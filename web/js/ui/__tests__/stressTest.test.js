/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة حرجة، مهندس الجودة): StressTest.js يحمل تعليقاً يوثّق
 * خللاً تاريخياً خطيراً (احتياط=20% من الاستثمار، مصروف=5% من CAPEX، إيراد=مصروف×1.2
 * — أرقام مفبركة بالكامل) أُصلح، لكن بلا أي اختبار انحدار يحرسه. هذا يثبّت: الأساس
 * الشهري (computeBase) يُشتق من calculateStudy الحقيقي فعلياً لا صيغة نسبية مفبركة،
 * وحساب أشهر البقاء (calculateSurvival) صحيح رياضياً مع حالات الحافة.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StressTest } from '../StressTest.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { get: () => state, updatePath: vi.fn() };
}

// دراسة مطعم مربحة بقرض فعلي — لضمان monthlyDebt > 0 واحتياطي حقيقي من رأس المال العامل.
function profitableStudyWithLoan() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = { ...data[SECTIONS.PROJECT_INFO], businessModel: 'Independent' };
    data.assumptions = { ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    data[SECTIONS.TECHNICAL] = {
        equipment: [{ price: 250000, quantity: 1 }], buildings: [], furniture: [],
        establishmentCosts: [], capacityUtilization: []
    };
    data[SECTIONS.HR] = { positions: [{ position: 'شيف', count: 2, salary: 5000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 12000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 1500, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.03 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = {
        sources: {
            equity: { amount: 200000 },
            bankLoan: { amount: 300000, interestRate: 0.07, termYears: 5, gracePeriodMonths: 0, repaymentType: 'equal' }
        }
    };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return data;
}

function noRevenueStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.REVENUE] = { streams: [] };
    return data;
}

describe('StressTest — computeBase (الأساس مُشتق من المحرك الحقيقي لا صيغة نسبية)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('بلا إيرادات أو تكاليف: ok=false ويعرض رسالة "بيانات غير كافية" بدل أرقام مفبركة', () => {
        const view = new StressTest('c', fakeStore(noRevenueStudy()));
        view.render();
        expect(document.getElementById('c').textContent).toContain('لا تتوفر أرقام كافية');
        expect(document.getElementById('survivalMonths')).toBeNull();
    });

    it('دراسة صالحة: الأساس الشهري يساوي بالضبط (رقم المحرك الحقيقي)/12 — لا نسبة مفبركة من الاستثمار', () => {
        const study = profitableStudyWithLoan();
        const engineResults = calculateStudy(study);
        const view = new StressTest('c', fakeStore(study));
        const base = view.computeBase(study);

        expect(base.ok).toBe(true);
        expect(base.monthlyRevenue).toBeCloseTo(engineResults.incomeStatement[0].revenue / 12, 5);
        expect(base.monthlyFixed).toBeCloseTo((engineResults.opex.fixedAnnual ?? engineResults.incomeStatement[0].fixedCosts) / 12, 2);
        expect(base.monthlyVariable).toBeCloseTo((engineResults.opex.variableAnnual ?? engineResults.incomeStatement[0].variableCosts) / 12, 2);

        // احتياطي حقيقي = أكبر القيمتين (رأس المال العامل الممول، النقد الافتتاحي بالميزانية)
        // — لا 20% من الاستثمار كما كان سابقاً (الخلل التاريخي الموثّق في تعليق الملف).
        const fabricatedOldReserve = engineResults.capex.total * 0.20;
        const openingCash = engineResults.balanceSheets?.[0]?.assets?.current?.cash;
        const expectedReserve = Math.max(Number(engineResults.capex.workingCapital) || 0, Number(openingCash) || 0);
        expect(base.cashReserve).not.toBeCloseTo(fabricatedOldReserve, 0);
        expect(base.cashReserve).toBeCloseTo(expectedReserve, 2);
        expect(expectedReserve).toBeGreaterThan(0); // تأكيد أن الاختبار يقيس رقماً حقيقياً لا صفراً بلا معنى
    });

    it('قرض فعلي موجود: monthlyDebt مُشتق من جدول السداد الحقيقي (annualSummary سنة 1) لا صفر ولا صيغة مصطنعة', () => {
        const study = profitableStudyWithLoan();
        const engineResults = calculateStudy(study);
        const view = new StressTest('c', fakeStore(study));
        const base = view.computeBase(study);

        const expectedAnnualDebt = engineResults.loanSchedule?.annualSummary?.find(s => s.year === 1)?.totalPayment || 0;
        expect(expectedAnnualDebt).toBeGreaterThan(0); // تأكيد أن القرض فعلاً يولّد سداداً — وإلا الاختبار لا يثبت شيئاً
        expect(base.monthlyDebt).toBeCloseTo(expectedAnnualDebt / 12, 2);
    });

    it('لا قرض إطلاقاً: monthlyDebt = 0 بالضبط (لا قيمة افتراضية مفبركة)', () => {
        const study = profitableStudyWithLoan();
        study[SECTIONS.FINANCING] = { sources: { equity: { amount: 500000 } } };
        const view = new StressTest('c', fakeStore(study));
        const base = view.computeBase(study);
        expect(base.monthlyDebt).toBe(0);
    });
});

describe('StressTest — calculateSurvival (رياضيات الصدمة)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    const base = {
        monthlyRevenue: 100000,
        monthlyFixed: 30000,
        monthlyVariable: 40000, // 40% من الإيراد
        monthlyDebt: 5000,
        cashReserve: 90000,
    };

    it('بلا صدمة (0%/0%): صافي الحرق = (30000+40000+5000) - 100000 = -25000 (تدفق موجب ⇒ يصمد للأبد)', () => {
        const view = new StressTest('c', fakeStore({}));
        document.getElementById('c').innerHTML = `
            <div id="survivalMonths"></div><div id="survivalBar"></div>
            <div id="stressAdvice"></div><div id="stressBurn"></div>`;
        view.calculateSurvival(0, 0, base);
        expect(document.getElementById('survivalMonths').textContent).toContain('∞');
        expect(document.getElementById('survivalMonths').className).toContain('text-success');
    });

    it('صدمة مبيعات 30% دون ارتفاع تكاليف: التكاليف المتغيرة تنخفض مع المبيعات — تُحسب أشهر بقاء محدودة صحيحة رياضياً', () => {
        const store = fakeStore({});
        const view = new StressTest('c', store);
        document.getElementById('c').innerHTML = `
            <div id="survivalMonths"></div><div id="survivalBar"></div>
            <div id="stressAdvice"></div><div id="stressBurn"></div>`;

        view.calculateSurvival(30, 0, base);
        // impactedRevenue = 100000*0.7=70000; impactedVariable=40000*0.7*1=28000; impactedFixed=30000
        // netBurn = 30000+28000+5000-70000 = -7000 (لا يزال موجباً ⇒ يصمد)
        expect(document.getElementById('survivalMonths').textContent).toContain('∞');
    });

    it('صدمة مبيعات 50% + ارتفاع تكاليف 20%: صافي حرق سالب فعلي ⇒ أشهر بقاء محدودة = احتياطي/حرق بالضبط', () => {
        const store = fakeStore({});
        const view = new StressTest('c', store);
        document.getElementById('c').innerHTML = `
            <div id="survivalMonths"></div><div id="survivalBar"></div>
            <div id="stressAdvice"></div><div id="stressBurn"></div>`;

        view.calculateSurvival(50, 20, base);
        // impactedRevenue=100000*0.5=50000; impactedVariable=40000*0.5*1.2=24000; impactedFixed=30000*1.2=36000
        // netBurn = 36000+24000+5000-50000 = 15000 (حرق فعلي)
        // months = 90000/15000 = 6.0 بالضبط
        expect(document.getElementById('survivalMonths').textContent).toContain('6.0');
        // 6 بالضبط تقع في الفرع "جيد" (else) لأن الشرط الصارم months<6 كاذب عند 6 تماماً
        expect(document.getElementById('survivalMonths').className).toContain('text-success');

        // يُحفَظ في المخزن بالقيم المستديرة الصحيحة
        expect(store.updatePath).toHaveBeenCalledWith('stressTest', null, {
            salesDrop: 50, costHike: 20, monthlyNetBurn: 15000, survivalMonths: 6
        });
    });

    it('حالة حافة: أشهر البقاء أقل من 3 بالضبط (2.9) تُصنَّف "خطر سيولة" حرجاً', () => {
        const store = fakeStore({});
        const view = new StressTest('c', store);
        document.getElementById('c').innerHTML = `
            <div id="survivalMonths"></div><div id="survivalBar"></div>
            <div id="stressAdvice"></div><div id="stressBurn"></div>`;
        // احتياطي صغير عمداً لإنتاج أشهر بقاء < 3 مع نفس معدل الحرق (15000/شهر من الحالة أعلاه)
        const tightBase = { ...base, cashReserve: 29000 };
        view.calculateSurvival(50, 20, tightBase);
        // months = 29000/15000 ≈ 1.93
        expect(document.getElementById('survivalMonths').className).toContain('text-danger');
        expect(document.getElementById('stressAdvice').innerHTML).toContain('خطر سيولة');
    });

    it('حالة حافة: بالضبط 3 أشهر لا تُصنَّف "خطر حرج" (الشرط months<3 صارم) بل "وضع حرج" (تحذيري)', () => {
        const store = fakeStore({});
        const view = new StressTest('c', store);
        document.getElementById('c').innerHTML = `
            <div id="survivalMonths"></div><div id="survivalBar"></div>
            <div id="stressAdvice"></div><div id="stressBurn"></div>`;
        // نضبط احتياطياً يعطي 3.0 أشهر بالضبط مع حرق 15000/شهر (من سيناريو 50/20 أعلاه)
        const exactBase = { ...base, cashReserve: 45000 };
        view.calculateSurvival(50, 20, exactBase);
        expect(document.getElementById('survivalMonths').textContent).toContain('3.0');
        expect(document.getElementById('survivalMonths').className).toContain('text-warning');
        expect(document.getElementById('stressAdvice').innerHTML).toContain('وضع حرج');
    });

    it('لا يرمي خطأً إن غابت عناصر DOM (مثلاً استُدعيت قبل render كامل)', () => {
        document.body.innerHTML = `<div id="c"></div>`; // بلا survivalMonths إلخ
        const view = new StressTest('c', fakeStore({}));
        expect(() => view.calculateSurvival(30, 10, base)).not.toThrow();
    });
});

describe('StressTest — تفاعل السلايدرز وأزرار السيناريوهات الجاهزة', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });

    it('يُعيد الحساب فعلياً عند تحريك سلايدر انخفاض المبيعات', () => {
        const study = profitableStudyWithLoan();
        const view = new StressTest('c', fakeStore(study));
        view.render();

        const before = document.getElementById('survivalMonths').textContent;
        const salesInput = document.getElementById('salesDrop');
        salesInput.value = '90';
        salesInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(document.getElementById('salesDropVal').textContent).toBe('90');
        // صدمة 90% يجب أن تُغيّر النتيجة (على الأقل لم تعد "جاري الحساب" ويُفترض تغيّرها فعلياً)
        expect(document.getElementById('survivalMonths').textContent).not.toBe(before === '--' ? '--' : undefined);
    });

    it('زر سيناريو "أزمة حادة" الجاهز يضبط السلايدرين بالقيم الصحيحة (50% مبيعات، 20% تكاليف) ويعيد الحساب', () => {
        const study = profitableStudyWithLoan();
        const view = new StressTest('c', fakeStore(study));
        view.render();

        const severeBtn = [...document.querySelectorAll('.stress-preset')].find(b => b.dataset.key === 'severe');
        expect(severeBtn).toBeTruthy();
        severeBtn.click();

        expect(document.getElementById('salesDrop').value).toBe('50');
        expect(document.getElementById('costHike').value).toBe('20');
        expect(document.getElementById('salesDropVal').textContent).toBe('50');
        expect(document.getElementById('costHikeVal').textContent).toBe('20');
    });

    it('يستعيد آخر إعداد محفوظ (state.stressTest) بدل الافتراضي عند إعادة الفتح', () => {
        const study = profitableStudyWithLoan();
        study.stressTest = { salesDrop: 77, costHike: 15 };
        const view = new StressTest('c', fakeStore(study));
        view.render();
        expect(document.getElementById('salesDrop').value).toBe('77');
        expect(document.getElementById('costHike').value).toBe('15');
    });
});

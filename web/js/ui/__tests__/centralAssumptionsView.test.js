/**
 * @vitest-environment jsdom
 *
 * خطة الاستفادة من تقرير اختبار محل الخضار (2026-07-12) — الدفعة 4، البند 1:
 * «لوحة افتراضات مركزية». يثبّت هذا الملف:
 * 1) الالتزام يقرأ/يكتب نفس مسارات المخزون الفعلية (revenue.streams، hr.positions،
 *    financing.sources، assumptions) عبر store.updatePath/update — لا نسخة ظل.
 * 2) الالتزام يحدث على change/blur فقط، لا على input (فخّ 0.1 الموثَّق في الخطة).
 * 3) تحويل النسبة المئوية↔كسر صحيح لكل حقل (معدل الفائدة/الخصم/التضخم) — فخّ
 *    isFractionPercentColumn الموثَّق (إدخال 30 يجب ألا يتحوّل إلى 3000%).
 * 4) محلّل الأرقام المتسامح (DynamicTable.parseLenientNumber) يُطبَّق فعلياً —
 *    أرقام هندية عربية تُحفظ صحيحة.
 * 5) calculateStudy يُستدعى مرة واحدة فقط بعد سلسلة تغييرات متتابعة (خنق 400ms)
 *    لا مرة لكل تغيير — يمنع التجمّد الموثَّق في البند 0.2 من الخطة.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const calculateStudySpy = vi.fn();
vi.mock('../../core/engine.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        calculateStudy: (...args) => {
            calculateStudySpy(...args);
            return actual.calculateStudy(...args);
        }
    };
});

const { CentralAssumptionsView } = await import('../CentralAssumptionsView.js');
const { SECTIONS, createEmptyStudy } = await import('../../core/schema.js');

/**
 * مخزن وهمي يطابق دلالات store.js الحقيقية (updatePath/update/getState/subscribe)
 * بأسلوب نسخ-عند-الكتابة — نفس نمط بقية اختبارات هذا المجلد (fakeStore محلي بدل
 * استيراد store.js الحقيقي لتفادي آثار جانبية: localStorage، مزامنة سحابية).
 */
function makeStore(initialState) {
    let state = initialState;
    const listeners = new Set();
    const notify = (section) => listeners.forEach(fn => fn(state, section));
    return {
        getState: () => state,
        get: () => state,
        updatePath(section, path, value) {
            if (!path) {
                state = { ...state, [section]: value };
                notify(section);
                return;
            }
            const keys = path.split('.');
            const sectionCopy = { ...(state[section] || {}) };
            let target = sectionCopy;
            for (let i = 0; i < keys.length - 1; i++) {
                target[keys[i]] = { ...(target[keys[i]] || {}) };
                target = target[keys[i]];
            }
            target[keys[keys.length - 1]] = value;
            state = { ...state, [section]: sectionCopy };
            notify(section);
        },
        update(section, data) {
            state = { ...state, [section]: data };
            notify(section);
        },
        subscribe(cb) {
            listeners.add(cb);
            return () => listeners.delete(cb);
        }
    };
}

function healthyStudy(overrides = {}) {
    const data = createEmptyStudy();
    data.assumptions = { ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0, rampUpMonths: 0 };
    data[SECTIONS.TECHNICAL] = { equipment: [{ price: 200000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    data[SECTIONS.HR] = { positions: [{ position: 'مدير المتجر', count: 2, salary: 6000, months: 12, nationality: 'saudi' }] };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 8000 }] };
    data[SECTIONS.MARKETING] = { campaigns: [] };
    data[SECTIONS.REVENUE] = { streams: [{ service: 'مبيعات البقالة', customersPerMonth: 3000, avgPrice: 25, variableCostRate: 0.32, growthRate: 0.05 }] };
    data[SECTIONS.SERVICES] = { items: [] };
    data[SECTIONS.FINANCING] = {
        sources: {
            equity: { amount: 150000 },
            bankLoan: { amount: 100000, interestRate: 0.08, termYears: 5, gracePeriodMonths: 0 },
            investors: { amount: 0 },
            governmentSupport: { amount: 0 }
        }
    };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [] };
    data[SECTIONS.LEGAL] = { licenses: [] };
    return { ...data, ...overrides };
}

function fireChange(el) {
    el.dispatchEvent(new Event('change', { bubbles: true }));
}
function fireInput(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
}
function fireFocusOut(el) {
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

describe('CentralAssumptionsView — التزام القيم بنفس مسارات المخزون الفعلية', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateStudySpy.mockClear();
    });
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('يعرض القيم الحالية لكل حقل عند الرسم الأولي (بلا نسخة ظل — نفس أرقام المخزن)', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        expect(document.querySelector('input[data-ca-field="customersPerMonth"]').value).toBe('3000');
        expect(document.querySelector('input[data-ca-field="avgPrice"]').value).toBe('25');
        expect(document.querySelector('input[data-ca-field="count"]').value).toBe('2');
        expect(document.getElementById('caEquityAmount').value).toBe('150000');
        expect(document.getElementById('caLoanAmount').value).toBe('100000');
        // معدل الفائدة 0.08 (كسر) يُعرض 8 (نسبة مئوية) — تحويل ×100
        expect(document.getElementById('caLoanInterestRate').value).toBe('8');
        // معدل الخصم 0.10 → 10، التضخم 0.02 → 2
        expect(document.getElementById('caDiscountRate').value).toBe('10');
        expect(document.getElementById('caInflationRate').value).toBe('2');
        expect(document.getElementById('caRampUpMonths').value).toBe('0');
    });

    it('تعديل «العملاء/شهر» ثم change يكتب في store.revenue.streams[i].customersPerMonth (نفس مسار OfferingView/Wizard)', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.querySelector('input[data-ca-field="customersPerMonth"]');
        input.value = '4500';
        fireChange(input);

        expect(store.getState().revenue.streams[0].customersPerMonth).toBe(4500);
        // صف آخر لم يُمس (لا استبدال كامل يبعث بيانات قديمة — لا يوجد إلا صف واحد هنا،
        // لكن نتحقق أن بقية حقول نفس الصف بقيت كما هي)
        expect(store.getState().revenue.streams[0].avgPrice).toBe(25);
        expect(store.getState().revenue.streams[0].service).toBe('مبيعات البقالة');
    });

    it('تعديل «متوسط السعر» يكتب في store.revenue.streams[i].avgPrice', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.querySelector('input[data-ca-field="avgPrice"]');
        input.value = '30';
        fireChange(input);

        expect(store.getState().revenue.streams[0].avgPrice).toBe(30);
    });

    it('تعديل عدد الموظفين يكتب في store.hr.positions[i].count', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.querySelector('input[data-ca-field="count"]');
        input.value = '5';
        fireChange(input);

        expect(store.getState().hr.positions[0].count).toBe(5);
    });

    it('لا يكتب للمخزن على حدث input — فقط على change (فخّ 0.1: كتابة لكل ضغطة مفتاح)', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.querySelector('input[data-ca-field="avgPrice"]');
        input.value = '999';
        fireInput(input); // input فقط، لا change

        expect(store.getState().revenue.streams[0].avgPrice).toBe(25); // لم يتغيّر بعد
    });

    it('أرقام هندية عربية (٥٠٠٠) تُحفظ صحيحة عبر parseLenientNumber — لا تتحوّل إلى 0', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.querySelector('input[data-ca-field="avgPrice"]');
        input.value = '٥٠';
        fireChange(input);

        expect(store.getState().revenue.streams[0].avgPrice).toBe(50);
    });
});

describe('CentralAssumptionsView — تحويل النسبة المئوية↔كسر (فخّ الوحدة)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateStudySpy.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('معدل الفائدة: إدخال 30 (نسبة) يُخزَّن 0.30 (كسر) لا 30 ولا 3000%', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.getElementById('caLoanInterestRate');
        input.value = '30';
        fireChange(input);

        expect(store.getState().financing.sources.bankLoan.interestRate).toBe(0.30);
    });

    it('معدل الخصم: إدخال 12 يُخزَّن 0.12', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.getElementById('caDiscountRate');
        input.value = '12';
        fireChange(input);

        expect(store.getState().assumptions.discountRate).toBe(0.12);
    });

    it('معدل التضخم: إدخال 3.5 يُخزَّن 0.035', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.getElementById('caInflationRate');
        input.value = '3.5';
        fireChange(input);

        expect(store.getState().assumptions.inflationRate).toBeCloseTo(0.035, 10);
    });

    it('فترة التصاعد (rampUpMonths) تُخزَّن كعدد أشهر خام (ليست نسبة/كسر) — إدخال 9 يُخزَّن 9 لا 0.09', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.getElementById('caRampUpMonths');
        input.value = '9';
        fireChange(input);

        expect(store.getState().assumptions.rampUpMonths).toBe(9);
    });

    it('قرض بفائدة 0% صريحة يُعرَض 0 لا 8 (rateOrDefault يحترم الصفر الصريح)', () => {
        const store = makeStore(healthyStudy({
            financing: { sources: { equity: { amount: 150000 }, bankLoan: { amount: 100000, interestRate: 0 } } }
        }));
        const view = new CentralAssumptionsView('c', store);
        view.render();

        expect(document.getElementById('caLoanInterestRate').value).toBe('0');
    });
});

describe('CentralAssumptionsView — مبالغ التمويل + إعادة حساب النسب', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateStudySpy.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('تعديل مبلغ التمويل الذاتي يكتب financing.sources.equity.amount ويعيد حساب النسب لكل المصادر (تطابق FinancingStructure.recalcSourcePercentages)', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.getElementById('caEquityAmount');
        input.value = '200000';
        fireChange(input);

        const sources = store.getState().financing.sources;
        expect(sources.equity.amount).toBe(200000);
        // النسب تُعاد حسابها لكل المصادر الأربعة من مجموعها (200000+100000=300000)
        expect(sources.equity.percentage).toBeCloseTo(66.7, 1);
        expect(sources.bankLoan.percentage).toBeCloseTo(33.3, 1);
    });

    it('فقد التركيز بـTab يلتزم بمبلغ التمويل حتى لو لم يطلق المتصفح change', () => {
        const store = makeStore(healthyStudy());
        const updateSpy = vi.spyOn(store, 'update');
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.getElementById('caEquityAmount');
        input.value = '64080';
        fireFocusOut(input);

        expect(store.getState().financing.sources.equity.amount).toBe(64080);
        expect(input.value).toBe('64080');

        // المسار الطبيعي في المتصفح قد يطلق change ثم focusout؛ لا نكرر الحفظ.
        fireChange(input);
        fireFocusOut(input);
        expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it('تعديل مبلغ القرض البنكي يكتب financing.sources.bankLoan.amount دون مسّ سعر الفائدة', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        const input = document.getElementById('caLoanAmount');
        input.value = '150000';
        fireChange(input);

        const bankLoan = store.getState().financing.sources.bankLoan;
        expect(bankLoan.amount).toBe(150000);
        expect(bankLoan.interestRate).toBe(0.08); // لم يتغيّر
    });
});

describe('CentralAssumptionsView — الحالة الفارغة وزر التنقّل', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateStudySpy.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('بلا مصادر إيرادات: يعرض إرشاداً وزر انتقال يستدعي onNavigateToStep بمعرّف قسم الإيرادات', () => {
        const store = makeStore(healthyStudy({ revenue: { streams: [] } }));
        const onNavigateToStep = vi.fn();
        const view = new CentralAssumptionsView('c', store, { onNavigateToStep });
        view.render();

        const btn = document.querySelector('[data-ca-goto="revenue"]');
        expect(btn).toBeTruthy();
        btn.click();
        expect(onNavigateToStep).toHaveBeenCalledWith(SECTIONS.REVENUE);
    });

    it('بلا وظائف: يعرض إرشاداً وزر انتقال يستدعي onNavigateToStep بمعرّف قسم الفريق', () => {
        const store = makeStore(healthyStudy({ hr: { positions: [] } }));
        const onNavigateToStep = vi.fn();
        const view = new CentralAssumptionsView('c', store, { onNavigateToStep });
        view.render();

        const btn = document.querySelector('[data-ca-goto="hr"]');
        expect(btn).toBeTruthy();
        btn.click();
        expect(onNavigateToStep).toHaveBeenCalledWith(SECTIONS.HR);
    });

    it('زر «إغلاق» يستدعي onExit', () => {
        const store = makeStore(healthyStudy());
        const onExit = vi.fn();
        const view = new CentralAssumptionsView('c', store, { onExit });
        view.render();

        document.getElementById('caCloseBtn').click();
        expect(onExit).toHaveBeenCalledTimes(1);
    });
});

describe('CentralAssumptionsView — خنق calculateStudy (لا استدعاء متكرر بلا حدّ)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        calculateStudySpy.mockClear();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('الرسم الأولي يحسب الأثر فوراً مرة واحدة (بلا انتظار الخنق)', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();

        expect(calculateStudySpy).toHaveBeenCalledTimes(1);
        const summary = document.getElementById('caImpactSummary');
        expect(summary.textContent).toContain('الدرجة');
    });

    it('سلسلة تغييرات متتابعة سريعة (Tab بين حقول) تُنتج تشغيلة واحدة فقط بعد الخنق، لا واحدة لكل تغيير', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();
        calculateStudySpy.mockClear(); // تجاهل تشغيلة الرسم الأولي

        const priceInput = document.querySelector('input[data-ca-field="avgPrice"]');
        const customersInput = document.querySelector('input[data-ca-field="customersPerMonth"]');
        const countInput = document.querySelector('input[data-ca-field="count"]');

        priceInput.value = '28'; fireChange(priceInput);
        vi.advanceTimersByTime(100);
        customersInput.value = '3200'; fireChange(customersInput);
        vi.advanceTimersByTime(100);
        countInput.value = '3'; fireChange(countInput);

        // لم يمر بعد 400ms منذ آخر تغيير — لا تشغيلة جديدة حتى الآن
        expect(calculateStudySpy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(400);

        // تشغيلة واحدة فقط رغم 3 تغييرات متتابعة
        expect(calculateStudySpy).toHaveBeenCalledTimes(1);
        // والقيم الثلاث فعلاً وصلت المخزن قبل التشغيلة (الالتزام غير مؤجَّل، الحساب وحده مؤجَّل)
        expect(store.getState().revenue.streams[0].avgPrice).toBe(28);
        expect(store.getState().revenue.streams[0].customersPerMonth).toBe(3200);
        expect(store.getState().hr.positions[0].count).toBe(3);
    });

    it('cleanup() يلغي المؤقّت المعلَّق ولا تشغيلة تُطلَق بعده', () => {
        const store = makeStore(healthyStudy());
        const view = new CentralAssumptionsView('c', store);
        view.render();
        calculateStudySpy.mockClear();

        const priceInput = document.querySelector('input[data-ca-field="avgPrice"]');
        priceInput.value = '99'; fireChange(priceInput);
        view.cleanup();

        vi.advanceTimersByTime(1000);
        expect(calculateStudySpy).not.toHaveBeenCalled();
    });
});

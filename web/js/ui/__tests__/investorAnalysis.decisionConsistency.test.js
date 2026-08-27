/**
 * @vitest-environment jsdom
 *
 * مسح ليلة 2026-08-26 — بلاغان مؤكَّدان على شاشة «تحليل الجدوى الاستثمارية»:
 *
 * (1) InvestorAnalysis.js:156 — calcInvestabilityScore تجمع نقاطها من المؤشرات وحدها
 *     ولا تقرأ results.decision ولا decisionReasons إطلاقاً، فتمنح 100% و«جاذبية جيدة —
 *     المشروع مؤهل لعرضه على مستثمرين مدروسين» لدراسة مصنع يرفضها المحرك بـREVISE
 *     وسببها الصريح «مصادر التمويل أقل من الاستثمار المطلوب بفجوة ٢٬٤٧٥٬٣٠٠ ريال».
 *     الشاشة المخصّصة لسؤال «هل أنا جاهز للمستثمر؟» كانت تخالف القرار الرسمي في
 *     الاتجاه المتفائل ولا تذكر الفجوة إطلاقاً.
 *
 * (2) InvestorAnalysis.js:186 — render() بلا أي بوابة كفاية بيانات: دراسة فارغة تماماً
 *     تحصل على عدّاد بـ5 و«جاذبية منخفضة» و✓ خضراء على «نموذج مالي مكتمل (إيرادات
 *     وتكاليف)» (لأن الشرط كان `typeof rev === 'number'` وrevenue = 0 عدد) وتوصية
 *     نصية — بينما الشاشات الأربع الأخرى تحجب.
 *
 * الأرقام أدناه مأخوذة من تشغيل calculateStudy الحقيقي (لا محاكاة) على نفس المدخلات.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InvestorAnalysis } from '../InvestorAnalysis.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state };
}

/**
 * دراسة مصنع من البلاغ: معدات 2,500,000 + 10 عمّال + إيجار 40 ألف/شهر
 * + إيراد 1500 عميل × 400 ريال، ومصادر التمويل المُدخَلة 1,200,000 فقط.
 * المؤشرات كلها ممتازة (NPV 11.6م، IRR 104%، استرداد 0.95 سنة) — أي أن كل بنود
 * الجاذبية الثمانية تتحقق — بينما القرار REVISE لفجوة التمويل.
 */
function underfundedFactory() {
    const d = createEmptyStudy();
    d[SECTIONS.PROJECT_INFO] = { ...d[SECTIONS.PROJECT_INFO], name: 'مصنع تعبئة', businessModel: 'Independent' };
    d.assumptions = { ...d.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 };
    d[SECTIONS.TECHNICAL] = { equipment: [{ price: 2500000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
    d[SECTIONS.HR] = { positions: [{ position: 'عامل', count: 10, salary: 4000, months: 12, nationality: 'nonSaudi' }] };
    d[SECTIONS.ADMINISTRATIVE] = { administrative: [{ name: 'إيجار', monthly: 40000 }] };
    d[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 1500, avgPrice: 400, variableCostRate: 0.30, growthRate: 0.03 }] };
    d[SECTIONS.FINANCING] = { sources: { equity: { amount: 1200000 } } };
    d.marketSizing = { tam: { value: 500000000 }, som: { value: 20000000 } };
    d.riskAnalysis = { risks: [{ name: 'منافسة', probability: 'medium', impact: 'high', mitigation: 'خطة تسعير' }] };
    return d;
}

function gaugeNumber() {
    const gauge = document.querySelector('.investability-gauge');
    return gauge ? Number(gauge.textContent.trim()) : null;
}

describe('InvestorAnalysis — درجة الجاذبية لا تخالف قرار المحرك في الاتجاه المتفائل', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('المحرك فعلاً يرفض هذه الدراسة بـREVISE وسببه فجوة التمويل (تثبيت المدخل)', () => {
        const results = calculateStudy(underfundedFactory());
        expect(results.decision).toBe('REVISE');
        expect(results.decisionReasons.join(' ')).toContain('مصادر التمويل أقل من الاستثمار المطلوب');
        // كل معايير الجاذبية الثمانية تتحقق فعلاً — فالدرجة الخام 100 بلا سقف القرار
        expect(results.indicators.npv).toBeGreaterThan(0);
        expect(results.indicators.irr).toBeGreaterThan(results.assumptionsApplied.discountRate);
        expect(results.indicators.paybackPeriod).toBeLessThan(results.assumptionsApplied.thresholds.maxPayback);
        expect(results.indicators.roi).toBeGreaterThan(results.assumptionsApplied.thresholds.minROI);
        expect(results.indicators.profitMargin).toBeGreaterThan(0.10);
    });

    it('لا تعرض «مؤهل لعرضه على مستثمرين» ولا 100% لدراسة قرارها REVISE', () => {
        new InvestorAnalysis('c', fakeStore(underfundedFactory())).render();
        const html = document.getElementById('c').innerHTML;

        expect(html).not.toContain('مؤهل لعرضه على مستثمرين');
        expect(gaugeNumber()).toBeLessThan(70);
    });

    it('تعرض قرار المحرك وسبب فجوة التمويل حرفياً بدل إخفائهما', () => {
        new InvestorAnalysis('c', fakeStore(underfundedFactory())).render();

        const banner = document.querySelector('.decision-banner');
        expect(banner).not.toBeNull();
        expect(banner.textContent).toContain('المشروع يحتاج مراجعة');

        const reasons = document.querySelector('.investor-decision-reasons');
        expect(reasons).not.toBeNull();
        expect(reasons.textContent).toContain('مصادر التمويل أقل من الاستثمار المطلوب');
    });

    it('قرار NO-GO يسقف الدرجة تحت «جاذبية متوسطة» أيضاً', () => {
        // نفس المصنع لكن بإيراد هزيل: المحرك يُصدر NO-GO، والمؤشرات كلها سالبة/ضعيفة.
        const d = underfundedFactory();
        d[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 5, avgPrice: 50, variableCostRate: 0.30, growthRate: 0 }] };
        const results = calculateStudy(d);
        expect(results.decision).toBe('NO-GO');

        new InvestorAnalysis('c', fakeStore(d)).render();
        expect(gaugeNumber()).toBeLessThan(50);
        expect(document.getElementById('c').innerHTML).not.toContain('مؤهل لعرضه على مستثمرين');
    });
});

describe('InvestorAnalysis — لا حكم على دراسة بلا بيانات كافية', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('دراسة فارغة (اسم مشروع فقط): لا عدّاد ولا درجة ولا توصية — رسالة «بيانات غير كافية»', () => {
        const empty = createEmptyStudy();
        empty[SECTIONS.PROJECT_INFO] = { ...empty[SECTIONS.PROJECT_INFO], name: 'مشروعي' };

        new InvestorAnalysis('c', fakeStore(empty)).render();
        const html = document.getElementById('c').innerHTML;

        expect(html).toContain('بيانات غير كافية');
        expect(document.querySelector('.investability-gauge')).toBeNull();
        expect(html).not.toContain('جاذبية منخفضة');
        expect(html).not.toContain('يُنصح بمراجعة التكاليف والإيرادات');
    });

    it('دراسة فارغة: لا ✓ خضراء على «نموذج مالي مكتمل» (القائمة نفسها لا تُرسم)', () => {
        const empty = createEmptyStudy();
        empty[SECTIONS.PROJECT_INFO] = { ...empty[SECTIONS.PROJECT_INFO], name: 'مشروعي' };

        new InvestorAnalysis('c', fakeStore(empty)).render();

        expect(document.querySelector('.investor-readiness-grid')).toBeNull();
        expect(document.getElementById('c').innerHTML).not.toContain('نموذج مالي مكتمل');
    });

    it('بند «نموذج مالي مكتمل» لا يتحقق بمجرد أن revenue عدد: إيراد صفر مع أصول ⟵ ○ لا ✓', () => {
        // مصدر إيراد بحقول صفرية + معدات: البوابة تمرّ (إيراد + تكلفة مُدخَلان شكلياً)
        // لكن إيراد السنة الأولى = 0 — الحالة التي كان `typeof rev === 'number'` يمنحها ✓.
        const d = createEmptyStudy();
        d[SECTIONS.PROJECT_INFO] = { ...d[SECTIONS.PROJECT_INFO], name: 'مشروعي' };
        d[SECTIONS.REVENUE] = { streams: [{ type: 'operating', customersPerMonth: 0, avgPrice: 0 }] };
        d[SECTIONS.TECHNICAL] = { ...d[SECTIONS.TECHNICAL], equipment: [{ price: 100000, quantity: 1 }] };
        expect(calculateStudy(d).incomeStatement[0].revenue).toBe(0);

        new InvestorAnalysis('c', fakeStore(d)).render();

        const item = [...document.querySelectorAll('.investor-readiness-grid > div')]
            .find(el => el.textContent.includes('نموذج مالي مكتمل'));
        expect(item).toBeDefined();
        expect(item.className).not.toContain('text-success');
        expect(item.textContent).toContain('○');
    });
});

/**
 * قياس المُدقِّق (2026-08-26) على نفس دراسة المصنع أعلاه، قرارها REVISE بفجوة تمويل
 * ٢٬٤٧٥٬٣٠٠ ريال: قائمة الجاهزية 8 من 8 بصنف text-success، وجدول «معايير المستثمر
 * مقابل مشروعك» 6 من 6 بصنف text-success، وفقرة التوصية تُنتج «ركّز على تعزيز النموذج
 * المالي وإكمال قائمة الجاهزية أعلاه…» — أي شاشة تمنح علامة اكتمال كاملة لدراسة يرفضها
 * المحرك، ثم تنصح بـ«إكمال القائمة» التي أعلنتها مكتملة للتوّ.
 *
 * الاختبارات تعدّ العناصر في DOM المُنتَج فعلياً (لا فحص وجود نص)، وتثبّت الثابتة
 * البنيوية: قرار غير GO ⟹ لا تكتمل أي من القائمتين خضراء.
 */
function readinessItems() {
    return [...document.querySelectorAll('.investor-readiness-grid > div')];
}

function criteriaRows() {
    return [...document.querySelectorAll('.investor-criteria-table tbody tr')];
}

describe('InvestorAnalysis — لا علامة اكتمال كاملة فوق قرار المحرك', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('قائمة الجاهزية: لا تكون كل بنودها خضراء لدراسة قرارها REVISE', () => {
        const d = underfundedFactory();
        expect(calculateStudy(d).decision).toBe('REVISE');
        new InvestorAnalysis('c', fakeStore(d)).render();

        const items = readinessItems();
        const green = items.filter(el => el.classList.contains('text-success'));
        expect(items.length).toBeGreaterThan(0);
        expect(green.length).toBeLessThan(items.length);
    });

    it('قائمة الجاهزية: كاسر المحرك (فجوة التمويل) يظهر بنداً غير أخضر بشرحه الرقمي', () => {
        new InvestorAnalysis('c', fakeStore(underfundedFactory())).render();

        const gapItem = readinessItems().find(el => el.textContent.includes('فجوة التمويل'));
        expect(gapItem).toBeDefined();
        expect(gapItem.classList.contains('text-success')).toBe(false);
        expect(gapItem.textContent).toContain('مصادر التمويل أقل من الاستثمار المطلوب');
    });

    it('جدول معايير المستثمر: لا تكون كل صفوفه خضراء لدراسة قرارها REVISE', () => {
        new InvestorAnalysis('c', fakeStore(underfundedFactory())).render();

        const rows = criteriaRows();
        const green = rows.filter(tr => tr.querySelector('td.text-success'));
        expect(rows.length).toBeGreaterThan(0);
        expect(green.length).toBeLessThan(rows.length);
        // الصف المُضاف من المحرك يحمل عنوان الكاسر وشرحه الرقمي
        const gapRow = rows.find(tr => tr.textContent.includes('فجوة التمويل'));
        expect(gapRow).toBeDefined();
        expect(gapRow.querySelector('td.text-success')).toBeNull();
    });

    it('فقرة التوصية تذكر كاسر المحرك ولا تنصح بإكمال قائمة أعلنتها مكتملة', () => {
        new InvestorAnalysis('c', fakeStore(underfundedFactory())).render();

        const rec = [...document.querySelectorAll('#c .card')]
            .find(el => el.textContent.includes('توصية مبنية على أرقامك'));
        expect(rec).toBeDefined();
        expect(rec.textContent).toContain('فجوة التمويل');
        expect(rec.textContent).toContain('مصادر التمويل أقل من الاستثمار المطلوب');
        expect(rec.textContent).not.toContain('ركّز على');
        expect(rec.textContent).not.toContain('إكمال قائمة الجاهزية');
    });

    it('التخفيض مُوجَّه لا شامل: دراسة بلا أي كاسر مقياسي تسقط بندَ القرار وحده', () => {
        // نفس المصنع ممولاً بالكامل ومع مصدر TAM موثَّق: decisionExplanation.issues فارغة
        // تماماً، والقرار REVISE من بوابة «المؤشرات مرتفعة بشكل غير معتاد» وحدها — وهي
        // بوابة لا تُمثَّل في issues إطلاقاً. المتوقع: بند القرار فقط غير أخضر.
        const d = underfundedFactory();
        d[SECTIONS.FINANCING] = { sources: { equity: { amount: 5000000 } } };
        d.marketSizing = { tam: { value: 500000000, source: 'الهيئة العامة للإحصاء 2025' }, som: { value: 20000000 } };
        const results = calculateStudy(d);
        expect(results.decision).toBe('REVISE');
        expect(results.decisionExplanation.issues).toHaveLength(0);

        new InvestorAnalysis('c', fakeStore(d)).render();
        const items = readinessItems();
        const notGreen = items.filter(el => !el.classList.contains('text-success'));
        expect(notGreen).toHaveLength(1);
        expect(notGreen[0].textContent).toContain('قرار المحرك النهائي');
        expect(notGreen[0].textContent).toContain('المؤشرات مرتفعة بشكل غير معتاد');
    });
});

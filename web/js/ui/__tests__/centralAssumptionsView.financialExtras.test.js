/**
 * @vitest-environment jsdom
 *
 * إضافات دفعة "المالية" على لوحة الافتراضات المركزية (2026-07-16):
 * مراجع تمويل ثابتة، تنبيهات معايير القطاع، تورنيدو مصغّر، حاسبة رأس مال عامل،
 * سلايدر زكاة/ضريبة حي، أفضل مزيج تمويل، معاينة مونت كارلو سريعة، اختصار تصدير
 * بنكي، وسجل افتراضات/قرار. يعيد استخدام نفس fakeStore/healthyStudy المحليين
 * لتفادي آثار جانبية (localStorage، مزامنة سحابية) — مطابقة لملف الاختبار الشقيق.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../ExportMenu.js', () => ({
    ExportMenu: vi.fn().mockImplementation(() => ({ open: vi.fn() }))
}));

const { CentralAssumptionsView } = await import('../CentralAssumptionsView.js');
const { ExportMenu } = await import('../ExportMenu.js');
const { SECTIONS, createEmptyStudy } = await import('../../core/schema.js');

function makeStore(initialState, versionHistory = []) {
    let state = initialState;
    const listeners = new Set();
    const notify = (section) => listeners.forEach(fn => fn(state, section));
    return {
        getState: () => state,
        get: () => state,
        updatePath(section, path, value) {
            if (!path) { state = { ...state, [section]: value }; notify(section); return; }
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
        update(section, data) { state = { ...state, [section]: data }; notify(section); },
        subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
        getVersionHistory: () => versionHistory
    };
}

function healthyStudy(overrides = {}) {
    const data = createEmptyStudy();
    data.assumptions = {
        ...data.assumptions, projectionYears: 5, discountRate: 0.10, inflationRate: 0.02,
        taxRate: 0.20, foreignOwnershipRate: 0, rampUpMonths: 0,
        workingCapitalPolicy: { dsoDays: 30, dpoDays: 15, dioDays: 20 }
    };
    data[SECTIONS.TECHNICAL] = { equipment: [{ type: 'capital', amount: 200000 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] };
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

function fireChange(el) { el.dispatchEvent(new Event('change', { bubbles: true })); }

describe('CentralAssumptionsView — مراجع ثابتة ورأس المال العامل', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('يعرض نطاقات فائدة مرجعية وعلاوة مخاطر السوق', () => {
        const store = makeStore(healthyStudy());
        new CentralAssumptionsView('c', store).render();
        expect(document.getElementById('caReferenceRows').textContent).toContain('صندوق التنمية الصناعية');
        expect(document.getElementById('caReferenceRows').textContent).toContain('8%');
    });

    it('يحسب الحد الأدنى لرأس المال العامل من دورة التحويل النقدي ويطبّقه عند الضغط', () => {
        const store = makeStore(healthyStudy());
        new CentralAssumptionsView('c', store).render();
        // (30 + 20 - 15) / 30 = 1.166... شهر
        const btn = document.getElementById('caApplyWorkingCapital');
        expect(btn).toBeTruthy();
        btn.click();
        expect(store.getState().assumptions.workingCapitalMonths).toBeCloseTo(1.2, 1);
    });
});

describe('CentralAssumptionsView — سلايدر الزكاة/الضريبة', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('يعرض القيم الحالية لنسبة الملكية الأجنبية ومعدل الضريبة', () => {
        const store = makeStore(healthyStudy());
        new CentralAssumptionsView('c', store).render();
        expect(document.getElementById('caForeignOwnershipRate').value).toBe('0');
        expect(document.getElementById('caTaxRate').value).toBe('20');
    });

    it('تعديل معدل الضريبة يكتب assumptions.taxRate كسراً لا نسبة مئوية', () => {
        const store = makeStore(healthyStudy());
        new CentralAssumptionsView('c', store).render();
        const input = document.getElementById('caTaxRate');
        input.value = '15';
        fireChange(input);
        expect(store.getState().assumptions.taxRate).toBe(0.15);
    });

    it('يعرض زكاة/ضريبة/صافي ربح السنة الأولى من نتائج المحرك الفعلية بعد الحساب الأولي', () => {
        const store = makeStore(healthyStudy());
        new CentralAssumptionsView('c', store).render();
        const text = document.getElementById('caZakatTaxResult').textContent;
        expect(text).toContain('زكاة');
        expect(text).toContain('ضريبة');
    });
});

describe('CentralAssumptionsView — تنبيهات المعايير والتورنيدو المصغّر', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('لا يرمي عند غياب إيرادات ويترك تنبيهات المعايير فارغة', () => {
        const store = makeStore(healthyStudy({ revenue: { streams: [] } }));
        expect(() => new CentralAssumptionsView('c', store).render()).not.toThrow();
        expect(document.getElementById('caBenchmarkAlerts').innerHTML).toBe('');
    });

    it('يعرض أكثر 3 متغيرات تأثيراً على NPV بعد الحساب الأولي', () => {
        const store = makeStore(healthyStudy());
        new CentralAssumptionsView('c', store).render();
        const slot = document.getElementById('caQuickTornado');
        expect(slot.querySelectorAll('.ca-tornado-row').length).toBeGreaterThan(0);
    });
});

describe('CentralAssumptionsView — أفضل مزيج تمويل ومعاينة مونت كارلو', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('زر "أفضل مزيج دين/ملكية" يعرض نتيجة تحتوي NPV بلا رمي', () => {
        const store = makeStore(healthyStudy());
        new CentralAssumptionsView('c', store).render();
        document.getElementById('caRunOptimalMix').click();
        expect(document.getElementById('caOptimalMixResult').textContent).toContain('أفضل مزيج');
    });

    it('زر "معاينة مونت كارلو سريعة" يعرض P10/P50/P90 بلا رمي', () => {
        const store = makeStore(healthyStudy());
        new CentralAssumptionsView('c', store).render();
        document.getElementById('caRunMiniMonteCarlo').click();
        const text = document.getElementById('caMiniMonteCarloResult').textContent;
        expect(text).toContain('P10');
        expect(text).toContain('P90');
    });
});

describe('CentralAssumptionsView — اختصار التصدير البنكي وسجل الافتراضات', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div><div id="exportMenuOverlay"></div>`;
        ExportMenu.mockClear();
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('زر "افتح قائمة التصدير" ينشئ ExportMenu ويفتحها', () => {
        const store = makeStore(healthyStudy());
        new CentralAssumptionsView('c', store).render();
        document.getElementById('caOpenBankExport').click();
        expect(ExportMenu).toHaveBeenCalledWith('exportMenuOverlay', store);
    });

    it('بلا سجل: يعرض رسالة "لا يوجد سجل بعد"', () => {
        const store = makeStore(healthyStudy(), []);
        new CentralAssumptionsView('c', store).render();
        expect(document.getElementById('caHistoryPanel').textContent).toContain('لا يوجد سجل بعد');
    });

    it('مع سجل: يعرض لقطات ويسترجع افتراضات لقطة محددة دون مسّ بقية الحالة', () => {
        const oldSnapshot = { timestamp: Date.now() - 60000, state: healthyStudy({ assumptions: { ...healthyStudy().assumptions, discountRate: 0.18 } }) };
        const store = makeStore(healthyStudy(), [oldSnapshot]);
        new CentralAssumptionsView('c', store).render();

        const restoreBtn = document.querySelector('.ca-restore-assumptions');
        expect(restoreBtn).toBeTruthy();
        restoreBtn.click();

        expect(store.getState().assumptions.discountRate).toBe(0.18);
        // بقية الحالة (الإيرادات) لم تُمسّ رغم أن اللقطة القديمة قد تحمل نسخة مختلفة منها
        expect(store.getState().revenue.streams[0].service).toBe('مبيعات البقالة');
    });
});

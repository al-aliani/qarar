/**
 * @vitest-environment jsdom
 *
 * إضافات دفعة "التسويق" على شاشة تحجيم السوق (2026-07-17): شارات مصداقية TAM/SAM/SOM
 * (SaudiMarketEngine.analyzeSaudiMarket كانت تحسبها فعلياً بلا عرض بصري)، تنبؤ الطلب،
 * مقارنة مواقع بديلة، جدول "نحن مقابل أقرب 3 منافسين"، شخصيات عملاء، وحالة نمو
 * السوشال ميديا (موصّل غير مُفعّل بعد).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../services/connectors/OverpassConnector.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, overpassCompetitorsConnector: vi.fn().mockResolvedValue({ value: { count: 3, sample: [] }, provenance: 'sourced' }) };
});

const { MarketAnalysis } = await import('../MarketAnalysis.js');

function fakeStore(initialState) {
    let state = initialState;
    return {
        getState: () => state,
        update: (section, value) => { state = { ...state, [section]: value }; }
    };
}

async function flush() {
    await new Promise(r => setTimeout(r, 0));
    await new Promise(r => setTimeout(r, 0));
}

describe('MarketAnalysis — شارات المصداقية وتنبؤ الطلب', () => {
    let container;
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; container = document.getElementById('c'); });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('يعرض شارات مصدر (sourced/assumption) لعناصر TAM/SAM/SOM', async () => {
        const store = fakeStore({ projectInfo: { city: 'الرياض' }, marketing: { competitors: [] }, marketSizing: {} });
        const view = new MarketAnalysis('c', store);
        view.render(0);
        await flush();
        const badges = container.querySelector('#marketProvenanceBadges');
        expect(badges.textContent).toContain('عدد السكان');
    });

    it('يعرض تنبؤ طلب لمدينة معروفة', async () => {
        const store = fakeStore({ projectInfo: { city: 'الرياض' }, marketing: { competitors: [] }, marketSizing: {} });
        const view = new MarketAnalysis('c', store);
        view.render(0);
        await flush();
        const box = container.querySelector('#demandForecastBox');
        expect(box.textContent).toContain('سنة +');
    });

    it('بلا مدينة: يعرض رسالة إرشادية بدل تنبؤ فارغ', async () => {
        const store = fakeStore({ projectInfo: {}, marketing: { competitors: [] }, marketSizing: {} });
        const view = new MarketAnalysis('c', store);
        view.render(0);
        await flush();
        expect(container.querySelector('#demandForecastBox').textContent).toContain('اختر مدينة');
    });
});

describe('MarketAnalysis — جدول أقرب 3 منافسين', () => {
    let container;
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; container = document.getElementById('c'); });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('يعرض جدول مقارنة عند وجود منافسين', async () => {
        const store = fakeStore({
            projectInfo: { city: 'الرياض' },
            marketing: { competitors: [{ name: 'منافس أ', marketShare: 20, advantage: 'موقع' }] },
            marketSizing: {}
        });
        const view = new MarketAnalysis('c', store);
        view.render(0);
        await flush();
        const table = container.querySelector('#marketComparisonTable');
        expect(table.textContent).toContain('منافس أ');
        expect(table.textContent).toContain('مشروعك');
    });

    it('بلا منافسين: لا يعرض جدولاً فارغاً', async () => {
        const store = fakeStore({ projectInfo: { city: 'الرياض' }, marketing: { competitors: [] }, marketSizing: {} });
        const view = new MarketAnalysis('c', store);
        view.render(0);
        await flush();
        expect(container.querySelector('#marketComparisonTable').innerHTML.trim()).toBe('');
    });
});

describe('MarketAnalysis — مقارنة المواقع وشخصيات العملاء', () => {
    let container;
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; container = document.getElementById('c'); });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('توليد الشخصيات يعرض بطاقات غير فارغة لمشروع بمدينة/قطاع معروفين', async () => {
        const store = fakeStore({ projectInfo: { city: 'الرياض', sector: 'مقهى مختص' }, marketing: { competitors: [] }, marketSizing: {} });
        const view = new MarketAnalysis('c', store);
        view.render(0);
        await flush();
        container.querySelector('#btnGeneratePersonas').click();
        const result = container.querySelector('#customerPersonasResult');
        expect(result.children.length).toBeGreaterThan(0);
    });

    it('مقارنة المواقع بلا مدن مكتوبة: لا تُشغَّل ولا ترمي', async () => {
        const store = fakeStore({ projectInfo: { city: 'الرياض' }, marketing: { competitors: [] }, marketSizing: {} });
        const view = new MarketAnalysis('c', store);
        view.render(0);
        await flush();
        expect(() => container.querySelector('#btnRunSiteComparison').click()).not.toThrow();
    });
});

describe('MarketAnalysis — حالة نمو السوشال ميديا (موصّل غير مُفعّل)', () => {
    let container;
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; container = document.getElementById('c'); });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('يعرض رسالة تعذّر واضحة بدل رقم مختلَق', async () => {
        const store = fakeStore({ projectInfo: { city: 'الرياض' }, marketing: { competitors: [] }, marketSizing: {} });
        const view = new MarketAnalysis('c', store);
        view.render(0);
        await flush();
        const box = container.querySelector('#socialGrowthBox');
        expect(box.textContent).not.toBe('جارٍ التحقق...');
        expect(box.textContent.length).toBeGreaterThan(0);
    });
});

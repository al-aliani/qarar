/**
 * @vitest-environment jsdom
 *
 * دفعة 6 (2026-07-09): FinancialDashboard.js كان آخر شاشة تحمل إيموجي خام
 * (✅ ❌ 💡 🚀 ⚠️ ✋ 📊 👥 🏠 🇸🇦) بينما بقية الشاشات (ReportBuilderView،
 * Timeline، DecisionDashboard) هاجرت بالفعل لنمط الأيقونات الموحّد
 * <svg class="ic"><use href="#i-..."/></svg>. هذا الاختبار يغطي كل سياق كان
 * يظهر فيه إيموجي خام سابقاً ويتأكد من عدم وجوده + وجود الأيقونة البديلة —
 * بما في ذلك المسارات التي تُحدَّث ديناميكياً عبر innerHTML (وليس فقط قالب
 * الرسم الأول) لتفادي فخ textContent الموثّق سابقاً في هذه الحملة.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FinancialDashboard } from '../FinancialDashboard.js';
import { SmartAdvisor } from '../../services/SmartAdvisor.js';
import { SECTIONS } from '../../core/schema.js';

// كل الرموز التعبيرية الخام التي كانت موجودة في هذا الملف قبل الدفعة 6
const RAW_EMOJI_RE = /[✅❌💡🚀⚠️✋📊👥🏠🇸🇦]/u;

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, notify: () => {} };
}

function buildStudy(overrides = {}) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [{ price: 250000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 17000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 400, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] },
        ...overrides
    };
}

describe('FinancialDashboard — دفعة 6: تحويل كل الإيموجي الخام المتبقي لأيقونات SVG', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

    it('حالة «لا توجد بيانات إيرادات»: أيقونة i-warning بدل ⚠️', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy({ [SECTIONS.REVENUE]: { streams: [] } })));
        dashboard.render();
        const html = document.getElementById('c').innerHTML;
        expect(html).toContain('href="#i-warning"');
        expect(html).not.toMatch(RAW_EMOJI_RE);
    });

    it('العرض المبسّط «هل المشروع ربح؟»: أيقونة i-check عند صافي ربح موجب، بدل ✅', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        dashboard.render();
        const html = document.getElementById('c').innerHTML;
        // نتحقق من النص + الأيقونة معاً (بدل تثبيت صيغة إغلاق وسم <use> التي تختلف
        // بين محركات التصيير: self-closing مقابل <use ...></use> بعد التطبيع من jsdom).
        expect(html).toMatch(/نعم <svg class="ic"[^>]*><use href="#i-check"/);
        expect(html).toContain('href="#i-check"');
    });

    it('تلميح «اسأل عن رقمك» الثابت: أيقونة i-lightbulb بدل 💡 في القالب الأولي', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        dashboard.render();
        const html = document.getElementById('c').innerHTML;
        expect(html).toMatch(/<svg class="ic"[^>]*><use href="#i-lightbulb"[^>]*>[^]*?<\/svg> يمكنك كتابة طلب بلغة عادية/);
    });

    it('إجابة «اسأل عن رقمك» (بلا سؤال): أيقونة i-lightbulb حقيقية داخل innerHTML المُحدَّث ديناميكياً — لا فخ textContent', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        dashboard.render();
        const askBtn = document.getElementById('askAboutNumbersBtn');
        const askAnswer = document.getElementById('askAboutNumbersAnswer');
        expect(askBtn).toBeTruthy();
        askBtn.click();
        // إن كانت الأيقونة قد أُدرجت عبر textContent بدل innerHTML، سيُطبع كود الـ<svg>
        // كنص خام هارِب ولن يُنشئ عنصر <svg> فعلياً داخل الـDOM.
        const iconEl = askAnswer.querySelector('svg.ic use[href="#i-lightbulb"]');
        expect(iconEl).toBeTruthy();
        expect(askAnswer.innerHTML).not.toMatch(RAW_EMOJI_RE);
        expect(askAnswer.textContent).not.toContain('<svg');
    });

    it('إجابة «اسأل عن رقمك» (بسؤال مكتوب): نفس الأيقونة الحقيقية داخل innerHTML المُحدَّث', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        dashboard.render();
        const askInput = document.getElementById('askAboutNumbersInput');
        const askBtn = document.getElementById('askAboutNumbersBtn');
        const askAnswer = document.getElementById('askAboutNumbersAnswer');
        askInput.value = 'هل مشروعي مجدٍ إذا زاد الإيجار 20%؟';
        askBtn.click();
        const iconEl = askAnswer.querySelector('svg.ic use[href="#i-lightbulb"]');
        expect(iconEl).toBeTruthy();
        expect(askAnswer.innerHTML).not.toMatch(RAW_EMOJI_RE);
    });

    it('renderAdvisorInsights: بلا ملاحظات سلبية ⇒ أيقونة i-rocket بدل 🚀', () => {
        vi.spyOn(SmartAdvisor, 'analyze').mockReturnValue({
            ratios: { cogs: 0.3, labor: 0.2, rent: 0.1, marketing: 0, profit: 0.15 },
            insights: []
        });
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        const html = dashboard.renderAdvisorInsights({}, {});
        expect(html).toContain('href="#i-rocket"');
        expect(html).not.toMatch(RAW_EMOJI_RE);
    });

    it('renderAdvisorInsights: تغطي أيقونات البطاقات الثلاث (i-warning حرج/i-hand-stop تحذير/i-check نجاح) + i-lightbulb للحل المقترح + i-chart/i-users/i-home لشريط النسب', () => {
        vi.spyOn(SmartAdvisor, 'analyze').mockReturnValue({
            ratios: { cogs: 0.35, labor: 0.25, rent: 0.12, marketing: 0.02, profit: 0.08 },
            insights: [
                { type: 'critical', category: 'جدوى', message: 'صافي القيمة الحالية غير إيجابي.', action: 'راجع الافتراضات.' },
                { type: 'warning', category: 'عائد', message: 'العائد منخفض.', action: 'حسّن الهوامش.' },
                { type: 'success', category: 'عام', message: 'المؤشرات ضمن النطاق.', action: 'استمر.' }
            ]
        });
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        const html = dashboard.renderAdvisorInsights({}, {});

        expect(html).toContain('href="#i-warning"');
        expect(html).toContain('href="#i-hand-stop"');
        expect(html).toContain('href="#i-check"');
        expect(html).toContain('href="#i-lightbulb"');
        expect(html).toContain('href="#i-chart"');
        expect(html).toContain('href="#i-users"');
        expect(html).toContain('href="#i-home"');
        expect(html).not.toMatch(RAW_EMOJI_RE);
    });

    it('renderImprovementSuggestions: أيقونة i-lightbulb بدل 💡 عند كل اقتراح تحسين', () => {
        vi.spyOn(SmartAdvisor, 'analyze').mockReturnValue({
            ratios: { cogs: 0.3, labor: 0.2, rent: 0.1, marketing: 0, profit: 0.15 },
            insights: [
                { type: 'warning', category: 'عائد', message: 'العائد منخفض.', action: 'حسّن الهوامش.' }
            ]
        });
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        const html = dashboard.renderImprovementSuggestions({}, {});
        expect(html).toContain('href="#i-lightbulb"');
        expect(html).not.toMatch(RAW_EMOJI_RE);
    });

    it('renderLocalizationBreakdown: أيقونة i-flag-sa بدل 🇸🇦', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        const opex = { fixed: [{ name: 'التأمينات الاجتماعية (GOSI)', autoCalculated: true, monthly: 500 }] };
        const html = dashboard.renderLocalizationBreakdown(opex);
        expect(html).toContain('href="#i-flag-sa"');
        expect(html).not.toMatch(RAW_EMOJI_RE);
    });

    it('renderAuditorPanel: يغطي الحالات الثلاث لمصالحة الطاقة (i-x مستحيلة / i-warning ضيّقة / i-check قابلة للتحقيق)', () => {
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));

        const exceededHtml = dashboard.renderAuditorPanel({
            capacityCheck: { exceeded: true, utilizationOfMax: 1.2, plannedUnitsPerMonth: 600, maxUnitsPerMonth: 500 },
            tornado: [], indicators: {}
        });
        expect(exceededHtml).toContain('href="#i-x"');
        expect(exceededHtml).not.toMatch(RAW_EMOJI_RE);

        const tightHtml = dashboard.renderAuditorPanel({
            capacityCheck: { exceeded: false, utilizationOfMax: 0.9, plannedUnitsPerMonth: 450, maxUnitsPerMonth: 500 },
            tornado: [], indicators: {}
        });
        expect(tightHtml).toContain('href="#i-warning"');
        expect(tightHtml).not.toMatch(RAW_EMOJI_RE);

        const okHtml = dashboard.renderAuditorPanel({
            capacityCheck: { exceeded: false, utilizationOfMax: 0.6, plannedUnitsPerMonth: 300, maxUnitsPerMonth: 500 },
            tornado: [], indicators: {}
        });
        expect(okHtml).toContain('href="#i-check"');
        expect(okHtml).not.toMatch(RAW_EMOJI_RE);
    });

    it('الرسم الكامل render(): الأقسام المملوكة مباشرة لـFinancialDashboard خالية من الإيموجي القديم', () => {
        // نطاق محدود للأقسام التي يبنيها FinancialDashboard.js نفسه؛ يستثني عمداً
        // أقساماً مفوَّضة لمكوّنات أخرى (ScenarioSwitcher.js، BenchmarkingView.js) والتي
        // قد تحمل إيموجي خاصاً بها خارج نطاق هذه المهمة تماماً.
        const dashboard = new FinancialDashboard('c', fakeStore(buildStudy()));
        dashboard.render();
        const root = document.getElementById('c');
        const ownedSelectors = ['#simpleViewPanel', '#askAboutNumbersPanel', '#advisorInsights', '[aria-label="اقتراحات التحسين"]', '#localizationBreakdown', '#auditorPanel'];
        let checkedAtLeastOne = false;
        ownedSelectors.forEach(sel => {
            const el = root.querySelector(sel);
            if (!el) return;
            checkedAtLeastOne = true;
            expect(el.innerHTML).not.toMatch(RAW_EMOJI_RE);
        });
        expect(checkedAtLeastOne).toBe(true);
    });
});

/**
 * @vitest-environment jsdom
 *
 * دفعة 7 — إصلاحان في نفس المهمة:
 *
 * (أ) لا صنف CSS موحّد لعنوان الصفحة بين شاشات النتائج — Timeline.js استخدم فئات
 * Tailwind-utility خام (text-xl font-bold)، ReportBuilderView.js صنفاً مخصصاً
 * (report-builder-title)، وDecisionDashboard.js صنف card-title العام (المستخدم في
 * 29 موضعاً آخر لعناوين بطاقات صغيرة، فلا يصح تعديل تعريفه). الإصلاح: صنف مشترك
 * جديد .page-title (معرَّف في web/css/components.css بنفس قيم report-builder-title:
 * font-size 1.5rem؛ font-weight 700؛ margin-bottom var(--s-2)) مطبَّق على الثلاثة.
 *
 * (ب) DecisionDashboard.js كان يحتوي 6 إيموجي خام لم تُهاجَر لنظام SVG-sprite رغم
 * أن الشاشة "هُجِّرت بالكامل" في دفعة سابقة: ⚠️ (تحذير لا بيانات إيرادات)، ✓ (bullet
 * في قائمة عوامل الجاهزية)، ✕ (زر إغلاق مودال الملخص التنفيذي)، و✅/❌/🤔 (أيقونات
 * توصية GO/NOGO/REVIEW في calculateReadiness). الآن تستخدم جميعها
 * <svg class="ic"><use href="#i-..."/></svg> من نفس مكتبة index.html.
 * ملاحظة: لـ🤔 (يحتاج مراجعة) لا يوجد رمز "تفكير/تردد" مطابق دلالياً في القائمة
 * الحالية؛ استُخدم i-warning (أقرب بديل: تنبيه يستدعي انتباهاً) بدل إضافة رمز جديد،
 * كما نصّت التعليمات صراحة على قبول هذا البديل.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { DecisionDashboard } from '../DecisionDashboard.js';
import { Timeline } from '../Timeline.js';
import { ReportBuilderView } from '../ReportBuilderView.js';
import { SECTIONS } from '../../core/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS_CSS_PATH = path.join(__dirname, '..', '..', '..', 'css', 'components.css');

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, notify: () => {} };
}

// دراسة مطعم كاملة تُحسب فعلياً عبر المحرك (calculateStudy) بلا أخطاء — لتفعيل
// المسار الكامل لـ render() (لا مسار "لا بيانات إيرادات" المختصر).
function createRenderableStudy() {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: [{ price: 250000, quantity: 1 }],
            buildings: [], furniture: [{ price: 50000, quantity: 1 }],
            establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: {
            positions: [
                { position: 'مدير', count: 1, salary: 9000, months: 12, nationality: 'saudi' },
                { position: 'موظف', count: 3, salary: 4000, months: 12, nationality: 'saudi' }
            ]
        },
        [SECTIONS.LOGISTICS]: { logistics: [{ name: 'نقل', monthly: 2000 }] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 15000 }] },
        [SECTIONS.MARKETING]: { campaigns: [{ name: 'إعلانات', monthly: 3000 }] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 1200, avgPrice: 100, variableCostRate: 0.30, growthRate: 0.03 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [{ name: 'رخصة', cost: 5000 }] },
        [SECTIONS.STRATEGIC]: { swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] } }
    };
}

describe('العلة أ — صنف .page-title موحّد بين Timeline/ReportBuilderView/DecisionDashboard', () => {
    it('.page-title معرَّف في components.css بنفس القيم البصرية لـ .report-builder-title', () => {
        const css = fs.readFileSync(COMPONENTS_CSS_PATH, 'utf-8');
        const match = css.match(/\.page-title[^{]*\{([^}]*)\}/);
        expect(match).not.toBeNull();
        expect(match[1]).toMatch(/font-size:\s*1\.5rem/);
        expect(match[1]).toMatch(/font-weight:\s*700/);
        expect(match[1]).toMatch(/margin-bottom:\s*var\(--s-2\)/);
    });

    it('Timeline.js: عنوان القسم يستخدم page-title بدل فئات Tailwind الخام (text-xl font-bold)', () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const timeline = new Timeline('c', fakeStore({ projectInfo: {}, [SECTIONS.TIMELINE]: { activities: [] } }));
        timeline.render();

        const h2 = document.querySelector('.section-header h2');
        expect(h2).not.toBeNull();
        expect(h2.classList.contains('page-title')).toBe(true);
        expect(h2.classList.contains('text-xl')).toBe(false);
        expect(h2.classList.contains('font-bold')).toBe(false);
        document.body.innerHTML = '';
    });

    it('ReportBuilderView.js: العنوان يحمل page-title إضافةً إلى report-builder-title (دون حذفه)', () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const view = new ReportBuilderView('c', fakeStore({}));
        view.render();

        const h2 = document.querySelector('.report-builder-header h2');
        expect(h2).not.toBeNull();
        expect(h2.classList.contains('page-title')).toBe(true);
        expect(h2.classList.contains('report-builder-title')).toBe(true);
        document.body.innerHTML = '';
    });

    it('DecisionDashboard.js (حالة "لا بيانات إيرادات"): العنوان يحمل page-title إضافةً إلى card-title (دون تعديل تعريف card-title)', async () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const dashboard = new DecisionDashboard('c', fakeStore({ revenue: { streams: [] } }));
        await dashboard.render();

        const h2 = document.querySelector('#c h2.card-title');
        expect(h2).not.toBeNull();
        expect(h2.classList.contains('page-title')).toBe(true);
        expect(h2.classList.contains('card-title')).toBe(true);
        document.body.innerHTML = '';
    });

    it('.card-title الأصلي لم يُعدَّل (لا يزال بلا margin-bottom خاص بـ page-title مضافاً لتعريفه العام)', () => {
        const css = fs.readFileSync(COMPONENTS_CSS_PATH, 'utf-8');
        // .card-title يجب أن يبقى قاعدة مستقلة، لا مدموجة مع .page-title
        expect(css).not.toMatch(/\.page-title\s*,\s*\.card-title/);
        expect(css).not.toMatch(/\.card-title\s*,\s*\.page-title/);
    });
});

describe('العلة ب — DecisionDashboard.js: 6 إيموجي خام هُوجرت لنظام SVG-sprite', () => {
    afterEach(() => { document.body.innerHTML = ''; });

    it('تحذير "لا بيانات إيرادات": يستخدم أيقونة i-warning بدل إيموجي ⚠️', async () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const dashboard = new DecisionDashboard('c', fakeStore({ revenue: { streams: [] } }));
        await dashboard.render();

        const alertBox = document.querySelector('.alert--warning');
        expect(alertBox).not.toBeNull();
        expect(alertBox.innerHTML).toContain('href="#i-warning"');
        expect(alertBox.textContent).not.toMatch(/⚠️/u);
    });

    it('قائمة "شروط النجاح الحرجة": كل bullet يستخدم أيقونة i-check بدل إيموجي ✓ الحرفي', async () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const dashboard = new DecisionDashboard('c', fakeStore(createRenderableStudy()));
        await dashboard.render();

        const bullets = document.querySelectorAll('.factors-list .bullet');
        expect(bullets.length).toBeGreaterThan(0);
        bullets.forEach(b => {
            expect(b.innerHTML).toContain('href="#i-check"');
            expect(b.textContent).not.toMatch(/✓/u);
        });
    });

    it('زر إغلاق مودال الملخص التنفيذي: يستخدم أيقونة i-x بدل إيموجي ✕ بعد النقر على "الملخص التنفيذي"', async () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const dashboard = new DecisionDashboard('c', fakeStore(createRenderableStudy()));
        await dashboard.render();

        const btnExec = document.querySelector('#btnExecutiveSummary');
        expect(btnExec).not.toBeNull();
        btnExec.click();

        // انتظار حل الاستيراد الديناميكي الحقيقي لـ ExecutiveSummary.js (غير مموَّه) وإنشاء
        // المودال — قد يستغرق أكثر من دورة مايكروتاسك واحدة فعلياً، فنستطلع بحلقة زمنية.
        let closeBtn = null;
        for (let i = 0; i < 50 && !closeBtn; i++) {
            await new Promise(r => setTimeout(r, 20));
            closeBtn = document.querySelector('#execSummaryModal .btn-close-modal');
        }
        expect(closeBtn).not.toBeNull();
        expect(closeBtn.innerHTML).toContain('href="#i-x"');
        expect(closeBtn.textContent).not.toMatch(/✕/u);
    });

    it('calculateReadiness().recommendation.icon: حالة GO تستخدم i-check ولا تحتوي إيموجي ✅', () => {
        const dd = Object.create(DecisionDashboard.prototype);
        const state = { projectInfo: {}, assumptions: {}, financing: {}, marketSizing: {}, hr: { positions: [] }, legal: {}, riskAnalysis: {} };
        const results = {
            decision: 'GO',
            indicators: { npv: 500000, irr: 0.25, roi: 0.3, paybackPeriod: 2, dscr: 1.5 },
            incomeStatement: [{ ebitda: 100000 }],
            capex: { total: 300000 },
            financingCheck: { fundingGap: 0 }
        };
        const r = dd.calculateReadiness(state, results);

        expect(r.recommendation.status).toBe('go');
        expect(r.recommendation.icon).toContain('href="#i-check"');
        expect(r.recommendation.icon).not.toMatch(/✅/u);
    });

    it('calculateReadiness().recommendation.icon: حالة NO-GO تستخدم i-x ولا تحتوي إيموجي ❌', () => {
        const dd = Object.create(DecisionDashboard.prototype);
        const state = { projectInfo: {}, assumptions: {}, financing: {}, marketSizing: {}, hr: { positions: [] }, legal: {}, riskAnalysis: {} };
        const results = {
            decision: 'NO-GO',
            indicators: { npv: -500000, irr: 0, roi: 0, paybackPeriod: 999, dscr: null },
            incomeStatement: [{ ebitda: 0 }],
            capex: { total: 300000 },
            financingCheck: { fundingGap: 0 }
        };
        const r = dd.calculateReadiness(state, results);

        expect(r.recommendation.status).toBe('nogo');
        expect(r.recommendation.icon).toContain('href="#i-x"');
        expect(r.recommendation.icon).not.toMatch(/❌/u);
    });

    it('calculateReadiness().recommendation.icon: حالة REVISE/يحتاج مراجعة تستخدم i-warning (أقرب بديل متاح) ولا تحتوي إيموجي 🤔', () => {
        const dd = Object.create(DecisionDashboard.prototype);
        const state = { projectInfo: {}, assumptions: {}, financing: {}, marketSizing: {}, hr: { positions: [] }, legal: {}, riskAnalysis: {} };
        const results = {
            decision: 'REVISE',
            indicators: { npv: 0, irr: 0.1, roi: 0.1, paybackPeriod: 4, dscr: 1.0 },
            incomeStatement: [{ ebitda: 10000 }],
            capex: { total: 300000 },
            financingCheck: { fundingGap: 0 }
        };
        const r = dd.calculateReadiness(state, results);

        expect(r.recommendation.status).toBe('review');
        expect(r.recommendation.icon).toContain('href="#i-warning"');
        expect(r.recommendation.icon).not.toMatch(/🤔/u);
    });

    it('لا يبقى أي حرف إيموجي خام (⚠️ ✓ ✕ ✅ ❌ 🤔) في أي مكان بمخرجات الشاشة الكاملة', async () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const dashboard = new DecisionDashboard('c', fakeStore(createRenderableStudy()));
        await dashboard.render();

        const html = document.getElementById('c').innerHTML;
        expect(html).not.toMatch(/[⚠️✓✕✅❌🤔]/u);
    });
});

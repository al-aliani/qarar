/**
 * ProjectOverviewView — صفحة الخلاصة التنفيذية لمشروع واحد، برابط خاص (#/project/<id>).
 *
 * قبلها: النقر على بطاقة المشروع في لوحة التحكم كان يقذف المستخدم مباشرةً داخل
 * الويزارد (DashboardView.loadProject → onProjectSelect → navigateTo)، فلا توجد أي
 * نقطة يرى فيها صاحب الدراسة خلاصتها وقرارها قبل التعديل، ولا رابط يشير لمشروع بعينه.
 *
 * مبادئ ملتزَم بها هنا:
 * 1. القرار (GO/REVISE/NO-GO) وأسبابه يُقرآن من calculateStudy() في engine.js حصراً —
 *    المصدر الوحيد لعتبات القرار (تدقيق 2026-07-08: كانت كل شاشة تخترع عتباتها
 *    الاحتياطية فتُظهر ✓ لمشروع يرفضه القرار نفسه). لا عتبات محلية هنا إطلاقاً.
 * 2. المؤشرات تُقرأ عبر getOfficialIndicators (resultContract.js) لا من جذر results.
 * 3. **لا قرار على بيانات ناقصة.** تحقّق حيّ (2026-07-17) على دراسة مكتملة 9%: المحرك
 *    يُعيد فعلاً decision = 'NO-GO' لأن كل المؤشرات أصفار فتفشل عتبات القرار الأربع.
 *    أي أن فحص «هل يوجد decision؟» لا يحمي شيئاً — لا بد من فحص **مخرَج النموذج نفسه**
 *    (hasRealModel أدناه). عرض «لا تمضِ» على دراسة فارغة تخويف كاذب لا نتيجة؛ نعرض
 *    حينها «بيانات غير كافية» بنفس صياغة FinancialStatements.js:233 المعتمدة.
 * 4. المحرك يخزّن irr/roi/profitMargin **كسوراً عشرية** (0.127 = 12.7%) — الضرب في 100
 *    إلزامي قبل العرض (فخّ متكرر موثّق: أنتج سابقاً «عائد داخلي −0.1%» في تقرير ممول).
 */
import { ProjectManager } from '../services/ProjectManager.js';
import { calculateStudy } from '../core/engine.js';
import { getOfficialIndicators } from '../core/resultContract.js';
import { generateExecutiveSummary } from '../services/InternalAIGenerator.js';
import { calculateStudyCompleteness } from '../utils/studyCompleteness.js';
import { escapeHtml } from '../utils/escape.js';
import { runQAChecks } from '../utils/qaChecks.js';
import { buildDecisionQualityGate } from '../utils/decisionQuality.js';

const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

/** أرقام لاتينية داخل نص عربي — نفس اختيار DashboardView (`dv-num`). */
const fmtMoney = (n) => `${Math.round(Number(n) || 0).toLocaleString('en-US')} ﷼`;
const fmtPct = (fraction) => `${(Number(fraction) * 100).toFixed(1)}%`;
const fmtYears = (n) => `${Number(n).toFixed(1)} سنة`;

/**
 * هل أنتج النموذج المالي شيئاً فعلياً؟ دراسة بلا إيراد/تكلفة/استثمار تُخرِج
 * npv=0, irr=0, roi=0, breakEven=0, payback=null — ومع ذلك يمنحها المحرك 'NO-GO'
 * (كل العتبات تفشل على الأصفار). هذا الفحص هو ما يفصل «قرار حقيقي» عن «أصفار».
 */
function hasRealModel(ind) {
    const anyNonZero = [ind?.npv, ind?.irr, ind?.roi, ind?.breakEvenPointValue, ind?.profitMargin]
        .some(v => Number(v) !== 0 && Number.isFinite(Number(v)));
    return anyNonZero || Number(ind?.paybackPeriod) > 0;
}

const DECISION_META = {
    'GO': { label: 'امضِ قدماً', desc: 'المؤشرات تتجاوز عتبات القرار المحددة في افتراضات دراستك.' },
    'REVISE': { label: 'يحتاج مراجعة', desc: 'بعض المؤشرات دون العتبات — راجع الافتراضات أو الهيكلة قبل المضي.' },
    'NO-GO': { label: 'لا تمضِ', desc: 'المؤشرات دون عتبات القرار بفارق يصعب تداركه بالافتراضات الحالية.' }
};

/**
 * نفس تعيين ExecutiveSummary.js:419 وFinancialDashboard.js:153 حرفياً — ألوان القرار
 * معرَّفة مرة واحدة في components.css (.decision-banner). لا تخترع صنفاً جديداً هنا:
 * تعليق components.css:382 ينصّ على أن REVISE تحذير لا رفض، واختزاله للأحمر مخالف.
 */
const bannerClass = (d) => (d === 'GO' ? 'is-go' : (d === 'REVISE' ? 'is-revise' : 'is-nogo'));

export class ProjectOverviewView {
    /**
     * @param {string} containerId
     * @param {object} store - مخزن الحالة المشترك (تُحمَّل فيه الدراسة كي يعمل زر التعديل)
     * @param {{ onEdit?: (projectId: string) => void, onBack?: () => void }} options
     */
    constructor(containerId, store, options = {}) {
        this.containerId = containerId;
        this.store = store;
        this.onEdit = options.onEdit || (() => {});
        this.onBack = options.onBack || (() => { window.location.hash = '#/home'; });
    }

    async render(projectId) {
        this.container = document.getElementById(this.containerId);
        if (!this.container) return;
        this.projectId = projectId;

        this.container.innerHTML = `<div class="dv-loading-box"><div class="loader"></div><div class="text-sm text-muted">جاري تحميل الدراسة...</div></div>`;

        let data = null;
        let headerName = '';
        try {
            const loaded = await ProjectManager.loadProject(projectId);
            data = loaded?.data || null;
        } catch (e) {
            console.warn('[ProjectOverviewView] فشل تحميل المشروع:', e);
        }

        if (!data) {
            this._renderNotFound();
            return;
        }

        // اسم الدراسة يعيش في فهرس المشاريع، لا داخل بيانات الدراسة: تحقّق حيّ أظهر
        // projectInfo.name = '' لدراسة تعرضها البطاقة باسم «مشروع جديد». بدون هذا
        // تتناقض هذه الصفحة مع البطاقة التي فُتحت منها.
        try {
            const list = await ProjectManager.getActiveProjects();
            headerName = list?.find(p => p.id === projectId)?.name || '';
        } catch (e) {
            console.warn('[ProjectOverviewView] تعذّر جلب اسم المشروع من الفهرس:', e);
        }

        // تحميل الدراسة في المخزن المشترك: زر «تعديل» ينقل للويزارد الذي يقرأ من المخزن،
        // فبدون هذا يفتح الويزارد على دراسة أخرى (أو فارغة).
        try { this.store?.set?.(data); } catch (e) { console.warn('[ProjectOverviewView] store.set فشل:', e); }

        let results = null;
        try {
            results = calculateStudy(data);
        } catch (e) {
            console.warn('[ProjectOverviewView] المحرك فشل على هذه الدراسة:', e);
        }

        const indicators = getOfficialIndicators(results || {});
        const completeness = calculateStudyCompleteness(data);
        let qualityGate = buildDecisionQualityGate();
        try {
            qualityGate = buildDecisionQualityGate(await runQAChecks(data, results || {}));
        } catch (e) {
            console.warn('[ProjectOverviewView] فحص الجودة لم يكتمل:', e);
        }
        // القرار يُعرض فقط حين يكون للنموذج مخرَج فعلي — لا لمجرّد أن المحرك أعاد قيمة.
        // نفس `decision` يبوِّب الخلاصة التنفيذية أدناه (السطر 124): generateExecutiveSummary
        // تقرأ results.decision الخام (='NO-GO' لدراسة صفرية) فتُصدر «القرار يشير إلى عدم
        // الجدوى» — عرضها تحت شارة «لا يوجد قرار بعد» على نفس الشاشة تناقض. فنُخفي الملخّص
        // كاملاً ما لم يوجد قرار حقيقي (تدقيق 2026-07-20: تسرّب سردي كان يظهر رغم أن
        // الشارة والمؤشرات مُبوَّبتان صحيحاً — الثغرة كانت في الملخّص وحده).
        const decision = hasRealModel(indicators) && !qualityGate.locked ? (results?.decision || null) : null;

        this.container.innerHTML = `
            <div class="dv po animate-entry">
                ${this._renderHeader(data, completeness, headerName)}
                ${qualityGate.locked ? this._renderQualityBlocked(qualityGate) : (decision ? this._renderDecision(decision, results, data?.appSettings?.mode) : this._renderInsufficient(completeness))}
                ${this._renderIndicators(indicators)}
                ${decision ? this._renderSummary(data, results) : ''}
                ${this._renderActions()}
            </div>
        `;
        this._bind();
    }

    _renderQualityBlocked(gate) {
        const blockers = (gate?.hardItems || []).slice(0, 4);
        return `
            <section class="po__block po__quality-blocked" role="region" aria-label="بوابة جودة القرار">
                <div class="decision-banner is-revise">القرار محجوب مؤقتاً</div>
                <p class="po__block-desc">لن نعرض توصية نهائية قبل إصلاح الأخطاء الحرجة في البيانات (عددها ${Number(gate?.hardCount) || blockers.length}).</p>
                ${blockers.length ? `<div class="po__reasons"><h3 class="po__reasons-title">ابدأ بهذه الإصلاحات</h3><ul class="po__reasons-list">${blockers.map(item => `<li>${escapeHtml(item.message)}</li>`).join('')}</ul></div>` : ''}
                <p class="po__block-note">افتح الدراسة لإصلاح البنود؛ ستظهر التوصية تلقائياً بعد اجتياز بوابة الجودة.</p>
            </section>
        `;
    }

    _renderHeader(data, completeness, headerName = '') {
        const name = escapeHtml(data?.projectInfo?.name || headerName || 'مشروع بلا اسم');
        const city = data?.projectInfo?.city ? escapeHtml(data.projectInfo.city) : '';
        const pct = Number(completeness?.percentage) || 0;
        return `
            <header class="po__head">
                <button type="button" class="btn btn--sm btn--ghost po__back">${icon('i-home')} رجوع للمشاريع</button>
                <h1 class="po__title">${name}</h1>
                ${city ? `<p class="po__sub">${city}</p>` : ''}
                <p class="po__completeness">اكتمال بيانات الدراسة: <b class="dv-num">${pct}%</b></p>
            </header>
        `;
    }

    _renderDecision(decision, results, mode) {
        const meta = DECISION_META[decision] || DECISION_META['REVISE'];
        const reasons = (results?.decisionReasons || [])
            .map(r => (typeof r === 'string' ? r : (r?.text || r?.reason || '')))
            .filter(Boolean);
        return `
            <section class="po__block">
                <div class="decision-banner ${bannerClass(decision)}">${escapeHtml(meta.label)}</div>
                <p class="po__block-desc">${escapeHtml(meta.desc)}</p>
                ${mode === 'mini' ? '<p class="po__block-note">توصية أولية مبنية على 7 حقول أساسية فقط (الوضع «مصغّر») — لم تُدخَل بيانات السوق أو القانونية أو المخاطر. أكمل الوضع الكامل أو المتقدم لتقرير تمويلي معتمد.</p>' : ''}
                ${reasons.length ? `
                    <div class="po__reasons">
                        <h3 class="po__reasons-title">لماذا هذا القرار</h3>
                        <ul class="po__reasons-list">${reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
                    </div>
                ` : ''}
            </section>
        `;
    }

    /** دراسة بلا مدخلات مالية فعلية: لا نخترع قراراً — نقول ما ينقص بالضبط. */
    _renderInsufficient(completeness) {
        return `
            <section class="po__block">
                <div class="decision-banner is-revise">لا يوجد قرار بعد</div>
                <p class="po__block-desc">بيانات غير كافية. يرجى إكمال البيانات المالية الأساسية (الإيرادات، التكاليف، الاستثمارات) ليحسب النموذج قراراً حقيقياً.</p>
                <p class="po__block-note">أكملت <b class="dv-num">${Number(completeness?.percentage) || 0}%</b> من حقول الدراسة. لن نعرض توصية في أي اتجاه قبل توفّر أرقام فعلية — القرار المبني على أصفار ليس قراراً.</p>
            </section>
        `;
    }

    _renderIndicators(ind) {
        // المؤشر يظهر فقط إن كانت له قيمة فعلية — نفس مبدأ generateExecutiveSummary،
        // يمنع شبكة من «0 ﷼ · 0.0%» تبدو نتيجةً وهي غياب بيانات.
        const cards = [
            Number(ind.npv) ? { label: 'صافي القيمة الحالية', value: fmtMoney(ind.npv), good: Number(ind.npv) > 0 } : null,
            Number(ind.irr) ? { label: 'معدل العائد الداخلي', value: fmtPct(ind.irr), good: Number(ind.irr) > 0 } : null,
            Number(ind.paybackPeriod) > 0 ? { label: 'فترة الاسترداد', value: fmtYears(ind.paybackPeriod), good: true } : null,
            Number(ind.roi) ? { label: 'العائد على الاستثمار', value: fmtPct(ind.roi), good: Number(ind.roi) > 0 } : null,
            Number(ind.breakEvenPointValue) ? { label: 'نقطة التعادل (سنوياً)', value: fmtMoney(ind.breakEvenPointValue), good: true } : null,
            Number(ind.profitMargin) ? { label: 'هامش الربح الصافي', value: fmtPct(ind.profitMargin), good: Number(ind.profitMargin) > 0 } : null
        ].filter(Boolean);

        if (!cards.length) return '';
        return `
            <section class="po__section">
                <h2 class="po__section-title">المؤشرات المالية</h2>
                <div class="po__kpis">
                    ${cards.map(c => `
                        <div class="po__kpi ${c.good ? 'is-good' : 'is-bad'}">
                            <span class="po__kpi-label">${escapeHtml(c.label)}</span>
                            <b class="po__kpi-value dv-num">${escapeHtml(c.value)}</b>
                        </div>
                    `).join('')}
                </div>
                ${ind?.irrMultipleRootsRisk === true ? '<p class="po__block-note">قد يكون معدل العائد الداخلي غير موثوق لوجود أكثر من نتيجة رياضية ممكنة — استخدم صافي القيمة الحالية (NPV) كمرجع أساسي للقرار.</p>' : ''}
            </section>
        `;
    }

    _renderSummary(data, results) {
        let text = '';
        try {
            text = generateExecutiveSummary(data, results) || '';
        } catch (e) {
            console.warn('[ProjectOverviewView] توليد الخلاصة فشل:', e);
        }
        if (!text) return '';
        const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean);
        return `
            <section class="po__section">
                <h2 class="po__section-title">الخلاصة التنفيذية</h2>
                <div class="po__summary">
                    ${paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
                </div>
            </section>
        `;
    }

    _renderActions() {
        return `
            <div class="po__actions">
                <button type="button" class="btn btn--primary po__edit">${icon('i-pen')} تعديل وتغيير الدراسة</button>
            </div>
        `;
    }

    _renderNotFound() {
        this.container.innerHTML = `
            <div class="dv po animate-entry">
                <section class="po__decision is-pending">
                    <div class="po__decision-head"><span class="po__verdict">الدراسة غير موجودة</span></div>
                    <p class="po__decision-desc">تعذّر العثور على هذه الدراسة. قد تكون حُذفت، أو أن الرابط يخصّ جهازاً آخر (المسودات المحلية محفوظة على الجهاز الذي أنشأها فقط).</p>
                </section>
                <div class="po__actions">
                    <button type="button" class="btn btn--primary po__back">رجوع للمشاريع</button>
                </div>
            </div>
        `;
        this.container.querySelectorAll('.po__back').forEach(b => b.addEventListener('click', () => this.onBack()));
    }

    _bind() {
        this.container.querySelectorAll('.po__back').forEach(b => b.addEventListener('click', () => this.onBack()));
        this.container.querySelectorAll('.po__edit').forEach(b => b.addEventListener('click', () => this.onEdit(this.projectId)));
    }
}

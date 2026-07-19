/**
 * لوحة الإحصائيات الشاملة — تجميع حقيقي عبر كل دراسات المستخدم المحفوظة
 * (وليس دراسة واحدة). كل دراسة تُحمَّل كاملة وتُمرَّر لـ calculateStudy() الحقيقي
 * ثم تُقرأ مؤشراتها الرسمية من results.indicators (نفس عقد resultContract.js).
 * لا يوجد مصدر بيانات حقيقي لتوزيع القطاعات أو التدفقات النقدية المجمّعة عبر
 * الدراسات — حُذفت الرسوم البيانية المصطنعة لذلك بدل تركها بأرقام مختلقة.
 */
import { ProjectManager } from '../services/ProjectManager.js';
import { calculateStudy } from '../core/engine.js';
import { getOfficialIndicators } from '../core/resultContract.js';
import { formatCurrency, formatPercent, formatPayback } from '../utils/formatters.js';
import { escapeHtml } from '../utils/escape.js';

const PAGE_SIZE = 12;

export class GlobalAnalyticsView {
    constructor(containerOrId, options = {}) {
        this.container = typeof containerOrId === 'string'
            ? document.getElementById(containerOrId)
            : containerOrId;
        this.headers = [];
        this.rows = [];
        this.loadedCount = 0;
        // تدقيق: هذا الزر كان يضبط window.location.hash = '#/home' مباشرة — يفتح
        // هذه الصفحة أصلاً لا يغيّر الهاش عن '#/home' (يُفتح عبر حدث feasibility:showGlobalAnalytics
        // لا توجيه هاش)، فتعيين نفس القيمة لا يُطلق hashchange والزر لا يعمل إطلاقاً.
        // onBack (يمرّره app.js كـ showLandingDashboard، بنفس نمط بقية الشاشات المشابهة)
        // يستدعي الرسم مباشرة بدل انتظار حدث متصفّح قد لا يقع.
        this.onBack = options.onBack || (() => { window.location.hash = '#/home'; });
    }

    async render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="global-analytics-view" style="max-width:960px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnAnalyticsBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg> لوحة الإحصائيات الشاملة</h2>
                <p class="text-muted mb-4">رأس المال والعائد الحقيقي عبر كل دراساتك المحفوظة — لا دراسة واحدة. انسخ أي دراسة من الجدول أدناه لبدء فرع جديد.</p>
                <div id="analyticsBody"><p class="text-sm text-muted">جاري تحميل دراساتك...</p></div>
            </div>
        `;
        this.container.querySelector('#btnAnalyticsBack')?.addEventListener('click', () => this.onBack());

        this.headers = (await ProjectManager.getActiveProjects()) || [];
        this.headers.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

        if (this.headers.length === 0) {
            this.container.querySelector('#analyticsBody').innerHTML = `
                <div class="alert alert--info">
                    <p><strong>لا توجد دراسات محفوظة بعد.</strong></p>
                    <p class="text-sm mt-2">أنشئ أول دراسة لعرض إحصائياتها هنا.</p>
                </div>`;
            return;
        }

        await this.loadMore();
        return this.container;
    }

    async loadMore() {
        const body = this.container.querySelector('#analyticsBody');
        const slice = this.headers.slice(this.loadedCount, this.loadedCount + PAGE_SIZE);

        for (const h of slice) {
            try {
                const loaded = await ProjectManager.loadProject(h.id);
                if (!loaded?.data) continue;
                const result = calculateStudy(loaded.data);
                const ind = getOfficialIndicators(result);
                if (!ind || (ind.npv == null && ind.roi == null)) continue;
                this.rows.push({
                    id: h.id,
                    name: h.name || 'دراسة بلا اسم',
                    npv: ind.npv,
                    irr: ind.irr,
                    roi: ind.roi,
                    paybackPeriod: ind.paybackPeriod,
                    capex: result.capex?.total
                });
            } catch (_) {
                // نتجاوز الدراسة الفاشلة، لا نوقف الصفحة بالكامل
            }
        }
        this.loadedCount += slice.length;

        if (this.rows.length === 0) {
            body.innerHTML = `
                <div class="alert alert--warning">
                    <p><strong>تعذر حساب مؤشرات دراساتك.</strong></p>
                    <p class="text-sm mt-2">تحقق من اكتمال بيانات الإيرادات والتكاليف في دراساتك المحفوظة.</p>
                </div>`;
            return;
        }

        const totalCapex = this.rows.reduce((a, r) => a + (Number(r.capex) || 0), 0);
        const roiValues = this.rows.map(r => r.roi).filter(v => Number.isFinite(v));
        const avgRoi = roiValues.length ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length : null;
        const paybackValues = this.rows.map(r => r.paybackPeriod).filter(v => Number.isFinite(v) && v > 0);
        const avgPayback = paybackValues.length ? paybackValues.reduce((a, b) => a + b, 0) / paybackValues.length : null;

        const hasMore = this.loadedCount < this.headers.length;
        const cappedNote = this.headers.length > PAGE_SIZE
            ? `<p class="text-xs text-muted mt-2">تم تحميل ${this.loadedCount} من إجمالي ${this.headers.length} دراسة.</p>`
            : '';

        body.innerHTML = `
            <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;">
                <div class="card"><div class="text-xs text-muted">عدد الدراسات المحسوبة</div><div class="text-mono" style="font-size:1.4rem;font-weight:700;">${this.rows.length}</div></div>
                <div class="card"><div class="text-xs text-muted">إجمالي رأس المال المطلوب</div><div class="text-mono" style="font-size:1.4rem;font-weight:700;">${formatCurrency(totalCapex)}</div></div>
                <div class="card"><div class="text-xs text-muted">متوسط العائد على الاستثمار (ROI)</div><div class="text-mono" style="font-size:1.4rem;font-weight:700;">${formatPercent(avgRoi)}</div></div>
                <div class="card"><div class="text-xs text-muted">متوسط فترة الاسترداد</div><div class="text-mono" style="font-size:1.4rem;font-weight:700;">${avgPayback != null ? avgPayback.toFixed(1) + ' سنة' : '—'}</div></div>
            </div>
            <div class="card" style="padding:0;overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="text-align:right;border-bottom:1px solid var(--c-border);">
                            <th style="padding:10px 12px;">الدراسة</th>
                            <th style="padding:10px 12px;">NPV</th>
                            <th style="padding:10px 12px;">IRR</th>
                            <th style="padding:10px 12px;">ROI</th>
                            <th style="padding:10px 12px;">فترة الاسترداد</th>
                            <th style="padding:10px 12px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.rows.map(r => `
                            <tr style="border-bottom:1px solid var(--c-border);">
                                <td style="padding:10px 12px;">${escapeHtml(r.name)}</td>
                                <td style="padding:10px 12px;" class="text-mono">${formatCurrency(r.npv)}</td>
                                <td style="padding:10px 12px;" class="text-mono">${formatPercent(r.irr)}</td>
                                <td style="padding:10px 12px;" class="text-mono">${formatPercent(r.roi)}</td>
                                <td style="padding:10px 12px;" class="text-mono">${formatPayback(r.paybackPeriod)}</td>
                                <td style="padding:10px 12px;">
                                    <button type="button" class="btn btn--sm btn--ghost btn-branch-duplicate" data-id="${r.id}" data-name="${escapeHtml(r.name)}" title="نسخ هذه الدراسة لبدء فرع جديد">نسخ لفرع جديد</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${cappedNote}
            ${hasMore ? '<button type="button" id="btnAnalyticsLoadMore" class="btn btn--secondary btn--sm mt-2">تحميل المزيد</button>' : ''}
        `;

        body.querySelector('#btnAnalyticsLoadMore')?.addEventListener('click', () => this.loadMore());

        // نسخ لبدء فرع جديد — هذا بالضبط الوعد المكتوب في بطاقة «محاكي التوسع والفروع»
        // على الرئيسية («قارن دراساتك، وانسخ أي دراسة لبدء فرع جديد») والذي لم يكن منفَّذاً هنا فعلياً.
        body.querySelectorAll('.btn-branch-duplicate').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const target = e.currentTarget;
                const id = target.dataset.id;
                if (!id) return;
                const { promptDuplicateProject } = await import('../utils/duplicateProjectDialog.js');
                const result = await promptDuplicateProject(id, target.dataset.name);
                if (!result) return;
                this.headers = [];
                this.rows = [];
                this.loadedCount = 0;
                await this.render();
            });
        });
    }
}

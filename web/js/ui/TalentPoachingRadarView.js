/**
 * مؤشر تنافسية الرواتب — إعادة صياغة "رادار اصطياد المواهب" الأصلي (كان يختلق موظفاً
 * حقيقياً مسمّى بشركة منافسة حقيقية ويعرض راتبه وعرضاً سرياً لاستقطابه، بلا أي بيانات
 * حقيقية تسند ذلك). لا يوجد بالمشروع أي قاعدة رواتب/دوران وظيفي خارجية، فلا مجال لبناء
 * "مؤشر تنافسية" حقيقي مقابل السوق. الزاوية الصادقة الوحيدة المتاحة: هل إجمالي إنفاقك
 * على الرواتب متناسب مع إيراداتك مقارنة بنطاق قطاعك التقديري (sectorBenchmarks.js) —
 * نفس النطاق المستخدم فعلاً في فحص "السائقين" (checkDriversAgainstBenchmarks)، لا رقم
 * جديد. هذا مؤشر صحة هيكل تكلفة، وليس مقارنة بمرتبات أفراد حقيقيين.
 */
import { calculateStudy } from '../core/engine.js';
import { getCostRatios } from '../core/costRatios.js';
import { resolveSectorBenchmark } from '../core/sectorBenchmarks.js';
import { formatFractionAsPercent } from '../utils/formatters.js';
import { escapeHtml } from '../utils/escape.js';

export class TalentPoachingRadarView {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
    }

    async render() {
        if (!this.container) return;

        const state = this.store.get();
        let result = null;
        try { result = calculateStudy(state); } catch (_) { result = null; }

        const ratios = result ? getCostRatios(result) : null;
        const labor = ratios?.labor || 0;

        if (!result || labor <= 0) {
            this.container.innerHTML = `
                <div class="talent-competitiveness-view" style="max-width:680px;margin:0 auto;padding:var(--s-4) 0;">
                    <button type="button" id="btnTalentBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                    <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-scale"/></svg> مؤشر تنافسية الرواتب</h2>
                    <div class="alert alert--info mt-4">
                        <p>أكمل الإيرادات والرواتب في دراستك لعرض نسبة تكلفة الرواتب إلى الإيرادات.</p>
                    </div>
                </div>`;
            this.container.querySelector('#btnTalentBack')?.addEventListener('click', () => {
                window.location.hash = '#/home';
            });
            return this.container;
        }

        const bench = resolveSectorBenchmark(state);
        const [lo, hi] = bench.laborToRevenue;
        let statusClass = 'success';
        let statusText = 'ضمن النطاق المعتاد لقطاعك';
        let hint = '';
        if (labor < lo) {
            statusClass = 'warning';
            statusText = 'أدنى من النطاق المعتاد لقطاعك';
            hint = 'هل فريقك يكفي فعلاً لتحقيق هذه المبيعات؟ إنفاق رواتب منخفض نسبياً قد يعني فريقاً مرهقاً أو مقارنة تنافسية ضعيفة عند التوظيف.';
        } else if (labor > hi) {
            statusClass = 'danger';
            statusText = 'أعلى من النطاق المعتاد لقطاعك';
            hint = 'هيكل الرواتب يستحق مراجعة — لكن هذا لا يعني بالضرورة رواتب غير تنافسية، فقد يكون العدد أو المستويات الوظيفية أعلى من المعتاد لنشاطك.';
        }

        this.container.innerHTML = `
            <div class="talent-competitiveness-view" style="max-width:680px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnTalentBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>
                <h2 class="section-title"><svg class="ic" aria-hidden="true"><use href="#i-scale"/></svg> مؤشر تنافسية الرواتب</h2>
                <p class="text-muted mb-4">هل إنفاقك على الرواتب متناسب مع إيراداتك مقارنة بقطاعك؟ — هذا مؤشر هيكل تكلفة، وليس مقارنة برواتب أفراد أو منافسين حقيقيين.</p>

                <div class="card glass-card mb-4">
                    <h3 class="card-title mb-2">العمالة إلى المبيعات</h3>
                    <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
                        <div><div class="text-xs text-muted">نسبتك الفعلية</div><div class="text-mono" style="font-size:1.4rem;font-weight:700;">${formatFractionAsPercent(labor, 0)}</div></div>
                        <div><div class="text-xs text-muted">نطاق قطاع «${escapeHtml(bench.label || 'عام')}»</div><div class="text-mono" style="font-size:1.4rem;font-weight:700;">${formatFractionAsPercent(lo, 0)}–${formatFractionAsPercent(hi, 0)}</div></div>
                    </div>
                    <div class="badge badge--${statusClass} mt-3">${statusText}</div>
                    ${hint ? `<p class="text-sm mt-2 mb-0">${hint}</p>` : ''}
                    <p class="text-xs text-muted mt-2 mb-0">نطاق تقديري داخلي — ليس رقماً رسمياً منشوراً، راجعه بحذر. لا توجد بهذه الأداة أي بيانات عن رواتب موظفين حقيقيين لدى منافسين — لمقارنة تكلفة توظيفك أنت تفصيلياً، استخدم «محاكي الموارد البشرية والرواتب».</p>
                </div>
            </div>
        `;

        this.container.querySelector('#btnTalentBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}

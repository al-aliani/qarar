/**
 * ما بعد الجدوى — ربط المستخدم بمراحل لاحقة: مراجعة استشاري، التقديم للممول، مسار ريادة، شراكات
 * (جدوى كلاود — إحساس أن المنصة لا تتركه بعد التقرير)
 */
import { APP_CONFIG, RESOURCES_GUIDANCE_LINKS } from '../config.js';
import { escapeHtml } from '../utils/escape.js';
import { calculateStudy } from '../core/engine.js';
import { buildDecisionActionPlan } from '../core/decisionActionPlan.js';
import { trackEvent } from '../utils/analytics.js';

export class PostFeasibilityView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => {});
        this.store = options.store || null;
        this.onNavigateStep = options.onNavigateStep || null;
        this.onNavigateRoute = options.onNavigateRoute || null;
    }

    render() {
        if (!this.container) return;

        const consultationUrl = APP_CONFIG?.consultationBookingUrl || '';
        const consultationText = consultationUrl
            ? `احجز جلسة مراجعة مع خبير لمراجعة دراستك وتدعيم النقاط الحرجة.`
            : `يمكنك طلب مراجعة استشاري لدراستك عبر التواصل مع إدارة المنصة أو الجهات الداعمة.`;

        const links = RESOURCES_GUIDANCE_LINKS || [];
        const fundingLinks = links.filter(l => (l.name || '').includes('بنك') || (l.name || '').includes('تمويل'));
        const partnershipLinks = links;
        const state = this.store?.getState?.() || {};
        let results = state.results || {};
        try { results = calculateStudy(state); } catch { /* تعرض الصفحة الروابط العامة عند نقص البيانات */ }
        const actions = buildDecisionActionPlan(state, results);
        const projectName = state.projectInfo?.name || state.projectInfo?.concept || 'مشروعك';

        this.container.innerHTML = `
            <div class="post-feasibility-view animate-entry p-6 max-w-2xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="postFeasibilityBack">← العودة</button>
                <h1 class="text-2xl font-bold mb-2">ما بعد الجدوى</h1>
                <p class="text-muted mb-6">خطة ما بعد القرار لمشروع <strong>${escapeHtml(projectName)}</strong>، مبنية على نتيجة الدراسة الحالية واحتياجاتها.</p>

                <div class="space-y-6">
                    ${actions.length ? `<section class="card p-4">
                        <h2 class="font-bold text-gold mb-2">الإجراءات التالية حسب الأولوية</h2>
                        <div class="grid grid-cols-2 gap-3">
                            ${actions.map((item, index) => `<div class="card p-4">
                                <span class="badge">${index + 1}</span>
                                <strong class="block mt-2">${escapeHtml(item.title)}</strong>
                                <p class="text-sm text-muted mt-1">${escapeHtml(item.description || '')}</p>
                                <button type="button" class="btn btn--secondary btn--sm mt-3" data-post-action="${escapeHtml(item.id)}" ${item.route ? `data-route="${escapeHtml(item.route)}"` : `data-step-index="${item.stepIndex}"`}>ابدأ الإجراء</button>
                            </div>`).join('')}
                        </div>
                    </section>` : ''}
                    <section class="card card-hover p-4">
                        <h2 class="font-bold text-gold mb-2">مراجعة استشاري</h2>
                        <p class="text-sm text-muted mb-3">${consultationText}</p>
                        ${consultationUrl ? `<a href="${consultationUrl}" target="_blank" rel="noopener" class="btn btn--primary btn--sm">حجز جلسة مراجعة</a>` : '<a href="./contact.html" class="btn btn--primary btn--sm">تواصل لطلب المراجعة</a>'}
                    </section>

                    <section class="card card-hover p-4">
                        <h2 class="font-bold text-gold mb-2">التقديم للممول</h2>
                        <p class="text-sm text-muted mb-3">بعد إكمال الدراسة، استخدم تصدير <strong>عرض للمستثمر/المسرّعة</strong> من قائمة التصدير، ثم قدّم لجهات التمويل أو المسرّعات حسب متطلبات كل جهة.</p>
                        ${fundingLinks.length > 0 ? `
                            <ul class="text-sm space-y-1 mt-2">
                                ${fundingLinks.map(l => `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="text-gold underline">${escapeHtml(l.name)}</a> — ${escapeHtml(l.description || '')}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </section>

                    <section class="card card-hover p-4">
                        <h2 class="font-bold text-gold mb-2">مسار ريادة</h2>
                        <p class="text-sm text-muted">انطلق من الجدوى إلى التنفيذ: خططك الزمنية ومؤشراتك المالية جاهزة. راجع لوحة القرار وملخص التوصية، ثم ابدأ بإجراءات التأسيس والتراخيص والتمويل.</p>
                    </section>

                    <section class="card card-hover p-4">
                        <h2 class="font-bold text-gold mb-2">شراكات وموارد</h2>
                        <p class="text-sm text-muted mb-3">روابط جهات مفيدة للاستشارة والتمويل والشراكات (بدون التعهد بخدمات طرف ثالث):</p>
                        ${partnershipLinks.length > 0 ? `
                            <ul class="text-sm space-y-2">
                                ${partnershipLinks.map(l => `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="text-gold underline">${escapeHtml(l.name)}</a> — ${escapeHtml(l.description || '')}</li>`).join('')}
                            </ul>
                        ` : '<p class="text-xs text-muted">لا توجد روابط مُعدّة حاليًا.</p>'}
                    </section>
                </div>
            </div>
        `;

        this.container.querySelector('#postFeasibilityBack')?.addEventListener('click', () => this.onBack());
        this.container.querySelectorAll('[data-post-action]').forEach(button => button.addEventListener('click', () => {
            const route = button.dataset.route;
            const targetStep = Number(button.dataset.stepIndex);
            trackEvent('post_feasibility_action_opened', { action: button.dataset.postAction || 'unknown', decision: results?.decision });
            if (route && this.onNavigateRoute) this.onNavigateRoute(route);
            else if (Number.isInteger(targetStep) && targetStep >= 0 && this.onNavigateStep) this.onNavigateStep(targetStep);
        }));
    }
}

/**
 * ما بعد الجدوى — ربط المستخدم بمراحل لاحقة: مراجعة استشاري، التقديم للممول، مسار ريادة، شراكات
 * (جدوى كلاود — إحساس أن المنصة لا تتركه بعد التقرير)
 */
import { APP_CONFIG, RESOURCES_GUIDANCE_LINKS } from '../config.js';

export class PostFeasibilityView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onBack = options.onBack || (() => {});
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

        this.container.innerHTML = `
            <div class="post-feasibility-view animate-entry p-6 max-w-2xl mx-auto" dir="rtl">
                <button type="button" class="btn btn--ghost mb-4" id="postFeasibilityBack">← العودة</button>
                <h1 class="text-2xl font-bold mb-2">ما بعد الجدوى</h1>
                <p class="text-muted mb-6">المنصة لا تتركك بعد التقرير. خطوات مقترحة لاحقة: مراجعة استشاري، التقديم للممول، مسار ريادة، شراكات.</p>

                <div class="space-y-6">
                    <section class="card card-hover p-4">
                        <h2 class="font-bold text-gold mb-2">مراجعة استشاري</h2>
                        <p class="text-sm text-muted mb-3">${consultationText}</p>
                        ${consultationUrl ? `<a href="${consultationUrl}" target="_blank" rel="noopener" class="btn btn--primary btn--sm">حجز جلسة مراجعة</a>` : '<p class="text-xs text-muted">رابط الحجز يُضاف من إعدادات المنصة.</p>'}
                    </section>

                    <section class="card card-hover p-4">
                        <h2 class="font-bold text-gold mb-2">التقديم للممول</h2>
                        <p class="text-sm text-muted mb-3">بعد إكمال الدراسة، استخدم تصدير <strong>عرض للمستثمر/المسرّعة</strong> من قائمة التصدير، ثم قدّم لجهات التمويل أو المسرّعات حسب متطلبات كل جهة.</p>
                        ${fundingLinks.length > 0 ? `
                            <ul class="text-sm space-y-1 mt-2">
                                ${fundingLinks.map(l => `<li><a href="${l.url}" target="_blank" rel="noopener" class="text-gold underline">${l.name}</a> — ${l.description || ''}</li>`).join('')}
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
                                ${partnershipLinks.map(l => `<li><a href="${l.url}" target="_blank" rel="noopener" class="text-gold underline">${l.name}</a> — ${l.description || ''}</li>`).join('')}
                            </ul>
                        ` : '<p class="text-xs text-muted">لا توجد روابط مُعدّة حاليًا.</p>'}
                    </section>
                </div>
            </div>
        `;

        this.container.querySelector('#postFeasibilityBack')?.addEventListener('click', () => this.onBack());
    }
}

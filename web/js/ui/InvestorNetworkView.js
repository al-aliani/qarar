/**
 * شبكة مطابقة المستثمرين — مفهوم منتج غير مبني بعد. لا يوجد أي مستثمر حقيقي
 * مسجَّل لدى "قرار"، ولا آلية مطابقة فعلية، وزر "تقديم مشروعي للمستثمرين" /
 * "طلب التواصل" لا يرسل شيئاً لأي جهة. البطاقات أدناه أمثلة توضيحية لشكل
 * الميزة إن بُنيت مستقبلاً (تحتاج قاعدة مستثمرين معتمدين حقيقية وشراكة/ترخيص
 * تنظيمي لم يُتخذ قرار عملها بعد) — لا بيانات حقيقية.
 */
import { formatCurrency, formatFractionAsPercent } from '../utils/formatters.js';
import { escapeHtml } from '../utils/escape.js';

export class InvestorNetworkView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        const deals = [
            { sector: 'قطاع الأغذية والمشروبات', req: 2500000, roi: 0.35, risk: 'متوسط', tags: ['توسع', 'مبيعات نشطة'] },
            { sector: 'التطبيقات التقنية (SaaS)', req: 500000, roi: 0.60, risk: 'عالي', tags: ['بذرة (Seed)', 'تقنية مالية'] },
            { sector: 'القطاع اللوجستي', req: 1200000, roi: 0.22, risk: 'منخفض', tags: ['معدات', 'عقود حكومية'] }
        ];

        const riskBadgeClass = (risk) => risk === 'عالي' ? 'badge--danger' : risk === 'متوسط' ? 'badge--warning' : 'badge--success';

        this.container.innerHTML = `
            <div class="investor-network-view" style="max-width:860px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnInvestorNetworkBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>

                <div class="flex-between mb-4">
                    <div>
                        <h2 class="section-title" style="margin-bottom:4px;"><svg class="ic" aria-hidden="true"><use href="#i-bank"/></svg> شبكة مطابقة المستثمرين</h2>
                        <p class="text-muted" style="margin:0;">مطابقة بين مشاريع تبحث عن تمويل ومستثمرين محتملين.</p>
                    </div>
                    <span class="badge badge--warning" style="white-space:nowrap;">مفهوم — قيد التطوير</span>
                </div>

                <div class="alert alert--warning mb-4">
                    <p style="margin:0;">هذه الشاشة مفهوم منتج فقط. لا يوجد حالياً أي مستثمر حقيقي مسجَّل لدى "قرار"، ولا مطابقة فعلية تجري بين المشاريع والمستثمرين، وزرّا "تقديم مشروعي للمستثمرين" و"طلب التواصل" لا يرسلان شيئاً لأي جهة. البطاقات أدناه أمثلة توضيحية لشكل الميزة إن بُنيت مستقبلاً.</p>
                </div>

                <div class="card glass-card mb-4" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div>
                        <h3 class="card-title mb-1">لديك مشروع يبحث عن تمويل؟</h3>
                        <p class="text-xs text-muted mb-0">هذه الميزة قيد التطوير ولا تصل بعد لأي مستثمر حقيقي.</p>
                    </div>
                    <button type="button" class="btn btn--secondary" disabled>تقديم مشروعي للمستثمرين (غير متاح)</button>
                </div>

                <div style="display:flex;flex-direction:column;gap:12px;">
                    ${deals.map(deal => `
                        <div class="card">
                            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                                <div style="flex:1;min-width:200px;">
                                    <div class="card-title mb-1" style="font-size:0.95rem;">مشروع في ${escapeHtml(deal.sector)}</div>
                                    <div class="text-xs text-muted mb-2">مثال توضيحي — الموقع مجهول</div>
                                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                        ${deal.tags.map(t => `<span class="badge badge--neutral">${escapeHtml(t)}</span>`).join('')}
                                    </div>
                                </div>
                                <div style="display:flex;gap:20px;flex-wrap:wrap;">
                                    <div class="text-center">
                                        <div class="text-xs text-muted mb-1">المبلغ المطلوب</div>
                                        <div class="text-mono" style="font-weight:700;">${formatCurrency(deal.req)}</div>
                                    </div>
                                    <div class="text-center">
                                        <div class="text-xs text-muted mb-1">متوسط العائد</div>
                                        <div class="text-mono" style="font-weight:700;">${formatFractionAsPercent(deal.roi, 0)}</div>
                                    </div>
                                    <div class="text-center">
                                        <div class="text-xs text-muted mb-1">المخاطرة</div>
                                        <span class="badge ${riskBadgeClass(deal.risk)}">${escapeHtml(deal.risk)}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="mt-3" style="text-align:left;">
                                <button type="button" class="btn btn--secondary btn--sm" disabled>طلب التواصل (غير متاح)</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.container.querySelector('#btnInvestorNetworkBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}

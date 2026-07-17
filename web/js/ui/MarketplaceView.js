/**
 * سوق مقدمي الخدمات — مفهوم منتج غير مبني بعد. لا يوجد أي مزوّد خدمة حقيقي
 * متعاقد مع "قرار"، ولا خصومات فعلية، ولا آلية طلب عرض سعر تصل لأي جهة.
 * القائمة أدناه أمثلة توضيحية لشكل الميزة إن بُنيت مستقبلاً — لا بيانات حقيقية.
 */
export class MarketplaceView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        const vendors = [
            { name: 'مثال: مزوّد خدمات تقنية', category: 'تصميم المواقع والتطبيقات', icon: 'i-code' },
            { name: 'مثال: مكتب استشارات قانونية', category: 'تأسيس وعقود', icon: 'i-shield' },
            { name: 'مثال: وكالة تسويق وهوية بصرية', category: 'هوية بصرية وتسويق', icon: 'i-pen' },
            { name: 'مثال: مقاول ديكور وتشطيب', category: 'ديكور وتشطيب', icon: 'i-home' }
        ];

        this.container.innerHTML = `
            <div class="marketplace-view" style="max-width:860px;margin:0 auto;padding:var(--s-4) 0;">
                <button type="button" id="btnMarketplaceBack" class="btn btn--ghost mb-4" style="display:inline-flex;align-items:center;gap:8px;">← العودة للوحة التحكم</button>

                <div class="flex-between mb-4">
                    <div>
                        <h2 class="section-title" style="margin-bottom:4px;"><svg class="ic" aria-hidden="true"><use href="#i-box"/></svg> سوق مقدمي الخدمات</h2>
                        <p class="text-muted" style="margin:0;">شركاء تنفيذ لمشروعك — قانون، تسويق، تقنية، مقاولات.</p>
                    </div>
                    <span class="badge badge--warning" style="white-space:nowrap;">مفهوم — قيد التطوير</span>
                </div>

                <div class="alert alert--warning mb-4">
                    <p style="margin:0;">هذه الشاشة مفهوم منتج فقط. لا يوجد حالياً أي مزوّد خدمة حقيقي متعاقد مع "قرار"، ولا خصومات فعلية، وزر "طلب عرض سعر" لا يرسل شيئاً لأي جهة. البطاقات أدناه أمثلة توضيحية لشكل الميزة إن بُنيت مستقبلاً.</p>
                </div>

                <div class="kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
                    ${vendors.map(v => `
                        <div class="card" style="text-align:center;">
                            <svg class="ic" style="width:32px;height:32px;margin-bottom:8px;" aria-hidden="true"><use href="#${v.icon}"/></svg>
                            <div class="card-title" style="font-size:0.9rem;">${v.name}</div>
                            <p class="text-xs text-muted mb-4">${v.category}</p>
                            <button type="button" class="btn btn--secondary" disabled style="width:100%;">طلب عرض سعر (غير متاح)</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.container.querySelector('#btnMarketplaceBack')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}

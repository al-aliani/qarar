export class GovTendersRadarView {
    constructor(containerOrId) {
        if (typeof containerOrId === 'string') {
            this.container = document.getElementById(containerOrId);
        } else {
            this.container = containerOrId;
        }
    }

    async render() {
        if (!this.container) return;

        const tenders = [
            { id: 'TND-2024-89', entity: 'وزارة الصحة', title: 'توريد إعاشة ومواد غذائية لمستشفيات المنطقة الشرقية', value: '2,500,000 ريال', daysLeft: 4, match: 95 },
            { id: 'TND-2024-102', entity: 'أمانة منطقة الرياض', title: 'عقد تشغيل مقهى في حديقة الملك سلمان', value: 'غير محدد', daysLeft: 12, match: 88 },
            { id: 'TND-2024-115', entity: 'جامعة الملك سعود', title: 'تأمين أجهزة تقنية وخدمات سحابية', value: '450,000 ريال', daysLeft: 2, match: 45 }
        ];

        this.container.innerHTML = `
            <div class="tenders-radar-view animate-entry">
                <!-- Header -->
                <div class="tr-header">
                    <div>
                        <h2 class="tr-title">
                            <svg class="ic" aria-hidden="true"><use href="#i-briefcase"/></svg>
                            رادار المناقصات والعطاءات الحكومية
                        </h2>
                        <p class="tr-desc">أمثلة توضيحية لشكل مناقصات متوافقة مع مشروعك — الربط الفعلي بمنصة اعتماد الحكومية غير متاح حالياً.</p>
                    </div>
                    <div class="tr-badge">
                        <div class="tr-badge-dot"></div>
                        <span>بيانات تجريبية (Demo)</span>
                    </div>
                </div>

                <!-- Stats & Sync -->
                <div class="tr-toolbar">
                    <div class="tr-filters">
                        <select class="tr-filter" disabled title="بيانات تجريبية — التصفية غير مفعّلة">
                            <option>تطابق عالي (>80%)</option>
                            <option>الكل</option>
                        </select>
                        <select class="tr-filter" disabled title="بيانات تجريبية — التصفية غير مفعّلة">
                            <option>تنتهي قريباً</option>
                            <option>الأحدث</option>
                        </select>
                    </div>
                    <button class="tr-sync-btn" disabled title="بيانات تجريبية — الربط الفعلي بمنصة اعتماد غير متاح حالياً">
                        <svg class="ic" aria-hidden="true"><use href="#i-refresh-cw"/></svg> تحديث الرادار
                    </button>
                </div>

                <!-- Tenders List -->
                <div class="tr-list">
                    ${tenders.map(t => `
                        <div class="tr-item${t.match > 80 ? ' tr-item--match' : ''}">
                            ${t.match > 80 ? '<div class="tr-item-glow"></div>' : ''}

                            <div class="tr-item-body">
                                <div class="tr-item-main">
                                    <div class="tr-item-meta">
                                        <div class="tr-item-id">${t.id}</div>
                                        <div class="tr-item-entity">${t.entity}</div>
                                    </div>
                                    <h3 class="tr-item-title">${t.title}</h3>
                                    <div class="tr-item-facts">
                                        <span class="tr-item-value">القيمة التقديرية: <strong class="${t.value !== 'غير محدد' ? '' : 'is-tbd'}">${t.value}</strong></span>
                                        <span class="tr-item-days${t.daysLeft <= 3 ? ' tr-item-days--urgent' : ''}">
                                            <svg class="ic" aria-hidden="true"><use href="#i-clock"/></svg>
                                            ينتهي بعد ${t.daysLeft} أيام
                                        </span>
                                    </div>
                                </div>

                                <div class="tr-item-side">
                                    <!-- Match Score -->
                                    <div class="tr-match">
                                        <span class="tr-match-label">نسبة التطابق</span>
                                        <div class="tr-match-circle${t.match > 80 ? ' tr-match-circle--high' : ''}">
                                            ${t.match}%
                                        </div>
                                    </div>
                                    <button class="btn btn--secondary tr-item-cta" disabled title="بيانات تجريبية — التوليد الآلي غير متاح حالياً">
                                        <svg class="ic" aria-hidden="true"><use href="#i-file-text"/></svg>
                                        توليد عرض سعر آلي
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div style="margin-top: var(--s-4);">
                    <button type="button" class="btn btn--secondary btn-back-dashboard">
                        <svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>
                        العودة للوحة التحكم
                    </button>
                </div>
            </div>
        `;

        this.container.querySelector('.btn-back-dashboard')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        return this.container;
    }
}

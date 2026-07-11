import { escapeAttr, escapeHtml } from '../utils/escape.js';

const downloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>';
const fileIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';

export class DatabaseFilesView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.catalog = null;
        this.loaded = false;
    }

    async render() {
        if (!this.container) return;
        if (!this.loaded) {
            this.container.innerHTML = `
                <div class="rs-loading" role="status" aria-live="polite">
                    <div class="loader"></div>
                    <p>جاري تجهيز فهرس قواعد البيانات…</p>
                </div>
            `;
            try {
                const response = await fetch('/data/database-files.json', { cache: 'no-store' });
                if (!response.ok) throw new Error(`Database files catalogue request failed: ${response.status}`);
                this.catalog = await response.json();
                this.loaded = true;
            } catch (error) {
                console.error('Database files catalogue failed:', error);
                this.container.innerHTML = `
                    <div class="rs-error" role="alert">
                        <strong>تعذّر تحميل فهرس قواعد البيانات.</strong>
                        <p>تأكد من وجود مجلد المصدر ثم أعد المحاولة.</p>
                        <button type="button" class="btn btn--secondary" data-rs-retry>إعادة المحاولة</button>
                    </div>
                `;
                this.container.querySelector('[data-rs-retry]')?.addEventListener('click', () => {
                    this.loaded = false;
                    this.render();
                });
                return;
            }
        }
        this.draw();
    }

    draw() {
        const catalog = this.catalog || { totalFiles: 0, totalGroups: 0, groups: [] };
        
        let groupsHtml = '';
        if (catalog.groups && catalog.groups.length) {
            groupsHtml = catalog.groups.map((group) => `
                <details class="rs-db-group">
                    <summary>
                        <span class="rs-db-group__title">${escapeHtml(group.label)}</span>
                        <span class="rs-db-group__count">${escapeHtml(group.count)} ملف</span>
                    </summary>
                    <div class="rs-db-group__body">
                        <p class="rs-db-group__description">${escapeHtml(group.description)}</p>
                        <div class="rs-db-files">
                            ${(group.files || []).map((file) => `
                                <article class="rs-db-file">
                                    <div class="rs-db-file__icon">${fileIcon}</div>
                                    <div class="rs-db-file__content">
                                        <h4>${escapeHtml(file.title)}</h4>
                                        <span>${escapeHtml(file.formatLabel)} · ${escapeHtml(file.sizeLabel)}${file.isSample ? ' · نسخة تجريبية' : ''}</span>
                                    </div>
                                    <div class="rs-db-file__actions">
                                        <a class="btn btn--primary btn--sm" href="${escapeAttr(file.url)}" download="${escapeAttr(file.downloadName)}">${downloadIcon} تحميل</a>
                                        <a class="rs-card__preview" href="${escapeAttr(file.url)}" target="_blank" rel="noopener noreferrer">عرض</a>
                                    </div>
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </details>
            `).join('');
        }

        this.container.innerHTML = `
            <div class="ready-studies" dir="rtl">
                <div class="rs-hero">
                    <div class="rs-hero__icon">${fileIcon}</div>
                    <div>
                        <p class="rs-eyebrow">مكتبة قواعد بيانات</p>
                        <h2 class="dv-section__title">قواعد البيانات</h2>
                        <p class="rs-hero__copy">أدلة وقواعد بيانات جاهزة للتحميل، مرتبة حسب المجال والقطاع.</p>
                    </div>
                    <div class="rs-hero__stats" aria-label="إحصاءات قواعد البيانات">
                        <strong>${escapeHtml(catalog.totalFiles)}</strong>
                        <span>ملف في ${escapeHtml(catalog.totalGroups)} مجالاً</span>
                    </div>
                </div>

                <div class="rs-intro-box">
                    <h3>فكرة مكتبة قواعد البيانات وأدلة القطاعات:</h3>
                    <ul>
                        <li><strong>الاسترشاد والاستلهام:</strong> فهم حجم السوق، الاتجاهات الحالية، وتحليل المنافسين في قطاعك لاكتشاف الفرص.</li>
                        <li><strong>دعم القرارات بالبيانات:</strong> الحصول على أرقام وإحصائيات موثوقة لتبني عليها افتراضات مشروعك وتتجنب التخمين الخاطئ.</li>
                        <li><strong>تسريع عملية البحث:</strong> توفير الوقت والجهد للوصول للمعلومات المحورية بدلاً من البحث العشوائي المشتت.</li>
                        <li><strong>مرجع استراتيجي:</strong> أساس قوي تعتمد عليه لبناء دراسة الجدوى الخاصة بك باحترافية وبناءً على معطيات حقيقية للسوق.</li>
                    </ul>
                </div>

                <section class="rs-databases" aria-labelledby="rsDatabasesTitle">
                    <div class="rs-databases__header">
                        <div>
                            <h3 id="rsDatabasesTitle">أقسام قواعد البيانات</h3>
                            <p>تصفح وحمل الملفات حسب المجال.</p>
                        </div>
                    </div>
                    <div class="rs-db-groups">${groupsHtml}</div>
                </section>
            </div>
        `;
    }
}

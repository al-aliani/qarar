import { escapeAttr, escapeHtml } from '../utils/escape.js';

const downloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>';
const fileIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';

export class HRFilesView {
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
                    <p>جاري تجهيز فهرس ملفات الموارد البشرية…</p>
                </div>
            `;
            try {
                const response = await fetch('/data/hr-files.json', { cache: 'no-store' });
                if (!response.ok) throw new Error(`HR files catalogue request failed: ${response.status}`);
                this.catalog = await response.json();
                this.loaded = true;
            } catch (error) {
                console.error('HR files catalogue failed:', error);
                this.container.innerHTML = `
                    <div class="rs-error" role="alert">
                        <strong>تعذّر تحميل فهرس ملفات الموارد البشرية.</strong>
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
                                        <span>${escapeHtml(file.formatLabel)} · ${escapeHtml(file.sizeLabel)}</span>
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
                        <p class="rs-eyebrow">مكتبة جاهزة للتحميل</p>
                        <h2 class="dv-section__title">ملفات الموارد البشرية</h2>
                        <p class="rs-hero__copy">نماذج ووصف وظيفي وملفات إدارية جاهزة داعمة لعملياتك ومشاريعك.</p>
                    </div>
                    <div class="rs-hero__stats" aria-label="إحصاءات المكتبة">
                        <strong>${escapeHtml(catalog.totalFiles)}</strong>
                        <span>ملف في ${escapeHtml(catalog.totalGroups)} قسم</span>
                    </div>
                </div>

                <div class="rs-intro-box">
                    <h3>فكرة مكتبة الموارد البشرية والنماذج الوظيفية:</h3>
                    <ul>
                        <li><strong>الاسترشاد والاستلهام:</strong> فهم كيفية بناء الهيكل التنظيمي الأنسب لمشروعك وتوزيع الأدوار الوظيفية.</li>
                        <li><strong>معرفة متطلبات التوظيف:</strong> تصور واضح للمهام، المسؤوليات، والمؤهلات لكل وظيفة لتجنب العشوائية الإدارية.</li>
                        <li><strong>تسريع عملية التوظيف:</strong> استخدام نماذج جاهزة وقابلة للتعديل لاختيار وتقييم فريق عملك بكفاءة وسرعة.</li>
                        <li><strong>أساس تنظيمي:</strong> خريطة طريق توضح لك كيفية إدارة وتنظيم الموظفين باحترافية قبل البدء الفعلي في التشغيل.</li>
                    </ul>
                </div>

                <section class="rs-databases" aria-labelledby="rsHRTitle">
                    <div class="rs-databases__header">
                        <div>
                            <h3 id="rsHRTitle">أقسام الموارد البشرية</h3>
                            <p>تصفح وحمل الملفات حسب القسم المناسب.</p>
                        </div>
                    </div>
                    <div class="rs-db-groups">${groupsHtml}</div>
                </section>
            </div>
        `;
    }
}

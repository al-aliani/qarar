import { escapeAttr, escapeHtml } from '../utils/escape.js';
import { parseWorksheetRows } from './DatabaseCompanyPicker.js';
import { attachModalA11y } from '../utils/modalA11y.js';

const downloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></svg>';
const fileIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';

export class DatabaseFilesView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.catalog = null;
        this.loaded = false;
        this.options = options;
        this.previewOverlay = null;
        this.previewState = null;
        this.container?.addEventListener('click', (e) => this._onContainerClick(e));
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
        const filterTerm = (this.options.filterTerm || '').trim().toLowerCase();
        const matchesFilter = (value) => String(value || '').toLowerCase().includes(filterTerm);
        const groups = filterTerm
            ? (catalog.groups || []).map((group) => {
                const files = (group.files || []).filter((file) => [
                    group.label,
                    group.description,
                    file.title,
                    file.filename,
                    file.downloadName
                ].some(matchesFilter));
                const groupMatches = [group.label, group.description, group.sourceFolder].some(matchesFilter);
                return groupMatches ? { ...group, files: files.length ? files : (group.files || []) } : { ...group, files };
            }).filter((group) => (group.files || []).length)
            : (catalog.groups || []);
        const totalFiles = groups.reduce((sum, group) => sum + (group.files || []).length, 0);
        const title = this.options.title || 'قواعد البيانات';
        const eyebrow = this.options.eyebrow || 'مكتبة قواعد بيانات';
        const copy = this.options.copy || 'أدلة وقواعد بيانات جاهزة للتحميل، مرتبة حسب المجال والقطاع.';
        const introTitle = this.options.introTitle || 'فكرة مكتبة قواعد البيانات وأدلة القطاعات:';
        const sectionTitle = this.options.sectionTitle || 'أقسام قواعد البيانات';
        const sectionCopy = this.options.sectionCopy || 'تصفح وحمل الملفات حسب المجال.';
        
        let groupsHtml = '';
        if (groups.length) {
            groupsHtml = groups.map((group) => `
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
                                        <button type="button" class="rs-card__preview" data-preview-file="${escapeAttr(file.id)}" data-preview-group="${escapeAttr(group.id)}">معاينة المحتوى</button>
                                    </div>
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </details>
            `).join('');
        } else {
            groupsHtml = `
                <div class="rs-error" role="status">
                    <strong>لا توجد ملفات مطابقة حالياً.</strong>
                    <p>أضف ملفات تحتوي على "${escapeHtml(this.options.filterTerm || '')}" في الفهرس لتظهر هنا تلقائياً.</p>
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="ready-studies" dir="rtl">
                <div class="rs-hero">
                    <div class="rs-hero__icon">${fileIcon}</div>
                    <div>
                        <p class="rs-eyebrow">${escapeHtml(eyebrow)}</p>
                        <h2 class="dv-section__title">${escapeHtml(title)}</h2>
                        <p class="rs-hero__copy">${escapeHtml(copy)}</p>
                    </div>
                    <div class="rs-hero__stats" aria-label="إحصاءات قواعد البيانات">
                        <strong>${escapeHtml(filterTerm ? totalFiles : catalog.totalFiles)}</strong>
                        <span>ملف في ${escapeHtml(filterTerm ? groups.length : catalog.totalGroups)} مجالاً</span>
                    </div>
                </div>

                <div class="rs-intro-box">
                    <h3>${escapeHtml(introTitle)}</h3>
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
                            <h3 id="rsDatabasesTitle">${escapeHtml(sectionTitle)}</h3>
                            <p>${escapeHtml(sectionCopy)}</p>
                        </div>
                    </div>
                    <div class="rs-db-groups">${groupsHtml}</div>
                </section>
            </div>
        `;
    }

    _onContainerClick(e) {
        const btn = e.target.closest('[data-preview-file]');
        if (!btn) return;
        const group = (this.catalog?.groups || []).find((g) => g.id === btn.getAttribute('data-preview-group'));
        const file = group?.files?.find((f) => f.id === btn.getAttribute('data-preview-file'));
        if (file) this._openPreview(file);
    }

    _ensurePreviewOverlay() {
        let overlay = document.getElementById('databaseFilePreviewOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'databaseFilePreviewOverlay';
            document.body.appendChild(overlay);
            // مُرفَق مرة واحدة للأبد على مستوى الصفحة — يقرأ overlay._activeView ديناميكياً
            // بدل الإغلاق على `this` وقت الربط، لأن DatabaseFilesView يُعاد إنشاؤه في كل
            // DashboardView.draw() (انظر DashboardView.js) فيصبح `this` هنا نسخة ميتة قديمة.
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay._activeView?._closePreview(); });
        }
        overlay.classList.add('modal-overlay');
        overlay._activeView = this;
        this.previewOverlay = overlay;
        return overlay;
    }

    async _openPreview(file) {
        const overlay = this._ensurePreviewOverlay();
        this.previewState = { file, loading: true, error: null, headers: [], rowCount: 0 };
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        this._renderPreview();
        // بعد أول رسم: بطاقة [role="dialog"] صارت في DOM. كان هنا Escape يدوي فقط —
        // بلا حبس Tab (رغم aria-modal) وبلا إعادة تركيز لزر «معاينة المحتوى» الفاتح.
        if (!this._a11y) {
            this._a11y = attachModalA11y({
                container: overlay,
                labelledBy: 'dbFilePreviewTitle',
                initialFocus: '[data-preview-close]',
                onEscape: () => this._closePreview()
            });
        }
        try {
            const res = await fetch(file.url);
            if (!res.ok) throw new Error(`status ${res.status}`);
            const buffer = await res.arrayBuffer();
            const mod = await import('exceljs');
            const ExcelJS = mod.default && mod.default.Workbook ? mod.default : mod;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const parsed = parseWorksheetRows(workbook.worksheets[0]);
            this.previewState.headers = parsed.headers;
            this.previewState.rowCount = parsed.rows.length;
        } catch (error) {
            console.error('DatabaseFilesView: preview parse failed', error);
            this.previewState.error = 'تعذّر تحليل هذا الملف للمعاينة. جرّب التحميل المباشر.';
        } finally {
            this.previewState.loading = false;
            this._renderPreview();
        }
    }

    _closePreview() {
        if (!this.previewOverlay) return;
        this.previewOverlay.classList.remove('is-open');
        document.body.style.overflow = '';
        this.previewState = null;
        this._a11y?.release();
        this._a11y = null;
    }

    _renderPreview() {
        const overlay = this.previewOverlay;
        const state = this.previewState;
        if (!overlay || !state) return;
        const { file, loading, error, headers, rowCount } = state;

        let body;
        if (loading) {
            body = `<div class="rs-loading" role="status" aria-live="polite"><div class="loader"></div><p>جاري تحليل الملف…</p></div>`;
        } else if (error) {
            body = `<div class="rs-error" role="alert"><strong>${escapeHtml(error)}</strong></div>`;
        } else {
            const shown = headers.slice(0, 5);
            const restCount = headers.length - shown.length;
            body = headers.length ? `
                <p class="text-sm"><strong>${escapeHtml(rowCount)}</strong> صف بيانات فعلي · <strong>${escapeHtml(headers.length)}</strong> عمود</p>
                <p class="text-sm text-muted mb-2">أول أعمدة الملف:</p>
                <div class="rs-card__tags">${shown.map((h) => `<span class="rs-tag">${escapeHtml(h)}</span>`).join('')}</div>
                ${restCount > 0 ? `<p class="text-xs text-muted mt-2">و${restCount} عمود آخر.</p>` : ''}
            ` : `<p class="text-sm text-muted">تعذّر اكتشاف رؤوس أعمدة في هذا الملف.</p>`;
        }

        overlay.innerHTML = `
            <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="dbFilePreviewTitle" dir="rtl" style="width:420px;max-width:92vw;">
                <div class="modal-header">
                    <h3 id="dbFilePreviewTitle">${fileIcon} ${escapeHtml(file.title)}</h3>
                    <button type="button" class="btn-close" data-preview-close aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body">${body}</div>
                ${!loading ? `
                    <div class="modal-footer flex-between gap-2">
                        <a class="btn btn--primary btn-sm" href="${escapeAttr(file.url)}" download="${escapeAttr(file.downloadName)}">${downloadIcon} تحميل الملف</a>
                        <button type="button" class="btn btn--secondary btn-sm" data-preview-close>إغلاق</button>
                    </div>
                ` : ''}
            </div>
        `;
        overlay.querySelectorAll('[data-preview-close]').forEach((btn) => btn.addEventListener('click', () => this._closePreview()));

        // الرسم الثاني (بعد تحليل الملف) يستبدل innerHTML فيختفي العنصر المركَّز —
        // أعِد التركيز داخل النافذة بدل تركه يسقط على body.
        if (this._a11y && !overlay.contains(document.activeElement)) this._a11y.focusInitial();
    }
}

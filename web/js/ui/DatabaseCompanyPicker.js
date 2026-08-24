/**
 * منتقي شركات من مكتبة قواعد البيانات (web/public/data/database-files.json +
 * ملفات xlsx الفعلية) — بديل عن "تصفح/تحميل فقط" (DatabaseFilesView.js) حين
 * يكون المستخدم فعلياً داخل معالج دراسة ويريد إدراج صفوف جاهزة في جدول الموردين
 * أو المنافسين مباشرة. لا يتعامل مع أي جدول بنفسه — يستدعي onAdd(rows, targetType)
 * فقط، ليبقى قابلاً لإعادة الاستخدام من أكثر من مكان (Wizard.js حالياً).
 *
 * ملاحظة أعمدة: ملفات الإكسل المصدر ليست موحّدة الشكل — أسماء الأعمدة تختلف
 * فعلياً بين ملف وآخر (تحقّق مباشر: companyName/arabic_name/name، sectorType/
 * main_activity/النشاط الرئيسي، cr/trading_number/السجل التجاري...). detectColumn
 * أدناه يبحث عن أول عمود مطابق من قائمة بدائل بدل افتراض اسم عمود ثابت.
 *
 * ملاحظة صف الرؤوس: أغلب الملفات تضع الرؤوس في الصف الأول، لكن ملف "دليل
 * المصانع السعودية" (تحقّق مباشر) يضع عنواناً مكرراً في الصفوف 2-4 والرؤوس
 * الحقيقية في الصف 6 — findHeaderRowNumber يتعامل مع هذا دون افتراض رقم صف ثابت.
 */
import { escapeHtml, escapeAttr } from '../utils/escape.js';
import { toast } from '../utils/toast.js';

const MAX_VISIBLE_ROWS = 50;

const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

// ─── تحويل قيمة خلية exceljs الخام لنص عادي (نص/رقم/تاريخ/نص غني/رابط/معادلة) ───
export function extractCellText(raw) {
    if (raw === null || raw === undefined) return '';
    if (raw instanceof Date) return raw.toLocaleDateString('ar-SA');
    if (typeof raw === 'object') {
        if (Array.isArray(raw.richText)) return raw.richText.map((t) => t.text || '').join('');
        if (typeof raw.text === 'string') return raw.text; // خلية رابط {text, hyperlink}
        if (raw.result !== undefined) return extractCellText(raw.result); // خلية معادلة
        return '';
    }
    return String(raw);
}

// بعض ملفات المصدر تحوي هروب حرفي "_x000D_" بدل سطر فعلي (تحقّق مباشر على عيّنة
// "الأجهزة الطبية": companyName يحوي "...المحدودة_x000D_\n_x000D_\n") — ننظّفه هنا.
export function cleanText(value) {
    return extractCellText(value)
        .replace(/_x000d_/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeHeader(h) {
    return String(h || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

const NAME_PATTERNS = ['arabicname', 'companyname', 'tradingname', 'اسمالمصنع', 'اسمالمنشأة', 'اسمالمؤسسة', 'اسمالشركة', 'اسم', 'name'];
const ACTIVITY_PATTERNS = ['sectortype', 'mainactivity', 'النشاطالرئيسي', 'النشاط', 'نشاط', 'businesssubtype', 'businesstype', 'companytype', 'category'];
const CITY_PATTERNS = ['city', 'المدينة', 'region', 'المنطقة', 'area'];
const PHONE_PATTERNS = ['mobile', 'phonenumber', 'phone', 'جوال', 'هاتف', 'whatsup'];
const EMAIL_PATTERNS = ['email', 'بريد'];
const CR_PATTERNS = ['cr', 'tradingnumber', 'licensenumber', 'license', 'السجلالتجاري', 'رمزالمنشأة', 'رخصة'];

/** أول عمود (من رؤوس الملف الفعلية) يطابق أحد الأنماط بالترتيب، أو null. */
export function detectColumn(headers, patterns) {
    for (const pattern of patterns) {
        const found = headers.find((h) => normalizeHeader(h).includes(pattern));
        if (found) return found;
    }
    return null;
}

function buildContactNotes(row, headers) {
    const cityCol = detectColumn(headers, CITY_PATTERNS);
    const phoneCol = detectColumn(headers, PHONE_PATTERNS);
    const emailCol = detectColumn(headers, EMAIL_PATTERNS);
    const crCol = detectColumn(headers, CR_PATTERNS);
    const parts = [];
    const city = cityCol ? cleanText(row[cityCol]) : '';
    const phone = phoneCol ? cleanText(row[phoneCol]) : '';
    const email = emailCol ? cleanText(row[emailCol]) : '';
    const cr = crCol ? cleanText(row[crCol]) : '';
    if (city) parts.push(`المدينة: ${city}`);
    if (phone) parts.push(`الجوال: ${phone}`);
    if (email) parts.push(`البريد: ${email}`);
    if (cr) parts.push(`السجل التجاري: ${cr}`);
    parts.push('المصدر: مكتبة قواعد بيانات قرار');
    return parts.join(' — ');
}

/** يحوّل صفاً واحداً (كائن {رأس العمود: نص}) لشكل عمود جدول الموردين. */
export function buildSupplierRow(row, headers) {
    const nameCol = detectColumn(headers, NAME_PATTERNS);
    const activityCol = detectColumn(headers, ACTIVITY_PATTERNS);
    return {
        name: nameCol ? cleanText(row[nameCol]) : '',
        supplyNature: activityCol ? cleanText(row[activityCol]) : '',
        availability: '',
        avgDeliveryDays: 0,
        notes: buildContactNotes(row, headers)
    };
}

/**
 * يحوّل صفاً واحداً لشكل عمود جدول المنافسين — الاسم فقط من الملف؛ بقية
 * الأعمدة (schema.js: competitors) تبقى undefined عمداً (لا تخمين أرقام/نصوص
 * تنافسية غير موجودة أصلاً في ملف دليل شركات). لا حقل notes في هذا الجدول أصلاً.
 */
export function buildCompetitorRow(row, headers) {
    const nameCol = detectColumn(headers, NAME_PATTERNS);
    return {
        name: nameCol ? cleanText(row[nameCol]) : '',
        strengths: undefined,
        weaknesses: undefined,
        marketShare: undefined,
        estimatedDailyCustomers: undefined,
        estimatedAvgTicket: undefined
    };
}

/**
 * صف الرؤوس الفعلي: أول صف فيه خليتان مختلفتان فأكثر (لا نص عنوان مكرر بكل
 * الخلايا). التحقّق المباشر على "دليل المصانع السعودية" أثبت أن الرؤوس ليست
 * دوماً بالصف 1 — عنوان مكرر بالصفوف 2-4 كان سيُقرأ خطأً كرؤوس أعمدة بدون هذا الفحص.
 */
export function findHeaderRowNumber(sheet, maxScan = 20) {
    const limit = Math.min(maxScan, sheet.rowCount || maxScan);
    for (let r = 1; r <= limit; r++) {
        const values = [];
        sheet.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
            const text = cleanText(cell.value);
            if (text) values.push(text);
        });
        if (values.length >= 2 && new Set(values).size >= 2) return r;
    }
    return 1;
}

/** يحوّل ورقة exceljs محمّلة فعلياً لـ{headers, rows} — منطق خالص، قابل للاختبار بلا I/O. */
export function parseWorksheetRows(sheet) {
    if (!sheet) return { headers: [], rows: [] };
    const headerRowNumber = findHeaderRowNumber(sheet);
    const headersByColumn = [];
    sheet.getRow(headerRowNumber).eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = cleanText(cell.value);
        if (text) headersByColumn[colNumber] = text;
    });
    const headers = headersByColumn.filter(Boolean);
    const rows = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowNumber) return;
        const obj = {};
        let hasValue = false;
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const key = headersByColumn[colNumber];
            if (!key) return;
            const text = cleanText(cell.value);
            obj[key] = text;
            if (text) hasValue = true;
        });
        if (hasValue) rows.push(obj);
    });
    return { headers, rows };
}

export class DatabaseCompanyPicker {
    constructor(options = {}) {
        this.onAdd = typeof options.onAdd === 'function' ? options.onAdd : () => {};
        this.enabledTargets = Array.isArray(options.enabledTargets) && options.enabledTargets.length
            ? options.enabledTargets
            : ['suppliers', 'competitors'];
        this.overlay = document.getElementById('databaseCompanyPickerOverlay') || this._createOverlay();
        // مُدمَّن دوماً بلا شرط (لا `if (!this.overlay)`) — عنصر مُعرَّف مسبقاً بلا
        // كلاس يبقى بلا هذا الكلاس للأبد وتصبح is-open بلا أي أثر بصري (علة سابقة موثّقة).
        this.overlay.classList.add('modal-overlay');
        this.catalog = null;
        this._reset();
    }

    _createOverlay() {
        const el = document.createElement('div');
        el.id = 'databaseCompanyPickerOverlay';
        document.body.appendChild(el);
        return el;
    }

    _reset() {
        this.groupSearch = '';
        this.activeFile = null; // { file, group }
        this.headers = [];
        this.rows = [];
        this.rowSearch = '';
        this.selected = new Set();
        this.loadingRows = false;
        this.rowsError = null;
    }

    async open(targetType) {
        this._reset();
        this.defaultTarget = this.enabledTargets.includes(targetType) ? targetType : this.enabledTargets[0];
        this.overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        this._onEscape = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._onEscape);
        this.render();
        await this._loadCatalog();
        this.render();
    }

    close() {
        this.overlay.classList.remove('is-open');
        document.body.style.overflow = '';
        if (this._onEscape) {
            document.removeEventListener('keydown', this._onEscape);
            this._onEscape = null;
        }
    }

    async _loadCatalog() {
        if (this.catalog) return;
        try {
            const res = await fetch('/data/database-files.json', { cache: 'no-store' });
            if (!res.ok) throw new Error(`status ${res.status}`);
            this.catalog = await res.json();
        } catch (err) {
            console.error('DatabaseCompanyPicker: catalog load failed', err);
            this.catalog = { groups: [] };
            this.catalogError = true;
        }
    }

    async _pickFile(file, group) {
        this.activeFile = { file, group };
        this.headers = [];
        this.rows = [];
        this.selected = new Set();
        this.rowSearch = '';
        this.rowsError = null;
        this.loadingRows = true;
        this.render();
        try {
            const res = await fetch(file.url);
            if (!res.ok) throw new Error(`status ${res.status}`);
            const buffer = await res.arrayBuffer();
            // استيراد ديناميكي — exceljs لا يُحمَّل إلا عند فتح ملف فعلياً (الملف قد
            // يصل 400+ كيلوبايت، لا داعي لدفع تكلفته لكل زيارة للمعالج).
            const mod = await import('exceljs');
            const ExcelJS = mod.default && mod.default.Workbook ? mod.default : mod;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const parsed = parseWorksheetRows(workbook.worksheets[0]);
            this.headers = parsed.headers;
            this.rows = parsed.rows.map((row, index) => ({ ...row, __rowId: index }));
        } catch (err) {
            console.error('DatabaseCompanyPicker: file parse failed', err);
            this.rowsError = 'تعذّر قراءة هذا الملف. جرّب ملفاً آخر أو أعد المحاولة.';
        } finally {
            this.loadingRows = false;
            this.render();
        }
    }

    _matchingRows() {
        const term = this.rowSearch.trim().toLowerCase();
        if (!term) return this.rows;
        const nameCol = detectColumn(this.headers, NAME_PATTERNS);
        const activityCol = detectColumn(this.headers, ACTIVITY_PATTERNS);
        const cityCol = detectColumn(this.headers, CITY_PATTERNS);
        return this.rows.filter((row) => {
            const haystack = [nameCol && row[nameCol], activityCol && row[activityCol], cityCol && row[cityCol]]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(term);
        });
    }

    _filteredGroups() {
        const groups = (this.catalog && this.catalog.groups) || [];
        const term = this.groupSearch.trim().toLowerCase();
        if (!term) return groups;
        return groups.filter((g) => String(g.label || '').toLowerCase().includes(term));
    }

    _addSelected(targetType) {
        if (!this.enabledTargets.includes(targetType)) return;
        const selectedRows = this.rows.filter((row) => this.selected.has(row.__rowId));
        if (!selectedRows.length) return;
        const transform = targetType === 'competitors' ? buildCompetitorRow : buildSupplierRow;
        const mapped = selectedRows.map((row) => transform(row, this.headers));
        this.onAdd(mapped, targetType);
        const count = mapped.length;
        const label = targetType === 'competitors' ? 'كمنافسين' : 'كموردين';
        toast.success(`أُضيف ${count} ${count === 1 ? 'صف' : 'صفوف'} ${label} — راجع البيانات وعدّلها حسب واقعك الفعلي.`);
        this.close();
    }

    /** يعيد رسم المحتوى مع الحفاظ على تركيز حقل البحث النشط وموضع مؤشره (وإلا
     *  يفقد المستخدم التركيز بعد كل حرف يكتبه لأن render() يستبدل innerHTML بالكامل). */
    _rerenderPreservingFocus() {
        const active = document.activeElement;
        const activeId = active && this.overlay.contains(active) ? active.id : null;
        const selStart = activeId && 'selectionStart' in active ? active.selectionStart : null;
        const selEnd = activeId && 'selectionEnd' in active ? active.selectionEnd : null;
        this.render();
        if (activeId) {
            const el = document.getElementById(activeId);
            if (el) {
                el.focus();
                if (selStart != null && el.setSelectionRange) {
                    try { el.setSelectionRange(selStart, selEnd); } catch { /* أنواع إدخال لا تدعم selectionRange */ }
                }
            }
        }
    }

    render() {
        const rowsListEl = document.getElementById('dbPickerRowsList');
        const rowsScrollTop = rowsListEl ? rowsListEl.scrollTop : 0;

        const body = this.activeFile ? this._renderRowsView() : this._renderGroupsView();
        const footer = this.activeFile && !this.loadingRows && !this.rowsError ? this._renderFooter() : '';

        this.overlay.innerHTML = `
            <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="dbPickerTitle" dir="rtl" style="width:760px;max-width:95vw;">
                <div class="modal-header">
                    <h3 id="dbPickerTitle">${icon('i-folder')} اختر شركات من قواعد بياناتنا</h3>
                    <button type="button" class="btn-close" data-picker-close aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body">${body}</div>
                ${footer}
            </div>
        `;

        const newRowsListEl = document.getElementById('dbPickerRowsList');
        if (newRowsListEl) newRowsListEl.scrollTop = rowsScrollTop;

        this._bindEvents();
    }

    _renderGroupsView() {
        if (this.catalogError) {
            return `
                <div class="rs-error" role="alert">
                    <strong>تعذّر تحميل فهرس قواعد البيانات.</strong>
                    <p>تأكد من الاتصال ثم أعد المحاولة.</p>
                    <button type="button" class="btn btn--secondary" data-picker-retry-catalog>إعادة المحاولة</button>
                </div>
            `;
        }
        if (!this.catalog) {
            return `
                <div class="rs-loading" role="status" aria-live="polite">
                    <div class="loader"></div>
                    <p>جاري تجهيز فهرس قواعد البيانات…</p>
                </div>
            `;
        }
        const groups = this._filteredGroups();
        const groupsHtml = groups.length
            ? groups.map((g) => `
                <div class="mb-2">
                    <div class="text-sm" style="font-weight:600;margin-bottom:4px;">${escapeHtml(g.label)}</div>
                    <div class="flex flex-wrap gap-2">
                        ${(g.files || []).map((f) => `
                            <button type="button" class="btn btn--secondary btn-sm" data-picker-file="${escapeAttr(f.id)}" data-picker-group="${escapeAttr(g.id)}">
                                ${escapeHtml(f.title)}${f.isSample ? ' (تجريبي)' : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('')
            : `<p class="text-sm text-muted">لا توجد مجالات مطابقة لـ"${escapeHtml(this.groupSearch)}".</p>`;

        return `
            <input type="text" id="dbPickerGroupSearch" class="input mb-2" placeholder="ابحث باسم المجال (مطاعم، مقاولات، مصانع...)" value="${escapeAttr(this.groupSearch)}">
            <div style="max-height:420px;overflow-y:auto;">${groupsHtml}</div>
        `;
    }

    _renderRowsView() {
        const { file } = this.activeFile;
        const header = `
            <div class="flex-between mb-2">
                <button type="button" class="btn btn--secondary btn-sm" data-picker-back>${icon('i-arrow-right')} رجوع لقائمة المجالات</button>
                <span class="text-sm text-muted">${escapeHtml(file.title)}</span>
            </div>
        `;

        if (this.loadingRows) {
            return `${header}
                <div class="rs-loading" role="status" aria-live="polite">
                    <div class="loader"></div>
                    <p>جاري تحميل وتحليل الملف…</p>
                </div>
            `;
        }
        if (this.rowsError) {
            return `${header}
                <div class="rs-error" role="alert">
                    <strong>${escapeHtml(this.rowsError)}</strong>
                </div>
            `;
        }

        const nameCol = detectColumn(this.headers, NAME_PATTERNS);
        const activityCol = detectColumn(this.headers, ACTIVITY_PATTERNS);
        const cityCol = detectColumn(this.headers, CITY_PATTERNS);
        const matches = this._matchingRows();
        const visible = matches.slice(0, MAX_VISIBLE_ROWS);
        const remaining = matches.length - visible.length;

        const rowsHtml = visible.length
            ? visible.map((row) => {
                const name = nameCol ? cleanText(row[nameCol]) : '';
                const meta = [activityCol ? cleanText(row[activityCol]) : '', cityCol ? cleanText(row[cityCol]) : '']
                    .filter(Boolean).join(' · ');
                return `
                    <label class="flex items-center gap-2" style="padding:6px 4px;border-bottom:1px solid var(--c-border);">
                        <input type="checkbox" class="checkbox" data-picker-row-id="${row.__rowId}" ${this.selected.has(row.__rowId) ? 'checked' : ''}>
                        <span style="font-weight:600;">${escapeHtml(name || '(بلا اسم)')}</span>
                        <span class="text-xs text-muted">${escapeHtml(meta)}</span>
                    </label>
                `;
            }).join('')
            : `<p class="text-sm text-muted">لا توجد نتائج مطابقة.</p>`;

        return `${header}
            <input type="text" id="dbPickerRowSearch" class="input mb-2" placeholder="ابحث بالاسم أو النشاط أو المدينة..." value="${escapeAttr(this.rowSearch)}">
            <div id="dbPickerRowsList" style="max-height:340px;overflow-y:auto;border-top:1px solid var(--c-border);">${rowsHtml}</div>
            ${remaining > 0 ? `<p class="text-xs text-muted mt-2">اكتب للبحث ضمن باقي ${remaining} صف.</p>` : ''}
        `;
    }

    _renderFooter() {
        const count = this.selected.size;
        const disabled = count ? '' : 'disabled';
        return `
            <div class="modal-footer flex-between gap-2">
                <span class="text-sm text-muted">${count} محدَّد</span>
                <div class="flex gap-2">
                    ${this.enabledTargets.includes('suppliers') ? `<button type="button" class="btn btn--primary btn-sm" data-picker-add="suppliers" ${disabled}>أضف المحدَّد كموردين</button>` : ''}
                    ${this.enabledTargets.includes('competitors') ? `<button type="button" class="btn btn--secondary btn-sm" data-picker-add="competitors" ${disabled}>أضف المحدَّد كمنافسين</button>` : ''}
                </div>
            </div>
        `;
    }

    _bindEvents() {
        this.overlay.querySelector('[data-picker-close]')?.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });

        this.overlay.querySelector('[data-picker-retry-catalog]')?.addEventListener('click', () => {
            this.catalog = null;
            this.catalogError = false;
            this._loadCatalog().then(() => this.render());
            this.render();
        });

        const groupSearch = this.overlay.querySelector('#dbPickerGroupSearch');
        groupSearch?.addEventListener('input', (e) => {
            this.groupSearch = e.target.value;
            this._rerenderPreservingFocus();
        });

        this.overlay.querySelectorAll('[data-picker-file]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const groupId = btn.getAttribute('data-picker-group');
                const fileId = btn.getAttribute('data-picker-file');
                const group = (this.catalog?.groups || []).find((g) => g.id === groupId);
                const file = group?.files?.find((f) => f.id === fileId);
                if (file) this._pickFile(file, group);
            });
        });

        this.overlay.querySelector('[data-picker-back]')?.addEventListener('click', () => {
            this.activeFile = null;
            this.headers = [];
            this.rows = [];
            this.rowSearch = '';
            this.selected = new Set();
            this.render();
        });

        const rowSearch = this.overlay.querySelector('#dbPickerRowSearch');
        rowSearch?.addEventListener('input', (e) => {
            this.rowSearch = e.target.value;
            this._rerenderPreservingFocus();
        });

        this.overlay.querySelectorAll('[data-picker-row-id]').forEach((cb) => {
            cb.addEventListener('change', (e) => {
                const id = Number(e.target.getAttribute('data-picker-row-id'));
                if (e.target.checked) this.selected.add(id);
                else this.selected.delete(id);
                this.render();
            });
        });

        this.overlay.querySelectorAll('[data-picker-add]').forEach((btn) => {
            btn.addEventListener('click', () => this._addSelected(btn.getAttribute('data-picker-add')));
        });
    }
}

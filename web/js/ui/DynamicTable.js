import { getLabel } from '../core/labels.js';
import { toast } from '../utils/toast.js';
import { escapeHtml } from '../utils/escape.js';
import Swal from 'sweetalert2';
import Cleave from 'cleave.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#${id}"/></svg>`;

/**
 * Dynamic Table Component
 * Renders editable tables with add/delete row functionality
 */
export class DynamicTable {
    /** أعمدة مخزنة ككسر (0–1) وتُعرض/تُحرَّر كنسبة مئوية (0–100) — نفس نهج Wizard.isFractionPercentKey */
    static isFractionPercentColumn(colKey) {
        // تدقيق 2026-07-08 (ملاحظة عالية #38): variablePercent (عمود «% متغير» باللوجستيات)
        // كان غائباً عن هذه القائمة رغم مطابقة اسمه ووسمه لبقية أعمدة الكسر (variableCostRate)
        // — فيُعرض/يُحرَّر كرقم خام بلا تحويل، ويتناقض مع قوالب الخبراء التي تُخزّنه ككسر (0.7).
        // تدقيق دفعة 3 (2026-07-12): wasteRate/platformCommissionRate (جدول مصادر الإيرادات)
        // عمودان كسريان جديدان — غيابهما هنا يعني تحويل إدخال 30 إلى 3000% كما حدث سابقاً
        // مع variablePercent (فخّ وحدة الكسر الموثَّق).
        return ['growthRate', 'variableCostRate', 'amortizationRate', 'depreciationRate', 'rate', 'utilizationRate', 'variablePercent', 'wasteRate', 'platformCommissionRate'].includes(colKey);
    }

    /**
     * محلّل أرقام متسامح: يطبّع الأرقام الهندية العربية (٠-٩) والفارسية (۰-۹)، والفاصلة
     * العشرية العربية «٫»، وفواصل الآلاف (عربية «٬» وغربية ,)، قبل التحويل لرقم.
     * تدقيق اختبار عميل 2026-07-12: type="number" الأصلي يُفرغ value بصمت (badInput)
     * عند الكتابة بلوحة مفاتيح عربية فتُخزَّن 0 دون أي إشعار — هذا المحلّل يمنع ذلك
     * لأن الحقول أصبحت type="text" (القيمة الخام تصل دوماً، لا حالة badInput ممكنة).
     * @returns {number|null} الرقم المُطبَّع، أو null إن تعذّر التحليل (نص فارغ/غير رقمي)
     */
    static parseLenientNumber(raw) {
        if (raw === null || raw === undefined) return null;
        let s = String(raw).trim();
        if (s === '') return null;
        s = s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));
        s = s.replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0));
        s = s.replace(/٫/g, '.'); // فاصلة عشرية عربية
        s = s.replace(/[٬,]/g, ''); // فواصل آلاف عربية/غربية
        s = s.replace(/\s+/g, '');
        if (s === '' || s === '-' || s === '.') return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    }

    /**
     * تقدير استرشادي نقي (قابل للاختبار) لقيمة خلية بناءً على المفتاح واسم البند.
     * ⚠️ الأعمدة الكسرية (growthRate/variableCostRate/amortizationRate) تُعاد ككسر (0–1)
     * لا كنسبة مئوية خام — لتفادي خطأ ×100 الذي يجعل 55% تُخزَّن 55 وتُعرض 5500% فتدمّر الدراسة.
     * @param {string} colKey مفتاح العمود
     * @param {string} [itemName] اسم البند (لمطابقة الكلمات المفتاحية القطاعية)
     * @returns {number} القيمة المُقدَّرة الجاهزة للتخزين
     */
    static estimateCellValue(colKey, itemName = '') {
        const name = String(itemName || '').toLowerCase();
        // Estimate definitions — النطاقات بوحدة التخزين (الأعمدة الكسرية بوحدة الكسر لا النسبة المئوية)
        const estimates = {
            'price': [
                { keywords: ['فرن', 'ثلاجة', 'معدات', 'آلة', 'ماكينة', 'خط إنتاج'], min: 3000, max: 15000 },
                { keywords: ['ديكور', 'أثاث', 'طاولة', 'كرسي', 'كنبة', 'رفوف'], min: 500, max: 3500 },
                { keywords: ['كمبيوتر', 'لابتوب', 'طابعة', 'كاشير', 'شاشة', 'نظام'], min: 1500, max: 5000 },
                { keywords: ['لوحة', 'تراخيص', 'سجل', 'رخصة', 'تصريح'], min: 500, max: 2500 },
                { keywords: ['تسويق', 'إعلان', 'حملة', 'ترويج'], min: 1000, max: 5000 },
                { keywords: ['مكيف', 'إضاءة', 'كهرباء'], min: 1200, max: 3000 }
            ],
            'cost': [ // Shared with price logic usually, but can be distinct
                { keywords: ['فرن', 'ثلاجة', 'معدات', 'آلة'], min: 3000, max: 15000 },
                { keywords: ['ديكور', 'أثاث'], min: 500, max: 3500 },
                { keywords: ['كمبيوتر', 'تقنية'], min: 1500, max: 5000 }
            ],
            'salary': [
                { keywords: ['مدير', 'مشرف', 'رئيس'], min: 6000, max: 12000 },
                { keywords: ['طباخ', 'شيف', 'معلم', 'فني'], min: 4000, max: 7000 },
                { keywords: ['محاسب', 'إداري', 'سكرتير', 'مسوق'], min: 3500, max: 5500 },
                { keywords: ['عامل', 'نادل', 'حارس', 'سائق', 'مقدم', 'نظافة'], min: 2500, max: 4000 },
                { keywords: ['مهندس', 'مبرمج', 'مطور'], min: 7000, max: 15000 }
            ],
            'quantity': [
                { keywords: ['كرسي', 'طاولة', 'طبق', 'ملعقة', 'كوب'], min: 20, max: 60 },
                { keywords: ['مكيف', 'شاشة', 'كاميرا', 'طابعة'], min: 2, max: 6 },
                { keywords: ['سيارة', 'شاحنة', 'فرن', 'ثلاجة'], min: 1, max: 3 },
                { keywords: ['موظف', 'عامل'], min: 2, max: 5 }
            ],
            'months': [
                { keywords: [], min: 12, max: 12 } // Fixed usually
            ],
            'customersPerMonth': [
                { keywords: [], min: 100, max: 500 }
            ],
            'growthRate': [
                { keywords: [], min: 0.05, max: 0.15 } // المحرك يقرأ النمو ككسر (0.05 = 5%)
            ],
            'avgPrice': [
                { keywords: [], min: 25, max: 150 }
            ],
            // أعمدة مخزَّنة ككسر (0–1) — النطاق هنا بوحدة الكسر لا النسبة المئوية
            'variableCostRate': [
                { keywords: ['توصيل', 'طلبات'], min: 0.35, max: 0.55 }, // التوصيل يحمل عمولة منصة
                { keywords: ['مشروب', 'قهوة', 'عصير', 'شاي'], min: 0.25, max: 0.40 },
                { keywords: [], min: 0.30, max: 0.45 } // تكلفة الطعام/المتغيرة النموذجية للمطاعم
            ],
            'amortizationRate': [
                { keywords: [], min: 0.10, max: 0.20 }
            ],
            // نموذج الطاقة القصوى (مقاعد × دورات/يوم × أيام/شهر)
            'turnsPerDay': [
                { keywords: [], min: 2, max: 4 } // دورات جلوس واقعية لمطعم — لا 55!
            ],
            'seats': [
                { keywords: [], min: 20, max: 60 }
            ],
            'daysPerMonth': [
                { keywords: [], min: 26, max: 30 }
            ]
        };

        // Helper to find match — القاعدة بلا كلمات مفتاحية = افتراضي القطاع (catch-all)
        const findMatch = (key) => {
            const rules = estimates[key] || [];
            let fallbackRule = null;
            for (const rule of rules) {
                if (!rule.keywords || rule.keywords.length === 0) { fallbackRule = fallbackRule || rule; continue; }
                if (rule.keywords.some(k => name.includes(k))) {
                    return rule;
                }
            }
            if (fallbackRule) return fallbackRule;
            // Return default for key if exists, or generic default
            if (['price', 'cost', 'salary'].includes(key)) return { min: 1000, max: 5000 };
            if (key === 'quantity') return { min: 1, max: 10 };
            if (key === 'months') return { min: 12, max: 12 };
            if (key === 'growthRate') return { min: 0.05, max: 0.10 };
            return { min: 10, max: 100 };
        };

        const rule = findMatch(colKey);
        const isFractionPct = DynamicTable.isFractionPercentColumn(colKey);

        // تقدير استرشادي ثابت: منتصف النطاق النموذجي للقطاع (مُدوَّر على الخطوة) — ليس عشوائياً
        // أعمدة الكسور (نمو/تكلفة متغيرة/إطفاء) تُقاس بخطوة 0.01 لأنها مخزَّنة ككسر (0–1)
        const step = (colKey === 'salary' || colKey === 'price' || colKey === 'cost') ? 100 : (isFractionPct ? 0.01 : 1);
        let estimatedValue = Math.round(((rule.min + rule.max) / 2) / step) * step;

        // Specific overrides
        if (colKey === 'months') estimatedValue = 12;
        // أعمدة الكسور تُخزَّن ككسر (0.35 = 35%) — تدوير لتفادي أخطاء الفاصلة العائمة
        if (isFractionPct) estimatedValue = Math.round(estimatedValue * 100) / 100;
        // 🛡️ أمان حاسم: العمود الكسري يجب ألا يتجاوز 1. أي قيمة >1 تعني أنها كُتبت بوحدة نسبة مئوية
        // بالخطأ (مثل 55 بدل 0.55) فتُعرَض 5500% وتُدمّر الدراسة — نصحّحها بالقسمة على 100.
        if (isFractionPct && estimatedValue > 1) estimatedValue = estimatedValue / 100;

        return estimatedValue;
    }

    constructor(containerId, config) {
        this.container = document.getElementById(containerId) || document.createElement('div');
        this.config = config;
        // تدقيق اختبار قبول 2026-07-12: store.get()/getState() تعيدان this.state الحي
        // بالمرجع (لا نسخة) — وWizard.renderTable يمرر tableData المُستخرج منها مباشرة
        // كـinitialData بلا استنساخ. بدون هذا الاستنساخ، مستمع input (الذي يُفترض أنه
        // "محلي بلا onChange" عمداً) كان في الواقع يُحوِّر مصفوفة المخزون الحيّة مباشرة
        // مع كل ضغطة مفتاح — فقيمة خام غير مطبَّعة (بالأرقام الهندية العربية مثلاً) تصير
        // مرئية لأي قارئ لـgetState() (بما فيها الحفظ التلقائي الدوري) قبل أي blur/تحقق.
        this.data = JSON.parse(JSON.stringify(config.initialData || []));
        this.onChange = config.onChange || (() => { });
        this.onSuggest = config.onSuggest || null;
        this.isQuickMode = localStorage.getItem('study_mode_preference') === 'quick';
        this._eventListeners = []; // Track event listeners for cleanup
    }

    /**
     * Cleanup method to prevent memory leaks
     */
    cleanup() {
        // Remove all event listeners
        this._eventListeners.forEach(({ element, event, handler }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler);
            }
        });
        this._eventListeners = [];
    }
    
    // Helper to determine if a column should be hidden in quick mode by default
    isAdvancedColumn(key) {
        // valueAdded أُزيل من هنا (دفعة 3، 2026-07-12): لم يعد عمود schema مستقلاً —
        // دُمج داخل uniqueFeatures (جدول المنتجات). أُبقي المفتاح خارج القائمة عمداً
        // فقط تنظيفاً؛ لا أثر وظيفياً لأن لا عمود يحمل هذا المفتاح بعد الآن.
        // wasteRate/platformCommissionRate (دفعة 3، 2026-07-12): عمودان اختياريان
        // لتفصيل الهدر/العمولة عن التكلفة المتغيرة الإجمالية — تنقيح دقيق لا يحتاجه
        // كل مستخدم في الوضع السريع؛ يظهران عبر مفتاح «عرض التفاصيل» كبقية الأعمدة هنا.
        const advancedKeys = ['notes', 'description', 'uniqueFeatures', 'customerBenefit', 'qualifications', 'mitigation', 'owner', 'wasteRate', 'platformCommissionRate'];
        return advancedKeys.includes(key);
    }

    /** يلتقط حقل الإدخال المُركَّز حالياً (إن كان داخل هذا الجدول) قبل هدم DOM بإعادة الرسم. */
    _captureFocus() {
        const el = document.activeElement;
        if (!el || !this.container.contains(el) || !el.dataset) return null;
        const { row, col } = el.dataset;
        if (row === undefined || col === undefined) return null;
        return {
            row, col,
            selStart: typeof el.selectionStart === 'number' ? el.selectionStart : null,
            selEnd: typeof el.selectionEnd === 'number' ? el.selectionEnd : null,
        };
    }

    /** يعيد التركيز (وموضع المؤشر) لنفس الخلية بعد إعادة الرسم — يمنع سقوط التركيز على body. */
    _restoreFocus(snapshot) {
        if (!snapshot) return;
        const el = this.container.querySelector(`[data-row="${snapshot.row}"][data-col="${snapshot.col}"]`);
        if (!el) return;
        el.focus();
        if (snapshot.selStart !== null && typeof el.setSelectionRange === 'function') {
            try { el.setSelectionRange(snapshot.selStart, snapshot.selEnd ?? snapshot.selStart); } catch (_) { /* بعض الأنواع (select) لا تدعم النطاق */ }
        }
    }

    render() {
        const focusSnapshot = this._captureFocus();
        const { title, columns, showTotal, totalColumn, hintHtml } = this.config || {};
        const rows = Array.isArray(this.data) ? this.data : [];
        const cols = Array.isArray(columns) ? columns : [];

        let html = `
            <div class="dynamic-table ${this.isQuickMode ? 'quick-mode' : ''}" data-table-id="${this.config?.id || 'table'}">
                <div class="table-header d-flex justify-between items-center">
                    <h4 class="text-gold">${title || ''}</h4>
                    <div class="actions gap-2 flex-wrap justify-end">
                        ${this.isQuickMode ? `
                        <label class="flex items-center gap-1 text-xs text-muted cursor-pointer select-none">
                            <input type="checkbox" class="toggle-advanced-cols" />
                            عرض التفاصيل
                        </label>
                        ` : ''}
                        ${this.onSuggest ? `<button type="button" class="btn btn--secondary btn-sm btn-suggest ${this.isQuickMode ? 'animate-pulse' : ''}">اقتراح بنود</button>` : ''}
                        <button type="button" class="btn btn--ghost btn-add-row">+ إضافة بند</button>
                    </div>
                </div>
                ${hintHtml ? `<div class="table-hint alert alert--info mb-2" data-table-hint>${hintHtml}</div>` : ''}
                <div class="table-wrapper" style="overflow-x:auto">
                    <table class="w-full">
                        <thead>
                            <tr>
                                <th style="width:40px">#</th>
                                ${cols.map(c => `
                                    <th class="${this.isQuickMode && this.isAdvancedColumn(c.key) ? 'col-advanced hidden' : ''}">
                                        ${c.label || getLabel(c.key)}
                                    </th>
                                `).join('')}
                                <th style="width:50px">حذف</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        if (rows.length === 0) {
            html += `
                <tr>
                    <td colspan="${cols.length + 2}" class="text-center p-4">
                        <div class="empty-state text-center" style="padding: 2rem; background: var(--color-surface-hover); border-radius: var(--radius); border: 1px dashed var(--color-border);">
                            <p class="text-muted mb-0" style="font-size: 1.1em;">هذا الجدول فارغ حالياً</p>
                            ${this.onSuggest ? `<p class="text-muted mt-1" style="font-size:.9em;">استخدم «اقتراح بنود» أو «+ إضافة بند» بالأعلى.</p>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        } else {
            rows.forEach((row, rowIndex) => {
                html += this.renderRow(row, rowIndex, cols);
            });
        }

        html += `
                        </tbody>
                    </table>
                </div>
        `;

        if (showTotal && totalColumn) {
            const grandTotal = rows.reduce((sum, row) => {
                const col = cols.find(c => c.key === totalColumn);
                if (col && col.type === 'computed' && col.formula) {
                    return sum + (col.formula(row, this.config?.context) || 0);
                }
                return sum + (parseFloat(row[totalColumn]) || 0);
            }, 0);

            html += `
                <div class="table-footer d-flex justify-between items-center mt-2">
                    <span class="text-muted">الإجمالي:</span>
                    <span class="text-gold text-mono" data-grand-total>${grandTotal.toLocaleString('ar-SA')} ريال</span>
                </div>
            `;
        }

        html += `</div>`;

        this.container.innerHTML = html;
        this.bindEvents();
        this._restoreFocus(focusSnapshot);
    }

    /**
     * تحديث موضعي بعد تعديل خلية: يحدّث الأعمدة المحسوبة في نفس الصف + سطر الإجمالي
     * فقط، دون هدم بقية DOM بإعادة رسم كاملة — يمنع سقوط تركيز المستخدم عند الانتقال
     * لخلية مجاورة (تدقيق اختبار عميل 2026-07-12).
     */
    _applyRowUpdate(rowIndex) {
        const { columns, showTotal, totalColumn } = this.config || {};
        const cols = Array.isArray(columns) ? columns : [];
        const row = this.data[rowIndex];
        const tr = this.container.querySelector(`tr[data-row-index="${rowIndex}"]`);

        if (row && tr) {
            cols.forEach((col, i) => {
                if (col.type === 'computed' && col.formula) {
                    const td = tr.children[i + 1]; // +1: أول عمود هو رقم الصف
                    if (td) {
                        const val = col.formula(row, this.config?.context) || 0;
                        td.textContent = val.toLocaleString('ar-SA');
                    }
                } else if (col.type === 'number') {
                    const cellInput = tr.querySelector(`.table-input[data-col="${col.key}"]`);
                    const magicBtn = cellInput?.parentElement?.querySelector('.btn-magic-cell');
                    if (magicBtn && row[col.key] && row[col.key] != 0) {
                        magicBtn.style.display = 'none';
                    }
                }
            });
        }

        if (showTotal && totalColumn) {
            const totalCol = cols.find(c => c.key === totalColumn);
            const grandTotal = this.data.reduce((sum, r) => {
                if (totalCol && totalCol.type === 'computed' && totalCol.formula) {
                    return sum + (totalCol.formula(r, this.config?.context) || 0);
                }
                return sum + (parseFloat(r[totalColumn]) || 0);
            }, 0);
            const footerEl = this.container.querySelector('[data-grand-total]');
            if (footerEl) footerEl.textContent = `${grandTotal.toLocaleString('ar-SA')} ريال`;
        }
    }

    renderRow(row, rowIndex, columns) {
        let html = `<tr data-row-index="${rowIndex}">`;
        html += `<td class="text-muted">${rowIndex + 1}</td>`;

        columns.forEach(col => {
            const isHidden = this.isQuickMode && this.isAdvancedColumn(col.key);
            const cellClass = isHidden ? 'col-advanced hidden' : 'col-advanced'; // col-advanced allows toggling
            const displayStyle = isHidden ? 'display:none' : ''; // fallback if class hidden not enough
            
            // Note: We use class 'hidden' which is likely defined in utilities or we rely on toggle logic.
            // To be safe, let's use the class 'col-advanced' and 'hidden'.
            
            if (col.type === 'computed' && col.formula) {
                const val = col.formula(row, this.config?.context) || 0;
                html += `<td class="text-mono computed-cell ${isHidden ? 'hidden col-advanced' : ''}">${val.toLocaleString('ar-SA')}</td>`;
            } else if (col.type === 'select' && col.options) {
                const val = row[col.key] || '';
                const optionsHtml = col.options.map(opt => {
                    const optVal = typeof opt === 'object' ? opt.value : opt;
                    const optLabel = typeof opt === 'object' ? opt.label : opt;
                    const isSelected = val === optVal ? 'selected' : '';
                    return `<option value="${optVal}" ${isSelected}>${optLabel}</option>`;
                }).join('');

                html += `<td class="${isHidden ? 'hidden col-advanced' : ''}">
                    <select class="table-input" data-row="${rowIndex}" data-col="${col.key}">
                        <option value="">اختر...</option>
                        ${optionsHtml}
                    </select>
                </td>`;
            } else if (col.type === 'checkbox') {
                const isChecked = row[col.key] ? 'checked' : '';
                html += `<td class="text-center ${isHidden ? 'hidden col-advanced' : ''}">
                    <input type="checkbox" 
                           class="table-input" 
                           data-row="${rowIndex}" 
                           data-col="${col.key}"
                           ${isChecked}>
                </td>`;
            } else {
                const isFractionPct = DynamicTable.isFractionPercentColumn(col.key);
                const isNumberCol = col.type === 'number';
                let val = row[col.key] ?? '';
                // نسب النمو/الحصص المخزنة ككسر (0.07) تُعرض وتُحرَّر كنسبة مئوية (7)
                // — كان المستخدم يرى «نمو سنوي (كسر)» فيكتب 7 ويحصل على 700%
                if (isFractionPct && typeof val === 'number') {
                    val = Math.round(val * 10000) / 100;
                }
                // تدقيق اختبار عميل 2026-07-12: الحقول الرقمية type="number" كانت تُفرغ
                // قيمتها بصمت (badInput) عند الكتابة بأرقام هندية عربية أو فاصلة عشرية
                // عربية «٫» فتُخزَّن 0 دون أي إشعار. التحويل لـtype="text" مع
                // inputmode="decimal" يزيل حالة badInput كلياً (القيمة الخام تصل دوماً)؛
                // التحقق (سالب/سقف 100/تحويل كسر) انتقل لمعالج change عبر parseLenientNumber.
                const inputAttrs = isNumberCol ? 'inputmode="decimal" autocomplete="off"' : '';

                // Magic Wand for empty numbers (متاح في الوضعين السريع والمفصل)
                let magicBtn = '';
                if (isNumberCol && (!val || val == 0)) {
                   magicBtn = `<button type="button" class="btn-magic-cell" data-row="${rowIndex}" data-col="${col.key}" title="تقدير تلقائي" aria-label="تقدير تلقائي للقيمة">${icon('i-sparkle')}</button>`;
                }

                // تدقيق اختبار قبول 2026-07-12: نص إرشادي («[اذكر خبرتك...]») كان يُكتب
                // كقيمة value فعلية (لا placeholder حقيقي) في بعض الاقتراحات الاحتياطية
                // (keyPeople) — أي نقرة تحرير عادية بلا تحديد الكل تُدرج كتابة المستخدم
                // في منتصف النص فينتج محتوى مشوَّهاً. col.placeholder اختياري يتيح نص
                // إرشاد حقيقياً بخاصية placeholder، والقيمة تبقى فارغة حتى يكتب المستخدم.
                const placeholderAttr = col.placeholder ? `placeholder="${escapeHtml(col.placeholder)}"` : '';
                const cleaveClass = (isNumberCol && !isFractionPct) ? ' cleave-num' : '';

                html += `<td class="${isHidden ? 'hidden col-advanced' : ''} relative">
                    <div class="flex items-center gap-1">
                        <input type="text"
                               class="table-input ${magicBtn ? 'pr-8' : ''}${cleaveClass}"
                               data-row="${rowIndex}"
                               data-col="${col.key}"
                               value="${escapeHtml(val)}"
                               ${placeholderAttr}
                               ${inputAttrs}>
                        ${isFractionPct ? '<span class="text-muted" aria-hidden="true">٪</span>' : ''}
                        ${magicBtn}
                    </div>
                </td>`;
            }
        });

        html += `<td><button type="button" class="btn-delete" data-row="${rowIndex}" title="حذف الصف" aria-label="حذف الصف">${icon('i-trash')}</button></td>`;
        html += `</tr>`;
        return html;
    }

    bindEvents() {
        // Cleanup previous listeners first
        this.cleanup();

        // شريط التلميح فوق الجدول (hintHtml) — تفويض حدث واحد على الحاوية بدل ربط كل زر
        // بمفرده، كي يستمر العمل بعد أي إعادة رسم لاحقة بلا إعادة ربط يدوية من المستدعي.
        const hintEl = this.container.querySelector('[data-table-hint]');
        if (hintEl && typeof this.config?.onHintAction === 'function') {
            const handler = (e) => {
                const btn = e.target.closest('[data-hint-action]');
                if (!btn) return;
                this.config.onHintAction(btn.dataset.hintAction, btn);
            };
            hintEl.addEventListener('click', handler);
            this._eventListeners.push({ element: hintEl, event: 'click', handler });
        }

        // Toggle Advanced Columns
        const toggle = this.container.querySelector('.toggle-advanced-cols');
        if (toggle) {
            const handler = (e) => {
                const advancedCols = this.container.querySelectorAll('.col-advanced');
                advancedCols.forEach(col => {
                    if (e.target.checked) col.classList.remove('hidden');
                    else col.classList.add('hidden');
                });
            };
            toggle.addEventListener('change', handler);
            this._eventListeners.push({ element: toggle, event: 'change', handler });
        }

        // Magic Cell Buttons
        this.container.querySelectorAll('.btn-magic-cell').forEach(btn => {
            const handler = (e) => {
                const rowIndex = parseInt(e.target.dataset.row);
                const colKey = e.target.dataset.col;
                this.handleMagicCell(rowIndex, colKey, btn);
            };
            btn.addEventListener('click', handler);
            this._eventListeners.push({ element: btn, event: 'click', handler });
        });

        // Add Row
        const addBtn = this.container.querySelector('.btn-add-row');
        if (addBtn) {
            const handler = () => this.addRow();
            addBtn.addEventListener('click', handler);
            this._eventListeners.push({ element: addBtn, event: 'click', handler });
        }

        // Suggest (might be multiple: top actions & empty state)
        this.container.querySelectorAll('.btn-suggest').forEach(suggestBtn => {
            const handler = () => this.handleSuggest(suggestBtn);
            suggestBtn.addEventListener('click', handler);
            this._eventListeners.push({ element: suggestBtn, event: 'click', handler });
        });

        // Delete Row (with SweetAlert2)
        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            const handler = async (e) => {
                const rowIndex = parseInt(e.target.closest('.btn-delete').dataset.row);
                const result = await Swal.fire({
                    title: 'هل أنت متأكد؟',
                    text: 'سيتم حذف هذا الصف نهائياً.',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، احذف',
                    cancelButtonText: 'إلغاء',
                    customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                    buttonsStyling: false
                });
                if (result.isConfirmed) {
                    this.deleteRow(rowIndex);
                }
            };
            btn.addEventListener('click', handler);
            this._eventListeners.push({ element: btn, event: 'click', handler });
        });

        // Live typing (بلا onChange وبلا رسم) — يحفظ القيمة الخام فوراً في this.data محلياً
        // كي لا تضيع لو تسبّب إجراء آخر (تقدير تلقائي في خلية مجاورة، إضافة صف) بإعادة رسم
        // منتصف الكتابة. التحقق/التطبيع الفعلي يحدث عند change (blur/Enter) أدناه.
        this.container.querySelectorAll('input.table-input[type="text"]').forEach(input => {
            // Apply Cleave.js to numeric inputs
            if (input.classList.contains('cleave-num')) {
                new Cleave(input, {
                    numeral: true,
                    numeralThousandsGroupStyle: 'thousand'
                });
            }

            const inputHandler = (e) => {
                const rowIndex = parseInt(e.target.dataset.row, 10);
                const colKey = e.target.dataset.col;
                const rawVal = e.target.value;
                if (this.data[rowIndex]) {
                    this.data[rowIndex][colKey] = input.classList.contains('cleave-num') ? rawVal.replace(/,/g, '') : rawVal;
                }
            };
            input.addEventListener('input', inputHandler);
            this._eventListeners.push({ element: input, event: 'input', handler: inputHandler });

            // Enter تُثبّت القيمة فوراً (blur يُطلق change) بدل انتظار النقر خارج الحقل
            const enterHandler = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
            };
            input.addEventListener('keydown', enterHandler);
            this._eventListeners.push({ element: input, event: 'keydown', handler: enterHandler });
        });

        // Commit on change (blur/Enter): تحقق وتطبيع نهائيان + التزام للمخزن + تحديث موضعي
        this.container.querySelectorAll('.table-input').forEach(input => {
            const handler = (e) => {
                const rowIndex = parseInt(e.target.dataset.row, 10);
                const colKey = e.target.dataset.col;
                if (!this.data[rowIndex]) return;
                const colDef = (this.config.columns || []).find(c => c.key === colKey);
                let value;

                if (e.target.type === 'checkbox') {
                    value = e.target.checked;
                } else if (colDef?.type === 'number') {
                    const parsed = DynamicTable.parseLenientNumber(e.target.value);
                    value = parsed === null ? 0 : parsed;
                    // القيم السالبة تُقص عند الصفر (أسعار/رواتب/كميات سالبة تفسد المحرك)
                    if (value < 0 && colDef?.allowNegative !== true) value = 0;
                    // أعمدة النسب المعروضة كنسبة مئوية تُخزَّن ككسر (7 → 0.07)
                    if (DynamicTable.isFractionPercentColumn(colKey)) {
                        value = Math.min(value, 100) / 100;
                    }
                    // إعادة عرض القيمة نظيفة بأرقام غربية بعد التطبيع — يزيل أي التباس
                    // بصري لو كتب المستخدم بأرقام هندية أو فاصلة عشرية عربية
                    e.target.value = DynamicTable.isFractionPercentColumn(colKey)
                        ? Math.round(value * 10000) / 100
                        : value;
                } else {
                    value = e.target.value;
                }

                this.data[rowIndex][colKey] = value;
                console.debug(`[DynamicTable:${this.config.id}] Cell change, rows: ${this.data.length}`);
                this.onChange(JSON.parse(JSON.stringify(this.data)));
                this._applyRowUpdate(rowIndex); // تحديث موضعي — لا render() كامل يهدم التركيز
            };
            input.addEventListener('change', handler);
            this._eventListeners.push({ element: input, event: 'change', handler });
        });
    }

    handleMagicCell(rowIndex, colKey, btn) {
        // Smart estimation based on context — الحساب في دالة نقية قابلة للاختبار (estimateCellValue)
        // تفادياً لتكرار المنطق وضماناً لعدم تسرّب خطأ ×100 مرة أخرى (مغطّى باختبار وحدة).
        const rowData = this.data[rowIndex] || {};
        const itemName = (rowData.name || rowData.position || rowData.item || rowData.service || '').toLowerCase();
        const isFractionPct = DynamicTable.isFractionPercentColumn(colKey);
        const estimatedValue = DynamicTable.estimateCellValue(colKey, itemName);

        // Animate — نُبقي أيقونة الزر (i-sparkle) ونضيف نبضاً فقط بدل استبدالها بنص إيموجي
        // مؤقت (تدقيق 2026-07-11)؛ render() يعيد بناء الزر بعد التقدير على أي حال.
        btn.disabled = true;
        btn.classList.add('animate-pulse');

        setTimeout(() => {
            if (!this.data[rowIndex]) return; // الصف قد يكون حُذف أثناء الانتظار
            this.data[rowIndex][colKey] = estimatedValue;
            this.onChange(JSON.parse(JSON.stringify(this.data)));

            // تحديث الحقل مباشرة بدل render() كامل — يحافظ على أي كتابة جارية في خلايا
            // أخرى أثناء تأخير 600ms هذا (تدقيق اختبار عميل 2026-07-12)
            const cellInput = this.container.querySelector(`.table-input[data-row="${rowIndex}"][data-col="${colKey}"]`);
            if (cellInput) {
                cellInput.value = isFractionPct ? Math.round(estimatedValue * 10000) / 100 : estimatedValue;
            }
            btn.style.display = 'none';
            this._applyRowUpdate(rowIndex);

            // Show Toast feedback — نوضّح صراحةً أنه تقدير استرشادي قابل للتعديل (شفافية + بناء ثقة)
            // أعمدة الكسور تُعرض كنسبة مئوية في الإشعار لتطابق ما يراه المستخدم في الحقل (لا 0.35)
            const shownValue = isFractionPct ? `${Math.round(estimatedValue * 100)}%` : estimatedValue.toLocaleString('ar-SA');
            toast.show(`تقدير استرشادي لـ«${getLabel(colKey)}»: ${shownValue} — راجعه وعدّله حسب واقعك.`, 'magic', 3500);
        }, 600);
    }


    async handleSuggest(btn = null) {
        if (!this.onSuggest) {
            console.warn('No onSuggest handler defined for this table');
            return;
        }

        try {
            const suggestions = await this.onSuggest(btn);
            
            if (!suggestions) {
                console.warn('onSuggest returned null/undefined');
                return;
            }

            if (Array.isArray(suggestions) && suggestions.length > 0) {
                // Append suggestions to data
                this.data = [...this.data, ...suggestions];
                // ⚠️ FIX: Ensure onChange is called with a deep copy
                console.debug(`[DynamicTable:${this.config.id}] Suggestions added, rows: ${this.data.length}`);
                const dataCopy = JSON.parse(JSON.stringify(this.data));
                this.onChange(dataCopy);
                this.render();
                // Show success message
                console.log(`✅ تم إضافة ${suggestions.length} بند بنجاح`);
            } else {
                console.warn('onSuggest returned empty array or invalid data');
                // كان الزر يبدو «ميتاً» عند عدم توفّر اقتراحات — نُعلم المستخدم بدل الصمت التام
                toast.info('لا تتوفّر اقتراحات تلقائية لهذا البند حالياً. يمكنك إضافة الصفوف يدوياً عبر «إضافة صف».');
            }
        } catch (e) {
            console.error('Suggestion error:', e);
            alert('حدث خطأ أثناء جلب الاقتراحات: ' + (e.message || 'خطأ غير معروف'));
        }
    }

    addRow() {
        const newRow = {};
        (Array.isArray(this.config?.columns) ? this.config.columns : []).forEach(col => {
            if (col.type !== 'computed') {
                // كان يتجاهل col.default تماماً (مثل nationality: default 'expat') فيبدأ
                // كل صف جديد بقيمة فارغة صامتة تدخل حسابات التوطين/الرواتب دون اختيار واعٍ.
                newRow[col.key] = col.default !== undefined
                    ? col.default
                    : (col.type === 'number' ? 0 : '');
            }
        });
        this.data = [...this.data, newRow];
        // ⚠️ FIX: onChange with deep copy; no in-place mutation of this.data
        console.debug(`[DynamicTable:${this.config.id}] Row added, rows: ${this.data.length}`);
        this.onChange(JSON.parse(JSON.stringify(this.data)));
        this.render();
    }

    deleteRow(index) {
        this.data = this.data.filter((_, i) => i !== index);
        // ⚠️ FIX: onChange with deep copy; no in-place mutation of this.data
        console.debug(`[DynamicTable:${this.config.id}] Row deleted, rows: ${this.data.length}`);
        this.onChange(JSON.parse(JSON.stringify(this.data)));
        this.render();
    }

    /** Returns a deep copy so callers cannot mutate internal state. */
    getData() {
        return JSON.parse(JSON.stringify(this.data));
    }

    setData(newData) {
        this.data = newData || [];
        this.render();
    }
}

// Table Configuration Templates based on Excel structure
export const TABLE_CONFIGS = {
    // معدات المطبخ / التجهيزات
    equipment: {
        id: 'equipment',
        title: 'التجهيزات والمعدات',
        columns: [
            { key: 'name', label: 'البند', type: 'text' },
            { key: 'quantity', label: 'العدد', type: 'number' },
            { key: 'price', label: 'القيمة', type: 'number' },
            { key: 'total', label: 'الإجمالي', type: 'computed', formula: (r) => (r.quantity || 0) * (r.price || 0) },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'total'
    },

    // الموارد البشرية
    staffing: {
        id: 'staffing',
        title: 'الموظفين والرواتب',
        columns: [
            { key: 'position', label: 'المنصب', type: 'text' },
            { key: 'count', label: 'العدد', type: 'number' },
            { key: 'months', label: 'الشهور', type: 'number' },
            { key: 'salary', label: 'الراتب الشهري', type: 'number' },
            { key: 'total', label: 'الإجمالي', type: 'computed', formula: (r) => (r.count || 0) * (r.months || 12) * (r.salary || 0) }
        ],
        showTotal: true,
        totalColumn: 'total'
    },

    // التراخيص
    licenses: {
        id: 'licenses',
        title: 'التراخيص والرسوم',
        columns: [
            { key: 'name', label: 'البند', type: 'text' },
            { key: 'quantity', label: 'الكمية', type: 'number' },
            { key: 'price', label: 'السعر', type: 'number' },
            { key: 'total', label: 'الإجمالي', type: 'computed', formula: (r) => (r.quantity || 0) * (r.price || 0) },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'total'
    },

    // مصادر الإيرادات
    revenueStreams: {
        id: 'revenue',
        title: 'مصادر الإيرادات',
        columns: [
            { key: 'service', label: 'الخدمة', type: 'text' },
            { key: 'customersPerMonth', label: 'العملاء/شهر', type: 'number' },
            { key: 'growthRate', label: 'نسبة النمو', type: 'number' },
            { key: 'avgPrice', label: 'متوسط السعر', type: 'number' },
            { key: 'annualRevenue', label: 'الإيراد السنوي', type: 'computed', formula: (r) => (r.customersPerMonth || 0) * 12 * (r.avgPrice || 0) }
        ],
        showTotal: true,
        totalColumn: 'annualRevenue'
    },

    // الموارد التقنية
    techResources: {
        id: 'tech',
        title: 'الموارد التقنية',
        columns: [
            { key: 'name', label: 'البند', type: 'text' },
            { key: 'quantity', label: 'العدد', type: 'number' },
            { key: 'price', label: 'القيمة', type: 'number' },
            { key: 'total', label: 'الإجمالي', type: 'computed', formula: (r) => (r.quantity || 0) * (r.price || 0) },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'total'
    },

    // المنافسين
    competitors: {
        id: 'competitors',
        title: 'تحليل المنافسين',
        columns: [
            { key: 'name', label: 'اسم المنافس', type: 'text' },
            { key: 'strengths', label: 'نقاط القوة', type: 'text' },
            { key: 'weaknesses', label: 'نقاط الضعف', type: 'text' },
            { key: 'marketShare', label: 'الحصة السوقية %', type: 'number' }
        ],
        showTotal: false
    },

    // مراحل التنفيذ
    implementationPhases: {
        id: 'phases',
        title: 'مراحل التنفيذ',
        columns: [
            { key: 'phase', label: 'المرحلة', type: 'text' },
            { key: 'duration', label: 'المدة (أسابيع)', type: 'number' },
            { key: 'cost', label: 'التكلفة', type: 'number' },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'cost'
    }
};

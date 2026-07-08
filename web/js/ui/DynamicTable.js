import { getLabel } from '../core/labels.js';
import { toast } from '../utils/toast.js';

/**
 * Dynamic Table Component
 * Renders editable tables with add/delete row functionality
 */
export class DynamicTable {
    /** أعمدة مخزنة ككسر (0–1) وتُعرض/تُحرَّر كنسبة مئوية (0–100) — نفس نهج Wizard.isFractionPercentKey */
    static isFractionPercentColumn(colKey) {
        return ['growthRate', 'variableCostRate', 'amortizationRate', 'depreciationRate', 'rate', 'utilizationRate'].includes(colKey);
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
        this.data = config.initialData || [];
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
        const advancedKeys = ['notes', 'description', 'uniqueFeatures', 'valueAdded', 'customerBenefit', 'qualifications', 'mitigation', 'owner'];
        return advancedKeys.includes(key);
    }

    render() {
        const { title, columns, showTotal, totalColumn } = this.config || {};
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
                            <p class="text-muted mb-3" style="font-size: 1.1em;">هذا الجدول فارغ حالياً</p>
                            ${this.onSuggest ? `<button type="button" class="btn btn--secondary btn-suggest" style="margin: 0 auto;">إضافة مقترحات أولية ✨</button>` : ''}
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
                    <span class="text-gold text-mono">${grandTotal.toLocaleString('ar-SA')} ريال</span>
                </div>
            `;
        }

        html += `</div>`;

        this.container.innerHTML = html;
        this.bindEvents();
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
                let val = row[col.key] ?? '';
                // نسب النمو/الحصص المخزنة ككسر (0.07) تُعرض وتُحرَّر كنسبة مئوية (7)
                // — كان المستخدم يرى «نمو سنوي (كسر)» فيكتب 7 ويحصل على 700%
                if (isFractionPct && typeof val === 'number') {
                    val = Math.round(val * 10000) / 100;
                }
                const inputType = col.type === 'number' ? 'number' : 'text';
                // أسعار ورواتب وكميات سالبة لا معنى لها — تمرّ للمحرك وتفسد النتائج
                const minAttr = col.type === 'number' && col.allowNegative !== true ? 'min="0"' : '';
                const maxAttr = isFractionPct || /marketShare|share|percent/i.test(col.key) ? 'max="100"' : '';
                const stepAttr = col.type === 'number' ? 'step="any"' : '';

                // Magic Wand for empty numbers (متاح في الوضعين السريع والمفصل)
                let magicBtn = '';
                if (col.type === 'number' && (!val || val == 0)) {
                   magicBtn = `<button type="button" class="btn-magic-cell" data-row="${rowIndex}" data-col="${col.key}" title="تقدير تلقائي">🪄</button>`;
                }

                html += `<td class="${isHidden ? 'hidden col-advanced' : ''} relative">
                    <div class="flex items-center gap-1">
                        <input type="${inputType}"
                               class="table-input ${magicBtn ? 'pr-8' : ''}"
                               data-row="${rowIndex}"
                               data-col="${col.key}"
                               value="${val}"
                               ${stepAttr} ${minAttr} ${maxAttr}>
                        ${isFractionPct ? '<span class="text-muted" aria-hidden="true">٪</span>' : ''}
                        ${magicBtn}
                    </div>
                </td>`;
            }
        });

        html += `<td><button type="button" class="btn-delete" data-row="${rowIndex}">🗑️</button></td>`;
        html += `</tr>`;
        return html;
    }

    bindEvents() {
        // Cleanup previous listeners first
        this.cleanup();

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

        // Delete Row
        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            const handler = (e) => {
                const rowIndex = parseInt(e.target.dataset.row);
                this.deleteRow(rowIndex);
            };
            btn.addEventListener('click', handler);
            this._eventListeners.push({ element: btn, event: 'click', handler });
        });

        // Input Changes
        this.container.querySelectorAll('.table-input').forEach(input => {
            const handler = (e) => {
                const rowIndex = parseInt(e.target.dataset.row);
                const colKey = e.target.dataset.col;
                let value = e.target.value;

                if (e.target.type === 'number') {
                    value = parseFloat(value) || 0;
                    // القيم السالبة تُقص عند الصفر (أسعار/رواتب/كميات سالبة تفسد المحرك)
                    const colDef = (this.config.columns || []).find(c => c.key === colKey);
                    if (value < 0 && colDef?.allowNegative !== true) {
                        value = 0;
                        e.target.value = 0;
                    }
                    // أعمدة النسب المعروضة كنسبة مئوية تُخزَّن ككسر (7 → 0.07)
                    if (DynamicTable.isFractionPercentColumn(colKey)) {
                        value = Math.min(value, 100) / 100;
                    }
                } else if (e.target.type === 'checkbox') {
                    value = e.target.checked;
                }

                // Immutable update: copy, modify, replace — avoid mutating this.data before notify
                const next = JSON.parse(JSON.stringify(this.data));
                if (next[rowIndex]) next[rowIndex][colKey] = value;
                this.data = next;
                console.debug(`[DynamicTable:${this.config.id}] Cell change, rows: ${this.data.length}`);
                this.onChange(JSON.parse(JSON.stringify(next)));
                this.render(); // Re-render to update computed columns
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

        // Animate
        const originalText = btn.textContent;
        btn.textContent = '✨';
        btn.disabled = true;
        btn.classList.add('animate-pulse');

        setTimeout(() => {
            const next = JSON.parse(JSON.stringify(this.data));
            if (next[rowIndex]) next[rowIndex][colKey] = estimatedValue;
            this.data = next;
            this.onChange(JSON.parse(JSON.stringify(next)));
            this.render();
            
            // Show Toast feedback — نوضّح صراحةً أنه تقدير استرشادي قابل للتعديل (شفافية + بناء ثقة)
            // أعمدة الكسور تُعرض كنسبة مئوية في الإشعار لتطابق ما يراه المستخدم في الحقل (لا 0.35)
            const shownValue = isFractionPct ? `${Math.round(estimatedValue * 100)}%` : estimatedValue.toLocaleString('ar-SA');
            toast.show(`تقدير استرشادي لـ«${getLabel(colKey)}»: ${shownValue} — راجعه وعدّله حسب واقعك.`, 'magic', 3500);
            
            // Reset button after render (though render recreates it, if we kept reference)
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
                newRow[col.key] = col.type === 'number' ? 0 : '';
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

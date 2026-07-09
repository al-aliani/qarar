/**
 * مرحلة اختيار المشروع قبل التفصيل (د. الروضي)
 * "لديك أكثر من فكرة؟ قارنها مبدئياً قبل الدخول في التفصيل"
 * تحسب لكل فكرة: فترة الاسترداد والعائد على التكلفة، وترشّح الأفضل تلقائياً (مع مراعاة المخاطرة).
 */
import { stepIndexById } from '../core/wizardSteps.js';

// تدقيق 2026-07-09 (مفاضلة الأفكار): معاملات تعديل المخاطرة (ASSUMPTION) — تقديرات
// داخلية تقريبية لترتيب الأفكار مبدئياً فقط، وليست مشتقة من صيغة منشورة أو من
// انحراف معياري فعلي للطلب/التدفقات النقدية. لا تُستخدم كمُدخل للنموذج المالي التفصيلي.
const RISK_OPTIONS = [
    { value: '', label: 'غير محدد', factor: 1.10 },
    { value: 'low', label: 'منخفضة', factor: 1.00 },
    { value: 'medium', label: 'متوسطة', factor: 1.15 },
    { value: 'high', label: 'عالية', factor: 1.30 }
];
// تدقيق 2026-07-09: عتبة تحذير عامة (ASSUMPTION) لـ"استرداد طويل" — قاعدة تقريبية
// ثابتة لا تتناسب مع حجم الاستثمار أو طبيعة النشاط (مشروع كبير كالفرنشايز مقابل
// مقهى صغير تُقارَن بنفس العتبة رغم اختلاف دورة الاسترداد الطبيعية لكل منهما).
const LONG_PAYBACK_YEARS = 7; // فوقها نحذّر: استرداد طويل جداً لمشروع صغير

// أرقام بفواصل آلاف للقراءة (إدخال نصّي inputmode رقمي) — يمنع خطأ الأصفار
const fmtNum = (n) => (Number(n) || 0).toLocaleString('en-US');
const parseNum = (s) => parseFloat(String(s ?? '').replace(/[^\d.]/g, '')) || 0;

export class ProjectAlternativesView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
    }

    // مقاييس محسوبة لكل فكرة + ترشيح الأفضل (أقل استرداد معدّل بالمخاطرة)
    _computeMetrics(ideas) {
        const metrics = ideas.map(idea => {
            const cost = Number(idea.estimatedCost) || 0;
            const ret = Number(idea.estimatedReturn) || 0;
            const risk = RISK_OPTIONS.find(r => r.value === (idea.risk || '')) || RISK_OPTIONS[0];
            if (cost > 0 && ret > 0) {
                const payback = cost / ret;           // سنوات
                const roc = ret / cost;               // عائد على التكلفة
                return { valid: true, payback, roc, adjusted: payback * risk.factor };
            }
            return { valid: false, payback: null, roc: null, adjusted: Infinity, loss: cost > 0 && ret <= 0 };
        });
        let bestIdx = -1, bestVal = Infinity;
        metrics.forEach((m, i) => { if (m.valid && m.adjusted < bestVal) { bestVal = m.adjusted; bestIdx = i; } });
        return { metrics, bestIdx };
    }

    // بانر سياقي عند الوصول من الخطوة المبدئية بمؤشرات ضعيفة
    _weakPreliminary() {
        const pc = this.store.getState().preliminaryCheck || {};
        const isNo = (v) => /^(لا|no)\b/i.test((v ?? '').toString().trim());
        return isNo(pc.isProjectFeasible) || isNo(pc.suitableForEnvironment);
    }

    render() {
        if (!this.container) return;

        const state = this.store.getState();
        const pa = state.projectAlternatives || {};
        const ideas = pa.ideas || [];
        const selectedIndex = pa.selectedIndex ?? 0;
        const esc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const hasIdeas = ideas.length > 0;
        const { metrics, bestIdx } = this._computeMetrics(ideas);
        const validCount = metrics.filter(m => m.valid).length;

        // خلية الاسترداد: رقم + تحذير للخسارة/الاسترداد الطويل
        const paybackCell = (m) => {
            if (m.loss) return `<span class="pa-flag pa-flag--bad">بلا عائد / خسارة</span>`;
            if (!m.valid) return `<span class="text-muted">—</span>`;
            const warn = m.payback > LONG_PAYBACK_YEARS ? ` <span class="pa-flag pa-flag--warn">طويل</span>` : '';
            return `${m.payback.toFixed(1)} سنة${warn}`;
        };
        const rocCell = (m) => m.valid ? `${(m.roc * 100).toFixed(0)}%` : `<span class="text-muted">—</span>`;

        const riskSelect = (i, val) => `
            <select class="input input--sm alt-field" data-field="risk" aria-label="مستوى المخاطرة">
                ${RISK_OPTIONS.map(r => `<option value="${r.value}" ${(val || '') === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
            </select>`;

        this.container.innerHTML = `
            <div class="project-alternatives-view animate-entry">
                <h2 class="section-title">
                    <svg class="ic section-title__ic" aria-hidden="true"><use href="#i-chart"/></svg>
                    اختيار المشروع قبل التفصيل
                </h2>
                <p class="text-muted mb-4">إذا لديك أكثر من فكرة مشروع، قارنها مبدئياً قبل الدخول في الدراسة التفصيلية. إذا مشروع واحد فقط — اكمل مباشرة.</p>

                ${this._weakPreliminary() ? `
                    <div class="alert alert--warn mb-4">
                        <strong>وصلت هنا لأن مؤشرات فكرتك الأولى ضعيفة.</strong> جرّب إضافة فكرة أو فكرتين بديلتين ومقارنتها بالأرقام — قد تجد خياراً أنسب قبل صرف الوقت في التفاصيل.
                    </div>` : ''}

                <div class="alert alert--info mb-4 pa-note">
                    <strong>شرط المفاضلة:</strong> لا تستثمر في مشروع واحد بدون مقارنة — قارن ٢–٣ أفكار (تكلفة، عائد، مخاطرة) ثم اختر الأفضل للمتابعة. <strong>«قرار» يحسب لك فترة الاسترداد ويرشّح الأفضل تلقائياً.</strong>
                </div>

                <div class="card analysis-card mb-4 pa-card">
                    <h3 class="card-title">جدول مقارنة الأفكار (مبدئي)</h3>
                    <p class="text-xs text-muted mb-2">معامل تعديل المخاطرة (١٠٪/١٥٪/٣٠٪) وعتبة «استرداد طويل» (٧ سنوات) تقديرات داخلية عامة (ASSUMPTION) لترتيب الأفكار مبدئياً فقط — غير مشتقة من صيغة منشورة أو انحراف معياري للطلب، وغير متناسبة مع حجم الاستثمار أو نوع النشاط. عدّلها بحكمك حسب واقع كل فكرة.</p>
                    <div class="table-responsive pa-table-wrap">
                        <table class="data-table pa-table" id="alternativesTable">
                            <thead>
                                <tr>
                                    <th scope="col"><span class="sr-only">اختيار</span>✓</th>
                                    <th scope="col">اسم الفكرة</th>
                                    <th scope="col">تكلفة تقريبية (ر.س)</th>
                                    <th scope="col">عائد متوقع (ر.س/سنة)</th>
                                    <th scope="col">المخاطرة</th>
                                    <th scope="col">الاسترداد <small class="text-muted">(محسوب)</small></th>
                                    <th scope="col">العائد/التكلفة <small class="text-muted">(محسوب)</small></th>
                                    <th scope="col">ملاحظة</th>
                                    <th scope="col"><span class="sr-only">حذف</span></th>
                                </tr>
                            </thead>
                            <tbody id="alternativesBody">
                                ${!hasIdeas ? `
                                    <tr class="empty-row">
                                        <td colspan="9">
                                            <div class="pa-empty">
                                                <svg class="ic pa-empty__ic" aria-hidden="true"><use href="#i-folder"/></svg>
                                                <p class="pa-empty__title">لا توجد أفكار بعد</p>
                                                <p class="pa-empty__hint">أضف فكرة لمقارنتها، أو تابع مباشرة إن كان لديك مشروع واحد.</p>
                                                <p class="pa-empty__example">مثال: <em>مقهى مختص</em> — تكلفة ٢٥٠٬٠٠٠، عائد ٩٠٬٠٠٠/سنة، مخاطرة متوسطة ← استرداد ≈ ٢٫٨ سنة.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ` : ideas.map((idea, i) => `
                                    <tr data-idx="${i}" class="${i === bestIdx ? 'pa-best' : ''}">
                                        <td class="pa-td-select">
                                            <input type="radio" name="selectedAlt" ${selectedIndex === i ? 'checked' : ''} value="${i}" aria-label="اختيار الفكرة ${i + 1}">
                                            ${i === bestIdx ? '<span class="pa-trophy" title="الأفضل حسب الأرقام">🏆</span>' : ''}
                                        </td>
                                        <td><input type="text" class="input input--sm alt-field" data-field="name" placeholder="اسم الفكرة" aria-label="اسم الفكرة" value="${esc(idea.name)}"></td>
                                        <td><input type="text" inputmode="numeric" class="input input--sm alt-field alt-num" data-field="estimatedCost" placeholder="0" aria-label="تكلفة تقريبية" value="${idea.estimatedCost ? fmtNum(idea.estimatedCost) : ''}"></td>
                                        <td><input type="text" inputmode="numeric" class="input input--sm alt-field alt-num" data-field="estimatedReturn" placeholder="0" aria-label="عائد متوقع" value="${idea.estimatedReturn ? fmtNum(idea.estimatedReturn) : ''}"></td>
                                        <td>${riskSelect(i, idea.risk)}</td>
                                        <td class="pa-calc">${paybackCell(metrics[i])}</td>
                                        <td class="pa-calc">${rocCell(metrics[i])}</td>
                                        <td><input type="text" class="input input--sm alt-field" data-field="notes" placeholder="ملاحظة" aria-label="ملاحظة" value="${esc(idea.notes)}"></td>
                                        <td><button type="button" class="btn-icon btn-remove-alt pa-remove" data-idx="${i}" aria-label="حذف الفكرة ${i + 1}"><svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg></button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="d-flex gap-2 mt-2 flex-wrap" id="pa-actions">
                        <button type="button" class="btn btn--secondary btn-sm pa-add" id="btnAddIdea">
                            <svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg>
                            إضافة فكرة
                        </button>
                        ${this._pickBestButtonHtml(ideas, bestIdx, validCount)}
                    </div>
                    <p class="text-muted mt-2" id="pa-best-hint" style="font-size:.85rem;">${this._bestHintHtml(ideas, bestIdx, validCount)}</p>
                </div>
            </div>
        `;

        this._bindEvents();
    }

    _pickBestButtonHtml(ideas, bestIdx, validCount) {
        if (!(validCount >= 2 && bestIdx >= 0)) return '';
        const esc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        return `<button type="button" class="btn btn--ghost btn-sm" id="btnPickBest">🏆 اختر الأفضل (${esc(ideas[bestIdx].name) || 'الفكرة ' + (bestIdx + 1)})</button>`;
    }

    _bestHintHtml(ideas, bestIdx, validCount) {
        if (!(validCount >= 2 && bestIdx >= 0)) return '';
        const esc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        return `الأفضل حسب الأرقام: <strong>${esc(ideas[bestIdx].name) || 'الفكرة ' + (bestIdx + 1)}</strong> — أقصر فترة استرداد بعد موازنة المخاطرة. القرار النهائي لك.`;
    }

    // تحديث الأعمدة المحسوبة والترشيح في مكانها — دون إعادة رسم (يمنع فقدان الصفوف وقفز المؤشر)
    _refreshCalc() {
        const rows = [...this.container.querySelectorAll('#alternativesBody tr[data-idx]')];
        const ideas = rows.map(tr => ({
            name: tr.querySelector('[data-field="name"]')?.value || '',
            estimatedCost: parseNum(tr.querySelector('[data-field="estimatedCost"]')?.value),
            estimatedReturn: parseNum(tr.querySelector('[data-field="estimatedReturn"]')?.value),
            risk: tr.querySelector('[data-field="risk"]')?.value || ''
        }));
        const { metrics, bestIdx } = this._computeMetrics(ideas);
        const validCount = metrics.filter(m => m.valid).length;

        rows.forEach((tr, i) => {
            const m = metrics[i];
            const calc = tr.querySelectorAll('.pa-calc');
            if (calc[0]) calc[0].innerHTML = m.loss ? `<span class="pa-flag pa-flag--bad">بلا عائد / خسارة</span>`
                : !m.valid ? `<span class="text-muted">—</span>`
                : `${m.payback.toFixed(1)} سنة${m.payback > LONG_PAYBACK_YEARS ? ' <span class="pa-flag pa-flag--warn">طويل</span>' : ''}`;
            if (calc[1]) calc[1].innerHTML = m.valid ? `${(m.roc * 100).toFixed(0)}%` : `<span class="text-muted">—</span>`;
            tr.classList.toggle('pa-best', i === bestIdx);
            let trophy = tr.querySelector('.pa-trophy');
            if (i === bestIdx && !trophy) {
                tr.querySelector('.pa-td-select')?.insertAdjacentHTML('beforeend', '<span class="pa-trophy" title="الأفضل حسب الأرقام">🏆</span>');
            } else if (i !== bestIdx && trophy) {
                trophy.remove();
            }
        });

        // زر «اختر الأفضل» + سطر التلميح
        const actions = this.container.querySelector('#pa-actions');
        let pickBtn = this.container.querySelector('#btnPickBest');
        const wantBtn = validCount >= 2 && bestIdx >= 0;
        if (wantBtn && !pickBtn && actions) {
            actions.insertAdjacentHTML('beforeend', this._pickBestButtonHtml(ideas, bestIdx, validCount));
            this._bindPickBest();
        } else if (wantBtn && pickBtn) {
            pickBtn.outerHTML = this._pickBestButtonHtml(ideas, bestIdx, validCount);
            this._bindPickBest();
        } else if (!wantBtn && pickBtn) {
            pickBtn.remove();
        }
        const hint = this.container.querySelector('#pa-best-hint');
        if (hint) hint.innerHTML = this._bestHintHtml(ideas, bestIdx, validCount);
    }

    _bindPickBest() {
        this.container.querySelector('#btnPickBest')?.addEventListener('click', () => {
            const { bestIdx } = this._computeMetrics((this.store.getState().projectAlternatives || {}).ideas || []);
            const radio = this.container.querySelector(`input[name="selectedAlt"][value="${bestIdx}"]`);
            if (radio) { radio.checked = true; this._save({ keepEmpty: true }); }
        });
    }

    _save(options = {}) {
        const keepEmpty = Boolean(options.keepEmpty);
        const rows = this.container.querySelectorAll('#alternativesBody tr[data-idx]');
        const ideas = [];
        let selectedIndex = parseInt(this.container.querySelector('input[name="selectedAlt"]:checked')?.value ?? '0', 10) || 0;

        rows.forEach((tr) => {
            const name = tr.querySelector('[data-field="name"]')?.value?.trim() || '';
            const estimatedCost = parseNum(tr.querySelector('[data-field="estimatedCost"]')?.value);
            const estimatedReturn = parseNum(tr.querySelector('[data-field="estimatedReturn"]')?.value);
            const risk = tr.querySelector('[data-field="risk"]')?.value || '';
            const notes = tr.querySelector('[data-field="notes"]')?.value?.trim() || '';
            if (keepEmpty || name || estimatedCost || estimatedReturn || notes) {
                ideas.push({ name, estimatedCost, estimatedReturn, risk, notes });
            }
        });

        const safeSelected = ideas.length === 0 ? 0 : Math.min(Math.max(0, selectedIndex), ideas.length - 1);
        this.store.updatePath('projectAlternatives', null, { ideas, selectedIndex: safeSelected });
    }

    _bindEvents() {
        this.container.querySelector('#btnAddIdea')?.addEventListener('click', () => {
            this._save({ keepEmpty: true });
            const pa = this.store.getState().projectAlternatives || {};
            const ideas = [...(pa.ideas || []), { name: '', estimatedCost: 0, estimatedReturn: 0, risk: '', notes: '' }];
            this.store.updatePath('projectAlternatives', null, {
                ...pa,
                ideas,
                selectedIndex: ideas.length === 1 ? 0 : Math.min(pa.selectedIndex ?? 0, ideas.length - 1)
            });
            this.render();
        });

        // اختيار الأفضل تلقائياً (يحترم حق المستخدم في التغيير بعدها)
        this._bindPickBest();

        this.container.querySelectorAll('.btn-remove-alt').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                this._save({ keepEmpty: true });
                const pa = this.store.getState().projectAlternatives || {};
                const ideas = (pa.ideas || []).filter((_, i) => i !== idx);
                const selectedIndex = pa.selectedIndex >= ideas.length ? Math.max(0, ideas.length - 1) : pa.selectedIndex;
                this.store.updatePath('projectAlternatives', null, { ideas, selectedIndex: Math.min(selectedIndex, ideas.length - 1) });
                this.render();
            });
        });

        // تغيير رقم/مخاطرة/اختيار: حفظ (مع إبقاء الصفوف الفارغة أثناء التحرير) + تحديث محسوب في مكانه
        const recalcFields = this.container.querySelectorAll('.alt-num, [data-field="risk"], input[name="selectedAlt"]');
        recalcFields.forEach(el => el.addEventListener('change', () => { this._save({ keepEmpty: true }); this._refreshCalc(); }));

        // حقول نصية (اسم/ملاحظة): حفظ عند مغادرة الحقل — نبقي الصفوف الفارغة، والإخراج يصفّيها
        this.container.querySelectorAll('[data-field="name"], [data-field="notes"]').forEach(el => {
            el.addEventListener('blur', () => this._save({ keepEmpty: true }));
        });
    }
}

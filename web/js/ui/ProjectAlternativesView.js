/**
 * مرحلة اختيار المشروع قبل التفصيل (د. الروضي)
 * "لديك أكثر من فكرة؟ قارنها مبدئياً قبل الدخول في التفصيل"
 * تحسب لكل فكرة: فترة الاسترداد والعائد على التكلفة، وترشّح الأفضل تلقائياً (مع مراعاة المخاطرة).
 */
import { stepIndexById } from '../core/wizardSteps.js';
import Sortable from 'sortablejs';
import Swal from 'sweetalert2';
import Cleave from 'cleave.js';
import { CountUp } from 'countup.js';
import noUiSlider from 'nouislider';
import 'nouislider/dist/nouislider.css';
import { detectSectorBenchmark, GENERIC_BENCHMARK } from '../core/sectorBenchmarks.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

// تدقيق 2026-07-09 (مفاضلة الأفكار): معاملات تعديل المخاطرة (ASSUMPTION) — تقديرات
// داخلية تقريبية لترتيب الأفكار مبدئياً فقط، وليست مشتقة من صيغة منشورة أو من
// انحراف معياري فعلي للطلب/التدفقات النقدية. لا تُستخدم كمُدخل للنموذج المالي التفصيلي.
const RISK_OPTIONS = [
    { value: '', label: 'غير محدد', factor: 1.10 },
    { value: 'low', label: 'منخفضة', factor: 1.00 },
    { value: 'medium', label: 'متوسطة', factor: 1.15 },
    { value: 'high', label: 'عالية', factor: 1.30 }
];
// تدقيق 2026-07-09: عتبة «استرداد طويل» تتدرّج مع حجم الاستثمار (ASSUMPTION) —
// مشروع صغير (مقهى مثلاً) يُتوقَّع منه استرداد أسرع، بينما مشروع كبير (فرنشايز/سلسلة
// فروع) يقبل دورة استرداد أطول طبيعياً بحكم حجم رأس المال ومدة الانتشار.
function longPaybackThreshold(cost) {
    const c = Number(cost) || 0;
    if (c < 500000) return 5;
    if (c < 2000000) return 7;
    return 9;
}

// أرقام بفواصل آلاف للقراءة (إدخال نصّي inputmode رقمي) — يمنع خطأ الأصفار
const fmtNum = (n) => (Number(n) || 0).toLocaleString('en-US');
const parseNum = (s) => parseFloat(String(s ?? '').replace(/[^\d.]/g, '')) || 0;

// تدقيق 2026-07-16 (تقدير تلقائي لتكلفة الفكرة): «مقارنة الأفكار» تسبق أي خطوة يُدخِل فيها
// المستخدم إيرادات فعلية (تُدخَل لاحقاً في النموذج المالي)، فلا يوجد سياق إيراد حقيقي نبني
// عليه. لذا نفترض مرجعاً خشناً موحّداً لحجم إيرادات سنوية لمشروع صغير/متوسط نموذجي في
// السوق السعودي (ASSUMPTION وليس تنبؤاً لهذه الفكرة تحديداً)، ونضربه في مجموع نسب تكلفة
// القطاع (بضاعة/خدمة + إيجار + عمالة) من sectorBenchmarks.js — نفس مصدر معايير SmartAdvisor،
// لا جدول تكلفة موازٍ جديد. الناتج رقم استرشادي أولي فقط يعدّله المستخدم بحرية.
const REFERENCE_ANNUAL_REVENUE = 400000; // ريال/سنة — مرجع تقريبي لمشروع صغير نموذجي، ليس تنبؤاً
function estimateIdeaCost(text) {
    const bench = detectSectorBenchmark(text) || GENERIC_BENCHMARK;
    const mid = ([lo, hi]) => (lo + hi) / 2;
    const opexRatio = mid(bench.variableCostRate) + mid(bench.rentToRevenue) + mid(bench.laborToRevenue);
    const cost = Math.round((REFERENCE_ANNUAL_REVENUE * opexRatio) / 1000) * 1000;
    return { cost, sectorLabel: bench.label };
}

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
                return { valid: true, payback, roc, adjusted: payback * risk.factor, cost };
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
            const warn = m.payback > longPaybackThreshold(m.cost) ? ` <span class="pa-flag pa-flag--warn">طويل</span>` : '';
            return `${m.payback.toFixed(1)} سنة${warn}`;
        };
        const rocCell = (m) => m.valid ? `<span class="countup-roc" data-val="${m.roc * 100}">0</span>%` : `<span class="text-muted">—</span>`;

        const riskSelect = (i, val) => `
            <div class="risk-slider-container" style="padding: 10px; min-width: 120px;">
                <div class="risk-slider alt-field" data-field="risk" data-idx="${i}" data-val="${val || 'medium'}"></div>
                <div class="risk-slider-label text-xs text-center mt-1" style="color: #64748b;">${
                    val === 'low' ? 'منخفضة' : (val === 'high' ? 'عالية' : 'متوسطة')
                }</div>
            </div>`;

        this.container.innerHTML = `
            <div class="project-alternatives-view animate-entry">
                <h2 class="section-title">
                    <svg class="ic section-title__ic" aria-hidden="true"><use href="#i-chart"/></svg>
                    مقارنة الأفكار
                </h2>
                <p class="text-muted mb-4">إذا لديك أكثر من فكرة مشروع، قارنها مبدئياً قبل الدخول في الدراسة التفصيلية. إذا مشروع واحد فقط — اكمل مباشرة.</p>

                ${this._weakPreliminary() ? `
                    <div class="alert alert--warn mb-4">
                        <strong>وصلت هنا لأن مؤشرات فكرتك الأولى ضعيفة.</strong> جرّب إضافة فكرة أو فكرتين بديلتين ومقارنتها بالأرقام — قد تجد خياراً أنسب قبل صرف الوقت في التفاصيل.
                    </div>` : ''}

                <div class="alert alert--info mb-4 pa-note">
                    قارن ٢–٣ أفكار (تكلفة، عائد، مخاطرة) — «قرار» يحسب الاسترداد ويرشّح الأفضل تلقائياً.
                </div>

                <div class="card analysis-card mb-4 pa-card">
                    <h3 class="card-title">جدول مقارنة الأفكار (مبدئي)</h3>
                    <p class="text-xs text-muted mb-2">معامل المخاطرة وعتبة الاسترداد تقديرات استرشادية لترتيب الأفكار مبدئياً — عدّلها بحكمك.</p>
                    <div class="table-responsive pa-table-wrap">
                        <table class="data-table pa-table" id="alternativesTable">
                            <thead>
                                <tr>
                                    <th scope="col" style="width: 30px;"></th>
                                    <th scope="col"><span class="sr-only">اختيار</span>${icon('i-check')}</th>
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
                                    <tr data-idx="${i}" data-cost-estimated="${idea.costIsEstimated ? '1' : ''}" class="${i === bestIdx ? 'pa-best' : ''}">
                                        <td class="pa-drag-handle text-muted" style="cursor: grab; font-size: 1.2rem;">≡</td>
                                        <td class="pa-td-select">
                                            <input type="radio" name="selectedAlt" ${selectedIndex === i ? 'checked' : ''} value="${i}" aria-label="اختيار الفكرة ${i + 1}">
                                            ${i === bestIdx ? `<span class="pa-trophy" title="الأفضل حسب الأرقام">${icon('i-trophy')}</span>` : ''}
                                        </td>
                                        <td><input type="text" class="input input--sm alt-field" data-field="name" placeholder="اسم الفكرة" aria-label="اسم الفكرة" value="${esc(idea.name)}"></td>
                                        <td>
                                            <input type="text" inputmode="numeric" class="input input--sm alt-field alt-num cleave-num" data-field="estimatedCost" placeholder="0" aria-label="تكلفة تقريبية" value="${idea.estimatedCost ? fmtNum(idea.estimatedCost) : ''}">
                                            <div class="pa-cost-actions">
                                                <button type="button" class="btn-xs btn-magic pa-estimate" data-idx="${i}" title="تقدير استرشادي لتكلفة الفكرة حسب متوسطات القطاع — ليس رقماً نهائياً">${icon('i-sparkle')} تقدير تلقائي</button>
                                                ${idea.costIsEstimated ? `<span class="badge badge--neutral pa-estimate-badge">تقدير تلقائي</span>` : ''}
                                            </div>
                                        </td>
                                        <td><input type="text" inputmode="numeric" class="input input--sm alt-field alt-num cleave-num" data-field="estimatedReturn" placeholder="0" aria-label="عائد متوقع" value="${idea.estimatedReturn ? fmtNum(idea.estimatedReturn) : ''}"></td>
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

        // Initialize Sortable for drag-and-drop reordering
        const tbody = this.container.querySelector('#alternativesBody');
        if (tbody && hasIdeas) {
            new Sortable(tbody, {
                handle: '.pa-drag-handle',
                animation: 150,
                onEnd: (evt) => {
                    if (evt.oldIndex === evt.newIndex) return;
                    const state = this.store.getState();
                    const ideas = [...(state.projectAlternatives?.ideas || [])];
                    const item = ideas.splice(evt.oldIndex, 1)[0];
                    ideas.splice(evt.newIndex, 0, item);
                    
                    let newSelected = state.projectAlternatives?.selectedIndex ?? 0;
                    if (newSelected === evt.oldIndex) newSelected = evt.newIndex;
                    else if (evt.oldIndex < newSelected && evt.newIndex >= newSelected) newSelected--;
                    else if (evt.oldIndex > newSelected && evt.newIndex <= newSelected) newSelected++;
                    
                    this.store.updatePath('projectAlternatives', null, { ideas, selectedIndex: newSelected });
                    this.render();
                }
            });
        }

        // Initialize Cleave.js for numeric inputs
        this.container.querySelectorAll('.cleave-num').forEach(input => {
            new Cleave(input, {
                numeral: true,
                numeralThousandsGroupStyle: 'thousand'
            });
        });

        // Initialize CountUp.js
        this.container.querySelectorAll('.countup-roc').forEach(el => {
            const val = parseFloat(el.getAttribute('data-val') || 0);
            const countUp = new CountUp(el, val, { duration: 2, separator: ',' });
            if (!countUp.error) countUp.start();
        });

        // Initialize noUiSlider for risk
        const riskMap = { 'low': 0, 'medium': 1, 'high': 2 };
        const riskRevMap = ['low', 'medium', 'high'];
        const riskLabels = ['منخفضة', 'متوسطة', 'عالية'];
        this.container.querySelectorAll('.risk-slider').forEach(slider => {
            const valStr = slider.getAttribute('data-val') || 'medium';
            const initialVal = riskMap[valStr] ?? 1;
            
            noUiSlider.create(slider, {
                start: initialVal,
                step: 1,
                range: { min: 0, max: 2 },
                format: {
                    to: v => Math.round(v),
                    from: v => Math.round(v)
                }
            });

            slider.noUiSlider.on('update', (values, handle) => {
                const numVal = parseInt(values[handle], 10);
                slider.dataset.value = riskRevMap[numVal]; // custom attribute for saving
                const label = slider.nextElementSibling;
                if (label) label.textContent = riskLabels[numVal];
            });

            slider.noUiSlider.on('change', () => {
                this._save({ keepEmpty: true });
                this.render();
            });
        });
    }

    _pickBestButtonHtml(ideas, bestIdx, validCount) {
        if (!(validCount >= 2 && bestIdx >= 0)) return '';
        const esc = (s) => (s || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        return `<button type="button" class="btn btn--ghost btn-sm" id="btnPickBest">${icon('i-trophy')} اختر الأفضل (${esc(ideas[bestIdx].name) || 'الفكرة ' + (bestIdx + 1)})</button>`;
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
                : `${m.payback.toFixed(1)} سنة${m.payback > longPaybackThreshold(m.cost) ? ' <span class="pa-flag pa-flag--warn">طويل</span>' : ''}`;
            if (calc[1]) calc[1].innerHTML = m.valid ? `${(m.roc * 100).toFixed(0)}%` : `<span class="text-muted">—</span>`;
            tr.classList.toggle('pa-best', i === bestIdx);
            let trophy = tr.querySelector('.pa-trophy');
            if (i === bestIdx && !trophy) {
                tr.querySelector('.pa-td-select')?.insertAdjacentHTML('beforeend', `<span class="pa-trophy" title="الأفضل حسب الأرقام">${icon('i-trophy')}</span>`);
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
            const risk = tr.querySelector('.risk-slider')?.dataset?.value || 'medium';
            const notes = tr.querySelector('[data-field="notes"]')?.value?.trim() || '';
            const costIsEstimated = tr.dataset.costEstimated === '1';
            if (keepEmpty || name || estimatedCost || estimatedReturn || notes) {
                ideas.push({ name, estimatedCost, estimatedReturn, risk, notes, costIsEstimated });
            }
        });

        const safeSelected = ideas.length === 0 ? 0 : Math.min(Math.max(0, selectedIndex), ideas.length - 1);
        this.store.updatePath('projectAlternatives', null, { ideas, selectedIndex: safeSelected });
    }

    _bindEvents() {
        this.container.querySelector('#btnAddIdea')?.addEventListener('click', () => {
            this._save({ keepEmpty: true });
            const pa = this.store.getState().projectAlternatives || {};
            const ideas = [...(pa.ideas || []), { name: '', estimatedCost: 0, estimatedReturn: 0, risk: '', notes: '', costIsEstimated: false }];
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
            btn.addEventListener('click', async () => {
                const idx = parseInt(btn.dataset.idx, 10);
                
                const result = await Swal.fire({
                    title: 'هل أنت متأكد؟',
                    text: 'لن تتمكن من التراجع عن حذف هذه الفكرة!',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#3085d6',
                    confirmButtonText: 'نعم، احذفها!',
                    cancelButtonText: 'إلغاء'
                });
                
                if (result.isConfirmed) {
                    this._save({ keepEmpty: true });
                    const pa = this.store.getState().projectAlternatives || {};
                    const ideas = (pa.ideas || []).filter((_, i) => i !== idx);
                    const selectedIndex = pa.selectedIndex >= ideas.length ? Math.max(0, ideas.length - 1) : pa.selectedIndex;
                    this.store.updatePath('projectAlternatives', null, { ideas, selectedIndex: Math.min(selectedIndex, ideas.length - 1) });
                    this.render();
                    Swal.fire({ title: 'تم الحذف!', icon: 'success', timer: 1500, showConfirmButton: false });
                }
            });
        });

        // تعديل يدوي لحقل التكلفة يُسقط وسم «تقدير تلقائي» — يجب أن يُبنى قبل مستمع الحفظ
        // العام أدناه كي يقرأ _save() القيمة المُسقَطة من نفس حدث change.
        this.container.querySelectorAll('[data-field="estimatedCost"]').forEach(el => {
            el.addEventListener('change', () => { el.closest('tr')?.removeAttribute('data-cost-estimated'); });
        });

        // زر «تقدير تلقائي»: يكتشف قطاع الفكرة من اسمها/ملاحظتها ويقترح تكلفة استرشادية
        // (انظر estimateIdeaCost أعلاه) — لا يستبدل قيمة أدخلها المستخدم فعلياً دون تأكيد.
        this.container.querySelectorAll('.pa-estimate').forEach(btn => {
            btn.addEventListener('click', async () => {
                const idx = parseInt(btn.dataset.idx, 10);
                this._save({ keepEmpty: true });
                const pa = this.store.getState().projectAlternatives || {};
                const ideas = [...(pa.ideas || [])];
                const idea = ideas[idx];
                if (!idea) return;

                const { cost, sectorLabel } = estimateIdeaCost(`${idea.name || ''} ${idea.notes || ''}`);

                if (Number(idea.estimatedCost) > 0) {
                    const result = await Swal.fire({
                        title: 'يوجد تكلفة مُدخلة مسبقاً',
                        html: `التكلفة الحالية: <strong>${fmtNum(idea.estimatedCost)}</strong> ر.س.<br>استبدالها بتقدير تلقائي (~${fmtNum(cost)} ر.س حسب قطاع «${sectorLabel}»)؟`,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'استبدال',
                        cancelButtonText: 'إلغاء'
                    });
                    if (!result.isConfirmed) return;
                }

                ideas[idx] = { ...idea, estimatedCost: cost, costIsEstimated: true };
                this.store.updatePath('projectAlternatives', null, { ...pa, ideas });
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

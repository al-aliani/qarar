/**
 * SMART Goals Component
 * Specific, Measurable, Achievable, Relevant, Time-bound goals
 */

import { DataService } from '../services/DataService.js';
import { toast } from '../utils/toast.js';
import { fieldHelp } from './components/FieldHelp.js';
import { escapeHtml } from '../utils/escape.js';
import { deriveRevenueFromStreams } from '../core/engine.js';

// أيقونة من الـsprite الموحّد بدل إيموجي — تدقيق تنظيف 2026-07-11.
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

// خيارات «قابل للتحقيق» — value معياري، label عربي معروض ومخزّن
const ACHIEVABLE_CHOICES = [
    { value: 'yes', label: 'نعم' },
    { value: 'unsure', label: 'غير متأكد' },
    { value: 'no', label: 'لا' }
];

/**
 * توافق خلفي: goal.achievable القديم نص حر (والقوالب الجاهزة كذلك).
 * نقبل بادئة معيارية (yes/no/unsure) أو عربية؛ وإلا يُعرض النص كله في حقل الموارد.
 */
function parseAchievable(raw) {
    const text = (raw ?? '').toString().trim();
    if (!text) return { choice: '', resources: '' };
    for (const c of ACHIEVABLE_CHOICES) {
        for (const prefix of [c.value, c.label]) {
            if (text.toLowerCase().startsWith(prefix.toLowerCase())) {
                const rest = text.slice(prefix.length);
                // البادئة تصلح فقط إن انتهى النص أو تبعها فاصل (وإلا «لايوجد» تُحسب «لا»)
                if (rest === '' || /^[\s،,.:—-]/.test(rest)) {
                    return { choice: c.value, resources: rest.replace(/^[\s،,.:—-]+/, '').trim() };
                }
            }
        }
    }
    return { choice: '', resources: text };
}

// التخزين نص بادئته التسمية العربية — بقية القرّاء (التقارير) يطبعون القيمة خاماً
function composeAchievable(choice, resources) {
    const found = ACHIEVABLE_CHOICES.find(c => c.value === choice);
    if (!found) return (resources || '').trim();
    return resources?.trim() ? `${found.label} — ${resources.trim()}` : found.label;
}

export class SmartGoals {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.editingId = null;
        this.stepIndex = 0;
        // بند 1.2 (خطة 2026-07-12): يتتبّع مصدر آخر قيمة كُتبت في حقل «القيمة المستهدفة»
        // ضمن نموذج الإضافة/التعديل الحالي — 'computed' فقط إن ضُغط زر «استخدم القيمة
        // المحسوبة»، وإلا 'manual' بمجرد كتابة المستخدم يدوياً. يُصفَّر مع كل render() جديد.
        this._targetValueSource = null;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const smartGoals = state.smartGoals || {};
        // مشتقات الإيراد من جدول الإيرادات (بند 1.2) — تُستهلك في تلميح نموذج الإضافة
        // وشارة الانحراف على بطاقات الأهداف المالية. لا تشغّل المحرك الكامل، حساب خفيف.
        this._derivedRevenue = deriveRevenueFromStreams(state.revenue?.streams);
        this._targetValueSource = null;

        this.container.innerHTML = `
            <div class="smart-goals">
                <h2 class="section-title">الأهداف الذكية</h2>
                
                <div class="card analysis-card">
                    <div class="smart-intro">
                        <div class="smart-badges">
                            <span class="smart-badge smart-s">S - محدد</span>
                            <span class="smart-badge smart-m">M - قابل للقياس</span>
                            <span class="smart-badge smart-a">A - قابل للتحقيق</span>
                            <span class="smart-badge smart-r">R - مرتبط</span>
                            <span class="smart-badge smart-t">T - محدد بوقت</span>
                        </div>
                    </div>
                </div>

                <!-- Goals Categories -->
                ${this.renderGoalsByCategory(smartGoals.goals || [])}

                <div class="card analysis-card">
                    <div class="flex-between">
                        <h3 class="card-title">${this.editingId ? 'تعديل الهدف' : 'إضافة هدف جديد'}</h3>
                        <div class="actions">
                            ${this.editingId ? `<button class="btn btn--ghost btn-sm btn-cancel-edit">${icon('i-x')} إلغاء</button>` : ''}
                            <button class="btn btn--secondary btn-sm btn-suggest-goals">${icon('i-sparkle')} اقتراح أهداف نموذجية</button>
                        </div>
                    </div>
                    ${this.renderAddGoalForm()}
                </div>

                <!-- Goals Summary -->
                <div class="card analysis-card">
                    <h3 class="card-title">ملخص الأهداف</h3>
                    ${this.renderGoalsSummary(smartGoals.goals || [])}
                </div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
        this._syncFinancialHintVisibility();
    }

    renderGoalsByCategory(goals) {
        const categories = [
            { key: 'financial', label: 'الأهداف المالية', icon: icon('i-bank'), color: 'green' },
            { key: 'operational', label: 'الأهداف التشغيلية', icon: icon('i-settings'), color: 'blue' },
            { key: 'market', label: 'أهداف السوق', icon: icon('i-chart'), color: 'purple' },
            { key: 'hr', label: 'أهداف الموارد البشرية', icon: icon('i-users'), color: 'orange' }
        ];

        return categories.map(cat => {
            const categoryGoals = goals.filter(g => g.category === cat.key);
            return `
                <div class="card analysis-card goals-category goals-${cat.color}">
                    <div class="category-header">
                        <span class="category-icon">${cat.icon}</span>
                        <h3 class="card-title">${cat.label}</h3>
                        <span class="goals-count">${categoryGoals.length} أهداف</span>
                    </div>
                    <div class="goals-list">
                        ${categoryGoals.length > 0 ? categoryGoals.map((goal, idx) => this.renderGoalCard(goal, goals.indexOf(goal))).join('') : '<p class="text-muted text-center">لا توجد أهداف في هذه الفئة</p>'}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderGoalCard(goal, idx) {
        const progress = goal.targetValue > 0 ? Math.min(100, (goal.currentValue / goal.targetValue) * 100) : 0;
        const statusLabels = {
            pending: { label: 'قيد الانتظار', class: 'status-pending' },
            in_progress: { label: 'جاري العمل', class: 'status-progress' },
            achieved: { label: 'تم تحقيقه', class: 'status-achieved' }
        };
        const status = statusLabels[goal.status] || statusLabels.pending;

        return `
            <div class="goal-card" data-idx="${idx}">
                <div class="goal-header">
                    <span class="goal-title">${goal.specific ? escapeHtml(goal.specific) : 'هدف غير محدد'}</span>
                    <span class="goal-status ${status.class}">${status.label}</span>
                </div>
                <div class="goal-details">
                    <div class="goal-measure">
                        <span class="label">القياس:</span>
                        <span>${goal.measurable ? escapeHtml(goal.measurable) : '-'}</span>
                    </div>
                    <div class="goal-deadline">
                        <span class="label">الموعد:</span>
                        <span>${goal.timeBound ? escapeHtml(goal.timeBound) : '-'}</span>
                    </div>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-values">
                        <span>${this.formatValue(goal.currentValue)}</span>
                        <span>من ${this.formatValue(goal.targetValue)}</span>
                    </div>
                </div>
                ${this.renderFinancialGoalDeviation(goal, idx)}
                <div class="goal-actions">
                    <button class="btn btn--sm btn--ghost btn-edit-goal" data-idx="${idx}">${icon('i-pen')} تعديل</button>
                    <button class="btn btn--sm btn--ghost btn-update-goal" data-idx="${idx}">تحديث الحالة</button>
                    <button class="btn btn--sm btn--ghost btn-remove-goal" data-idx="${idx}">حذف</button>
                </div>
            </div>
        `;
    }

    /**
     * شارة انحراف الهدف المالي عن الإيراد المحسوب من جدول الإيرادات (بند 1.2، خطة
     * 2026-07-12) — لا تظهر إلا لهدف من فئة «مالي» بقيمة مستهدفة وانحراف > 10%.
     * التلوين/اللهجة يعتمدان على manualOverride: false = كان متزامناً وانحرف (يستحق
     * إعادة مزامنة بزر مباشر)، true = قيمة يدوية واعية (طموح مقصود) فملاحظة محايدة فقط.
     */
    renderFinancialGoalDeviation(goal, idx) {
        if (goal.category !== 'financial') return '';
        const year1Revenue = this._derivedRevenue?.year1Revenue || 0;
        const target = Number(goal.targetValue) || 0;
        if (!year1Revenue || !target) return '';
        const deviation = Math.abs(target - year1Revenue) / year1Revenue;
        if (deviation <= 0.10) return '';
        const pct = Math.round(deviation * 100);
        const revenueStr = Math.round(year1Revenue).toLocaleString('ar-SA');

        if (goal.manualOverride === false) {
            return `
                <div class="goal-financial-flag alert alert--warning">
                    ${icon('i-warning')}
                    <span>لم يعد يطابق الإيراد المحسوب حالياً من جدول الإيرادات (${revenueStr} ريال) — فارق ${pct}%.</span>
                    <button type="button" class="btn btn--sm btn--ghost btn-sync-financial-goal" data-idx="${idx}">إعادة المزامنة</button>
                </div>
            `;
        }
        return `
            <div class="goal-financial-flag text-xs text-muted">
                ${icon('i-info')}
                <span>ملاحظة: يختلف عن الإيراد المحسوب من جدول الإيرادات (${revenueStr} ريال) بنسبة ${pct}% — إن لم يكن هذا مقصوداً، افتح «تعديل» واستخدم القيمة المحسوبة.</span>
            </div>
        `;
    }

    renderAddGoalForm() {
        return `
            <div class="add-goal-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="goalSpecific">الهدف (Specific - محدد) ${fieldHelp('صِغ الهدف بوضوح: ماذا بالضبط تريد تحقيقه؟ هدف واحد لكل بطاقة.', 'مثال: الوصول إلى 150 عميلاً يومياً في مطعمي خلال السنة الأولى.')}</label>
                        <input type="text" class="input" id="goalSpecific" placeholder="ماذا تريد تحقيقه بالضبط؟">
                    </div>
                    <div class="form-group">
                        <label for="goalCategory">الفئة</label>
                        <select class="input" id="goalCategory">
                            <option value="financial">مالي</option>
                            <option value="operational">تشغيلي</option>
                            <option value="market">سوقي</option>
                            <option value="hr">موارد بشرية</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="goalMeasurable">كيف ستقيسه؟ (Measurable - قابل للقياس) ${fieldHelp('حدد رقماً أو نسبة تعرف بها أنك حققت الهدف — بلا رقم لا يمكن القياس.', 'مثال: مبيعات شهرية 90 ألف ريال، أو متوسط فاتورة 60 ريالاً.')}</label>
                        <input type="text" class="input" id="goalMeasurable" placeholder="مثال: زيادة المبيعات بنسبة 20%">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="goalTargetValue">القيمة المستهدفة</label>
                        <input type="number" class="input" id="goalTargetValue" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label for="goalCurrentValue">القيمة الحالية</label>
                        <input type="number" class="input" id="goalCurrentValue" placeholder="0">
                    </div>
                </div>
                <div class="form-row" id="goalFinancialHintRow">
                    <div class="form-group financial-goal-hint alert alert--info">
                        ${icon('i-info')}
                        <span>الإيراد المخطَّط لسنة كاملة من جدول الإيرادات: <strong>${Math.round(this._derivedRevenue?.year1Revenue || 0).toLocaleString('ar-SA')}</strong> ريال — اقتراح بداية للهدف المالي، قابل للتعديل بالكامل.</span>
                        <button type="button" class="btn btn--sm btn--ghost" id="btnUseComputedRevenue">استخدم هذه القيمة</button>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="goalRelevant">كيف يحقق الهدف الفكرة والهوية؟ (Relevant - مرتبط) ${fieldHelp('اربط الهدف بفكرة المشروع: لماذا هذا الهدف مهم لنجاحه تحديداً؟', 'مثال: زيادة عملاء الفطور تدعم هوية المطعم كوجهة عائلية صباحية.')}</label>
                        <input type="text" class="input" id="goalRelevant" placeholder="كيف يدعم هذا الهدف فكرة المشروع وهويته؟">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="goalStartDate">تاريخ البداية (إطار زمني)</label>
                        <input type="date" class="input" id="goalStartDate">
                    </div>
                    <div class="form-group">
                        <label for="goalTimeBound">تاريخ النهاية (Time-bound - محدد بوقت) ${fieldHelp('حدد موعداً نهائياً واقعياً — الهدف بلا موعد يبقى أمنية.', 'مثال: نهاية الربع الثاني من السنة الأولى لتشغيل المطعم.')}</label>
                        <input type="date" class="input" id="goalTimeBound">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>هل الهدف قابل للتحقيق؟ (Achievable) ${fieldHelp('قيّم بواقعية: هل الهدف ممكن بمواردك وقدراتك الحالية؟', 'مثال: 150 عميلاً يومياً قابل للتحقيق لمطعم بموقع رئيسي و40 مقعداً.')}</label>
                        <div class="yesno-group d-flex gap-2 mt-2" id="goalAchievableGroup">
                            ${ACHIEVABLE_CHOICES.map(c => `
                                <label class="yesno-btn flex-1">
                                    <input type="radio" name="goalAchievable" value="${c.value}" class="hidden-radio">
                                    ${c.label}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="goalAchievableResources">الموارد المطلوبة للتحقيق (اختياري)</label>
                        <input type="text" class="input" id="goalAchievableResources" placeholder="مثال: طباخ إضافي وميزانية تسويق 5 آلاف ريال شهرياً">
                    </div>
                </div>
                <button class="btn btn--primary btn-add-goal">${this.editingId ? 'حفظ التعديلات' : '+ إضافة الهدف'}</button>
            </div>
        `;
    }

    renderGoalsSummary(goals) {
        const total = goals.length;
        const achieved = goals.filter(g => g.status === 'achieved').length;
        const inProgress = goals.filter(g => g.status === 'in_progress').length;
        const pending = goals.filter(g => g.status === 'pending').length;

        return `
            <div class="goals-summary-grid">
                <div class="summary-card">
                    <div class="summary-value">${total}</div>
                    <div class="summary-label">إجمالي الأهداف</div>
                </div>
                <div class="summary-card summary-achieved">
                    <div class="summary-value">${achieved}</div>
                    <div class="summary-label">تم تحقيقها</div>
                </div>
                <div class="summary-card summary-progress">
                    <div class="summary-value">${inProgress}</div>
                    <div class="summary-label">جاري العمل</div>
                </div>
                <div class="summary-card summary-pending">
                    <div class="summary-value">${pending}</div>
                    <div class="summary-label">قيد الانتظار</div>
                </div>
            </div>
            <div class="completion-rate">
                <span>نسبة الإنجاز:</span>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: ${total > 0 ? (achieved / total) * 100 : 0}%"></div>
                </div>
                <span>${total > 0 ? Math.round((achieved / total) * 100) : 0}%</span>
            </div>
        `;
    }

    formatValue(value) {
        if (!value) return '0';
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toString();
    }

    bindEvents() {
        // Add goal button
        this.container.querySelector('.btn-add-goal')?.addEventListener('click', () => this.addGoal());

        // تفعيل بصري لأزرار «قابل للتحقيق»
        this.container.querySelectorAll('input[name="goalAchievable"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this.container.querySelectorAll('#goalAchievableGroup .yesno-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.querySelector('input')?.checked);
                });
            });
        });

        // Remove goal buttons
        this.container.querySelectorAll('.btn-remove-goal').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeGoal(e));
        });

        // Update goal buttons
        this.container.querySelectorAll('.btn-update-goal').forEach(btn => {
            btn.addEventListener('click', (e) => this.updateGoalStatus(e));
        });

        // Edit goal button
        this.container.querySelectorAll('.btn-edit-goal').forEach(btn => {
            btn.addEventListener('click', (e) => this.editGoal(e));
        });

        // Cancel Edit
        this.container.querySelector('.btn-cancel-edit')?.addEventListener('click', () => this.cancelEdit());

        // Suggest goals
        this.container.querySelector('.btn-suggest-goals')?.addEventListener('click', () => this.suggestGoals());

        // بند 1.2 (خطة 2026-07-12): تلميح الهدف المالي (اقتراح بنقرة — لا تعبئة تلقائية صامتة)
        this.container.querySelector('#goalCategory')?.addEventListener('change', () => this._syncFinancialHintVisibility());
        this.container.querySelector('#goalTargetValue')?.addEventListener('input', () => {
            this._targetValueSource = 'manual';
        });
        this.container.querySelector('#btnUseComputedRevenue')?.addEventListener('click', () => {
            const targetInput = this.container.querySelector('#goalTargetValue');
            if (!targetInput) return;
            targetInput.value = Math.round(this._derivedRevenue?.year1Revenue || 0);
            this._targetValueSource = 'computed';
            toast.success('عُبّئت القيمة المستهدفة من الإيراد المحسوب — يمكنك تعديلها كما تريد.');
        });
        // «إعادة المزامنة» على بطاقة هدف مالي منحرف بالفعل (بلا فتح نموذج التعديل)
        this.container.querySelectorAll('.btn-sync-financial-goal').forEach(btn => {
            btn.addEventListener('click', (e) => this.syncFinancialGoal(e));
        });

        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /** يُظهر/يُخفي شريط تلميح الإيراد المحسوب حسب الفئة المختارة حالياً في النموذج (financial فقط). */
    _syncFinancialHintVisibility() {
        const row = this.container.querySelector('#goalFinancialHintRow');
        const category = this.container.querySelector('#goalCategory')?.value;
        if (row) row.style.display = category === 'financial' ? '' : 'none';
    }

    /**
     * إعادة مزامنة هدف مالي منحرف مباشرة من بطاقته (بلا فتح نموذج التعديل) — يعيد
     * targetValue إلى الإيراد المحسوب حالياً ويضبط manualOverride=false مجدداً.
     */
    syncFinancialGoal(e) {
        const idx = parseInt(e.target.dataset.idx, 10);
        const state = this.store.getState();
        const goals = [...(state.smartGoals?.goals || [])];
        if (!goals[idx]) return;
        const year1Revenue = Math.round(this._derivedRevenue?.year1Revenue || 0);
        goals[idx] = { ...goals[idx], targetValue: year1Revenue, manualOverride: false };
        this.store.update('smartGoals', { ...state.smartGoals, goals });
        this.render();
        toast.success('أُعيدت مزامنة الهدف المالي مع الإيراد المحسوب.');
    }

    addGoal() {
        try {
            const specific = document.getElementById('goalSpecific')?.value;
            const measurable = document.getElementById('goalMeasurable')?.value;
            const achievableChoice = this.container.querySelector('input[name="goalAchievable"]:checked')?.value || '';
            const achievableResources = document.getElementById('goalAchievableResources')?.value || '';
            const achievable = composeAchievable(achievableChoice, achievableResources);
            const relevant = document.getElementById('goalRelevant')?.value;
            const startDate = document.getElementById('goalStartDate')?.value;
            const timeBound = document.getElementById('goalTimeBound')?.value;
            const category = document.getElementById('goalCategory')?.value;
            const targetValue = parseFloat(document.getElementById('goalTargetValue')?.value) || 0;
            const currentValue = parseFloat(document.getElementById('goalCurrentValue')?.value) || 0;

            if (!specific) {
                toast.error('يرجى إدخال الهدف');
                return;
            }

            const state = this.store.getState();
            const goals = [...(state?.smartGoals?.goals || [])];

            // بند 1.2 (خطة 2026-07-12): manualOverride يميّز هدفاً مالياً متزامناً مع الإيراد
            // المحسوب (زر «استخدم هذه القيمة» ⇒ false) عن قيمة يدوية واعية (طموح مختلف عمداً
            // ⇒ true). إن لم يُلمس الحقل في هذا الحفظ نحتفظ بالعلم السابق للهدف عند التعديل.
            const existingGoal = this.editingId ? goals.find(g => g.id === this.editingId) : null;
            let manualOverride;
            if (category !== 'financial') {
                manualOverride = undefined;
            } else if (this._targetValueSource === 'computed') {
                manualOverride = false;
            } else if (this._targetValueSource === 'manual') {
                manualOverride = true;
            } else {
                manualOverride = typeof existingGoal?.manualOverride === 'boolean' ? existingGoal.manualOverride : true;
            }

            if (this.editingId) {
                // Update existing
                const index = goals.findIndex(g => g.id === this.editingId);
                if (index !== -1) {
                    goals[index] = {
                        ...goals[index],
                        specific, measurable, achievable, relevant, startDate, timeBound, category,
                        targetValue, currentValue, manualOverride
                    };
                    this.editingId = null; // Clear edit mode
                    // تدقيق اختبار عميل 2026-07-12: alert() يحجب الخيط الرئيسي حتى
                    // يضغط المستخدم «موافق» — كان يُقرأ كـ«تجمّد» طويل بعد «حفظ التعديلات».
                    toast.success('تم تعديل الهدف بنجاح');
                }
            } else {
                // Create new
                goals.push({
                    id: this.generateId(),
                    specific,
                    measurable,
                    achievable,
                    relevant,
                    startDate,
                    timeBound,
                    category,
                    targetValue,
                    currentValue,
                    manualOverride,
                    status: 'pending'
                });
            }

            this.store.update('smartGoals', { ...state.smartGoals, goals });
            this.render();
        } catch (e) {
            console.error('Error adding goal:', e);
            toast.error('حدث خطأ أثناء إضافة الهدف');
        }
    }

    editGoal(e) {
        const idx = parseInt(e.target.dataset.idx);
        const state = this.store.getState();
        const goals = state.smartGoals?.goals || [];
        const goal = goals[idx];

        if (goal) {
            this.editingId = goal.id;
            this.render();

            // Fill form after render
            setTimeout(() => {
                const setValue = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val || '';
                };
                setValue('goalSpecific', goal.specific);
                setValue('goalMeasurable', goal.measurable);
                // توافق خلفي: النص القديم بلا بادئة معيارية يذهب كاملاً لحقل الموارد
                const { choice, resources } = parseAchievable(goal.achievable);
                setValue('goalAchievableResources', resources);
                const radio = this.container.querySelector(`input[name="goalAchievable"][value="${choice}"]`);
                if (radio) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
                setValue('goalRelevant', goal.relevant);
                setValue('goalStartDate', goal.startDate);
                setValue('goalTimeBound', goal.timeBound || goal.deadline);
                setValue('goalCategory', goal.category);
                setValue('goalTargetValue', goal.targetValue);
                setValue('goalCurrentValue', goal.currentValue);
                // القيمة معبّأة من الهدف المحفوظ لا من زر «استخدم القيمة المحسوبة» —
                // لا نغيّر this._targetValueSource هنا (يبقى null حتى يلمس المستخدم الحقل
                // فعلياً)، كي يُحتفظ بعلم manualOverride السابق للهدف عند الحفظ دون لمس.
                this._syncFinancialHintVisibility();

                document.getElementById('goalSpecific')?.focus();
            }, 50);
        }
    }

    cancelEdit() {
        this.editingId = null;
        this.render();
    }

    suggestGoals() {
        try {
            const templates = DataService.getSmartGoalsTemplates();
            if (!templates || templates.length === 0) {
                toast.info('لا توجد أهداف نموذجية متاحة');
                return;
            }

            const state = this.store.getState();
            if (!state) {
                toast.error('حدث خطأ: البيانات غير متوفرة');
                return;
            }
            const currentGoals = state.smartGoals?.goals || [];

            // Check for duplicates based on specific text
            const existingSpecifics = new Set(currentGoals.map(g => g.specific?.toLowerCase().trim()));

            // Filter out duplicates
            const newTemplates = templates.filter(t => {
                const specific = t.specific?.toLowerCase().trim();
                return specific && !existingSpecifics.has(specific);
            });

            if (newTemplates.length === 0) {
                toast.info('جميع الأهداف النموذجية موجودة بالفعل');
                return;
            }

            // Add templates to goals with unique IDs
            const newGoals = newTemplates.map(t => ({
                ...t,
                id: this.generateId()
            }));

            const updatedGoals = [...currentGoals, ...newGoals];

            this.store.update('smartGoals', {
                ...state.smartGoals,
                goals: updatedGoals
            });

            this.render();

            // Show success message
            toast.success(`تم إضافة ${newGoals.length} هدف نموذجي! يمكنك تعديلها الآن.`);
        } catch (e) {
            console.error('Error suggesting goals:', e);
            const errorMsg = e.message || 'حدث خطأ غير معروف';
            toast.error('حدث خطأ أثناء اقتراح الأهداف: ' + errorMsg);
        }
    }

    removeGoal(e) {
        const idx = parseInt(e.target.dataset.idx);
        const state = this.store.getState();
        const goals = (state.smartGoals?.goals || []).filter((_, i) => i !== idx);
        this.store.update('smartGoals', { ...state.smartGoals, goals });
        this.render();
    }

    updateGoalStatus(e) {
        const idx = parseInt(e.target.dataset.idx);
        const state = this.store.getState();
        const goals = [...(state.smartGoals?.goals || [])];

        if (goals[idx]) {
            const statuses = ['pending', 'in_progress', 'achieved'];
            const currentIdx = statuses.indexOf(goals[idx].status);
            goals[idx].status = statuses[(currentIdx + 1) % statuses.length];
            this.store.update('smartGoals', { ...state.smartGoals, goals });
            this.render();
        }
    }
}

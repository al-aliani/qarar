import { SECTIONS } from '../core/schema.js';
import { calculateStudy, rateOrDefault } from '../core/engine.js';
import { calculateProjectScore } from '../core/scoring.js';
import { DynamicTable } from './DynamicTable.js';
import { escapeHtml } from '../utils/escape.js';

const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;

/**
 * لوحة الافتراضات المركزية — خطة الاستفادة من تقرير اختبار محل الخضار 2026-07-12،
 * الدفعة 4 (باكلوج تنافسي)، البند الأول: «كل الأرقام الجوهرية في شاشة واحدة قابلة
 * للتعديل». تعالج أكبر إحباط وثّقه اختبار العميل الحقيقي: التنقل بين 41 قسماً
 * لمعايرة أرقام مترابطة (سعر/عملاء، عدد موظفين، مبلغ/نوع تمويل، معدل خصم...) ثم
 * العودة للوحة القرار لرؤية الأثر — تكراراً وتكراراً.
 *
 * حرج: تقرأ/تكتب نفس مسارات المخزون الفعلية (store.updatePath) التي تستخدمها
 * الشاشات الأصلية (revenue.streams، hr.positions، financing.sources، assumptions) —
 * لا نسخة ظل. أي تعديل هنا ينعكس فوراً في الشاشة الأصلية والعكس صحيح لأن كلتيهما
 * تقرآن من/تكتبان لنفس this.store.
 *
 * فخّان حرجان تفاديناهما عمداً (راجع docs/خطة_الاستفادة_من_تقرير_اختبار_محل_الخضار_2026-07-12.md):
 * 1) الالتزام للمخزن على change/blur فقط (لا input لكل ضغطة مفتاح) — نفس نمط
 *    Wizard.updateStore. القيم المحلية في DOM لا تُكتب للمخزن أثناء الكتابة نفسها.
 * 2) حقول النسبة المئوية (معدل الخصم/التضخم/الفائدة) تُخزَّن ككسر (0–1) في المخزن
 *    لكن تُعرض/تُحرَّر كنسبة مئوية (0–100) — تحويل صريح ×100/÷100 لكل حقل، لا نمط
 *    تخمين عام جديد.
 */
export class CentralAssumptionsView {
    constructor(containerId, store, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.store = store;
        this.onExit = typeof options.onExit === 'function' ? options.onExit : null;
        // onNavigateToStep(sectionId): يستقبل معرّف قسم ('revenue'|'hr') — القرار بأي
        // خطوة فعلية يقفز إليها متروك للمستدعي (app.js يعرف STEPS/stepIndexById).
        this.onNavigateToStep = typeof options.onNavigateToStep === 'function' ? options.onNavigateToStep : null;
        this._recomputeTimer = null;
        this._unsubscribe = null;
        this._destroyed = false;
        this._onContainerChange = (e) => this._handleFieldCommit(e.target);
    }

    cleanup() {
        this._destroyed = true;
        if (this._recomputeTimer) { clearTimeout(this._recomputeTimer); this._recomputeTimer = null; }
        if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
        this.container?.removeEventListener('change', this._onContainerChange);
    }

    render() {
        if (!this.container) return;
        const state = this.store.getState();

        this.container.innerHTML = `
            <div class="central-assumptions animate-entry">
                <header class="ca-header">
                    <div>
                        <span class="ca-header__eyebrow">معايرة سريعة</span>
                        <h2>لوحة الافتراضات المركزية</h2>
                        <p class="text-sm text-muted">عدّل الأرقام الجوهرية هنا مباشرة وشاهد أثرها المقدَّر على القرار فوراً — بلا تنقّل بين أقسام الدراسة. أي تعديل هنا محفوظ في دراستك مباشرة، ويظهر في خطواتها الأصلية أيضاً.</p>
                    </div>
                    <button type="button" id="caCloseBtn" class="btn btn--secondary btn--sm">${icon('i-x')} إغلاق</button>
                </header>

                <div id="caImpactSummary" class="ca-impact" aria-live="polite"></div>

                <div class="ca-groups">
                    <section class="card ca-group">
                        <h3 class="ca-group__title">${icon('i-chart')} مصادر الإيرادات</h3>
                        <p class="text-xs text-muted">السعر وعدد العملاء لكل مصدر — أكبر رافعتين للإيراد.</p>
                        <div id="caRevenueRows" class="ca-rows">${this._renderRevenueRows(state)}</div>
                    </section>

                    <section class="card ca-group">
                        <h3 class="ca-group__title">${icon('i-users')} الفريق</h3>
                        <p class="text-xs text-muted">عدد الموظفين لكل وظيفة — أكبر بند في المصاريف التشغيلية عادةً.</p>
                        <div id="caHrRows" class="ca-rows">${this._renderHrRows(state)}</div>
                    </section>

                    <section class="card ca-group">
                        <h3 class="ca-group__title">${icon('i-bank')} هيكل التمويل</h3>
                        <p class="text-xs text-muted">مصدر رأس المال ونوعه يحدّدان فجوة التمويل وتغطية خدمة الدين (DSCR).</p>
                        <div id="caFinancingRows" class="ca-rows">${this._renderFinancingRows(state)}</div>
                    </section>

                    <section class="card ca-group">
                        <h3 class="ca-group__title">${icon('i-settings')} الافتراضات العامة</h3>
                        <p class="text-xs text-muted">تؤثر في كل الحسابات المالية دفعة واحدة.</p>
                        <div id="caAssumptionsRows" class="ca-rows">${this._renderAssumptionsRows(state)}</div>
                    </section>
                </div>
            </div>
        `;

        this.bindEvents();
        // اشتراك حي: أي كتابة (من هذه اللوحة أو من أي كاتب آخر لنفس المخزن) تعيد جدولة
        // حساب ملخّص الأثر — خنق 400ms يمنع تشغيل calculateStudy (17 تشغيلة داخلية) على
        // كل تغيير متتابع سريع (تدقيق خطة 2026-07-12، البند 0.2).
        this._unsubscribe?.();
        this._unsubscribe = this.store.subscribe(() => this.scheduleRecompute());
        this.recomputeImpact(); // حساب فوري أولي (بلا خنق) كي لا تُفتح اللوحة بملخّص فارغ
    }

    bindEvents() {
        this.container.querySelector('#caCloseBtn')?.addEventListener('click', () => this.onExit?.());

        this.container.querySelectorAll('[data-ca-goto]').forEach(btn => {
            btn.addEventListener('click', () => this.onNavigateToStep?.(btn.dataset.caGoto));
        });

        // تفويض حدث change واحد على الحاوية (لا مستمع لكل حقل) — يلتقط أيضاً الحقول
        // المُضافة لاحقاً بلا إعادة ربط. change يطلق عند فقد التركيز/تأكيد القيمة فقط،
        // لا لكل ضغطة مفتاح (فخّ 0.1 الموثَّق).
        this.container.removeEventListener('change', this._onContainerChange);
        this.container.addEventListener('change', this._onContainerChange);
    }

    // ═══════════════════════════════════════════════════════════
    // عرض الصفوف
    // ═══════════════════════════════════════════════════════════

    _renderRevenueRows(state) {
        const streams = Array.isArray(state.revenue?.streams) ? state.revenue.streams : [];
        if (!streams.length) {
            return `
                <p class="text-sm text-muted">لا توجد مصادر إيرادات بعد.</p>
                ${this.onNavigateToStep ? `<button type="button" class="btn btn--ghost btn--sm" data-ca-goto="${SECTIONS.REVENUE}">${icon('i-chart')} أضِف مصدر إيراد</button>` : ''}
            `;
        }
        return streams.map((s, i) => `
            <div class="ca-row" data-row-index="${i}">
                <div class="ca-row__label" title="${escapeHtml(s.service || '')}">${escapeHtml(s.service || 'مصدر بلا اسم')}</div>
                <label class="ca-row__field">
                    <span>العملاء/شهر</span>
                    <input type="text" inputmode="decimal" class="input ca-input" data-ca-field="customersPerMonth" data-row-index="${i}" value="${escapeHtml(String(s.customersPerMonth ?? 0))}">
                </label>
                <label class="ca-row__field">
                    <span>متوسط السعر (ريال)</span>
                    <input type="text" inputmode="decimal" class="input ca-input" data-ca-field="avgPrice" data-row-index="${i}" value="${escapeHtml(String(s.avgPrice ?? 0))}">
                </label>
            </div>
        `).join('');
    }

    _renderHrRows(state) {
        const positions = Array.isArray(state.hr?.positions) ? state.hr.positions : [];
        if (!positions.length) {
            return `
                <p class="text-sm text-muted">لا توجد وظائف بعد.</p>
                ${this.onNavigateToStep ? `<button type="button" class="btn btn--ghost btn--sm" data-ca-goto="${SECTIONS.HR}">${icon('i-users')} أضِف وظيفة</button>` : ''}
            `;
        }
        return positions.map((p, i) => `
            <div class="ca-row" data-row-index="${i}">
                <div class="ca-row__label" title="${escapeHtml(p.position || '')}">${escapeHtml(p.position || 'وظيفة بلا مسمى')}
                    <span class="text-xs text-muted">${p.nationality === 'saudi' ? 'سعودي' : 'غير سعودي'}</span>
                </div>
                <label class="ca-row__field">
                    <span>العدد</span>
                    <input type="text" inputmode="decimal" class="input ca-input" data-ca-field="count" data-row-index="${i}" value="${escapeHtml(String(p.count ?? 1))}">
                </label>
            </div>
        `).join('');
    }

    _renderFinancingRows(state) {
        const sources = state.financing?.sources || {};
        const equity = sources.equity || {};
        const bankLoan = sources.bankLoan || {};
        // معدل الفائدة: يحترم الصفر الصريح (rateOrDefault، لا || الذي يفرض 8% على قرض
        // بنك تنمية 0% فائدة) — نفس منطق FinancingStructure.js حرفياً.
        const interestPct = rateOrDefault(bankLoan.interestRate, 0.08) * 100;
        return `
            <div class="ca-row">
                <div class="ca-row__label">${icon('i-bank')} التمويل الذاتي</div>
                <label class="ca-row__field">
                    <span>المبلغ (ريال)</span>
                    <input type="text" inputmode="decimal" class="input ca-input" id="caEquityAmount" value="${escapeHtml(String(equity.amount ?? 0))}">
                </label>
            </div>
            <div class="ca-row">
                <div class="ca-row__label">${icon('i-bank')} القرض البنكي</div>
                <label class="ca-row__field">
                    <span>المبلغ (ريال)</span>
                    <input type="text" inputmode="decimal" class="input ca-input" id="caLoanAmount" value="${escapeHtml(String(bankLoan.amount ?? 0))}">
                </label>
                <label class="ca-row__field">
                    <span>معدل الفائدة %</span>
                    <input type="text" inputmode="decimal" class="input ca-input" id="caLoanInterestRate" value="${escapeHtml(String(interestPct))}">
                </label>
            </div>
        `;
    }

    _renderAssumptionsRows(state) {
        const a = state.assumptions || {};
        const discountPct = (Number(a.discountRate ?? 0.10)) * 100;
        const inflationPct = (Number(a.inflationRate ?? 0.02)) * 100;
        const ramp = Number(a.rampUpMonths ?? 0);
        return `
            <div class="ca-row">
                <label class="ca-row__field">
                    <span>معدل الخصم %</span>
                    <input type="text" inputmode="decimal" class="input ca-input" id="caDiscountRate" value="${escapeHtml(String(discountPct))}">
                </label>
                <label class="ca-row__field">
                    <span>معدل التضخم %</span>
                    <input type="text" inputmode="decimal" class="input ca-input" id="caInflationRate" value="${escapeHtml(String(inflationPct))}">
                </label>
                <label class="ca-row__field">
                    <span>فترة التصاعد (أشهر)</span>
                    <input type="text" inputmode="decimal" class="input ca-input" id="caRampUpMonths" value="${escapeHtml(String(ramp))}">
                </label>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════
    // الالتزام للمخزن — كل دالة تقرأ getState() طازجة وقت التنفيذ (لا تعتمد لقطة
    // رسم قديمة)، ثم تكتب عبر store.updatePath/update على نفس المسار الذي تقرؤه
    // الشاشة الأصلية — لا نسخة ظل.
    // ═══════════════════════════════════════════════════════════

    _handleFieldCommit(el) {
        if (!el || !el.classList || !el.classList.contains('ca-input')) return;
        const field = el.dataset.caField;
        const rowIndex = el.dataset.rowIndex !== undefined ? parseInt(el.dataset.rowIndex, 10) : null;

        if (field === 'customersPerMonth' || field === 'avgPrice') {
            this._commitStreamField(rowIndex, field, el.value, el);
        } else if (field === 'count') {
            this._commitPositionCount(rowIndex, el.value, el);
        } else if (el.id === 'caEquityAmount') {
            this._commitFundingAmount('equity', el.value, el);
        } else if (el.id === 'caLoanAmount') {
            this._commitFundingAmount('bankLoan', el.value, el);
        } else if (el.id === 'caLoanInterestRate') {
            this._commitLoanInterestRate(el.value, el);
        } else if (el.id === 'caDiscountRate') {
            this._commitPercentAssumption('discountRate', el.value, el);
        } else if (el.id === 'caInflationRate') {
            this._commitPercentAssumption('inflationRate', el.value, el);
        } else if (el.id === 'caRampUpMonths') {
            this._commitRampUpMonths(el.value, el);
        }
    }

    _commitStreamField(rowIndex, field, rawValue, el) {
        if (rowIndex == null || Number.isNaN(rowIndex)) return;
        const parsed = DynamicTable.parseLenientNumber(rawValue);
        const value = parsed == null ? 0 : Math.max(0, parsed);
        const state = this.store.getState();
        const list = Array.isArray(state.revenue?.streams) ? state.revenue.streams : [];
        if (rowIndex < 0 || rowIndex >= list.length) return; // الصف قد يكون حُذف من مكان آخر
        const updated = list.map((row, i) => (i === rowIndex ? { ...row, [field]: value } : row));
        this.store.updatePath(SECTIONS.REVENUE, 'streams', updated);
        if (el) el.value = String(value); // تطبيع العرض (أرقام هندية → غربية) بعد الالتزام
    }

    _commitPositionCount(rowIndex, rawValue, el) {
        if (rowIndex == null || Number.isNaN(rowIndex)) return;
        const parsed = DynamicTable.parseLenientNumber(rawValue);
        const value = parsed == null ? 0 : Math.max(0, Math.round(parsed));
        const state = this.store.getState();
        const list = Array.isArray(state.hr?.positions) ? state.hr.positions : [];
        if (rowIndex < 0 || rowIndex >= list.length) return;
        const updated = list.map((row, i) => (i === rowIndex ? { ...row, count: value } : row));
        this.store.updatePath(SECTIONS.HR, 'positions', updated);
        if (el) el.value = String(value);
    }

    /**
     * نسب مصادر التمويل تُعاد حسابها من مجموع المصادر الأربعة نفسها — تطابق حرفياً
     * FinancingStructure.recalcSourcePercentages. بدون هذا يبقى حقل «النسبة %» (readonly)
     * في شاشة التمويل الأصلية على قيمة قديمة بعد تعديل المبلغ من هنا (تناقض ظاهر جديد
     * كنّا سنُدخله لولا هذه المطابقة — لا يعتمد على totalCapex فلا حاجة لإعادة حسابه هنا).
     */
    _recalcSourcePercentages(sources) {
        const keys = ['equity', 'bankLoan', 'investors', 'governmentSupport'];
        const totalFunded = keys.reduce((sum, k) => sum + Number(sources[k]?.amount || 0), 0);
        keys.forEach(k => {
            const amount = Number(sources[k]?.amount || 0);
            const pct = totalFunded > 0 ? Math.round((amount / totalFunded) * 1000) / 10 : 0;
            sources[k] = { ...(sources[k] || {}), percentage: pct };
        });
        return sources;
    }

    _commitFundingAmount(sourceKey, rawValue, el) {
        const parsed = DynamicTable.parseLenientNumber(rawValue);
        const amount = parsed == null ? 0 : Math.max(0, parsed);
        const state = this.store.getState();
        const financing = { ...(state.financing || {}) };
        financing.sources = { ...(financing.sources || {}) };
        financing.sources[sourceKey] = { ...(financing.sources[sourceKey] || {}), amount };
        this._recalcSourcePercentages(financing.sources);
        this.store.update(SECTIONS.FINANCING, financing);
        if (el) el.value = String(amount);
    }

    _commitLoanInterestRate(rawValue, el) {
        const parsed = DynamicTable.parseLenientNumber(rawValue);
        const pct = parsed == null ? 0 : Math.max(0, parsed);
        this.store.updatePath(SECTIONS.FINANCING, 'sources.bankLoan.interestRate', pct / 100);
        if (el) el.value = String(pct);
    }

    _commitPercentAssumption(key, rawValue, el) {
        const parsed = DynamicTable.parseLenientNumber(rawValue);
        const pct = parsed == null ? 0 : Math.max(0, parsed);
        this.store.updatePath(SECTIONS.ASSUMPTIONS, key, pct / 100);
        if (el) el.value = String(pct);
    }

    _commitRampUpMonths(rawValue, el) {
        const parsed = DynamicTable.parseLenientNumber(rawValue);
        const months = parsed == null ? 0 : Math.max(0, Math.min(24, Math.round(parsed)));
        this.store.updatePath(SECTIONS.ASSUMPTIONS, 'rampUpMonths', months);
        if (el) el.value = String(months);
    }

    // ═══════════════════════════════════════════════════════════
    // ملخّص الأثر الحي — calculateStudy عبر خنق 400ms، لا على كل ضغطة مفتاح ولا حتى
    // على كل change (قد تتوالى عدة change سريعة عند التنقل بـTab بين حقول).
    // ═══════════════════════════════════════════════════════════

    scheduleRecompute() {
        if (this._destroyed) return;
        if (this._recomputeTimer) clearTimeout(this._recomputeTimer);
        this._recomputeTimer = setTimeout(() => {
            this._recomputeTimer = null;
            this.recomputeImpact();
        }, 400);
    }

    recomputeImpact() {
        if (this._destroyed || !this.container) return;
        const state = this.store.getState();
        const hasRevenue = Array.isArray(state.revenue?.streams) && state.revenue.streams.length > 0;
        if (!hasRevenue) {
            this._renderImpactSummary(null, null);
            return;
        }
        let results = null;
        let evaluation = null;
        try {
            results = calculateStudy(state);
            evaluation = calculateProjectScore(state, results);
        } catch (e) {
            console.error('[CentralAssumptionsView] تعذّر حساب الأثر:', e);
        }
        this._renderImpactSummary(results, evaluation);
    }

    _renderImpactSummary(results, evaluation) {
        const slot = this.container?.querySelector('#caImpactSummary');
        if (!slot) return;
        if (!results || !evaluation) {
            slot.innerHTML = `<p class="text-sm text-muted">أضف مصدر إيراد واحداً على الأقل لعرض الأثر التقديري على القرار.</p>`;
            return;
        }
        const decision = results.decision || 'REVISE';
        const decisionClass = decision === 'GO' ? 'success' : decision === 'NO-GO' ? 'danger' : 'warning';
        const npv = Number(results.indicators?.npv) || 0;
        const irr = results.indicators?.irr;
        const dscr = results.indicators?.dscr;
        const fmtCurrency = (n) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
        const fmtPercent = (n) => Number.isFinite(n) ? `${Math.round(n * 100)}%` : '—';
        slot.innerHTML = `
            <div class="ca-impact__badge ca-impact__badge--${decisionClass}">${escapeHtml(decision)}</div>
            <div class="ca-impact__metric"><span>الدرجة (تقديرية)</span><strong>${Math.round(evaluation.score)}/100</strong></div>
            <div class="ca-impact__metric"><span>صافي القيمة الحالية</span><strong class="${npv >= 0 ? 'text-success' : 'text-danger'}">${fmtCurrency(npv)}</strong></div>
            <div class="ca-impact__metric"><span>العائد الداخلي</span><strong>${fmtPercent(irr)}</strong></div>
            <div class="ca-impact__metric"><span>تغطية خدمة الدين</span><strong>${Number.isFinite(dscr) ? dscr.toFixed(2) + 'x' : '—'}</strong></div>
            <p class="ca-impact__note text-xs text-muted">تقدير سريع من نفس محرك الحساب — راجع «لوحة القرار الاستثماري» للتوصية الكاملة مع فحوص الجودة.</p>
        `;
    }
}

import { SECTIONS } from '../core/schema.js';
import { calculateStudy, rateOrDefault, findOptimalFinancingMix } from '../core/engine.js';
import { calculateProjectScore } from '../core/scoring.js';
import { checkDriversAgainstBenchmarks } from '../core/sectorBenchmarks.js';
import { MonteCarloEngine } from '../core/MonteCarloEngine.js';
import { DynamicTable } from './DynamicTable.js';
import { ExportMenu } from './ExportMenu.js';
import { escapeHtml } from '../utils/escape.js';

/** نطاقات فائدة معتادة (مرجعية — بحث لمرة واحدة، ليست تغذية حية؛ لا API عام لمقارنة
 * أسعار البنوك السعودية مجاناً) — تُعرض كسياق عند تعديل معدل الفائدة يدوياً. */
const FINANCING_RATE_REFERENCE = [
    { label: 'بنك تجاري (تمويل منشآت صغيرة)', range: '6% – 12%' },
    { label: 'صندوق التنمية الصناعية السعودي', range: '0% – 4%' },
    { label: 'تمويل جماعي/دين خاص', range: '10% – 18%' }
];
/** علاوة مخاطر السوق المرجعية لتقدير تكلفة حقوق الملكية — متوسط تاريخي طويل الأمد
 * تقريبي (بحث لمرة واحدة)، وليس عائد تاسي حياً (لا تغذية سوقية حية متاحة مجاناً). */
const MARKET_RISK_PREMIUM_REFERENCE = 0.08; // 8% تقريباً فوق العائد الخالي من المخاطر

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
        this._onContainerFocusOut = (e) => this._handleFieldCommit(e.target);
    }

    cleanup() {
        this._destroyed = true;
        if (this._recomputeTimer) { clearTimeout(this._recomputeTimer); this._recomputeTimer = null; }
        if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
        this.container?.removeEventListener('change', this._onContainerChange);
        this.container?.removeEventListener('focusout', this._onContainerFocusOut);
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

                <div class="ca-groups ca-groups--secondary">
                    <section class="card ca-group">
                        <h3 class="ca-group__title">${icon('i-bank')} مراجع ومعايير</h3>
                        <div id="caReferenceRows">${this._renderReferenceRows()}</div>
                        <div id="caBenchmarkAlerts" class="mt-2"></div>
                    </section>

                    <section class="card ca-group">
                        <h3 class="ca-group__title">${icon('i-chart')} رأس المال العامل والزكاة</h3>
                        <div id="caWorkingCapital">${this._renderWorkingCapitalRow(state)}</div>
                        <div id="caZakatTax" class="mt-2">${this._renderZakatTaxRows(state)}</div>
                    </section>

                    <section class="card ca-group">
                        <h3 class="ca-group__title">${icon('i-sparkle')} تحليل سريع</h3>
                        <div id="caQuickTornado"></div>
                        <div class="ca-row mt-2">
                            <button type="button" id="caRunOptimalMix" class="btn btn--ghost btn--sm">${icon('i-bank')} أفضل مزيج دين/ملكية</button>
                            <button type="button" id="caRunMiniMonteCarlo" class="btn btn--ghost btn--sm">${icon('i-sparkle')} معاينة مونت كارلو سريعة</button>
                        </div>
                        <div id="caOptimalMixResult" class="mt-2"></div>
                        <div id="caMiniMonteCarloResult" class="mt-2"></div>
                    </section>

                    <section class="card ca-group">
                        <h3 class="ca-group__title">${icon('i-doc')} تصدير وسجل</h3>
                        <button type="button" id="caOpenBankExport" class="btn btn--ghost btn--sm">${icon('i-doc')} افتح قائمة التصدير (يشمل الملف البنكي)</button>
                        <details class="mt-2">
                            <summary>سجل الافتراضات والقرار</summary>
                            <div id="caHistoryPanel"></div>
                        </details>
                    </section>
                </div>
            </div>
        `;

        this.bindEvents();
        this._renderHistoryPanel();
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

        this.container.querySelector('#caApplyWorkingCapital')?.addEventListener('click', (e) => {
            const months = Number(e.currentTarget.dataset.months) || 0;
            this.store.updatePath(SECTIONS.ASSUMPTIONS, 'workingCapitalMonths', Math.round(months * 10) / 10);
        });

        this.container.querySelector('#caRunOptimalMix')?.addEventListener('click', () => this._runOptimalMix());
        this.container.querySelector('#caRunMiniMonteCarlo')?.addEventListener('click', () => this._runMiniMonteCarlo());
        this.container.querySelector('#caOpenBankExport')?.addEventListener('click', () => {
            new ExportMenu('exportMenuOverlay', this.store).open();
        });

        this.container.querySelector('#caHistoryPanel')?.addEventListener('click', (e) => {
            const btn = e.target.closest?.('.ca-restore-assumptions');
            if (!btn) return;
            const idx = parseInt(btn.dataset.historyIndex, 10);
            const history = this.store.getVersionHistory?.() || [];
            const snap = history[idx];
            if (!snap?.state?.assumptions) return;
            this.store.update(SECTIONS.ASSUMPTIONS, { ...snap.state.assumptions });
            this.render();
        });

        // تفويض حدث change واحد على الحاوية (لا مستمع لكل حقل) — يلتقط أيضاً الحقول
        // المُضافة لاحقاً بلا إعادة ربط. change يطلق عند فقد التركيز/تأكيد القيمة فقط،
        // لا لكل ضغطة مفتاح (فخّ 0.1 الموثَّق).
        this.container.removeEventListener('change', this._onContainerChange);
        this.container.addEventListener('change', this._onContainerChange);
        // بعض المتصفحات/أدوات الإدخال لا تطلق change عند التنقل بـTab بعد تعديل
        // حقل نصي. focusout يضمن حفظ القيمة عند مغادرة الحقل كما تعد الواجهة.
        this.container.removeEventListener('focusout', this._onContainerFocusOut);
        this.container.addEventListener('focusout', this._onContainerFocusOut);
    }

    _runOptimalMix() {
        const slot = this.container.querySelector('#caOptimalMixResult');
        if (!slot) return;
        slot.textContent = 'جارٍ الحساب…';
        const state = this.store.getState();
        let mix = null;
        try { mix = findOptimalFinancingMix(state); } catch (_) { mix = null; }
        if (!mix) { slot.textContent = 'تعذّر الحساب — تحقق من وجود استثمار وإيراد على الأقل.'; return; }
        const fmt = (n) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
        slot.innerHTML = `أفضل مزيج: ${Math.round(mix.best.debtFraction * 100)}% دين (${fmt(mix.best.loanAmount)}) / ${Math.round((1 - mix.best.debtFraction) * 100)}% ملكية (${fmt(mix.best.equityAmount)}) — NPV ${fmt(mix.best.npv)}${mix.best.meetsTarget ? '' : ' (تحذير: لا يحقق هدف DSCR)'}`;
    }

    _runMiniMonteCarlo() {
        const slot = this.container.querySelector('#caMiniMonteCarloResult');
        if (!slot) return;
        slot.textContent = 'جارٍ التشغيل…';
        const state = this.store.getState();
        let result = null;
        try { result = MonteCarloEngine.runSimulation(state, 80, 0.20); } catch (_) { result = null; }
        if (!result?.ok) { slot.textContent = 'تعذّر تشغيل المعاينة السريعة.'; return; }
        const fmt = (n) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
        slot.innerHTML = `معاينة سريعة (80 تكراراً — للاستكشاف فقط، استخدم محاكاة مونت كارلو الكاملة للتقرير النهائي): P10 ${fmt(result.stats.p10)} · P50 ${fmt(result.stats.p50)} · P90 ${fmt(result.stats.p90)} · احتمال نجاح ${Math.round(result.stats.successProbability * 100)}%`;
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

    _renderReferenceRows() {
        const rows = FINANCING_RATE_REFERENCE.map(r => `
            <div class="ca-row"><span>${escapeHtml(r.label)}</span><strong>${escapeHtml(r.range)}</strong></div>
        `).join('');
        return `
            <p class="text-xs text-muted">نطاقات فائدة معتادة (مرجع بحثي — ليست تغذية حية):</p>
            ${rows}
            <p class="text-xs text-muted mt-2">علاوة مخاطر السوق المرجعية لتكلفة حقوق الملكية: <strong>${Math.round(MARKET_RISK_PREMIUM_REFERENCE * 100)}%</strong> تقريباً (متوسط تاريخي، لا عائد تاسي حيّ).</p>
        `;
    }

    _renderWorkingCapitalRow(state) {
        const policy = state.assumptions?.workingCapitalPolicy || {};
        const dso = Number(policy.dsoDays) || 0;
        const dpo = Number(policy.dpoDays) || 0;
        const dio = Number(policy.dioDays) || 0;
        const minMonths = Math.max(0, ((dso + dio - dpo) / 30));
        return `
            <p class="text-xs text-muted">من دورة التحويل النقدي الحالية (تحصيل ${dso} يوم + مخزون ${dio} يوم − سداد ${dpo} يوم):</p>
            <div class="ca-row">
                <span>الحد الأدنى المقترح لرأس المال العامل</span>
                <strong>${minMonths.toFixed(1)} شهر</strong>
                <button type="button" id="caApplyWorkingCapital" data-months="${minMonths.toFixed(1)}" class="btn btn--ghost btn--sm">طبّق كشهور رأس المال العامل</button>
            </div>
        `;
    }

    _renderZakatTaxRows(state) {
        const a = state.assumptions || {};
        const foreignPct = (Number(a.foreignOwnershipRate ?? 0)) * 100;
        const taxPct = (Number(a.taxRate ?? 0.20)) * 100;
        return `
            <div class="ca-row">
                <label class="ca-row__field">
                    <span>نسبة الملكية الأجنبية %</span>
                    <input type="text" inputmode="decimal" class="input ca-input" id="caForeignOwnershipRate" value="${escapeHtml(String(foreignPct))}">
                </label>
                <label class="ca-row__field">
                    <span>معدل الضريبة %</span>
                    <input type="text" inputmode="decimal" class="input ca-input" id="caTaxRate" value="${escapeHtml(String(taxPct))}">
                </label>
            </div>
            <p id="caZakatTaxResult" class="text-xs text-muted mt-1">أضف مصدر إيراد لعرض الزكاة/الضريبة المحسوبة فعلياً للسنة الأولى.</p>
        `;
    }

    _renderBenchmarkAlerts(state, results) {
        const slot = this.container?.querySelector('#caBenchmarkAlerts');
        if (!slot) return;
        let warnings = [];
        try { warnings = checkDriversAgainstBenchmarks(state, results) || []; } catch (_) { warnings = []; }
        if (!warnings.length) { slot.innerHTML = ''; return; }
        slot.innerHTML = `<ul class="ca-alerts">${warnings.map(w => `<li class="text-xs text-warning">${escapeHtml(w.message || '')}</li>`).join('')}</ul>`;
    }

    _renderQuickTornado(results) {
        const slot = this.container?.querySelector('#caQuickTornado');
        if (!slot) return;
        const tornado = Array.isArray(results?.tornado) ? results.tornado.slice(0, 3) : [];
        if (!tornado.length) { slot.innerHTML = `<p class="text-xs text-muted">أضف مصدر إيراد لعرض أكثر 3 متغيرات تأثيراً على NPV.</p>`; return; }
        const maxSwing = Math.max(...tornado.map(t => t.swing || 0), 1);
        slot.innerHTML = `
            <p class="text-xs text-muted">أكثر 3 متغيرات تأثيراً على NPV (±10%):</p>
            ${tornado.map(t => `
                <div class="ca-tornado-row">
                    <span class="text-xs">${escapeHtml(t.variable)}</span>
                    <div class="ca-tornado-bar"><span style="width:${Math.round((t.swing / maxSwing) * 100)}%"></span></div>
                </div>
            `).join('')}
        `;
    }

    _renderZakatTaxResult(results) {
        const el = this.container?.querySelector('#caZakatTaxResult');
        if (!el) return;
        const y1 = results?.incomeStatement?.[0];
        if (!y1) { el.textContent = 'أضف مصدر إيراد لعرض الزكاة/الضريبة المحسوبة فعلياً للسنة الأولى.'; return; }
        const fmt = (n) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
        el.textContent = `السنة الأولى: زكاة ${fmt(y1.zakat)} + ضريبة ${fmt(y1.tax)} = صافي ربح ${fmt(y1.netIncome)} (من نفس محرك الحساب الفعلي، لا تقدير موازٍ).`;
    }

    _renderHistoryPanel() {
        const slot = this.container?.querySelector('#caHistoryPanel');
        if (!slot) return;
        const history = typeof this.store.getVersionHistory === 'function' ? this.store.getVersionHistory() : [];
        if (!history.length) { slot.innerHTML = `<p class="text-xs text-muted">لا يوجد سجل بعد.</p>`; return; }
        slot.innerHTML = history.slice().reverse().map((snap, revIdx) => {
            const idx = history.length - 1 - revIdx;
            const a = snap.state?.assumptions || {};
            const decision = (() => {
                try { return calculateStudy(snap.state)?.decision || '—'; } catch (_) { return '—'; }
            })();
            const when = new Date(snap.timestamp).toLocaleString('ar-SA');
            return `
                <div class="ca-row" data-history-index="${idx}">
                    <span class="text-xs text-muted">${escapeHtml(when)}</span>
                    <span class="text-xs">خصم ${Math.round((a.discountRate ?? 0) * 100)}% · ضريبة ${Math.round((a.taxRate ?? 0) * 100)}% · القرار: ${escapeHtml(decision)}</span>
                    <button type="button" class="btn btn--ghost btn--sm ca-restore-assumptions" data-history-index="${idx}">استرجع افتراضات هذه اللحظة</button>
                </div>
            `;
        }).join('');
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
        } else if (el.id === 'caForeignOwnershipRate') {
            this._commitPercentAssumption('foreignOwnershipRate', el.value, el);
        } else if (el.id === 'caTaxRate') {
            this._commitPercentAssumption('taxRate', el.value, el);
        }
    }

    _commitStreamField(rowIndex, field, rawValue, el) {
        if (rowIndex == null || Number.isNaN(rowIndex)) return;
        const parsed = DynamicTable.parseLenientNumber(rawValue);
        const value = parsed == null ? 0 : Math.max(0, parsed);
        const state = this.store.getState();
        const list = Array.isArray(state.revenue?.streams) ? state.revenue.streams : [];
        if (rowIndex < 0 || rowIndex >= list.length) return; // الصف قد يكون حُذف من مكان آخر
        if (Number(list[rowIndex]?.[field] || 0) === value) {
            if (el) el.value = String(value);
            return;
        }
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
        if (Number(list[rowIndex]?.count || 0) === value) {
            if (el) el.value = String(value);
            return;
        }
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
        if (Number(financing.sources[sourceKey]?.amount || 0) === amount) {
            if (el) el.value = String(amount);
            return;
        }
        financing.sources[sourceKey] = { ...(financing.sources[sourceKey] || {}), amount };
        this._recalcSourcePercentages(financing.sources);
        this.store.update(SECTIONS.FINANCING, financing);
        if (el) el.value = String(amount);
    }

    _commitLoanInterestRate(rawValue, el) {
        const parsed = DynamicTable.parseLenientNumber(rawValue);
        const pct = parsed == null ? 0 : Math.max(0, parsed);
        const current = Number(this.store.getState().financing?.sources?.bankLoan?.interestRate || 0);
        if (current === pct / 100) {
            if (el) el.value = String(pct);
            return;
        }
        this.store.updatePath(SECTIONS.FINANCING, 'sources.bankLoan.interestRate', pct / 100);
        if (el) el.value = String(pct);
    }

    _commitPercentAssumption(key, rawValue, el) {
        const parsed = DynamicTable.parseLenientNumber(rawValue);
        const pct = parsed == null ? 0 : Math.max(0, parsed);
        const current = Number(this.store.getState().assumptions?.[key] || 0);
        if (current === pct / 100) {
            if (el) el.value = String(pct);
            return;
        }
        this.store.updatePath(SECTIONS.ASSUMPTIONS, key, pct / 100);
        if (el) el.value = String(pct);
    }

    _commitRampUpMonths(rawValue, el) {
        const parsed = DynamicTable.parseLenientNumber(rawValue);
        const months = parsed == null ? 0 : Math.max(0, Math.min(24, Math.round(parsed)));
        if (Number(this.store.getState().assumptions?.rampUpMonths || 0) === months) {
            if (el) el.value = String(months);
            return;
        }
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
            this._renderBenchmarkAlerts(state, null);
            this._renderQuickTornado(null);
            this._renderZakatTaxResult(null);
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
        this._renderBenchmarkAlerts(state, results);
        this._renderQuickTornado(results);
        this._renderZakatTaxResult(results);
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

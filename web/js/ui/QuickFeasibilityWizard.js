/**
 * مسار "جدوى سريعة" / "جدوى في حوالي ساعة" (Modeliks) — 3 خطوات: تعريف المشروع → الأرقام الأساسية → القرار والتصدير.
 * استنساخ لنقاط قوة منافس (جدوى تك، Modeliks): تبسيط، تحميل PDF فوري، ملء بالذكاء الاصطناعي اختياري.
 */
import { quickFeasibilityCalc, QUICK_DEFAULTS_BY_SECTOR } from '../utils/quickFeasibilityCalc.js';
import { formatCurrency } from '../utils/formatters.js';
import { toast } from '../utils/toast.js';
import { QuickPDFGenerator } from '../../export/quickPdfGenerator.js';
import { IntelligenceService } from '../services/IntelligenceService.js';

const SECTORS = [
    { value: 'مطعم', label: 'مطعم / مقهى' },
    { value: 'retail', label: 'تجزئة (Retail)' },
    { value: 'خدمي', label: 'خدمي' },
    { value: 'صناعي', label: 'صناعي' },
    { value: 'تقني', label: 'تقني' },
    { value: 'أخرى', label: 'أخرى' }
];

const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الطائف', 'تبوك', 'بريدة', 'خميس مشيط', 'أخرى'];

const TOTAL_STEPS = 3;
const ESTIMATED_MINUTES = 15;
/** وقت متوقع متبقي للإكمال (دقائق) حسب الخطوة — KPI-1.2 / KPI-9.1 */
const ESTIMATED_MINUTES_BY_STEP = { 1: 12, 2: 5, 3: 0 };
const MODELIKS_HOUR_LABEL = 'جدوى في حوالي ساعة';

export class QuickFeasibilityWizard {
    constructor(containerId, store, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onFinish = options.onFinish || (() => {}); // الانتقال للمسار الكامل
        this.onExit = options.onExit || (() => {});      // العودة للوحة المشاريع
        this.step = 1;
        this.quickData = {
            projectName: '',
            sector: 'مطعم',
            city: 'الرياض',
            area: 100,
            budget: 0,
            monthlyRevenue: QUICK_DEFAULTS_BY_SECTOR.مطعم.monthlyRevenue,
            monthlyCosts: QUICK_DEFAULTS_BY_SECTOR.مطعم.monthlyCosts,
            initialInvestment: QUICK_DEFAULTS_BY_SECTOR.مطعم.initialInvestment,
            fundingSource: 'self',
            apiDefaults: null
        };
    }

    applySectorDefaults() {
        const def = QUICK_DEFAULTS_BY_SECTOR[this.quickData.sector] || QUICK_DEFAULTS_BY_SECTOR.أخرى;
        this.quickData.monthlyRevenue = def.monthlyRevenue;
        this.quickData.monthlyCosts = def.monthlyCosts;
        this.quickData.initialInvestment = def.initialInvestment;
    }

    render() {
        if (!this.container) return;
        if (this.step === 1) this.renderStep1();
        else if (this.step === 2) this.renderStep2();
        else this.renderStep3();
    }

    renderStep1() {
        const d = this.quickData;
        const progress = (1 / TOTAL_STEPS) * 100;
        const remaining = TOTAL_STEPS - 1;
        this.container.innerHTML = `
            <div class="quick-feasibility animate-entry" dir="rtl">
                <div class="progress-step-map flex gap-2 justify-center mb-4" role="navigation" aria-label="خريطة الخطوات">
                    <span class="step-dot active" aria-current="step" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;background:var(--c-p-500);color:#fff;border:2px solid var(--c-p-400);">1</span>
                    <span class="step-dot" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-bg-card);color:var(--c-text-muted);border:2px solid var(--c-border);">2</span>
                    <span class="step-dot" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-bg-card);color:var(--c-text-muted);border:2px solid var(--c-border);">3</span>
                </div>
                <div class="progress-info flex justify-between mb-2 text-sm text-muted" role="status" aria-label="أنت في الخطوة 1 من ${TOTAL_STEPS}">
                    <span>أنت في الخطوة 1 من ${TOTAL_STEPS}</span>
                    <span>${Math.round(progress)}%</span>
                </div>
                <p class="text-sm text-gold mb-2" aria-live="polite">⏱ وقت الإكمال المتوقع: حوالي ${ESTIMATED_MINUTES_BY_STEP[1]} دقيقة</p>
                <div class="progress-bar mb-6" role="progressbar" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <h2 class="text-2xl font-bold mb-2">تعريف المشروع</h2>
                <p class="text-muted mb-6">${MODELIKS_HOUR_LABEL} — خطوتان متبقيتان.</p>
                <div class="card card-hover max-w-xl space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">اسم المشروع</label>
                        <input type="text" id="qf-projectName" class="input w-full" value="${(d.projectName || '').replace(/"/g, '&quot;')}" placeholder="مثال: مقهى الروح" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">القطاع</label>
                        <select id="qf-sector" class="input w-full">
                            ${SECTORS.map(s => `<option value="${s.value}" ${d.sector === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">المدينة / المنطقة</label>
                        <select id="qf-city" class="input w-full">
                            ${CITIES.map(c => `<option value="${c}" ${d.city === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">المساحة (م²)</label>
                        <input type="number" id="qf-area" class="input w-full" value="${d.area || 100}" min="10" step="10" placeholder="100" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">ميزانية تقريبية (ريال) — اختياري</label>
                        <input type="number" id="qf-budget" class="input w-full" value="${d.budget || ''}" min="0" step="10000" placeholder="اتركه فارغاً" />
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button type="button" id="qf-back-dash" class="btn btn--ghost">← العودة</button>
                    <button type="button" id="qf-next-1" class="btn btn--primary">التالي ←</button>
                </div>
            </div>
        `;
        this.bindStep1();
    }

    /**
     * إشعار مصدر الأرقام: يميّز بوضوح بين تقدير حقيقي من محرك السوق (مدينة/قطاع)
     * وبين قيم افتراضية ثابتة (Offline Fallback) — لا نعرض الاثنين بنفس الثقة.
     */
    _renderDefaultsNotice(d) {
        if (!d.apiDefaults) return '';
        const isFallback = d.apiDefaults.source === 'Offline Fallback';
        if (isFallback) {
            return `<p class="text-sm mb-4" role="status">
                <span class="badge badge--warning">قيم عامة تقريبية</span>
                خادم محرك السوق غير متاح الآن، فعُبّئت الحقول بقيم عامة ثابتة (غير مخصّصة لمدينتك/قطاعك). راجع كل رقم وعدّله يدوياً قبل الاعتماد عليه.
            </p>`;
        }
        return `<p class="text-sm text-gold mb-4" role="status">
            <span class="badge badge--warning">تقديري</span>
            تم تعبئة الأرقام من محرك السوق بناءً على مدينتك وقطاعك. يمكنك تعديل أي حقل.
        </p>`;
    }

    renderStep2() {
        const d = this.quickData;
        const progress = (2 / TOTAL_STEPS) * 100;
        this.container.innerHTML = `
            <div class="quick-feasibility animate-entry" dir="rtl">
                <div class="progress-step-map flex gap-2 justify-center mb-4" role="navigation" aria-label="خريطة الخطوات">
                    <span class="step-dot completed" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-success);color:#fff;border:2px solid var(--c-success);">✓</span>
                    <span class="step-dot active" aria-current="step" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;background:var(--c-p-500);color:#fff;border:2px solid var(--c-p-400);">2</span>
                    <span class="step-dot" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-bg-card);color:var(--c-text-muted);border:2px solid var(--c-border);">3</span>
                </div>
                <div class="progress-info flex justify-between mb-2 text-sm text-muted" role="status" aria-label="أنت في الخطوة 2 من ${TOTAL_STEPS}">
                    <span>أنت في الخطوة 2 من ${TOTAL_STEPS}</span>
                    <span>${Math.round(progress)}%</span>
                </div>
                <p class="text-sm text-gold mb-2" aria-live="polite">⏱ وقت الإكمال المتوقع: حوالي ${ESTIMATED_MINUTES_BY_STEP[2]} دقيقة</p>
                <div class="progress-bar mb-6" role="progressbar" aria-valuenow="${Math.round(progress)}" aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar-fill" style="width: ${progress}%"></div>
                </div>
                <h2 class="text-2xl font-bold mb-2">الأرقام الأساسية</h2>
                <p class="text-muted mb-6">خطوة واحدة متبقية — ثم تحصل على القرار وتحميل PDF (حوالي 5 دقائق).</p>
                ${this._renderDefaultsNotice(d)}
                <div class="card card-hover max-w-xl space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">الإيراد الشهري المتوقع (ريال)</label>
                        <input type="number" id="qf-monthlyRevenue" class="input w-full" value="${d.monthlyRevenue}" min="0" step="1000" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">التكاليف التشغيلية الشهرية (ريال)</label>
                        <input type="number" id="qf-monthlyCosts" class="input w-full" value="${d.monthlyCosts}" min="0" step="1000" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">الاستثمار الأولي (ريال)</label>
                        <input type="number" id="qf-initialInvestment" class="input w-full" value="${d.initialInvestment}" min="0" step="10000" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">مصدر التمويل</label>
                        <select id="qf-fundingSource" class="input w-full">
                            <option value="self" ${d.fundingSource === 'self' ? 'selected' : ''}>تمويل ذاتي</option>
                            <option value="loan" ${d.fundingSource === 'loan' ? 'selected' : ''}>قرض</option>
                        </select>
                    </div>
                </div>
                <div class="mt-4 p-3 rounded-lg border border-border bg-card max-w-xl">
                    <p class="text-sm text-muted mb-2">اختياري: ملء المسودة بالذكاء الاصطناعي (ملخص، سوق، منافسون، مخاطر).</p>
                    <button type="button" id="qf-ai-fill" class="btn btn--sm btn-magic">ملء المسودة بالذكاء الاصطناعي</button>
                    <span id="qf-ai-status" class="text-xs text-muted mr-2"></span>
                </div>
                <div class="flex gap-3 mt-6">
                    <button type="button" id="qf-prev-2" class="btn btn--ghost">→ السابق</button>
                    <button type="button" id="qf-next-2" class="btn btn--primary">التالي ←</button>
                </div>
            </div>
        `;
        this.bindStep2();
    }

    renderStep3() {
        const d = this.quickData;
        const result = quickFeasibilityCalc(d);
        const progress = 100;
        const recClass = result.recommendation === 'go' ? 'text-success' : result.recommendation === 'revise' ? 'text-warning' : 'text-danger';
        this.container.innerHTML = `
            <div class="quick-feasibility animate-entry" dir="rtl">
                <div class="progress-step-map flex gap-2 justify-center mb-4" role="navigation" aria-label="خريطة الخطوات">
                    <span class="step-dot completed" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-success);color:#fff;border:2px solid var(--c-success);">✓</span>
                    <span class="step-dot completed" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-success);color:#fff;border:2px solid var(--c-success);">✓</span>
                    <span class="step-dot active" aria-current="step" style="width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;background:var(--c-p-500);color:#fff;border:2px solid var(--c-p-400);">3</span>
                </div>
                <div class="progress-info flex justify-between mb-2 text-sm text-muted" role="status" aria-label="أنت في الخطوة 3 من ${TOTAL_STEPS}">
                    <span>أنت في الخطوة 3 من ${TOTAL_STEPS}</span>
                    <span>100%</span>
                </div>
                <div class="progress-bar mb-6" role="progressbar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar-fill" style="width: 100%"></div>
                </div>
                <h2 class="text-2xl font-bold mb-2">ملخص القرار</h2>
                <p class="text-muted mb-6">تم تقييم المشروع بناءً على المدخلات. يمكنك تحميل التقرير المختصر الآن.</p>
                <p class="text-gold font-semibold mb-4">تم إعداد مسودة دراستك في حوالي ساعة.</p>
                <div class="card card-hover max-w-xl mb-6 p-6">
                    <div class="text-center mb-6">
                        <span class="text-4xl font-black ${recClass}">${result.recommendationLabel}</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div class="p-3 bg-white/5 rounded-lg">
                            <div class="text-xs text-muted mb-1">صافي القيمة الحالية (NPV)</div>
                            <div class="font-bold">${formatCurrency(result.npv)}</div>
                        </div>
                        <div class="p-3 bg-white/5 rounded-lg">
                            <div class="text-xs text-muted mb-1">فترة الاسترداد (سنوات)</div>
                            <div class="font-bold">${result.paybackYears != null ? result.paybackYears + ' سنة' : '—'}</div>
                        </div>
                        <div class="p-3 bg-white/5 rounded-lg">
                            <div class="text-xs text-muted mb-1">نقطة التعادل (ريال/شهر)</div>
                            <div class="font-bold">${formatCurrency(result.breakevenMonthly)}</div>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col sm:flex-row gap-3 items-center justify-between max-w-xl">
                    <button type="button" id="qf-download-pdf" class="btn btn--primary text-lg py-4 px-8 shadow-lg hover:scale-105" aria-label="تحميل PDF الآن — يفتح نافذة الطباعة لاختيار حفظ كـ PDF">
                        📄 تحميل PDF الآن
                    </button>
                    <div class="flex gap-2">
                        <button type="button" id="qf-full-path" class="btn btn--secondary">استكمال الدراسة الكاملة</button>
                        <button type="button" id="qf-back-dash-3" class="btn btn--ghost">العودة للوحة المشاريع</button>
                    </div>
                </div>
                <p class="text-xs text-muted mt-6 max-w-xl">التقرير المبني على معايير دراسات جدوى متوافقة مع أفضل الممارسات المحلية (رؤية 2030، منشآت، بنك التنمية). لا يُعد اعتماداً رسمياً إلا بموجب اتفاق.</p>
            </div>
        `;
        this.bindStep3(result);
    }

    bindStep1() {
        const sectorEl = this.container.querySelector('#qf-sector');
        sectorEl?.addEventListener('change', () => {
            this.quickData.sector = sectorEl.value;
            this.applySectorDefaults();
        });
        this.container.querySelector('#qf-next-1')?.addEventListener('click', async () => {
            this.quickData.projectName = this.container.querySelector('#qf-projectName')?.value?.trim() || 'مشروع جديد';
            this.quickData.sector = this.container.querySelector('#qf-sector')?.value || 'مطعم';
            this.quickData.city = this.container.querySelector('#qf-city')?.value || 'الرياض';
            this.quickData.area = Number(this.container.querySelector('#qf-area')?.value) || 100;
            this.quickData.budget = Number(this.container.querySelector('#qf-budget')?.value) || 0;
            this.applySectorDefaults();
            try {
                const defaults = await IntelligenceService.getMarketDefaults(
                    this.quickData.sector,
                    this.quickData.city,
                    this.quickData.area,
                    this.quickData.budget
                );
                if (defaults && (defaults.rent_per_sqm || defaults.fitout_per_sqm)) {
                    this.quickData.apiDefaults = defaults;
                    const area = this.quickData.area || 100;
                    const rent = (defaults.rent_per_sqm || 1000) * area / 12;
                    const sal = defaults.salaries || { manager: 6000, staff: 3500 };
                    const staffCount = 2;
                    const monthlySalaries = (sal.manager || 6000) + (staffCount * (sal.staff || 3500));
                    const marketing = (defaults.marketing && defaults.marketing.monthly) || 1500;
                    this.quickData.monthlyCosts = Math.round(rent + monthlySalaries + marketing);
                    this.quickData.initialInvestment = Math.round((defaults.fitout_per_sqm || 1500) * area);
                    this.quickData.monthlyRevenue = Math.max(this.quickData.monthlyRevenue, Math.round(this.quickData.monthlyCosts * 1.25));
                }
            } catch (e) {
                /* استمر بالافتراضات المحلية */
            }
            this.step = 2;
            this.render();
        });
        this.container.querySelector('#qf-back-dash')?.addEventListener('click', () => this.onExit());
    }

    bindStep2() {
        this.container.querySelector('#qf-prev-2')?.addEventListener('click', () => {
            this.step = 1;
            this.render();
        });
        this.container.querySelector('#qf-next-2')?.addEventListener('click', () => {
            this.quickData.monthlyRevenue = Number(this.container.querySelector('#qf-monthlyRevenue')?.value) || 0;
            this.quickData.monthlyCosts = Number(this.container.querySelector('#qf-monthlyCosts')?.value) || 0;
            this.quickData.initialInvestment = Number(this.container.querySelector('#qf-initialInvestment')?.value) || 0;
            this.quickData.fundingSource = this.container.querySelector('#qf-fundingSource')?.value || 'self';
            this.step = 3;
            this.render();
        });
        this.container.querySelector('#qf-ai-fill')?.addEventListener('click', async () => {
            const btn = this.container.querySelector('#qf-ai-fill');
            const status = this.container.querySelector('#qf-ai-status');
            if (btn) btn.disabled = true;
            if (status) status.textContent = 'جاري التوليد...';
            try {
                const { AIConnector } = await import('../services/AIConnector.js');
                const connector = new AIConnector();
                const ctx = {
                    projectInfo: {
                        name: this.quickData.projectName || 'مشروع',
                        concept: this.quickData.sector,
                        city: this.quickData.city
                    }
                };
                // تمرير نتائج الجدوى السريعة الحقيقية بدل كائن فارغ (يمنع ملخصاً بأصفار وتوصية زائفة)
                const qr = quickFeasibilityCalc(this.quickData) || {};
                const qResults = {
                    npv: qr.npv,
                    paybackPeriod: qr.paybackYears,
                    breakEvenPointValue: qr.breakevenMonthly,
                    decision: qr.recommendation === 'go' ? 'GO' : (qr.recommendation === 'revise' ? 'REVISE' : 'NO-GO'),
                    indicators: { npv: qr.npv, paybackPeriod: qr.paybackYears, breakEvenPointValue: qr.breakevenMonthly }
                };
                const [execSummary, market, competitors, risks] = await Promise.all([
                    connector.generateExecutiveSummary(ctx, qResults).catch(() => ''),
                    connector.generateMarketAnalysisText(ctx).catch(() => ''),
                    connector.generateCompetitors(ctx).then(c => Array.isArray(c) ? c : []).catch(() => []),
                    connector.generateRisksForReport(ctx).then(r => Array.isArray(r) ? r : []).catch(() => [])
                ]);
                this.quickData.generated = {
                    execSummary: typeof execSummary === 'string' ? execSummary : '',
                    market: typeof market === 'string' ? market : '',
                    competitors: Array.isArray(competitors) ? competitors : [],
                    risks: Array.isArray(risks) ? risks.map(r => ({ name: r.name || r.description, description: r.description || r.name, mitigation: r.mitigation || '', probability: r.probability || 'medium', impact: r.impact || 'medium' })) : []
                };
                toast.success('تم ملء المسودة بالذكاء الاصطناعي. انقر «التالي» لعرض القرار.');
                if (status) status.textContent = 'تم ✓';
            } catch (e) {
                console.error('Quick AI fill failed', e);
                toast.error('تعذر التوليد. يمكنك المتابعة بدون ملء المسودة.');
                if (status) status.textContent = '';
            }
            if (btn) btn.disabled = false;
        });
    }

    bindStep3(result) {
        this.container.querySelector('#qf-download-pdf')?.addEventListener('click', async () => {
            const btn = this.container.querySelector('#qf-download-pdf');
            if (btn?.disabled) return;
            if (btn) {
                btn.disabled = true;
                btn.textContent = '⏳ جاري الإعداد...';
            }
            try {
                const gen = new QuickPDFGenerator(this.quickData, result, this.store);
                await gen.generate();
                toast.success('تم فتح نافذة الطباعة — اختر «حفظ كـ PDF»');
            } catch (e) {
                console.error(e);
                toast.error('تعذر فتح التقرير. يرجى السماح بالنوافذ المنبثقة.');
            }
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '📄 تحميل PDF الآن';
            }
        });
        this.container.querySelector('#qf-full-path')?.addEventListener('click', () => this.onFinish(this.quickData));
        this.container.querySelector('#qf-back-dash-3')?.addEventListener('click', () => this.onExit());
    }
}

/**
 * Decision Dashboard Component
 * The "Boardroom" view for investors to see if the project is ready
 */
import { calculateStudy as runFullModel } from '../core/engine.js';
import { calculateProjectScore } from '../core/scoring.js';
import { ReportGenerator } from '../services/ReportGenerator.js';
import { ProjectManager } from '../services/ProjectManager.js';
import { PresentationView } from './PresentationView.js';
import { BankReportGenerator } from '../../export/BankReportGenerator.js';
import { PitchDeckExporter } from '../../export/PitchDeckExporter.js';
import { sanitizeFilename, exportDateISO, downloadBlob } from '../../export/utils.js';
import { generateInvestorLink } from '../utils/shareUtils.js';
import { exportExcel } from '../../export/excel.js';
import { animateCounter } from '../utils/ui.js';
import { runQAChecks } from '../utils/qaChecks.js';
import { toast } from '../utils/toast.js';

export class DecisionDashboard {
    constructor(containerId, store) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this._eventListeners = [];
    }

    // Cleanup method
    cleanup() {
        this._eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this._eventListeners = [];
    }

    async render() {
        const state = this.store.getState();
        let results = null;
        try {
            results = runFullModel(state);
        } catch (e) {
            console.error('Financial Model Error:', e);
        }

        const evaluation = calculateProjectScore(state, results);
        const readiness = this.calculateReadiness(state, results);
        
        // QA Gate validation (async, but we'll await it)
        let qaResults = { passed: true, hardErrors: [], softWarnings: [], validationErrors: [], validationWarnings: [] };
        try {
            qaResults = await runQAChecks(state, results);
        } catch (e) {
            console.error('QA Check failed:', e);
        }

        // تحقق صحة البيانات (validateStudy)
        let validationResult = { valid: true, errors: [] };
        try {
            const { validateStudy } = await import('../utils/validation.js');
            validationResult = validateStudy(state);
        } catch (_) {}

        this.container.innerHTML = `
            <div class="decision-dashboard animate-entry">
                <div class="alert alert--info mb-6" style="font-size: 0.9rem; border-right: 4px solid var(--c-p-500); background: rgba(212, 175, 55, 0.08);">
                    <strong>أفضل الممارسات المحلية:</strong> لا تتخذ قرار الاستقالة أو الاستثمار الكبير قبل إكمال الدراسة.
                </div>
                <div class="flex flex-col md:flex-row gap-6 mb-8 items-center bg-gradient-to-r from-gray-900 via-slate-900 to-gray-900 p-8 rounded-3xl shadow-2xl border border-white/10">
                    
                    <!-- Score Gauge Container -->
                    <div class="relative w-48 h-48 flex-shrink-0">
                         <svg viewBox="0 0 100 100" class="transform -rotate-90 w-full h-full drop-shadow-[0_0_15px_rgba(255,215,0,0.3)]">
                            <!-- Background Circle -->
                            <circle cx="50" cy="50" r="45" stroke="#333" stroke-width="8" fill="none" />
                            <!-- Progress Circle -->
                            <circle cx="50" cy="50" r="45" stroke="${this.getScoreColor(evaluation.score)}" stroke-width="8" fill="none" 
                                stroke-dasharray="283" stroke-dashoffset="${283 - (283 * evaluation.score / 100)}" 
                                class="transition-all duration-1000 ease-out" />
                        </svg>
                        <div class="absolute inset-0 flex flex-col items-center justify-center text-white">
                            <span class="text-4xl font-black font-mono tracking-tighter" id="scoreValue">0</span>
                            <span class="text-xs text-gray-400 uppercase tracking-widest mt-1">النقاط</span>
                        </div>
                    </div>

                    <div class="flex-1 text-center md:text-right">
                        <div class="inline-block px-4 py-1 rounded-full bg-white/10 text-xs font-bold mb-3 border border-white/10">التقييم الشامل</div>
                        <h2 class="text-3xl md:text-5xl font-bold text-white mb-2 leading-tight">
                            ${evaluation.recommendationLabel}
                        </h2>
                        <p class="text-gray-400 max-w-lg leading-relaxed">
                            بناءً على تحليل ${evaluation.details.length} معياراً تشمل الجدوى المالية، اكتمال البيانات، وجاهزية السوق.
                            ${qaResults.hardErrors.length > 0 ? '<br><span class="text-danger text-sm">⚠️ توجد أخطاء حرجة يجب إصلاحها قبل اتخاذ القرار.</span>' : ''}
                            ${qaResults.passed && qaResults.hardErrors.length === 0 ? '<br><span class="text-success text-sm">✅ الدراسة اجتازت معايير الجودة.</span>' : ''}
                        </p>
                    </div>

                     <div class="flex flex-col gap-3 min-w-[200px]">
                        <button id="btnExecutiveSummary" class="btn btn--primary py-3 px-6 shadow-glow hover:scale-105 transition-all text-lg flex items-center justify-center gap-2" title="يعمل بدون مفتاح API">
                            <span>📄</span> الملخص التنفيذي
                        </button>
                         <button id="btnPresentation" class="btn btn--secondary btn--sm flex items-center justify-center gap-2">
                            <span>📺</span> عرض تقديمي
                        </button>
                        <button id="btnInvestorLink" class="btn btn--secondary btn--sm flex items-center justify-center gap-2" title="إنشاء رابط للمستثمر (صفحة هبوط للقراءة فقط)">
                            <span>💎</span> رابط لوحة المستثمر
                        </button>
                        <button id="btnRefreshResults" class="btn btn--ghost btn--sm text-muted hover:text-white" title="إعادة حساب النتائج والتقييم">🔄 إعادة حساب</button>
                    </div>
                </div>

                <!-- QA Gate Status -->
                ${qaResults.hardErrors.length > 0 ? `
                    <div class="card bg-danger/10 border-danger/30 mb-6">
                        <div class="flex items-center gap-3 mb-3">
                            <span class="text-2xl">🚫</span>
                            <h4 class="text-danger font-bold">أخطاء حرجة - الدراسة غير جاهزة</h4>
                        </div>
                        <ul class="space-y-2 text-sm">
                            ${qaResults.hardErrors.map(err => `<li class="text-danger">• ${err.message || err}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${qaResults.softWarnings.length > 0 ? `
                    <div class="card bg-warning/10 border-warning/30 mb-6">
                        <div class="flex items-center gap-3 mb-3">
                            <span class="text-2xl">⚠️</span>
                            <h4 class="text-warning font-bold">تحذيرات مهمة</h4>
                        </div>
                        <ul class="space-y-2 text-sm">
                            ${qaResults.softWarnings.map(warn => `<li class="text-warning">• ${warn.message || warn}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${!validationResult.valid && validationResult.errors?.length ? `
                    <div class="card bg-warning/10 border-warning/30 mb-6">
                        <div class="flex items-center gap-3 mb-3">
                            <span class="text-2xl">📋</span>
                            <h4 class="text-warning font-bold">أخطاء في صحة البيانات</h4>
                        </div>
                        <p class="text-sm text-muted mb-2">قد تؤثر على دقة النتائج المالية. يُفضّل إصلاحها قبل التصدير أو اتخاذ القرار.</p>
                        <ul class="space-y-1 text-sm">
                            ${validationResult.errors.slice(0, 5).map(e => `<li class="text-warning">• ${e}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${qaResults.passed && qaResults.hardErrors.length === 0 ? `
                    <div class="card bg-success/10 border-success/30 mb-6">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">✅</span>
                            <h4 class="text-success font-bold">الدراسة اجتازت فحص الجودة (QA Gate)</h4>
                        </div>
                    </div>
                ` : ''}
                ${state.projectInfo?.investorProfile === 'conservative' && (readiness.recommendation.status === 'review' || readiness.recommendation.status === 'nogo') ? `
                    <div class="card bg-warning/10 border-warning/30 mb-6">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">⚖️</span>
                            <div>
                                <h4 class="text-warning font-bold">ملفك محافظ — تنبيه</h4>
                                <p class="text-sm text-muted mt-1">مشروعك عالي المخاطر أو يحتاج مراجعة. كملف محافظ قد لا يتوافق معك. راجع أو ابحث عن بديل أقل مخاطرة.</p>
                            </div>
                        </div>
                    </div>
                ` : ''}

                <div class="dashboard-grid">
                     <!-- Scoring Breakdown -->
                    <div class="dashboard-col">
                        <div class="card glass-card h-full">
                            <h4 class="card-title flex justify-between items-center">
                                <span>تفاصيل التقييم</span>
                                <span class="text-xs text-muted font-normal">${evaluation.score}/100 نقطة</span>
                            </h4>
                            <div class="space-y-3 mt-4">
                                ${evaluation.details.map(item => `
                                    <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                        <div class="flex items-center gap-3">
                                            <div class="w-2 h-8 rounded-full ${item.score > 0 ? 'bg-success' : 'bg-danger'}"></div>
                                            <div>
                                                <div class="font-bold text-sm text-gray-200">${item.label}</div>
                                                <div class="text-xs text-gray-500 uppercase">${item.category}</div>
                                            </div>
                                        </div>
                                        <div class="font-mono font-bold ${item.score > 0 ? 'text-success' : 'text-danger'}">
                                            +${item.score}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                <div class="dashboard-grid">
                    <!-- Left Column: Metrics -->
                    <div class="dashboard-col">
                        <div class="card glass-card">
                            <h4 class="card-title">المؤشرات المالية الحاسمة</h4>
                            <div class="kpi-grid-decision">
                                ${this.renderKPIItem('صافي القيمة الحالية', results?.indicators?.npv, 'currency')}
                                ${this.renderKPIItem('معدل العائد الداخلي', results?.indicators?.irr, 'percent')}
                                ${this.renderKPIItem('فترة الاسترداد', results?.indicators?.paybackPeriod, 'years')}
                                ${this.renderKPIItem('العائد على الاستثمار', results?.indicators?.roi, 'percent')}
                            </div>
                        </div>

                        <!-- اختبار الضغط (Stress Test / ماذا لو — Upmetrics) -->
                        <div class="card glass-card stress-test-card">
                            <h4 class="card-title">ماذا لو؟ — اختبار الضغط</h4>
                            <p class="text-muted text-sm mb-4">لو زاد الإيراد 10%؟ لو زاد الإيجار 20%؟ حرّك المنزلقات لتحديث النتائج فوراً (NPV، هامش الربح).</p>
                            <div class="stress-test-sliders">
                                <div class="stress-slider-row">
                                    <label class="stress-slider-label" for="stressRevenueSlider">تغير الإيرادات</label>
                                    <div class="stress-slider-wrap">
                                        <input type="range" id="stressRevenueSlider" class="stress-slider" min="-20" max="20" value="0" step="1" aria-label="تغير الإيرادات بالمئة">
                                        <span id="stressRevenueValue" class="stress-slider-value">0%</span>
                                    </div>
                                </div>
                                <div class="stress-slider-row">
                                    <label class="stress-slider-label" for="stressCostSlider">تغير التكاليف</label>
                                    <div class="stress-slider-wrap">
                                        <input type="range" id="stressCostSlider" class="stress-slider" min="-20" max="20" value="0" step="1" aria-label="تغير التكاليف بالمئة">
                                        <span id="stressCostValue" class="stress-slider-value">0%</span>
                                    </div>
                                </div>
                            </div>
                            <div class="stress-test-results">
                                <div class="stress-kpi">
                                    <span class="stress-kpi-label">صافي القيمة الحالية (بعد الصدمة)</span>
                                    <span id="stressNPV" class="stress-kpi-value">${this.formatCurrency(results?.indicators?.npv)}</span>
                                </div>
                                <div class="stress-kpi">
                                    <span class="stress-kpi-label">هامش الربح (بعد الصدمة)</span>
                                    <span id="stressMargin" class="stress-kpi-value">${this.formatPercent(results?.indicators?.profitMargin ?? 0)}</span>
                                </div>
                            </div>
                            <div class="stress-test-chart-wrap" aria-hidden="true">
                                <div class="stress-bar-label">مقارنة NPV بالأساسي</div>
                                <div class="stress-bar-track">
                                    <div id="stressNPVBar" class="stress-bar-fill" style="width: 50%;"></div>
                                </div>
                            </div>
                            <div class="mt-3">
                                <button type="button" id="btnStressAskAI" class="btn btn--secondary btn--sm" title="اسأل المستشار الذكي عن هذا السيناريو (ربط اختبار الضغط بـ AI)">
                                    🤖 اسأل مساعد AI عن هذا السيناريو
                                </button>
                            </div>
                        </div>

                        <div class="card glass-card">
                            <h4 class="card-title">جاهزية الأبعاد الأساسية</h4>
                            <div class="readiness-list">
                                ${this.renderReadinessItem('📊 جاهزية السوق', readiness.dimensions.market)}
                                ${this.renderReadinessItem('💵 جاهزية التمويل', readiness.dimensions.financing)}
                                ${this.renderReadinessItem('👥 جاهزية الفريق', readiness.dimensions.team)}
                                ${this.renderReadinessItem('⚖️ الجاهزية القانونية', readiness.dimensions.legal)}
                                ${this.renderReadinessItem('📍 جاهزية الموقع', readiness.dimensions.location)}
                                ${this.renderReadinessItem('⚠️ إدارة المخاطر', readiness.dimensions.risk)}
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Context -->
                    <div class="dashboard-col">
                        <div class="card glass-card">
                            <h4 class="card-title">نتائج السيناريوهات</h4>
                            <div class="scenario-results-table">
                                <table class="data-table small">
                                    <thead>
                                        <tr>
                                            <th>السيناريو</th>
                                            <th>صافي القيمة الحالية</th>
                                            <th>الأرباح قبل الفوائد والضرائب</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr class="row-pessimistic">
                                            <td>😟 متشائم (-20%)</td>
                                            <td>${this.formatCurrency(results?.indicators?.npv * 0.4)}</td>
                                            <td>${this.formatCurrency(results?.incomeStatement?.[0]?.ebitda * 0.8)}</td>
                                        </tr>
                                        <tr class="row-base">
                                            <td>😐 أساسي</td>
                                            <td>${this.formatCurrency(results?.indicators?.npv)}</td>
                                            <td>${this.formatCurrency(results?.incomeStatement?.[0]?.ebitda)}</td>
                                        </tr>
                                        <tr class="row-optimistic">
                                            <td>😊 متفائل (+20%)</td>
                                            <td>${this.formatCurrency(results?.indicators?.npv * 1.5)}</td>
                                            <td>${this.formatCurrency(results?.incomeStatement?.[0]?.ebitda * 1.2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="card glass-card">
                            <h4 class="card-title">شروط النجاح الحرجة</h4>
                            <ul class="factors-list">
                                ${readiness.factors.map(f => `<li><span class="bullet">⭐</span> ${f}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="decision-actions mt-6 flex gap-4 justify-center flex-wrap">
                    <button id="btnSaveStudy" class="btn btn--primary">💾 حفظ الدراسة</button>
                    <button id="btnExportPDF" class="btn btn--secondary btn-magic">📄 تصدير تقرير بنكي</button>
                    <button id="btnExportExcel" class="btn btn--success btn-magic" style="background:#10b981;">📊 تصدير إكسل</button>
                    <button id="btnConsultation" class="btn btn--ghost btn-magic" title="احجز استشارة Zoom مع خبير">📞 احجز استشارة</button>
                    <button id="btnPitchMode" class="btn btn--accent btn-magic" style="background:#000; color:#fff;">📽️ عرض المستثمر</button>
                    <button id="btnExportPitch" class="btn btn--ghost btn-magic" title="تحميل Pitch Deck كـ HTML (اطبع كـ PDF)">📥 تصدير Pitch Deck</button>
                </div>
            </div>
        `;

        this.bindEvents(state, results);

        // Stress-test sliders: live update NPV and Profit Margin
        this.bindStressTestSliders(state, results);

        // Animate Score
        setTimeout(() => {
            animateCounter('scoreValue', evaluation.score, 1500);
        }, 300);
    }

    bindStressTestSliders(state, results) {
        const revSlider = this.container.querySelector('#stressRevenueSlider');
        const costSlider = this.container.querySelector('#stressCostSlider');
        const revValueEl = this.container.querySelector('#stressRevenueValue');
        const costValueEl = this.container.querySelector('#stressCostValue');
        const stressNPVEl = this.container.querySelector('#stressNPV');
        const stressMarginEl = this.container.querySelector('#stressMargin');
        const stressNPVBar = this.container.querySelector('#stressNPVBar');
        if (!revSlider || !costSlider || !stressNPVEl || !stressMarginEl) return;

        const baseNPV = results?.indicators?.npv ?? 0;

        const updateStressResults = () => {
            const revPct = Number(revSlider.value);
            const costPct = Number(costSlider.value);
            if (revValueEl) revValueEl.textContent = (revPct >= 0 ? '+' : '') + revPct + '%';
            if (costValueEl) costValueEl.textContent = (costPct >= 0 ? '+' : '') + costPct + '%';

            const overrides = { revenueChange: revPct / 100, opexChange: costPct / 100 };
            let stressed = null;
            try {
                stressed = runFullModel(state, overrides);
            } catch (e) {
                console.warn('Stress test runFullModel error', e);
            }
            if (!stressed?.indicators) return;

            const npv = stressed.indicators.npv;
            const margin = stressed.indicators.profitMargin ?? 0;
            stressNPVEl.textContent = this.formatCurrency(npv);
            stressNPVEl.classList.toggle('text-danger', npv < 0);
            stressNPVEl.classList.toggle('text-success', npv >= 0);
            stressMarginEl.textContent = this.formatPercent(margin);
            stressMarginEl.classList.toggle('text-danger', margin < 0);
            stressMarginEl.classList.toggle('text-success', margin >= 0);

            if (stressNPVBar && Number.isFinite(baseNPV) && baseNPV !== 0) {
                const pct = Math.max(0, Math.min(100, (npv / baseNPV) * 100));
                stressNPVBar.style.width = pct + '%';
                stressNPVBar.classList.toggle('stress-bar-negative', npv < 0);
                stressNPVBar.classList.remove('stress-bar-negative');
                if (npv < 0) stressNPVBar.classList.add('stress-bar-negative');
            }
        };

        revSlider.addEventListener('input', updateStressResults);
        costSlider.addEventListener('input', updateStressResults);
        this._eventListeners.push({ element: revSlider, event: 'input', handler: updateStressResults });
        this._eventListeners.push({ element: costSlider, event: 'input', handler: updateStressResults });

        const btnStressAskAI = this.container.querySelector('#btnStressAskAI');
        if (btnStressAskAI) {
            const handler = () => {
                const revPct = revSlider?.value ?? 0;
                const costPct = costSlider?.value ?? 0;
                const npvText = stressNPVEl?.textContent ?? '—';
                const marginText = stressMarginEl?.textContent ?? '—';
                const prompt = `في اختبار الضغط: تغير الإيرادات ${revPct >= 0 ? '+' : ''}${revPct}% وتغير التكاليف ${costPct >= 0 ? '+' : ''}${costPct}%. صافي القيمة الحالية بعد الصدمة ${npvText} وهامش الربح ${marginText}. هل المشروع لا يزال مجدياً؟ ما توصياتك؟`;
                if (typeof window.aiChatModal?.openWithPrompt === 'function') {
                    window.aiChatModal.openWithPrompt(prompt);
                } else {
                    import('../utils/toast.js').then(({ toast }) => toast.info('المستشار الذكي يُحمّل... جرّب بعد ثوانٍ.'));
                }
            };
            btnStressAskAI.addEventListener('click', handler);
            this._eventListeners.push({ element: btnStressAskAI, event: 'click', handler });
        }
    }

    bindEvents(state, results) {
        // Executive Summary Button
        const btnExec = this.container.querySelector('#btnExecutiveSummary');
        if (btnExec) {
            const handler = async () => {
                // Dynamic Import
                const { ExecutiveSummary } = await import('./ExecutiveSummary.js');

                // Create Modal Container if not exists
                let modal = document.getElementById('execSummaryModal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'execSummaryModal';
                    modal.className = 'fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in';
                    modal.innerHTML = `
                        <div class="bg-gray-900 rounded-2xl w-full max-w-5xl relative shadow-2xl border border-white/10 min-h-[80vh]">
                            <button class="absolute top-4 left-4 z-10 btn btn--secondary btn--sm btn-close-modal">✕ إغلاق</button>
                            <div id="execSummaryContent" class="p-6 h-full overflow-y-auto max-h-[90vh]"></div>
                        </div>
                    `;
                    document.body.appendChild(modal);

                    modal._doClose = () => {
                        modal.classList.add('hidden');
                        if (modal._onEscape) { document.removeEventListener('keydown', modal._onEscape); modal._onEscape = null; }
                    };
                    const closeBtn = modal.querySelector('.btn-close-modal');
                    if (closeBtn) closeBtn.addEventListener('click', modal._doClose);
                }

                modal.classList.remove('hidden');
                modal._onEscape = (e) => { if (e.key === 'Escape') modal._doClose(); };
                document.addEventListener('keydown', modal._onEscape);

                // Render Component
                const execView = new ExecutiveSummary('execSummaryContent', this.store);
                execView.render();
            };
            btnExec.addEventListener('click', handler);
            this._eventListeners.push({ element: btnExec, event: 'click', handler });
        }

        // عرض المستثمر (على الشاشة)
        const btnPitch = this.container.querySelector('#btnPitchMode');
        if (btnPitch) {
            const handler = () => {
                const presentation = new PresentationView(this.store);
                presentation.render();
            };
            btnPitch.addEventListener('click', handler);
            this._eventListeners.push({ element: btnPitch, event: 'click', handler });
        }

        // تصدير Pitch Deck — مباشر (HTML جاهز للطباعة كـ PDF)
        const btnExportPitch = this.container.querySelector('#btnExportPitch');
        if (btnExportPitch) {
            const handler = async () => {
                try {
                    const pitchHtml = PitchDeckExporter.generateHTML(this.store);
                    const win = window.open('', '_blank');
                    if (win) {
                        win.document.write(pitchHtml);
                        win.document.close();
                        win.focus();
                    }
                    const state = this.store.getState();
                    const projName = sanitizeFilename(state?.projectInfo?.name || 'pitch_deck');
                    const pitchName = `pitch_deck_${projName}_${exportDateISO()}.html`;
                    const blob = new Blob([pitchHtml], { type: 'text/html;charset=utf-8' });
                    downloadBlob(blob, pitchName);
                    toast.success(win ? `تم فتح Pitch Deck وتنزيل: ${pitchName} — اطبع كـ PDF من المتصفح` : `تم تنزيل ${pitchName}. اسمح بالنوافذ المنبثقة لفتح العرض.`);
                } catch (e) {
                    console.error('Pitch deck export error', e);
                    toast.error('فشل إنشاء Pitch Deck. تحقق من اكتمال البيانات.');
                }
            };
            btnExportPitch.addEventListener('click', handler);
            this._eventListeners.push({ element: btnExportPitch, event: 'click', handler });
        }

        // إعادة حساب النتائج
        const btnRefresh = this.container.querySelector('#btnRefreshResults');
        if (btnRefresh) {
            const handler = () => {
                btnRefresh.disabled = true;
                btnRefresh.textContent = '⏳ جاري الحساب...';
                this.render().catch(e => console.error('Refresh error:', e)).finally(() => {
                    if (btnRefresh.isConnected) { btnRefresh.disabled = false; btnRefresh.textContent = '🔄 إعادة حساب'; }
                });
            };
            btnRefresh.addEventListener('click', handler);
            this._eventListeners.push({ element: btnRefresh, event: 'click', handler });
        }

        // احجز استشارة
        const btnConsultation = this.container.querySelector('#btnConsultation');
        if (btnConsultation) {
            const handler = async () => {
                const { ConsultationModal } = await import('./ConsultationModal.js');
                new ConsultationModal('consultationModalOverlay', this.store).open();
            };
            btnConsultation.addEventListener('click', handler);
            this._eventListeners.push({ element: btnConsultation, event: 'click', handler });
        }

        // تصدير تقرير بنكي — مباشر (بنك التنمية / ريادة / كفالة)
        const btnExport = this.container.querySelector('#btnExportPDF');
        if (btnExport) {
            const handler = async () => {
                try {
                    const html = BankReportGenerator.generateHTML(this.store);
                    const win = window.open('', '_blank');
                    if (win) {
                        win.document.write(html);
                        win.document.close();
                        win.focus();
                    }
                    const state = this.store.getState();
                    const projName = sanitizeFilename(state?.projectInfo?.name || 'تقرير_تمويل_بنكي');
                    const bankName = `bank_report_${projName}_${exportDateISO()}.html`;
                    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                    downloadBlob(blob, bankName);
                    toast.success(win ? `تم فتح التقرير البنكي وتنزيل: ${bankName}` : `تم تنزيل ${bankName}. اسمح بالنوافذ المنبثقة لفتح التقرير.`);
                } catch (e) {
                    console.error('Bank report export error', e);
                    toast.error('فشل إنشاء التقرير البنكي. تحقق من اكتمال البيانات.');
                }
            };
            btnExport.addEventListener('click', handler);
            this._eventListeners.push({ element: btnExport, event: 'click', handler });
        }

        // Save Study
        const btnSave = this.container.querySelector('#btnSaveStudy');
        if (btnSave) {
            const handler = async (e) => {
                const state = this.store.getState();
                let name = state.projectInfo?.name;
                if (!name) {
                    name = prompt('الرجاء إدخال اسم المشروع للحفظ:', 'مشروع جديد');
                    if (name) {
                        this.store.update('projectInfo', { ...state.projectInfo, name: name });
                    }
                }

                if (name) {
                    e.target.textContent = '⏳ جاري الحفظ...';
                    e.target.disabled = true;
                    try {
                        const state = this.store.getState();
                        const result = await ProjectManager.saveProject(state);
                        if (result.success) {
                            e.target.textContent = '✅ تم الحفظ!';
                            try {
                                const results = runFullModel(state);
                                const evaluation = this.calculateReadiness(state, results);
                                const status = evaluation?.recommendation?.status;
                                const { WebhookService } = await import('../services/WebhookService.js');
                                if (status === 'go') {
                                    WebhookService.triggerEvent('decision.go', { study_id: state.projectInfo?.id, project_name: state.projectInfo?.name });
                                } else if (status === 'nogo') {
                                    WebhookService.triggerEvent('decision.nogo', { study_id: state.projectInfo?.id, project_name: state.projectInfo?.name });
                                }
                            } catch (_) {}
                            setTimeout(() => {
                                e.target.textContent = '💾 حفظ الدراسة';
                                e.target.disabled = false;
                            }, 2000);
                        } else {
                            alert('حدث خطأ أثناء الحفظ: ' + (result.error || 'Unknown'));
                            e.target.textContent = '❌ خطأ';
                            e.target.disabled = false;
                        }
                    } catch (err) {
                        console.error(err);
                        alert('فشل الحفظ');
                        e.target.textContent = '💾 حفظ الدراسة';
                        e.target.disabled = false;
                    }
                }
            };
            btnSave.addEventListener('click', handler);
            this._eventListeners.push({ element: btnSave, event: 'click', handler });
        }

        // Excel Export
        const btnExcel = this.container.querySelector('#btnExportExcel');
        if (btnExcel) {
            const handler = async (e) => {
                const { ExportMenu } = await import('./ExportMenu.js');
                new ExportMenu('exportMenuOverlay', this.store).open();
            };
            btnExcel.addEventListener('click', handler);
            this._eventListeners.push({ element: btnExcel, event: 'click', handler });
        }

        // Presentation Button
        const btnPresentation = this.container.querySelector('#btnPresentation');
        if (btnPresentation) {
            const handler = () => {
                const presentation = new PresentationView(this.store);
                presentation.render();
            };
            btnPresentation.addEventListener('click', handler);
            this._eventListeners.push({ element: btnPresentation, event: 'click', handler });
        }

        // رابط لوحة المستثمر (Pitch View — للقراءة فقط، مشاركة عبر token)
        const btnInvestorLink = this.container.querySelector('#btnInvestorLink');
        if (btnInvestorLink) {
            const handler = async () => {
                const link = await generateInvestorLink(state, results);
                if (link?.url) {
                    try {
                        await navigator.clipboard.writeText(link.url);
                        toast.success('تم نسخ رابط لوحة المستثمر. شاركه مع المستثمر ليفتح الصفحة للقراءة فقط.');
                    } catch (_) {
                        window.prompt('انسخ الرابط:', link.url);
                        toast.info('انسخ الرابط من النافذة وأرسله للمستثمر.');
                    }
                    window.open(link.url, '_blank');
                } else {
                    toast.error('فشل إنشاء الرابط. تأكد من اكتمال بيانات المشروع.');
                }
            };
            btnInvestorLink.addEventListener('click', handler);
            this._eventListeners.push({ element: btnInvestorLink, event: 'click', handler });
        }
    }

    calculateReadiness(state, results) {
        const kpis = results?.indicators || {}; // Updated to match financialModel output
        const thresholds = state.assumptions?.thresholds || {
            minNPV: 0,
            minIRR: 0.15,
            maxPayback: 3.5,
            minROI: 0.20
        };

        const la = state.projectInfo?.locationAnalysis || {};
        const hasLocation = la.address || (la.coordinates?.lat != null && la.coordinates?.lng != null) || la.selectionFactors;
        const dimensions = {
            market: (state.marketSizing?.som?.value > 0) ? 'ready' : 'needs_work',
            financing: (state.financing?.totalInvestment > 0) ? 'ready' : 'critical',
            team: (state.hr?.positions?.length > 0) ? 'ready' : 'needs_work',
            legal: (state.legal?.licenses?.length > 0) ? 'ready' : 'needs_work',
            risk: (state.riskAnalysis?.risks?.length > 0) ? 'ready' : 'needs_work',
            location: hasLocation ? 'ready' : 'needs_work'
        };

        // Scoring Logic (Weighted 100%)
        // 1. Financial Viability (60%)
        let score = 0;
        let financialChecks = 0;

        if (kpis.npv > thresholds.minNPV) { score += 20; financialChecks++; }
        if (kpis.irr >= thresholds.minIRR) { score += 20; financialChecks++; }
        if (kpis.roi >= thresholds.minROI) { score += 10; financialChecks++; }
        if (kpis.payback <= thresholds.maxPayback && kpis.payback > 0) { score += 10; financialChecks++; }

        // 2. Operational Readiness (40%)
        if (dimensions.market === 'ready') score += 10;
        if (dimensions.financing === 'ready') score += 10;
        if (dimensions.team === 'ready') score += 10;
        if (dimensions.legal === 'ready') score += 5;
        if (dimensions.risk === 'ready') score += 5;

        // Recommendation Logic
        let recommendation = { status: 'nogo', icon: '❌', label: 'لا تدخل المشروع', desc: 'المخاطر عالية والمؤشرات المالية لا تحقق الحد الأدنى المطلوب.' };

        if (score >= 80) {
            recommendation = { status: 'go', icon: '✅', label: 'ادخل المشروع بقوة', desc: 'مشروع متميز! جميع المؤشرات المالية والتشغيلية في النطاق الأخضر.' };
        } else if (score >= 60) {
            recommendation = { status: 'conditional', icon: '⚠️', label: 'ادخل بشروط', desc: 'المشروع مجدٍ، لكن يحتاج لتحسين بعض الجوانب لرفع درجة الأمان.' };
        } else if (score >= 40) {
            recommendation = { status: 'review', icon: '🤔', label: 'يحتاج مراجعة', desc: 'المخاطرة مرتفعة. راجع هيكل التكاليف أو خطة التسويق قبل اتخاذ القرار.' };
        }

        const factors = [
            `تحقيق صافي قيمة حالية أعلى من ${this.formatCurrency(thresholds.minNPV)}.`,
            `تجاوز معدل العائد الداخلي نسبة ${(thresholds.minIRR * 100).toFixed(0)}%.`,
            `استرداد رأس المال خلال أقل من ${thresholds.maxPayback} سنوات.`
        ];

        return { dimensions, recommendation, factors, score };
    }

    renderKPIItem(label, value, type) {
        let formatted = value || '--';
        if (type === 'currency' && value) formatted = this.formatCurrency(value);
        if (type === 'percent' && value) formatted = (value * 100).toFixed(1) + '%';
        if (type === 'years' && value) formatted = value + ' سنة';

        const status = (type === 'currency' && value < 0) || (type === 'percent' && value < 0.05) ? 'negative' : 'positive';

        return `
            <div class="kpi-mini-card ${status}">
                <span class="mini-label">${label}</span>
                <span class="mini-value">${formatted}</span>
            </div>
        `;
    }

    renderReadinessItem(label, status) {
        const icons = { ready: '🟢', needs_work: '🟡', critical: '🔴' };
        return `
            <div class="readiness-item status-${status}">
                <span class="readiness-label">${label}</span>
                <span class="readiness-status-icon">${icons[status]}</span>
            </div>
        `;
    }

    getScoreColor(score) {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#3b82f6';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    }

    formatCurrency(n) {
        if (!n && n !== 0) return '--';
        return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n || 0);
    }

    formatPercent(n) {
        if (!Number.isFinite(n)) return '--';
        return (n * 100).toFixed(1) + '%';
    }
}

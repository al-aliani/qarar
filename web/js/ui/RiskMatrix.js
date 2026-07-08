/**
 * Risk Matrix Component
 * Visual risk matrix with interactive risk register
 */

import { generateTableSuggestions } from '../services/AIConnector.js';
import { escapeHtml } from '../utils/escape.js';
import { getRiskScore, classifyRiskScore } from '../core/riskScoring.js';

export class RiskMatrix {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
        this.stepIndex = 0;
        this.isGenerating = false;
    }

    render(stepIndex) {
        if (typeof stepIndex === 'number') this.stepIndex = stepIndex;
        const state = this.store.getState();
        const riskAnalysis = state.riskAnalysis || {};
        const risks = riskAnalysis.risks || [];

        this.container.innerHTML = `
            <div class="risk-analysis">
                <h2 class="section-title">⚠️ تحليل المخاطر</h2>
                <div class="alert alert--info mb-4" style="font-size: 0.85rem;">
                    <strong>مخاطر التقنية:</strong> المشاريع التقنية تحمل مخاطر عالية — تقنية جديدة قد تنسف المشروع (مثال: نوكيا). إذا مشروعك يعتمد على التقنية، أضف خطر «اختراق تقني / تقادم تقني» من نوع تقني.
                </div>
                
                <!-- Risk Matrix Visual -->
                <div class="card analysis-card">
                    <h3 class="card-title">مصفوفة المخاطر</h3>
                    <p class="text-muted text-sm mb-3">توزيع المخاطر حسب الاحتمالية والأثر</p>
                    ${this.renderMatrix(risks)}
                </div>

                <!-- Risk Register -->
                <div class="card analysis-card">
                    <h3 class="card-title">سجل المخاطر</h3>
                    <p class="text-muted text-sm mb-3">قائمة تفصيلية بالمخاطر وخطط المواجهة</p>
                    ${this.renderRiskRegister(risks)}
                </div>

                <!-- Navigation -->
                <div class="wizard-nav margin-top-lg">
                    <button class="btn btn--secondary btn-prev-step">السابق</button>
                    <button class="btn btn--primary btn-next-step">التالي</button>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderMatrix(risks) {
        // Create 3x3 matrix cells
        const matrix = {
            'high-high': [], 'high-medium': [], 'high-low': [],
            'medium-high': [], 'medium-medium': [], 'medium-low': [],
            'low-high': [], 'low-medium': [], 'low-low': []
        };

        risks.forEach((risk, idx) => {
            const key = `${risk.probability || 'low'}-${risk.impact || 'low'}`;
            if (matrix[key]) {
                matrix[key].push({ ...risk, idx });
            }
        });

        const getCellClass = (prob, impact) => `risk-${classifyRiskScore(getRiskScore(prob, impact))}`;

        return `
            <div class="risk-matrix-container">
                <div class="risk-matrix-grid">
                    <div class="matrix-y-label">
                        <span>الأثر</span>
                    </div>
                    <div class="matrix-content">
                        <!-- Y Axis Labels -->
                        <div class="y-labels">
                            <span>عالي</span>
                            <span>متوسط</span>
                            <span>منخفض</span>
                        </div>
                        <!-- Matrix Cells -->
                        <div class="matrix-cells">
                            ${['high', 'medium', 'low'].map(impact => `
                                <div class="matrix-row">
                                    ${['low', 'medium', 'high'].map(prob => {
            const key = `${prob}-${impact}`;
            const cellRisks = matrix[key];
            return `
                                            <div class="matrix-cell ${getCellClass(prob, impact)}">
                                                ${cellRisks.map(r => `
                                                    <div class="risk-dot" title="${escapeHtml(r.name)}">${r.idx + 1}</div>
                                                `).join('')}
                                            </div>
                                        `;
        }).join('')}
                                </div>
                            `).join('')}
                        </div>
                        <!-- X Axis Labels -->
                        <div class="x-labels">
                            <span>منخفض</span>
                            <span>متوسط</span>
                            <span>عالي</span>
                        </div>
                    </div>
                </div>
                <div class="matrix-x-label">
                    <span>الاحتمالية</span>
                </div>
                <!-- Legend -->
                <div class="risk-legend">
                    <span class="legend-item"><span class="legend-box risk-critical"></span>حرج (9-15)</span>
                    <span class="legend-item"><span class="legend-box risk-high"></span>عالي (6-8)</span>
                    <span class="legend-item"><span class="legend-box risk-medium"></span>متوسط (3-5)</span>
                    <span class="legend-item"><span class="legend-box risk-low"></span>منخفض (1-2)</span>
                </div>
            </div>
        `;
    }

    renderRiskRegister(risks) {
        const typeLabels = {
            operational: 'تشغيلي',
            financial: 'مالي',
            market: 'سوقي',
            legal: 'قانوني',
            technical: 'تقني'
        };

        const probLabels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };
        const impactLabels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };
        const residualLabels = { low: 'منخفض', medium: 'متوسط', high: 'عالي' };
        const horizonLabels = { immediate: 'فوري', short: 'قصير (< سنة)', medium: 'متوسط (1-3 سنوات)', long: 'طويل (> 3 سنوات)' };

        const getScore = getRiskScore;

        const BADGE_BY_CLASS = { critical: 'badge--danger', high: 'badge--warning', medium: 'badge--info', low: 'badge--success' };
        const getScoreBadge = (score) => BADGE_BY_CLASS[classifyRiskScore(score)];

        // إجمالي الأثر المالي السنوي المقدّر (يقبله البنك بدل التصنيف النوعي)
        const totalFinancialImpact = risks.reduce((sum, r) => sum + (Number(r.estimatedFinancialImpact) || 0), 0);
        const fmtSAR = (n) => (Number(n) || 0).toLocaleString('ar-SA');

        // ترتيب العرض تنازلياً بالأثر المالي المقدّر (عرض فقط — لا يغيّر ترتيب التخزين؛ idx يبقى مؤشّر المصفوفة الأصلية)
        const orderedRisks = risks
            .map((risk, idx) => ({ risk, idx }))
            .sort((a, b) => (Number(b.risk.estimatedFinancialImpact) || 0) - (Number(a.risk.estimatedFinancialImpact) || 0));

        return `
            <div class="risk-register">
                <div class="table-scroll" style="overflow-x:auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>الخطر</th>
                            <th>النوع</th>
                            <th>الاحتمالية</th>
                            <th>الأثر</th>
                            <th>الدرجة</th>
                            <th>الأثر المالي المقدّر (ريال/سنة)</th>
                            <th>الأفق الزمني</th>
                            <th>خطة المواجهة</th>
                            <th>الخطر المتبقي بعد المعالجة</th>
                            <th>مؤشر إنذار مبكر</th>
                            <th>المسؤول</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="riskRegisterBody">
                        ${orderedRisks.map(({ risk, idx }) => {
            const score = getScore(risk.probability, risk.impact);
            return `
                                <tr data-idx="${idx}">
                                    <td class="text-center">${idx + 1}</td>
                                    <td><input type="text" class="input input--sm risk-field" data-field="name" value="${escapeHtml(risk.name)}"></td>
                                    <td>
                                        <select class="input input--sm risk-field" data-field="type">
                                            ${Object.entries(typeLabels).map(([k, v]) => `
                                                <option value="${k}" ${risk.type === k ? 'selected' : ''}>${v}</option>
                                            `).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <select class="input input--sm risk-field" data-field="probability">
                                            <option value="low" ${risk.probability === 'low' ? 'selected' : ''}>🟢 منخفض</option>
                                            <option value="medium" ${risk.probability === 'medium' ? 'selected' : ''}>🟡 متوسط</option>
                                            <option value="high" ${risk.probability === 'high' ? 'selected' : ''}>🔴 عالي</option>
                                        </select>
                                    </td>
                                    <td>
                                        <select class="input input--sm risk-field" data-field="impact">
                                            <option value="low" ${risk.impact === 'low' ? 'selected' : ''}>🟢 منخفض</option>
                                            <option value="medium" ${risk.impact === 'medium' ? 'selected' : ''}>🟡 متوسط</option>
                                            <option value="high" ${risk.impact === 'high' ? 'selected' : ''}>🔴 عالي</option>
                                        </select>
                                    </td>
                                    <td class="text-center"><span class="badge ${getScoreBadge(score)}">${score}</span></td>
                                    <td><input type="number" min="0" step="1000" class="input input--sm risk-field" data-field="estimatedFinancialImpact" value="${risk.estimatedFinancialImpact != null ? risk.estimatedFinancialImpact : ''}" placeholder="ريال/سنة"></td>
                                    <td>
                                        <select class="input input--sm risk-field" data-field="timeHorizon">
                                            ${Object.entries(horizonLabels).map(([k, v]) => `
                                                <option value="${k}" ${(risk.timeHorizon || 'short') === k ? 'selected' : ''}>${v}</option>
                                            `).join('')}
                                        </select>
                                    </td>
                                    <td><input type="text" class="input input--sm risk-field" data-field="mitigation" value="${escapeHtml(risk.mitigation)}"></td>
                                    <td>
                                        <select class="input input--sm risk-field" data-field="residualRisk">
                                            ${Object.entries(residualLabels).map(([k, v]) => `
                                                <option value="${k}" ${(risk.residualRisk || 'medium') === k ? 'selected' : ''}>${v}</option>
                                            `).join('')}
                                        </select>
                                    </td>
                                    <td><input type="text" class="input input--sm risk-field" data-field="earlyWarning" value="${escapeHtml(risk.earlyWarning)}" placeholder="مؤشر يُنذر باقتراب الخطر"></td>
                                    <td><input type="text" class="input input--sm risk-field" data-field="owner" value="${escapeHtml(risk.owner)}"></td>
                                    <td><button class="btn-icon btn-remove-risk" data-idx="${idx}">🗑️</button></td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                    ${risks.length ? `<tfoot>
                        <tr>
                            <td colspan="6" style="text-align:end;font-weight:600;">إجمالي الأثر المالي المقدّر (ريال/سنة)</td>
                            <td style="font-weight:700;">${fmtSAR(totalFinancialImpact)}</td>
                            <td colspan="6"></td>
                        </tr>
                    </tfoot>` : ''}
                </table>
                </div>
                <!-- تدقيق 2026-07-08 (ملاحظة متوسطة #31): الأثر المالي/الأفق الزمني/الخطر
                المتبقي/مؤشر الإنذار المبكر حقول تخطيطية توثيقية — لا تُحتسب مباشرة ضمن
                صافي القيمة الحالية تفادياً لازدواج احتساب نفس الخطر (فاحتمالية × أثر كل
                خطر مُحتسبة فعلياً ضمن علاوة المخاطر المضافة لمعدل الخصم في المحرك المالي). -->
                <p class="text-xs text-muted mt-2">الأثر المالي/الأفق الزمني/الخطر المتبقي/مؤشر الإنذار المبكر أعلاه بيانات تخطيطية للتوثيق والمتابعة (وتظهر في التقرير النهائي) — احتمالية وأثر كل خطر هما ما يُحتسب فعلياً ضمن علاوة المخاطر في المعدل المالي (تفادياً لاحتساب نفس الخطر مرتين).</p>
                <div class="actions-row" style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                    <button class="btn btn--sm btn--ghost btn-add-risk">+ إضافة خطر</button>
                    <button class="btn btn--sm btn--secondary btn-suggest-risk" ${this.isGenerating ? 'disabled' : ''}>
                        ${this.isGenerating ? '<span class="spinner-sm"></span> جاري الاقتراح...' : '🪄 اقتراح بنود'}
                    </button>
                    ${risks.length === 0 ? `<button class="btn btn--sm btn--primary btn-inject-sector-risks">📦 حقن حزمة مخاطر قطاعية (مطاعم/مقاهي)</button>` : ''}
                </div>
            </div>
        `;
    }

    bindEvents() {
        // Navigation
        this.container.querySelector('.btn-prev-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex - 1);
        });
        this.container.querySelector('.btn-next-step')?.addEventListener('click', () => {
            if (this.onNavigate) this.onNavigate(this.stepIndex + 1);
        });

        // Risk field updates: القوائم على change، والحقول النصية على input
        // (كي لا يُعاد رسم الجدول أثناء الكتابة فيفقد الحقل التركيز — حقل «خطة المواجهة»)
        this.container.querySelectorAll('.risk-field').forEach(input => {
            const evt = input.tagName === 'SELECT' ? 'change' : 'input';
            input.addEventListener(evt, (e) => this.updateRisk(e));
        });

        // Add risk
        this.container.querySelector('.btn-add-risk')?.addEventListener('click', () => this.addRisk());

        // Suggest risks
        this.container.querySelector('.btn-suggest-risk')?.addEventListener('click', () => this.handleSuggestRisks());

        // Inject sector risk pack (يظهر عند فراغ الجدول فقط)
        this.container.querySelector('.btn-inject-sector-risks')?.addEventListener('click', () => this.injectSectorPack());

        // Remove risk
        this.container.querySelectorAll('.btn-remove-risk').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeRisk(e));
        });
    }

    updateRisk(e) {
        const row = e.target.closest('tr');
        const idx = parseInt(row.dataset.idx);
        const field = e.target.dataset.field;
        // الأثر المالي رقم؛ بقية الحقول نصية
        const value = field === 'estimatedFinancialImpact' ? (Number(e.target.value) || 0) : e.target.value;

        const state = this.store.getState();
        const risks = [...(state.riskAnalysis?.risks || [])];

        if (risks[idx]) {
            risks[idx] = { ...risks[idx], [field]: value };
            this.store.update('riskAnalysis', { ...state.riskAnalysis, risks });
            // نعيد الرسم لحقول تغيّر المصفوفة/الدرجة/الترتيب/الإجمالي؛ الحقول النصية لا تُعاد كي لا يضيع التركيز أثناء الكتابة
            if (field === 'probability' || field === 'impact' || field === 'type') {
                this.render();
            }
        }
    }

    addRisk() {
        const state = this.store.getState();
        const risks = [...(state.riskAnalysis?.risks || [])];
        risks.push({
            name: '',
            type: 'operational',
            probability: 'medium',
            impact: 'medium',
            estimatedFinancialImpact: 0,
            timeHorizon: 'short',
            mitigation: '',
            residualRisk: 'medium',
            earlyWarning: '',
            owner: ''
        });
        this.store.update('riskAnalysis', { ...state.riskAnalysis, risks });
        this.render();
    }

    /**
     * حقن حزمة مخاطر قطاعية جاهزة للمطاعم/المقاهي عند فراغ الجدول.
     * كل خطر باحتمال/أثر نوعي (للمصفوفة) + أثر مالي مبدئي + خطر متبقٍ + مؤشر إنذار مبكر + أفق زمني.
     * الأرقام مبدئية إرشادية على المُعِدّ تعديلها وفق مشروعه.
     */
    injectSectorPack() {
        const state = this.store.getState();
        const existing = state.riskAnalysis?.risks || [];
        // لا نحقن إلا عند الفراغ حتى لا نُكرّر أو نطمس إدخال المستخدم
        if (existing.length > 0) return;

        const pack = [
            {
                name: 'تقلّب أسعار المدخلات (لحوم/دواجن/زيوت/خضار)',
                type: 'financial', probability: 'high', impact: 'high',
                estimatedFinancialImpact: 120000, timeHorizon: 'short',
                mitigation: 'عقود توريد بأسعار ثابتة أو مثبّتة جزئياً، تعدد الموردين، مراجعة قائمة الأسعار ربع سنوياً، وهندسة القائمة نحو أطباق أعلى هامشاً.',
                residualRisk: 'medium',
                earlyWarning: 'ارتفاع تكلفة المكوّنات في فاتورة الشراء الشهرية بأكثر من 8% أو انخفاض هامش المكوّن (Food Cost %) تحت المستهدف.',
                owner: 'مدير المشتريات/التشغيل'
            },
            {
                name: 'الموسمية وتذبذب الطلب (رمضان والصيف والإجازات)',
                type: 'market', probability: 'high', impact: 'medium',
                estimatedFinancialImpact: 80000, timeHorizon: 'short',
                mitigation: 'خطة تدفق نقدي موسمية، عروض رمضانية وعائلية، قائمة موسمية، وجدولة عمالة مرنة تقلّص التكلفة في مواسم الركود.',
                residualRisk: 'medium',
                earlyWarning: 'انخفاض متوسط المبيعات الأسبوعية عن المعدّل الموسمي المتوقّع، أو تراجع عدد الفواتير اليومية.',
                owner: 'مدير الفرع'
            },
            {
                name: 'الاعتماد على طبّاخ رئيسي أو موقع واحد',
                type: 'operational', probability: 'medium', impact: 'high',
                estimatedFinancialImpact: 150000, timeHorizon: 'medium',
                mitigation: 'توثيق الوصفات ومعايير التحضير (SOP)، تدريب طبّاخ بديل، وعقد إيجار مرن مع دراسة موقع بديل/فرع ثانٍ لتقليل تركّز المخاطر.',
                residualRisk: 'medium',
                earlyWarning: 'غياب/استقالة الطبّاخ الرئيسي، تذبذب جودة الأطباق، أو إشعار عدم تجديد عقد الموقع.',
                owner: 'المالك/الشيف التنفيذي'
            },
            {
                name: 'حملة تفتيش صحي أو مخالفة بلدية',
                type: 'legal', probability: 'medium', impact: 'high',
                estimatedFinancialImpact: 60000, timeHorizon: 'short',
                mitigation: 'الالتزام باشتراطات الأمن الغذائي والبلدية، سجلات نظافة وتتبّع، تدريب دوري على السلامة الغذائية، وتدقيق داخلي قبل الزيارات الرسمية.',
                residualRisk: 'low',
                earlyWarning: 'ملاحظات في التدقيق الداخلي، شكاوى عملاء متعلقة بالنظافة، أو قرب انتهاء الشهادات الصحية.',
                owner: 'مسؤول الجودة والسلامة'
            },
            {
                name: 'دخول منافس قوي أو علامة قريبة',
                type: 'market', probability: 'medium', impact: 'medium',
                estimatedFinancialImpact: 90000, timeHorizon: 'medium',
                mitigation: 'بناء ولاء العملاء عبر برنامج نقاط، تميّز في القائمة والتجربة، حضور رقمي قوي وتقييمات إيجابية، ومراقبة الأسعار والعروض حول الموقع.',
                residualRisk: 'medium',
                earlyWarning: 'افتتاح منافس ضمن نطاق قريب، تراجع حصة الطلبات على تطبيقات التوصيل، أو انخفاض معدّل عودة العملاء.',
                owner: 'مدير التسويق'
            },
            {
                name: 'ارتفاع الإيجار عند تجديد العقد',
                type: 'financial', probability: 'medium', impact: 'medium',
                estimatedFinancialImpact: 70000, timeHorizon: 'long',
                mitigation: 'التفاوض على عقد طويل بزيادة سنوية مسقوفة، بند إخلاء عادل، ودراسة مواقع بديلة مبكراً قبل انتهاء العقد لتحسين موقفك التفاوضي.',
                residualRisk: 'medium',
                earlyWarning: 'اقتراب موعد انتهاء العقد (< 6 أشهر) أو إشارات المالك لرفع الإيجار مقارنةً بأسعار السوق المجاورة.',
                owner: 'المالك/الإدارة'
            }
        ];

        this.store.update('riskAnalysis', { ...state.riskAnalysis, risks: pack });
        this.render();
    }

    removeRisk(e) {
        const idx = parseInt(e.target.dataset.idx);
        const state = this.store.getState();
        const risks = (state.riskAnalysis?.risks || []).filter((_, i) => i !== idx);
        this.store.update('riskAnalysis', { ...state.riskAnalysis, risks });
        this.render();
    }

    async handleSuggestRisks() {
        this.isGenerating = true;
        this.render();

        try {
            const state = this.store.getState();
            const projectInfo = state.projectInfo || {};

            const suggestions = await generateTableSuggestions('suggest_risks', projectInfo);

            if (suggestions && suggestions.length > 0) {
                const currentRisks = state.riskAnalysis?.risks || [];
                const newRisks = [...currentRisks, ...suggestions];
                this.store.update('riskAnalysis', {
                    ...state.riskAnalysis,
                    risks: newRisks
                });
            }
        } catch (error) {
            console.error('Failed to generate risks:', error);
            alert('حدث خطأ أثناء توليد الاقتراحات');
        } finally {
            this.isGenerating = false;
            this.render();
        }
    }
}

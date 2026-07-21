/**
 * Investor Dashboard (LivePlan Replication)
 * A professional, read-only view designed for screen sharing with investors or PDF export.
 * Focuses on: Market Opportunity, Team, Traction, and Financial Highlights.
 */
import { calculateStudy as runFullModel } from '../core/engine.js';
import { formatCurrency } from '../utils/formatters.js';
import { animateCounter } from '../utils/ui.js';
import { formatIrrPct } from '../utils/indicatorFormat.js';

/**
 * يهرّب الحروف الحساسة في HTML لمنع حقن السكربتات (XSS) عبر قيم يتحكم بها المستخدم.
 * تُستدعى على كل قيمة نصية قادمة من الحمولة (?data=) قبل حقنها في innerHTML.
 */
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export class InvestorDashboard {
    constructor(containerId, store, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onExit = options.onExit || (() => { });
        // وضع مستقل: صفحة investor.html تُغذّى بحمولة جاهزة (payload) لا بمخزن حيّ (store)
        this.standalone = !!options.standalone;
    }

    /** يبني كائن العرض من المخزن الحيّ (داخل التطبيق). */
    _buildDataFromStore() {
        const state = this.store.getState();
        const project = state.projectInfo || {};
        let financialResults = {};
        try { financialResults = runFullModel(state) || {}; } catch (e) { financialResults = {}; }
        return this._normalizeData({
            name: project.name,
            concept: project.concept,
            city: project.city,
            description: project.description || state.executiveSummary?.projectOverview,
            uvp: state.executiveSummary?.uniqueValueProposition,
            problem: state.executiveSummary?.problemStatement || project.startupHypothesis?.problem,
            solution: project.startupHypothesis?.solution,
            insight: project.startupHypothesis?.insight,
            market: state.marketSizing || {},
            // تدقيق 2026-07-08 (ملاحظة حرجة محتوى): state.keyPeople كائن {keyPeople:[],
            // partnershipContracts:[]} حسب schema.js، لا مصفوفة مباشرة — كان يُفرغ قسم
            // الفريق دائماً في عرض المستثمر (Array.isArray عليه = false دوماً).
            team: state.keyPeople?.keyPeople || [],
            financing: state.financing || {},
            indicators: financialResults.indicators || {},
            partnerNeeds: financialResults.partnerNeeds || []
        });
    }

    /** يملأ القيم الناقصة بقيم آمنة كي لا ينهار العرض عند حمولة جزئية. */
    _normalizeData(d = {}) {
        return {
            name: d.name || 'مشروع جديد',
            concept: d.concept || '',
            city: d.city || '',
            description: d.description || '',
            uvp: d.uvp || 'فرصة استثمارية واعدة.',
            problem: d.problem || '',
            solution: d.solution || '',
            insight: d.insight || '',
            market: d.market || {},
            team: Array.isArray(d.team) ? d.team : [],
            financing: d.financing || {},
            indicators: d.indicators || {},
            partnerNeeds: Array.isArray(d.partnerNeeds) ? d.partnerNeeds : []
        };
    }

    /** حالة فارغة واضحة بدل صفحة بيضاء عند غياب بيانات العرض. */
    _renderEmptyState() {
        return `
            <div class="investor-dashboard text-right p-8" dir="rtl" style="min-height:100vh;display:flex;align-items:center;justify-content:center;">
                <div class="text-center max-w-md">
                    <div class="text-5xl mb-4"><svg class="ic" aria-hidden="true"><use href="#i-folder"/></svg></div>
                    <h1 class="text-2xl font-bold text-white mb-3">لا توجد بيانات عرض</h1>
                    <p class="text-muted">هذا الرابط لا يحتوي على ملخص دراسة صالح، أو انتهت صلاحيته على هذا الجهاز. أنشئ رابط «عرض المستثمر» من داخل الدراسة ثم افتحه.</p>
                </div>
            </div>`;
    }

    /**
     * @param {Object|null} payload حمولة جاهزة (من buildPitchPayload). إن غابت، يُبنى العرض من المخزن.
     */
    render(payload = null) {
        if (!this.container) return;
        let data;
        if (payload && typeof payload === 'object') {
            data = this._normalizeData(payload);
        } else if (this.store && typeof this.store.getState === 'function') {
            data = this._buildDataFromStore();
        } else {
            this.container.innerHTML = this._renderEmptyState();
            return;
        }

        this.container.innerHTML = `
            <div class="investor-dashboard animate-entry text-right bg-bg-app min-h-screen p-8" dir="rtl">
                <!-- Header / Navigation -->
                <div class="flex justify-between items-center mb-12 pb-4 border-b border-white/10 no-print max-w-6xl mx-auto">
                    <h1 class="text-xl font-bold text-gold flex items-center gap-2">
                        <svg class="ic" aria-hidden="true"><use href="#i-users"/></svg> عرض المستثمرين
                    </h1>
                    <div class="flex gap-2">
                        <button id="btnInvPrint" class="btn btn--secondary btn--sm"><svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg> طباعة / PDF</button>
                        ${this.standalone ? '' : '<button id="btnInvExit" class="btn btn--ghost btn--sm text-danger">إغلاق</button>'}
                    </div>
                </div>

                <!-- Main Content Grid -->
                <div class="max-w-5xl mx-auto space-y-16">
                
                    <!-- 1. Hero Section -->
                    <div class="text-center space-y-6">
                        <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary shadow-lg mb-4">
                            <svg class="ic text-4xl text-white" aria-hidden="true"><use href="#i-rocket"/></svg>
                        </div>
                        <h1 class="text-5xl font-black text-white leading-tight tracking-tight">${escapeHtml(data.name)}</h1>
                        <p class="text-2xl text-muted font-light max-w-3xl mx-auto">
                            ${data.concept ? `مشروع في قطاع ${escapeHtml(data.concept)}` : ''}
                            ${data.city ? `• ${escapeHtml(data.city)}` : ''}
                        </p>
                        <div class="mt-8 p-8 bg-white/5 rounded-2xl border-r-4 border-gold text-xl italic text-gold/90 max-w-3xl mx-auto leading-relaxed shadow-sm">
                            "${escapeHtml(data.description || data.uvp)}"
                        </div>
                    </div>

                    <!-- 2. The Opportunity (Market) -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                        <div class="space-y-6">
                            <h2 class="text-3xl font-bold border-b border-white/10 pb-4 text-white">الفرصة السوقية</h2>
                            <div class="prose prose-invert max-w-none text-muted leading-relaxed">
                                <p class="text-lg mb-4"><strong>المشكلة:</strong> ${escapeHtml(data.problem) || 'لم يتم تحديد المشكلة بعد.'}</p>
                                <p class="text-lg"><strong>الحل:</strong> ${escapeHtml(data.solution) || 'لم يتم تحديد الحل المقترح.'}</p>
                            </div>
                            
                            ${data.market.tam?.value ? `
                            <div class="flex flex-wrap gap-6 mt-8 p-6 bg-white/5 rounded-xl border border-white/5">
                                ${this.renderMarketBadge(data.market.tam?.value, 'TAM', 'إجمالي السوق')}
                                ${this.renderMarketBadge(data.market.sam?.value, 'SAM', 'السوق المتاح')}
                                ${this.renderMarketBadge(data.market.som?.value, 'SOM', 'سوقنا المستهدف')}
                            </div>
                            ` : '<div class="p-4 bg-white/5 rounded text-sm text-muted">أضف بيانات حجم السوق لتعزيز هذا القسم.</div>'}
                        </div>
                        
                        <div class="bg-gradient-to-br from-white/5 to-white/0 p-8 rounded-3xl border border-white/10 shadow-lg">
                             <h3 class="text-xl font-bold mb-6 text-gold">لماذا الآن؟ (Why Now)</h3>
                             <ul class="space-y-4">
                                <li class="flex items-start gap-4">
                                    <div class="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success flex-shrink-0">✓</div>
                                    <div>
                                        <div class="font-bold text-white">الدافع السوقي</div>
                                        <div class="text-sm text-muted mt-1">${escapeHtml(data.insight) || 'فجوة سوقية واضحة ونمو متسارع.'}</div>
                                    </div>
                                </li>
                                <li class="flex items-start gap-4">
                                    <div class="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success flex-shrink-0">✓</div>
                                    <div>
                                        <div class="font-bold text-white">الميزة التنافسية</div>
                                        <div class="text-sm text-muted mt-1">${escapeHtml(data.uvp)}</div>
                                    </div>
                                </li>
                             </ul>
                        </div>
                    </div>

                    <!-- 3. Financial Highlights -->
                    <div>
                        <div class="flex items-center justify-between border-b border-white/10 pb-6 mb-8">
                            <h2 class="text-3xl font-bold text-white">الأداء المالي المتوقع</h2>
                            <span class="text-sm text-muted bg-white/5 px-3 py-1 rounded-full">توقعات 5 سنوات</span>
                        </div>
                        
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            ${this.renderMetricCard('إجمالي الاستثمار', formatCurrency(data.financing.totalInvestment || 0), '<svg class="ic" aria-hidden="true"><use href="#i-bank"/></svg>')}
                            ${this.renderMetricCard('صافي القيمة الحالية (NPV)', formatCurrency(data.indicators.npv || 0), '<svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg>', (data.indicators.npv || 0) > 0)}
                            ${this.renderMetricCard('معدل العائد (IRR)', formatIrrPct(data.indicators.irr), '<svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg>')}
                            ${this.renderMetricCard('فترة الاسترداد', (data.indicators.paybackPeriod || '—') + ' سنة', '<svg class="ic" aria-hidden="true"><use href="#i-clock"/></svg>')}
                        </div>
                    </div>

                    <!-- 4. Team & Ask -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div class="md:col-span-2 space-y-6">
                            <h2 class="text-2xl font-bold text-white">فريق العمل</h2>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                ${(data.team).slice(0, 4).map(p => `
                                    <div class="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center gap-4 hover:bg-white/10 transition-colors">
                                        <div class="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl text-primary border border-primary/30">
                                            ${p.name ? escapeHtml(String(p.name).charAt(0)) : '<svg class="ic" aria-hidden="true"><use href="#i-user"/></svg>'}
                                        </div>
                                        <div>
                                            <div class="font-bold text-white">${escapeHtml(p.name) || 'عضو فريق'}</div>
                                            <div class="text-xs text-muted">${escapeHtml(p.role) || 'دور قيادي'}</div>
                                        </div>
                                    </div>
                                `).join('') || '<div class="text-muted italic">لم يتم إضافة أعضاء الفريق بعد.</div>'}
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-br from-primary/20 to-secondary/20 p-8 rounded-3xl border border-primary/30 text-center flex flex-col justify-center shadow-xl relative overflow-hidden group">
                            <div class="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <h3 class="text-xl font-bold mb-4 text-white relative z-10">المطلوب للتمويل</h3>
                            <div class="text-5xl font-black text-gold mb-4 relative z-10 tracking-tight">
                                ${escapeHtml(this.formatShortCurrency(data.financing.loanAmount || data.financing.totalInvestment || 0))}
                            </div>
                            <p class="text-sm text-muted relative z-10 bg-black/20 inline-block mx-auto px-3 py-1 rounded-full">
                                مقابل ${data.financing.loanAmount ? 'قرض / تمويل' : 'حصة استثمارية'}
                            </p>
                            ${(() => {
                                const need = (data.partnerNeeds || []).find(n => n.type === 'financial_equity');
                                return need ? `<p class="text-xs text-muted relative z-10 mt-3">${escapeHtml(need.reason)}</p>` : '';
                            })()}
                        </div>
                    </div>

                </div>
                
                <!-- Footer -->
                <div class="mt-20 pt-8 border-t border-white/10 text-center text-muted text-sm pb-8 flex flex-col items-center gap-2">
                    <span class="font-mono text-xs opacity-50">CONFIDENTIAL</span>
                    <span>تم إعداد هذا العرض بواسطة منصة محاكي الجدوى © ${new Date().getFullYear()}</span>
                </div>
            </div>
        `;

        this.bindEvents();
        this.animateMetrics();
    }

    renderMarketBadge(value, label, subLabel) {
        if (!value) return '';
        return `
            <div class="text-center min-w-[100px]">
                <div class="text-3xl font-bold text-white mb-1 tracking-tight">${escapeHtml(this.formatLargeNumber(value))}</div>
                <div class="text-xs font-bold text-gold uppercase tracking-wider">${escapeHtml(label)}</div>
                <div class="text-[10px] text-muted mt-1">${escapeHtml(subLabel)}</div>
            </div>
        `;
    }

    renderMetricCard(label, value, icon, isPositive = true) {
        return `
            <div class="bg-white/5 p-6 rounded-2xl border border-white/5 hover:bg-white/10 transition-all hover:-translate-y-1 shadow-sm text-center group">
                <div class="text-4xl mb-4 opacity-80 group-hover:scale-110 transition-transform duration-300">${icon}</div>
                <div class="text-2xl font-bold mb-2 ${isPositive ? 'text-white' : 'text-danger'} metric-value">${escapeHtml(value)}</div>
                <div class="text-xs text-muted font-medium">${escapeHtml(label)}</div>
            </div>
        `;
    }

    formatLargeNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(1) + ' مليار';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + ' مليون';
        if (num >= 1000) return (num / 1000).toFixed(0) + ' ألف';
        return num;
    }

    formatShortCurrency(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + ' مليون ريال';
        return formatCurrency(n);
    }

    bindEvents() {
        this.container.querySelector('#btnInvExit')?.addEventListener('click', () => {
            // Clean up and exit
            this.container.innerHTML = ''; // or handle higher level unmount
            this.onExit();
        });
        this.container.querySelector('#btnInvPrint')?.addEventListener('click', () => {
            window.print();
        });
    }

    animateMetrics() {
        // Simple animation hook
        const elements = this.container.querySelectorAll('.metric-value');
        elements.forEach(el => {
            el.classList.add('animate-pulse-slow'); // Placeholder for now or use utils
        });
    }
}

// ─── مشاركة عرض المستثمر (رابط للقراءة فقط) ───────────────────────────────
const PITCH_STORAGE_PREFIX = 'qarar_pitch_';

/**
 * يبني حمولة عرض مستثمر مكتفية بذاتها من حالة الدراسة ونتائجها.
 * تُخزَّن في localStorage (رابط token) أو تُرمَّز base64 في الرابط (data) لعرضها في investor.html.
 * @returns {Object|null}
 */
export function buildPitchPayload(state, results) {
    if (!state || typeof state !== 'object') return null;
    const project = state.projectInfo || {};
    const indicators = (results && results.indicators) || {};
    const financing = state.financing || {};
    return {
        v: 1,
        name: project.name || 'مشروع جديد',
        concept: project.concept || '',
        city: project.city || '',
        description: project.description || state.executiveSummary?.projectOverview || '',
        uvp: state.executiveSummary?.uniqueValueProposition || '',
        problem: state.executiveSummary?.problemStatement || project.startupHypothesis?.problem || '',
        solution: project.startupHypothesis?.solution || '',
        insight: project.startupHypothesis?.insight || '',
        market: state.marketSizing || {},
        team: Array.isArray(state.keyPeople?.keyPeople)
            ? state.keyPeople.keyPeople.slice(0, 6).map(p => ({ name: p?.name || '', role: p?.role || '' }))
            : [],
        financing: {
            totalInvestment: financing.totalInvestment || 0,
            loanAmount: financing.loanAmount || 0
        },
        indicators: {
            npv: indicators.npv || 0,
            irr: indicators.irr ?? null,
            paybackPeriod: indicators.paybackPeriod ?? null
        },
        partnerNeeds: (results && results.partnerNeeds) || []
    };
}

/** يحفظ حمولة العرض تحت token في localStorage. @returns {boolean} */
export function savePitchToStorage(token, payload) {
    try {
        if (!token || !payload) return false;
        localStorage.setItem(PITCH_STORAGE_PREFIX + token, JSON.stringify(payload));
        return true;
    } catch (e) {
        console.warn('savePitchToStorage:', e);
        return false;
    }
}

/** يقرأ حمولة العرض المخزّنة تحت token (نفس المتصفح/الجهاز). @returns {Object|null} */
export function getPitchFromStorage(token) {
    try {
        if (!token) return null;
        const raw = localStorage.getItem(PITCH_STORAGE_PREFIX + token);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn('getPitchFromStorage:', e);
        return null;
    }
}

/**
 * Investor Share View
 * A read-only, premium "Pitch Deck" style view for sharing with stakeholders.
 * Hides editing controls, focuses on "The Story" (Problem -> Solution -> Market -> Financials).
 *
 * تدقيق 2026-07-14: كان render(projectId) يتجاهل المعامل كلياً ويعرض حالة
 * المتصفح الحالية (this.store.getState()) — أي رابط مشاركة لا يُظهر فعلياً
 * دراسة الطرف الآخر. الآن يُعامَل المعامل كرمز مشاركة فعلي (share_token) عبر
 * ShareService.getSharedStudy، بصلاحية 'view' فقط (انظر migration
 * 20260714020000_share_tokens.sql).
 */
import { generateExecutiveSummary } from '../services/InternalAIGenerator.js'; // Re-use summary logic
import { getSharedStudy, recordShareView } from '../services/ShareService.js';
import { toast } from '../utils/toast.js';
import { getOfficialIndicators } from '../core/resultContract.js';
import { escapeHtml } from '../utils/escape.js';
import { trackEvent } from '../utils/analytics.js';
import { renderEngineVersionNotice } from '../utils/engineVersionNotice.js';

export class ShareView {
    constructor(containerId, store, onNavigate) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onNavigate = onNavigate;
    }

    async render(shareToken) {
        const shared = shareToken ? await getSharedStudy(shareToken) : null;
        if (!shared) {
            this._renderInvalidLink();
            return;
        }
        // مرة واحدة لكل تحميل صفحة (لا لكل تفاعل لاحق) — نمط DocSend لتتبّع "فُتح X مرة".
        recordShareView(shareToken);
        trackEvent('share_view', { view_mode: 'investor', hide_sensitive: !!shared.hide_sensitive });
        this._shareToken = shareToken;
        this._hideSensitive = shared.hide_sensitive;

        const state = shared.data || {};
        const pi = state.projectInfo || {};
        const revenue = state.revenue || {};
        const costs = state.costs || {};
        const engineResults = state.engineResults || {};
        const indicators = getOfficialIndicators(engineResults, { allowLegacy: true });

        // Generate Executive Summary if missing
        const execSummary = generateExecutiveSummary(state, engineResults);

        // بند 4 (بانر إصدار المحرك، 2026-08-29): أعلى أولوية بين الأسطح المضافة — من يفتح
        // رابط المشاركة (بنك/مستثمر) لا يملك وصولاً لـProjectOverviewView أصلاً، فبلا هذا
        // كان لا توجد أي وسيلة تُعلمه أن الأرقام قد تكون تغيّرت منذ إنشاء صاحب الدراسة لهذا
        // الرابط. يُدرَج داخل قسم الغلاف (z-10) لا قبل شريط التنقّل الثابت (fixed)، وإلا
        // اختفى جزء منه تحت الشريط في أعلى الصفحة.
        const engineNotice = renderEngineVersionNotice(state);

        this.container.innerHTML = `
            <div class="share-view bg-gray-50 min-h-screen font-sans">
                <!-- Header / Navigation -->
                <div class="fixed top-0 w-full bg-white/90 backdrop-blur-md shadow-sm z-50 px-6 py-3 flex justify-between items-center print:hidden">
                    <div class="flex items-center gap-2">
                        <svg class="ic text-2xl" aria-hidden="true"><use href="#i-rocket"/></svg>
                        <h1 class="font-bold text-lg text-gray-800">${escapeHtml(pi.name || 'مشروع جديد')} <span class="text-xs text-muted font-normal px-2 py-1 bg-gray-100 rounded-full">Investor Mode</span></h1>
                    </div>
                    <div class="flex gap-3">
                        <button id="btnExitShare" class="btn btn--sm btn--ghost text-gray-600">خروج</button>
                        <button id="btnPrintShare" class="btn btn--sm btn--primary"><svg class="ic" aria-hidden="true"><use href="#i-doc"/></svg> طباعة / PDF</button>
                    </div>
                </div>

                <!-- Hero Section (Cover Slide) -->
                <header class="min-h-[80vh] flex flex-col justify-center items-center text-center p-10 share-hero relative overflow-hidden">
                    <!-- نقش زخرفي مضمّن (data-URI) بدل طلب خارجي — أسرع وأأمن (يسمح بتضييق CSP img-src) -->
                    <div class="absolute inset-0 opacity-10" style="background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 20h40M20 0v40' stroke='%23ffffff' stroke-width='1' opacity='0.5'/%3E%3C/svg%3E&quot;);"></div>
                    <div class="z-10 max-w-4xl animate-fade-in-up">
                        ${engineNotice}
                        <h1 class="text-6xl font-bold mb-6 share-hero__title">${escapeHtml(pi.name || 'مشروع جديد')}</h1>
                        <p class="text-2xl font-light mb-8 share-hero__subtitle">${escapeHtml(pi.concept || 'فكرة المشروع')}</p>
                        <div class="inline-block share-hero__divider pt-8 mt-4">
                            <p class="text-lg share-hero__location">${escapeHtml(pi.city || 'المدينة المستهدفة')}</p>
                        </div>
                    </div>
                </header>

                <!-- Section 1: The Opportunity (Problem & Solution) -->
                <section class="py-20 px-6 max-w-5xl mx-auto">
                    <div class="grid md:grid-cols-2 gap-12 items-center">
                        <div class="p-8 bg-white rounded-3xl shadow-xl border border-gray-100 hover:-translate-y-2 transition-transform duration-500">
                            <svg class="ic text-4xl mb-4" aria-hidden="true"><use href="#i-warning"/></svg>
                            <h2 class="text-2xl font-bold mb-4 text-red-500">المشكلة</h2>
                            <p class="text-lg text-gray-600 leading-relaxed">
                                ${escapeHtml(pi.startupHypothesis?.problem || 'لم يتم تحديد المشكلة بالتفصيل.')}
                            </p>
                        </div>
                        <div class="p-8 bg-white rounded-3xl shadow-xl border border-gray-100 hover:-translate-y-2 transition-transform duration-500 delay-100">
                            <svg class="ic text-4xl mb-4" aria-hidden="true"><use href="#i-lightbulb"/></svg>
                            <h2 class="text-2xl font-bold mb-4 text-green-500">الحل المقترح</h2>
                            <p class="text-lg text-gray-600 leading-relaxed">
                                ${escapeHtml(pi.startupHypothesis?.solution || 'لم يتم تحديد الحل بالتفصيل.')}
                            </p>
                            <div class="mt-4 pt-4 border-t border-gray-100">
                                <strong class="text-sm text-gray-400">السر الخاص (Unfair Advantage):</strong>
                                <p class="text-sm text-gray-600 mt-1">${escapeHtml(pi.unfairAdvantage?.insightText || pi.startupHypothesis?.insight || 'غير محدد')}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Section 2: Market Snapshot -->
                <section class="py-20 bg-white shadow-inner">
                    <div class="max-w-6xl mx-auto px-6">
                        <h2 class="section-title text-center mb-16 relative">
                            <span class="relative z-10 bg-white px-4 text-3xl font-bold text-gray-800">حجم السوق والفرصة</span>
                            <div class="absolute top-1/2 left-0 w-full h-px bg-gray-200 -z-0"></div>
                        </h2>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                            <div class="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                                <div class="text-sm text-gray-400 uppercase tracking-widest mb-2">TAM (السوق الكلي)</div>
                                <div class="text-3xl font-bold text-gray-800 mb-2">${state.marketSizing?.tam ? Number(state.marketSizing.tam).toLocaleString() : '-'}</div>
                                <p class="text-xs text-gray-500">ريال/سنة</p>
                            </div>
                            <div class="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                                <div class="text-sm text-gray-400 uppercase tracking-widest mb-2">SAM (السوق المتاح)</div>
                                <div class="text-3xl font-bold text-gray-800 mb-2">${state.marketSizing?.sam ? Number(state.marketSizing.sam).toLocaleString() : '-'}</div>
                                <p class="text-xs text-gray-500">ريال/سنة</p>
                            </div>
                            <div class="p-6 rounded-2xl bg-gold/10 border border-gold/30 relative overflow-hidden">
                                <div class="absolute top-0 right-0 bg-gold text-invert text-[10px] px-2 py-1 rounded-bl-lg">مستهدف</div>
                                <div class="text-sm text-gold uppercase tracking-widest mb-2">SOM (حصتنا)</div>
                                <div class="text-4xl font-bold text-gold mb-2">${state.marketSizing?.som ? Number(state.marketSizing.som).toLocaleString() : '-'}</div>
                                <p class="text-xs text-gold/80">ريال/سنة</p>
                            </div>
                        </div>

                        <div class="mt-12 p-8 bg-gray-50 rounded-2xl border-l-4 border-gold">
                            <h3 class="font-bold text-lg mb-2">ملخص استراتيجي</h3>
                            <p class="text-gray-600 leading-relaxed">${escapeHtml(execSummary.split('\n')[0])}</p>
                        </div>
                    </div>
                </section>

                <!-- Section 3: Financial Highlights (The "Ask") -->
                <section class="py-20 px-6 max-w-5xl mx-auto">
                    <h2 class="section-title text-center mb-12 text-3xl font-bold text-gray-800">المؤشرات المالية (5 سنوات)</h2>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                        <div class="kpi-card text-center p-6 bg-white rounded-2xl shadow-lg border-b-4 border-blue-500">
                            <div class="text-gray-400 text-xs mb-1">صافي القيمة الحالية (NPV)</div>
                            <div class="text-xl font-bold text-blue-600">${this.formatMoney(indicators.npv)}</div>
                        </div>
                        <div class="kpi-card text-center p-6 bg-white rounded-2xl shadow-lg border-b-4 border-green-500">
                            <div class="text-gray-400 text-xs mb-1">العائد الداخلي (IRR)</div>
                            <div class="text-xl font-bold text-green-600">${this.formatPercent(indicators.irr)}</div>
                        </div>
                        <div class="kpi-card text-center p-6 bg-white rounded-2xl shadow-lg border-b-4 border-purple-500">
                            <div class="text-gray-400 text-xs mb-1">فترة الاسترداد</div>
                            <div class="text-xl font-bold text-purple-600">${this.formatYears(indicators.paybackPeriod)}</div>
                        </div>
                        <div class="kpi-card text-center p-6 bg-white rounded-2xl shadow-lg border-b-4 border-orange-500">
                            <div class="text-gray-400 text-xs mb-1">هامش الربح (السنة 1)</div>
                            <div class="text-xl font-bold text-orange-600">${this.formatPercent(indicators.profitMargin)}</div>
                        </div>
                    </div>

                    <div class="text-center mt-12 print:hidden">
                         <div class="inline-block p-1 rounded-full bg-gray-100">
                            <span class="px-6 py-2 rounded-full bg-white shadow text-sm font-medium text-gray-500">تم إعداد هذه الدراسة عبر منصة الجدوى</span>
                         </div>
                         <div class="mt-6">
                            <button type="button" id="btnTryFreeReferral" class="btn btn--primary">جرّب قرار مجاناً لمشروعك الخاص</button>
                         </div>
                    </div>
                </section>
            </div>
        `;

        this.bindEvents();
    }

    _renderInvalidLink() {
        this.container.innerHTML = `
            <div class="share-view-invalid" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;">
                <h1 style="font-size:1.5rem;margin-bottom:12px;">هذا الرابط غير صالح أو منتهي</h1>
                <p style="color:var(--c-text-muted,#94a3b8);margin-bottom:20px;">قد يكون صاحب الدراسة ألغى المشاركة، أو انتهت صلاحية الرابط.</p>
                <a href="./" class="btn btn--primary">الذهاب للصفحة الرئيسية</a>
            </div>
        `;
    }

    formatMoney(value) {
        if (this._hideSensitive) return 'مخفي';
        const n = Number(value);
        if (!Number.isFinite(n)) return '-';
        return Math.round(n).toLocaleString();
    }

    formatPercent(value) {
        if (this._hideSensitive) return 'مخفي';
        const n = Number(value);
        if (!Number.isFinite(n)) return '-';
        const percent = Math.abs(n) <= 1 ? n * 100 : n;
        return `${percent.toFixed(1)}%`;
    }

    formatYears(value) {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return '-';
        return `${n.toFixed(1)} سنوات`;
    }

    bindEvents() {
        this.container.querySelector('#btnExitShare')?.addEventListener('click', () => {
            // Navigate back to dashboard or project view
            window.location.hash = '';
            window.location.reload(); // Simple reload to clear "Share Mode" visually
        });

        this.container.querySelector('#btnPrintShare')?.addEventListener('click', () => {
            trackEvent('share_print', { view_mode: 'investor' });
            window.print();
        });

        // حلقة نمو: يحمل توكن المشاركة كمعامل ?ref= — app.js يلتقطه عند التحميل الكامل
        // ويحفظه لإرفاقه لاحقاً بأول تسجيل حساب فعلي (AuthModalStub.js → signUp()).
        this.container.querySelector('#btnTryFreeReferral')?.addEventListener('click', () => {
            trackEvent('share_referral_click', { view_mode: 'investor' });
            const url = new URL(window.location.href);
            url.hash = '';
            if (this._shareToken) url.searchParams.set('ref', this._shareToken);
            window.location.href = url.toString();
        });
    }
}

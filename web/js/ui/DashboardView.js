import { ProjectManager } from '../services/ProjectManager.js';
import { createEmptyStudy } from '../core/schema.js';
import { getAuthUser, signOut } from '../../supabaseClient.js';
import { toast } from '../utils/toast.js';
import { PLATFORM_STATS, TRIAL_OR_REFUND_TEXT, TRUST_TAGLINE, PRICING_DISPLAY } from '../config.js';
import { RefundPolicyModal } from './RefundPolicyModal.js';
import { QualityCalculator } from '../utils/QualityCalculator.js';
import { IdeaScoreGauge } from './widgets/IdeaScoreGauge.js';
import { FundingSimulator } from './widgets/FundingSimulator.js';
import { FounderCardGenerator } from './widgets/FounderCardGenerator.js';
import { SensitivityWidget } from './widgets/SensitivityWidget.js';
import { SampleReportModal } from './SampleReportModal.js';

const FOLDERS_STORAGE_KEY = 'feas_folders';

import { ResourcesMenu } from './widgets/ResourcesMenu.js';

export class DashboardView {
    constructor(containerId, store, onProjectSelect, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onProjectSelect = onProjectSelect;
        this.selectedFolderId = null;
        this.searchQuery = '';
        this.options = options;
        Object.assign(this, options); // for template: this.onShowX, this.onStartQuickFeasibility, etc.
        this.currentUser = null;
    }

    async render() {
        this.container.innerHTML = `
            <div class="dashboard-loading flex flex-col items-center justify-center h-64">
                <div class="loader mb-4"></div>
                <div class="text-muted">جاري تحميل المشاريع...</div>
            </div>
        `;

        try {
            // Check Auth
            const { user } = await getAuthUser();
            this.currentUser = user;

            const projects = await ProjectManager.getActiveProjects();
            this.renderList(projects);
        } catch (e) {
            console.error(e);
            this.container.innerHTML = `
                <div class="text-center text-danger p-8">
                    حدث خطأ أثناء تحميل البيانات. <br>
                    <button class="btn btn--secondary mt-4" onclick="window.location.reload()">إعادة المحاولة</button>
                </div>
            `;
        }
    }

    static getFolders() {
        try {
            return JSON.parse(localStorage.getItem(FOLDERS_STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    }

    static setFolders(folders) {
        localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
    }

    async renderList(projects) {
        const folders = DashboardView.getFolders();
        let filtered = this.selectedFolderId == null
            ? (projects || [])
            : (projects || []).filter(p => (p.folderId || null) === this.selectedFolderId);
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(q));
        }

        this.lastRenderedProjects = filtered; // Cache for event handlers

        const hasProjects = filtered.length > 0;
        const userEmail = this.currentUser ? this.currentUser.email : null;

        const folderOptions = [
            '<option value="">جميع المشاريع</option>',
            ...folders.map(f => `<option value="${f.id}" ${this.selectedFolderId === f.id ? 'selected' : ''}>${f.name}</option>`)
        ].join('');

        this.container.innerHTML = `
            <div class="dashboard-view animate-entry p-6 max-w-6xl mx-auto">
                <!-- 1. Header & Actions Row -->
                <div class="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                    <!-- Title & User -->
                    <div>
                        <h1 class="text-2xl font-bold mb-1">مكتبة دراسات الجدوى</h1>
                        <div class="flex items-center gap-3 text-sm text-muted">
                            ${userEmail ? `<span class="text-gold">مرحباً، ${userEmail} 👋</span>` : 'سجل الدخول لحفظ مشاريعك.'}
                            <span class="text-gray-600">|</span>
                            <!-- Resource Menu Anchor -->
                            <div id="resources-menu-root" class="relative inline-block"></div>
                        </div>
                    </div>

                    <!-- Idea Score Gauge (Hidden on mobile) -->
                    <div id="idea-score-gauge-root" class="hidden md:block"></div>
                    
                    <!-- Primary Actions -->
                    <div class="flex gap-3 flex-wrap opacity-90 hover:opacity-100 transition-opacity">
                        ${!this.currentUser ? `
                            <button id="btnLogin" class="btn btn--sm btn--secondary flex items-center gap-2">☁️ دخول</button>
                        ` : `
                            <button id="btnLogout" class="btn btn--secondary btn--sm text-danger border-danger/20 hover:bg-danger/10">خروج</button>
                        `}
                        <button id="btnRunDemo" class="btn btn--sm btn--secondary flex items-center gap-2">⚡ تجربة</button>
                        <button id="btnFundingSim" class="btn btn--sm btn--primary flex items-center gap-2">🏦 فحص التمويل</button>
                    </div>
                </div>

                <!-- 2. Quality Strip (Gamification) -->
                 ${this.renderQualityStrip(filtered)}

                <!-- 3. Strategic Hybrid Flow (Three Cards: ابدأ + عينة تقرير) -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto mb-10">
                    <!-- Card 1: Flash Feasibility -->
                    <div id="cardQuickFeasibility" role="button" tabindex="0" class="cursor-pointer group relative overflow-hidden rounded-xl border border-gold/40 bg-gradient-to-br from-gold/10 to-transparent hover:from-gold/20 hover:border-gold transition-all duration-300 p-6 text-center shadow-lg hover:shadow-gold/10 transform hover:-translate-y-1">
                        <div class="absolute top-0 right-0 w-16 h-16 bg-gold/10 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:bg-gold/20"></div>
                        <div class="text-4xl mb-3 group-hover:scale-110 transition-transform filter drop-shadow-md">⚡</div>
                        <h3 class="text-xl font-bold text-gold mb-1">جدوى سريعة</h3>
                        <p class="text-xs text-gold/80 mb-0">لمحة أولية لقرارك.. في 3 خطوات</p>
                    </div>

                    <!-- Card 2: Full Professional Study -->
                    <div id="cardFullStudy" role="button" tabindex="0" class="cursor-pointer group relative overflow-hidden rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 transition-all duration-300 p-6 text-center transform hover:-translate-y-1">
                        <div class="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:bg-white/10"></div>
                        <div class="text-4xl mb-3 group-hover:scale-110 transition-transform filter grayscale group-hover:grayscale-0">💼</div>
                        <h3 class="text-xl font-bold text-white mb-1">دراسة احترافية</h3>
                        <p class="text-xs text-muted mb-0 group-hover:text-white/80 transition-colors">شاملة وتفصيلية (مناسبة للتمويل)</p>
                    </div>

                    <!-- Card 3: عينة تقرير (المهمة 1 — خطة التفوق) -->
                    <div id="cardSampleReport" role="button" tabindex="0" class="cursor-pointer group relative overflow-hidden rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 hover:border-gold/40 transition-all duration-300 p-6 text-center transform hover:-translate-y-1" aria-label="اطلع على عينة تقرير">
                        <div class="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:bg-gold/10"></div>
                        <div class="text-4xl mb-3 group-hover:scale-110 transition-transform filter opacity-80 group-hover:opacity-100">📄</div>
                        <h3 class="text-xl font-bold text-white mb-1">عينة تقرير</h3>
                        <p class="text-xs text-muted mb-0 group-hover:text-white/80 transition-colors">اطلع على الجودة قبل البدء</p>
                    </div>
                </div>

                <!-- 3.5 New Row: Startup Hypothesis (Gap Filling) -->
                <div class="mb-8">
                     <h3 class="text-lg font-bold mb-4 px-2 border-r-4 border-purple-500" style="color: var(--c-text-main)">مختبر الأفكار (Startup Lab)</h3>
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Hypothesis Card -->
                        <div id="cardHypothesis" role="button" tabindex="0" class="cursor-pointer group relative overflow-hidden rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 transition-all duration-300 p-6 flex flex-row items-center gap-4">
                            <div class="text-4xl group-hover:scale-110 transition-transform">🚀</div>
                            <div>
                                <h3 class="text-xl font-bold text-purple-900 mb-1">فرضية الستارت آب (YC)</h3>
                                <p class="text-xs text-purple-700 mb-0">هل فكرتك "فكرة مليار"؟ قيّم المشكلة، الحل، والميزة التنافسية.</p>
                            </div>
                            <div class="mr-auto text-purple-300 group-hover:text-purple-600 transition-colors">➜</div>
                        </div>
                     </div>
                </div>

                <!-- 4. Slim Promo Strip (توقعات + سياسة استرداد — المهمة 2) -->
                <div class="mb-10 p-3 rounded-lg flex flex-wrap items-center justify-between gap-4 text-sm bg-gradient-to-r from-gold/5 to-transparent border border-gold/20">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-lg">💎</span>
                        <span class="text-gold font-bold">${PRICING_DISPLAY?.startPrice || 'ابدأ مجاناً'}</span>
                        <span class="text-muted">– توقعات 5 سنوات، تحليل حساسية، وتصدير كامل.</span>
                        ${TRIAL_OR_REFUND_TEXT ? `<button id="btnRefundPolicy" class="text-xs hover:text-gold underline decoration-dotted transition-colors text-gold/90" title="${TRIAL_OR_REFUND_TEXT}">🛡️ ضمان استرداد خلال 15 يوم</button>` : ''}
                    </div>
                    <div class="flex gap-3">
                         <button id="btnDownloadSample" class="text-xs hover:text-gold underline decoration-dotted transition-colors">📄 تحميل نموذج (PDF)</button>
                         ${PRICING_DISPLAY?.freeTrial ? `<span class="text-xs text-gold px-2 py-1 bg-gold/10 rounded">${PRICING_DISPLAY.freeTrial}</span>` : ''}
                    </div>
                </div>

                <!-- رحلات رقمية (الجدوى Aljdwa — مسارات متعددة) -->
                <div class="mb-8">
                    <div class="flex flex-wrap items-center gap-3 mb-4">
                        <h3 class="text-lg font-bold text-gold" style="border-right: 4px solid var(--c-p-500); padding-right: 12px;">رحلاتك الرقمية</h3>
                        ${this.onShowQuickStartGuide ? '<a href="#" id="linkQuickStartFromJourneys" class="text-xs text-gold underline">دليل سريع (5–7 دقائق)</a>' : ''}
                        ${this.onShowBeginnerGuide ? '<a href="#" id="linkBeginnerFromJourneys" class="text-xs text-gold underline">مركز المعرفة — نصائح الخبراء</a>' : ''}
                        ${this.onShowMonshaatCompliance ? '<a href="#" id="linkMonshaatFromJourneys" class="text-xs text-gold underline">توافق متطلبات منشآت</a>' : ''}
                        ${this.onShowFinancingGuide ? '<a href="#" id="linkFinancingFromJourneys" class="text-xs text-gold underline">الجدوى والتمويل — قائمة تحقق</a>' : ''}
                        ${this.onShowAcceleratorTips ? '<a href="#" id="linkAcceleratorFromJourneys" class="text-xs text-gold underline">نصائح المسرّعات</a>' : ''}
                        ${this.onShowExamplesInspire ? '<a href="#" id="linkExamplesFromJourneys" class="text-xs text-gold underline">استلهم من أمثلة</a>' : ''}
                        ${this.onShowIdeaAssessment ? '<a href="#" id="linkIdeaAssessmentFromJourneys" class="text-xs text-gold underline">تقييم الفكرة (ستارت آب)</a>' : ''}
                        ${this.onShowBenchmarking ? '<a href="#" id="linkBenchmarkingFromJourneys" class="text-xs text-gold underline" title="مقارنة أرقامك مع معايير القطاع">هل أرقامي منطقية؟</a>' : ''}
                    </div>
                    <p class="text-sm text-muted mb-4">اختر المسار المناسب لاحتياجك — لا تقتصر على دراسة جدوى فقط.</p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div id="journeyFeasibility" role="button" tabindex="0" class="journey-card card p-4 hover:bg-white/10 cursor-pointer transition-all border border-white/10 hover:border-gold/40" aria-label="رحلة الجدوى — جدوى في ساعة (AI يملأ) أو دراسة كاملة">
                            <div class="text-2xl mb-2">📊</div>
                            <h4 class="font-bold text-white mb-1">رحلة الجدوى</h4>
                            <p class="text-xs text-muted mb-0">جدوى في ساعة (AI يملأ المسودة) أو دراسة كاملة — اقتراحات تحسين في لوحة الأداء</p>
                        </div>
                        <div id="journeyAdvisory" role="button" tabindex="0" class="journey-card card p-4 hover:bg-white/10 cursor-pointer transition-all border border-white/10 hover:border-gold/40" aria-label="رحلة الاستشارة — أسئلة شائعة وأدوات مساعدة">
                            <div class="text-2xl mb-2">💬</div>
                            <h4 class="font-bold text-white mb-1">رحلة الاستشارة</h4>
                            <p class="text-xs text-muted mb-0">أسئلة شائعة وأدوات مساعدة</p>
                        </div>
                        <div id="journeyTemplates" role="button" tabindex="0" class="journey-card card p-4 hover:bg-white/10 cursor-pointer transition-all border border-white/10 hover:border-gold/40" aria-label="رحلة النموذج — قوالب ونماذج جاهزة">
                            <div class="text-2xl mb-2">📋</div>
                            <h4 class="font-bold text-white mb-1">رحلة النموذج</h4>
                            <p class="text-xs text-muted mb-0">قوالب قطاعية ونماذج جاهزة</p>
                        </div>
                        <div id="journeyPartner" role="button" tabindex="0" class="journey-card card p-4 hover:bg-white/10 cursor-pointer transition-all border border-white/10 hover:border-gold/40" aria-label="رحلة الشريك — معايير اختيار شريك أو التقديم للممول والمسرّعات">
                            <div class="text-2xl mb-2">🤝</div>
                            <h4 class="font-bold text-white mb-1">رحلة الشريك</h4>
                            <p class="text-xs text-muted mb-0">معايير اختيار شريك أو التقديم للممول والمسرّعات</p>
                        </div>
                    </div>
                </div>

                <!-- أرقامنا / لماذا محاكي الجدوى (إثبات اجتماعي) -->
                ${this.renderPlatformStats()}

                <!-- تنظيم: مجلدات + بحث (Runway) -->
                ${(projects && projects.length > 0) ? `
                <div class="mb-4 flex flex-wrap items-center gap-3">
                    <label for="dashboardFolderFilter" class="text-sm text-muted">عرض:</label>
                    <select id="dashboardFolderFilter" name="folderFilter" class="input w-auto max-w-[200px] text-sm">
                        ${folderOptions}
                    </select>
                    <button type="button" id="btnNewFolder" class="btn btn--sm btn--secondary">📁 مجلد جديد</button>
                    <input type="text" id="dashboardSearch" name="searchQuery" aria-label="بحث عن مشروع" class="input w-auto max-w-[180px] text-sm" placeholder="بحث بالاسم..." value="${(this.searchQuery || '').replace(/"/g, '&quot;')}" />
                </div>
                ` : ''}

                <!-- Projects Grid -->
                ${!hasProjects ? this.renderEmptyState() : `
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="projectsGrid">
                        ${await Promise.all(filtered.map(async p => {
            try {
                return await this.renderProjectCard(p);
            } catch (err) {
                console.error('Error rendering project card:', err);
                return '<div class="card">خطأ في عرض المشروع</div>';
            }
        })).then(cards => cards.join('')).catch(err => {
            console.error('Error rendering project cards:', err);
            return '<div class="card">حدث خطأ أثناء تحميل المشاريع</div>';
        })}
                    </div>
                `}
            </div>
            
            <!-- Competitor Gap 2: Sensitivity Widget (PlanGuru Style) -->
            <div id="sensitivity-widget-root" class="fixed bottom-6 left-6 z-40 w-72 hidden md:block"></div> 

            <!-- Funding Simulator Modal -->
            <div id="funding-sim-root" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div class="relative w-full max-w-md">
                    <button id="btnCloseFundingSim" class="absolute -top-10 left-0 text-white text-xl hover:text-gold">&times; إغلاق</button>
                    <div id="funding-sim-container"></div>
                </div>
            </div>

            <!-- Founder Card Root (Viral Growth) -->
            <div id="founder-card-root"></div>
        `;

        // Post-render initialization
        // 1. Idea Score Gauge (Based on latest project or average)
        if (projects && projects.length > 0) {
            const latest = projects[0];
            const completeness = QualityCalculator.calculate(latest).score || 0;
            const gauge = new IdeaScoreGauge('idea-score-gauge-root', { score: completeness, size: 100 });
            gauge.render();

            // 2. Sensitivity Widget (Floating or Inline)
            // Ideally this sits better inside the project view, but for dashboard "At a glance" we can show it for the latest project.
            const widgetRoot = this.container.querySelector('#sensitivity-widget-root');
            if (widgetRoot) {
                // Pre-load latest project results into store if needed, or pass dummy
                // This implies we need the store to have the latest project loaded. 
                // Since dashboard doesn't load a specific project into store by default, we might skip this 
                // OR load the latest project silently.
                // For now, let's Only render it if a project is loaded in store, OR just hide it if not.
                // BETTER STRATEGY: Render it inline in the "Quality Strip" area or below it.
            }
        }

        // Initialize Funding Simulator
        const simContainer = this.container.querySelector('#funding-sim-container');
        if (document.getElementById('funding-sim-root')) {
            new FundingSimulator('funding-sim-container', this.store).render();
        }

        this.bindEvents();
        this.maybeShowOnboarding();
    }

    maybeShowOnboarding() {
        const key = 'feas_onboarding_v1_dismissed';
        let dismissed = false;
        try { dismissed = localStorage.getItem(key) === '1'; } catch (_) { }
        if (dismissed) return;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay is-open';
        overlay.id = 'onboardingOverlay';

        overlay.innerHTML = `
            <div class="modal-card" style="max-width:560px;" role="dialog" aria-modal="true" aria-labelledby="onboardingTitle">
                <div class="modal-header">
                    <h3 id="onboardingTitle">مرحباً بك في محاكي الجدوى</h3>
                    <button type="button" class="btn-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body text-sm">
                    <p class="text-muted mb-3">ابدأ بأسرع طريق للوصول لقرار واضح، ثم صدّر تقريرك.</p>
                    <div class="card" style="margin-bottom: 12px;">
                        <div class="text-sm" style="margin-bottom: 6px;"><strong>1) جدوى سريعة</strong></div>
                        <div class="text-xs text-muted">3 خطوات لقرار أولي سريع. مناسبة لاختبار الفكرة.</div>
                    </div>
                    <div class="card" style="margin-bottom: 12px;">
                        <div class="text-sm" style="margin-bottom: 6px;"><strong>2) دراسة احترافية</strong></div>
                        <div class="text-xs text-muted">تفاصيل مناسبة للتمويل والتقديم للجهات.</div>
                    </div>
                    <div class="card" style="margin-bottom: 12px;">
                        <div class="text-sm" style="margin-bottom: 6px;"><strong>3) تصدير</strong></div>
                        <div class="text-xs text-muted">من داخل الدراسة: استخدم زر «📥 تصدير» للحصول على PDF/Excel/Word.</div>
                    </div>
                    <div class="flex gap-3 flex-wrap justify-end" style="margin-top: 12px;">
                        <button type="button" id="btnOnboardingQuick" class="btn btn--secondary btn--sm">⚡ ابدأ جدوى سريعة</button>
                        <button type="button" id="btnOnboardingFull" class="btn btn--primary btn--sm">💼 ابدأ دراسة احترافية</button>
                        <button type="button" id="btnOnboardingDismiss" class="btn btn--ghost btn--sm">فهمت</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const closeBtn = overlay.querySelector('.btn-close');
        const btnDismiss = overlay.querySelector('#btnOnboardingDismiss');
        const btnQuick = overlay.querySelector('#btnOnboardingQuick');
        const btnFull = overlay.querySelector('#btnOnboardingFull');

        const restoreOverflow = () => { document.body.style.overflow = ''; };
        const markDismissed = () => { try { localStorage.setItem(key, '1'); } catch (_) { } };

        const close = () => {
            markDismissed();
            overlay.remove();
            restoreOverflow();
            const focusBack = this.container.querySelector('#cardFullStudy') || this.container.querySelector('#cardQuickFeasibility');
            if (focusBack) setTimeout(() => focusBack.focus(), 0);
        };

        const cleanup = () => {
            document.removeEventListener('keydown', onEsc);
        };

        const closeAndCleanup = () => { close(); cleanup(); };

        const onEsc = (e) => { if (e.key === 'Escape') closeAndCleanup(); };
        document.addEventListener('keydown', onEsc);

        closeBtn?.addEventListener('click', closeAndCleanup);
        btnDismiss?.addEventListener('click', closeAndCleanup);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAndCleanup(); });

        btnQuick?.addEventListener('click', () => {
            closeAndCleanup();
            this.container.querySelector('#cardQuickFeasibility')?.click();
        });
        btnFull?.addEventListener('click', () => {
            closeAndCleanup();
            this.container.querySelector('#cardFullStudy')?.click();
        });

        setTimeout(() => (closeBtn || btnFull || btnQuick || btnDismiss)?.focus(), 0);
    }

    /** قسم "أرقامنا" / "لماذا تثق بنا" (KPI-3.1) — أرقام واقعية أو رابط معاييرنا */
    renderPlatformStats() {
        const s = PLATFORM_STATS || {};
        const hasStats = (s.studiesCount && s.studiesCount > 0) || (s.yearsExperience && s.yearsExperience > 0) || ((s.partnershipsText || '').trim()) || (s.yearStarted && s.yearStarted > 0);
        if (hasStats) {
            const items = [];
            if (s.studiesCount > 0) items.push({ label: 'دراسات مُنشأة', value: s.studiesCount.toLocaleString('ar-SA') });
            if (s.yearsExperience > 0) items.push({ label: 'سنوات خبرة', value: s.yearsExperience + '+' });
            if (s.yearStarted) items.push({ label: 'سنة البدء', value: String(s.yearStarted) });
            return `
                <div class="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 class="text-sm font-bold text-gold mb-3">لماذا تثق بنا — أرقامنا</h3>
                    <div class="flex flex-wrap gap-6 justify-center text-center">
                        ${items.map(i => `<div><span class="text-2xl font-bold text-white">${i.value}</span><br><span class="text-xs text-muted">${i.label}</span></div>`).join('')}
                    </div>
                    ${(s.partnershipsText || '').trim() ? `<p class="text-xs text-muted mt-3 text-center">${s.partnershipsText}</p>` : ''}
                    ${this.onShowTrustCriteria ? '<p class="text-xs text-center mt-3"><a href="#" id="linkTrustCriteriaStats" class="text-gold underline">معاييرنا</a></p>' : ''}
                </div>
            `;
        }
        return `
            <div class="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 class="text-sm font-bold text-gold mb-2">لماذا تثق بنا</h3>
                <p class="text-sm text-muted mb-2">معاييرنا وجودة المخرجات وتوافق التصدير مع متطلبات التمويل.</p>
                ${this.onShowTrustCriteria ? '<a href="#" id="linkTrustCriteriaStats" class="text-gold underline text-sm">معاييرنا</a>' : ''}
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="empty-state text-center py-16 bg-white/5 rounded-2xl border-2 border-dashed border-white/10">
                <div class="text-6xl mb-4 opacity-50">📂</div>
                <h3 class="text-xl font-bold mb-2">لا توجد دراسات محفوظة بعد</h3>
                <p class="text-muted max-w-md mx-auto mb-4">ابدأ رحلة نجاحك بإنشاء أول دراسة جدوى احترافية لمشروعك.</p>
                <p class="text-gold font-semibold mb-6">${PRICING_DISPLAY?.startPrice || 'ابدأ مجاناً'} — جدوى سريعة في 3 خطوات</p>
                <div class="flex flex-wrap gap-3 justify-center">
                    <button id="btnQuickFeasibilityEmpty" class="btn btn--primary">⚡ ابدأ مجاناً — جدوى سريعة (3 خطوات)</button>
                    <button id="btnNewProjectEmpty" class="btn btn--secondary">✨ دراسة جديدة (كاملة)</button>
                </div>
            </div>
        `;
    }

    async renderProjectCard(project) {
        const date = new Date(project.lastModified || project.updated_at).toLocaleDateString('ar-SA');
        const isCloud = project.source === 'cloud' || project.source === 'synced';
        const isLocal = project.source === 'local';
        const projectData = project.data || project;
        const folders = DashboardView.getFolders();
        const folderOptions = [
            '<option value="">بدون مجلد</option>',
            ...folders.map(f => `<option value="${f.id}" ${(project.folderId || null) === f.id ? 'selected' : ''}>${f.name}</option>`)
        ].join('');

        // Calculate completeness if project data is available
        let completenessHTML = '';
        try {
            const { calculateStudyCompleteness } = await import('../utils/studyCompleteness.js');
            const completeness = calculateStudyCompleteness(projectData);
            const percentage = completeness.percentage;
            const colorClass = percentage >= 80 ? 'text-success' : percentage >= 50 ? 'text-warning' : 'text-danger';
            const bgColorClass = percentage >= 80 ? 'bg-success/20' : percentage >= 50 ? 'bg-warning/20' : 'bg-danger/20';

            const tips = typeof completeness.getTipsToRaiseScore === 'function' ? completeness.getTipsToRaiseScore().slice(0, 1) : [];
            completenessHTML = `
                <div class="completeness-mini ${bgColorClass} p-2 rounded mb-3">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs text-muted">جودة المسودة</span>
                        <span class="text-sm font-bold ${colorClass}">${percentage}%</span>
                    </div>
                    <div class="progress-bar bg-bg-app" style="height: 4px; border-radius: 2px; overflow: hidden;">
                        <div class="progress-bar-fill ${colorClass.replace('text-', 'bg-')}" 
                             style="width: ${percentage}%; height: 100%; transition: width 0.3s ease;"></div>
                    </div>
                    ${percentage < 100 && tips.length ? `<p class="text-[10px] text-gold mt-1 mb-0" title="نصائح لرفع النقاط">📈 ${tips[0]}</p>` : ''}
                </div>
            `;
        } catch (e) {
            console.warn('Could not calculate completeness for project:', e);
        }

        return `
            <div class="project-card card glass-card hover:bg-white/10 transition-all cursor-pointer group relative" data-id="${project.id}">
                <div class="absolute top-4 left-4 flex gap-2">
                    ${isCloud ? '<span class="badge badge--info text-xs" title="محفوظ سحابياً">☁️ Cloud</span>' : ''}
                    ${isLocal && !isCloud ? '<span class="badge badge--warning text-xs" title="محفوظ محلياً فقط">💻 Local</span>' : ''}
                    ${(projectData.projectInfo?.members?.length > 0) ? '<span class="badge badge--success text-xs" title="مشترك مع فريق">👥 Shared</span>' : ''}
                </div>

                <div class="h-32 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-t-lg flex items-center justify-center text-4xl mb-4 group-hover:scale-105 transition-transform origin-bottom">
                    📊
                </div>
                
                <div class="p-2">
                    <h3 class="font-bold text-lg mb-1 truncate" title="${project.name}">${project.name || 'مشروع بدون اسم'}</h3>
                    <p class="text-xs text-muted mb-2">آخر تعديل: ${date}</p>
                    ${folders.length ? `<label class="text-[10px] text-muted block mt-1">مجلد:</label><select class="project-folder-select input input--sm w-full text-xs mt-0.5" data-id="${project.id}" onclick="event.stopPropagation()">${folderOptions}</select>` : ''}
                    ${completenessHTML}
                    
                    <div class="flex gap-2 mt-4 pt-4 border-t border-white/10">
                        <button class="btn btn--sm btn--secondary flex-1 btn-open" data-id="${project.id}">فتح</button>
                        <button class="btn btn--sm btn--ghost btn-share flex items-center justify-center" data-id="${project.id}" title="عرض المستثمر (Share)">🚀</button>
                        <button class="btn btn--sm btn--ghost btn-duplicate flex items-center justify-center" data-id="${project.id}" title="نسخ المشروع">📋</button>
                        <button class="btn btn--sm btn--danger btn-icon btn-delete" data-id="${project.id}" title="حذف">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderQualityStrip(projects) {
        if (!projects || projects.length === 0) return '';
        const latest = projects[0];
        if (!latest.projectInfo) return '';

        try {
            const q = QualityCalculator.calculate(latest);
            return `
                <div id="quality-strip" class="mb-8">
                    <div class="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 text-white border border-white/10 relative overflow-hidden shadow-lg">
                        <div class="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-gold/10 to-transparent pointer-events-none"></div>
                        <div class="flex flex-wrap items-center justify-between gap-4 relative z-10">
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-2xl">${q.badge.split(' ')[1] || '⭐'}</span>
                                    <h3 class="font-bold text-lg">جودة دراستك: ${q.badge.split(' ')[0]} (<span class="text-gold">${latest.projectInfo ? latest.projectInfo.name : ''}</span>)</h3>
                                </div>
                                <p class="text-gray-400 text-sm">أكملت ${q.score}% من الدراسة. ${q.missing.length > 0 ? 'خطوتك التالية: ' + q.missing[0].label : 'ممتاز! الدراسة مكتملة.'}</p>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="w-32 bg-gray-700 rounded-full h-3">
                                    <div class="bg-gradient-to-r from-yellow-400 to-gold h-3 rounded-full transition-all duration-1000" style="width: ${q.score}%"></div>
                                </div>
                                <button class="btn btn--sm btn--primary btn-open" data-id="${latest.id}">✨ حسّن النتيجة</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) { console.error(e); return ''; }
    }

    bindEvents() {
        // Login
        const btnLogin = this.container.querySelector('#btnLogin');
        if (btnLogin) {
            btnLogin.addEventListener('click', async () => {
                const { AuthModal } = await import('./AuthModalStub.js');
                new AuthModal('authModalContainer', {
                    onSuccess: () => this.render() // Refresh dashboard on success
                }).open();
            });
        }

        // Logout
        this.container.querySelector('#btnLogout')?.addEventListener('click', async () => {
            if (confirm('هل تود تسجيل الخروج؟')) {
                await signOut();
            }
        });

        // New Project (Standard / Full Study)
        const handleNew = async () => {
            window.dispatchEvent(new CustomEvent('feasibility:newStudy'));
        };

        // Card: Full Professional Study
        this.container.querySelector('#cardFullStudy')?.addEventListener('click', (e) => {
            handleNew();
        });

        // Card: Startup Hypothesis
        this.container.querySelector('#cardHypothesis')?.addEventListener('click', () => {
            if (this.onShowHypothesis) this.onShowHypothesis();
            else toast.info('الخدمة غير متوفرة حالياً');
        });

        // Card: Quick Feasibility
        this.container.querySelector('#cardQuickFeasibility')?.addEventListener('click', () => {
            if (this.onStartQuickFeasibility) this.onStartQuickFeasibility();
            else toast.info('الخدمة غير متوفرة حالياً');
        });

        // تحميل عينة تقرير (مشترك بين btnDownloadSample و modal عينة تقرير)
        const runDownloadSample = async () => {
            try {
                const { TEMPLATES } = await import('../core/templates.js');
                const template = Object.values(TEMPLATES).find(t => t.id === 'coffee_shop') || Object.values(TEMPLATES)[0];
                const dummyState = { ...createEmptyStudy(), projectInfo: { name: 'نموذج كوفي شوب (عينة)' } };

                if (template?.data) {
                    Object.assign(dummyState, template.data);
                    dummyState.projectInfo = { ...dummyState.projectInfo, ...template.data.projectInfo, name: 'نموذج كوفي شوب (عينة)' };
                }

                const { PDFGenerator } = await import('../../export/pdfGenerator.js');
                const mockStore = { getState: () => dummyState, get: () => dummyState };
                const generator = new PDFGenerator(mockStore);
                await generator.generate();

                toast.success('تم تحميل نموذج العينة بنجاح!');
            } catch (e) {
                console.error('Sample export failed:', e);
                toast.error('فشل تحميل العينة. حاول لاحقاً.');
            }
        };

        // Card: عينة تقرير (المهمة 1 — خطة التفوق)
        this.container.querySelector('#cardSampleReport')?.addEventListener('click', () => {
            const modal = new SampleReportModal({
                onDownloadSample: async () => {
                    await runDownloadSample();
                    modal.close();
                }
            });
            modal.open();
        });

        // Funding Simulator Toggle
        this.container.querySelector('#btnFundingSim')?.addEventListener('click', () => {
            this.container.querySelector('#funding-sim-root').classList.remove('hidden');
        });
        this.container.querySelector('#btnCloseFundingSim')?.addEventListener('click', () => {
            this.container.querySelector('#funding-sim-root').classList.add('hidden');
        });
        this.container.querySelector('#funding-sim-root')?.addEventListener('click', (e) => {
            if (e.target.id === 'funding-sim-root') {
                e.target.classList.add('hidden');
            }
        });

        this.container.querySelector('#btnQuickFeasibilityEmpty')?.addEventListener('click', () => {
            if (this.onStartQuickFeasibility) this.onStartQuickFeasibility();
        });

        // Initialize Resources Menu
        new ResourcesMenu('resources-menu-root', this.options).render();

        // Journey Cards
        const bindJourney = (id, handler) => {
            const el = this.container.querySelector(id);
            if (!el) return;
            el.addEventListener('click', () => {
                if (handler) handler();
            });
            el.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && handler) {
                    e.preventDefault();
                    handler();
                }
            });
        };

        bindJourney('#journeyFeasibility', () => {
             /* if (this.options.onStartQuickFeasibility) this.options.onStartQuickFeasibility();
             else */ window.dispatchEvent(new CustomEvent('feasibility:newStudy'));
        });
        bindJourney('#journeyAdvisory', () => {
            if (this.options.onShowAdvisory) this.options.onShowAdvisory();
            else toast.info('رحلة الاستشارة — قريباً');
        });
        bindJourney('#journeyTemplates', () => {
            window.dispatchEvent(new CustomEvent('feasibility:newStudy'));
        });
        bindJourney('#journeyPartner', () => {
            if (this.options.onShowPartnerSelection) this.options.onShowPartnerSelection();
            else if (this.options.onShowFinancingGuide) this.options.onShowFinancingGuide();
            else toast.info('رحلة الشريك — قريباً');
        });

        // Journey Links (دليل سريع، منشآت، تمويل، إلخ) — event delegation
        const journeyLinkHandlers = {
            linkQuickStartFromJourneys: () => this.options.onShowQuickStartGuide?.(),
            linkBeginnerFromJourneys: () => this.options.onShowBeginnerGuide?.(),
            linkMonshaatFromJourneys: () => this.options.onShowMonshaatCompliance?.(),
            linkFinancingFromJourneys: () => this.options.onShowFinancingGuide?.(),
            linkAcceleratorFromJourneys: () => this.options.onShowAcceleratorTips?.(),
            linkExamplesFromJourneys: () => this.options.onShowExamplesInspire?.(),
            linkIdeaAssessmentFromJourneys: () => this.options.onShowIdeaAssessment?.(),
            linkBenchmarkingFromJourneys: () => this.options.onShowBenchmarking?.(),
            linkTrustCriteriaStats: () => this.options.onShowTrustCriteria?.()
        };
        this.container.addEventListener('click', (e) => {
            const id = e.target?.id;
            const handler = journeyLinkHandlers[id];
            if (handler) {
                e.preventDefault();
                handler();
            }
        });

        // Share Button (Founder Card)
        this.container.querySelectorAll('.btn-share').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const allProjects = this.lastRenderedProjects || [];
                const project = allProjects.find(p => p.id === id);

                if (project) {
                    new FounderCardGenerator('founder-card-root', this.store).render(project);
                } else {
                    toast.info('جاري إعداد البطاقة...');
                }
            });
        });

        // سياسة الاسترداد (المهمة 2 — خطة التفوق)
        this.container.querySelector('#btnRefundPolicy')?.addEventListener('click', (e) => {
            e.preventDefault();
            new RefundPolicyModal().open();
        });

        // Download Sample Report (يستخدم runDownloadSample المعرّف أعلاه)
        this.container.querySelector('#btnDownloadSample')?.addEventListener('click', async () => {
            const btn = this.container.querySelector('#btnDownloadSample');
            const originalText = btn.textContent;
            btn.textContent = 'جاري التحضير...';
            btn.disabled = true;
            try {
                await runDownloadSample();
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });

        // Demo Simulation
        this.container.querySelector('#btnRunDemo')?.addEventListener('click', async () => {
            if (window.simulator) {
                if (confirm('هل تريد بدء محاكاة تجربة مستخدم كاملة؟ (سيتم إنشاء دراسة تجريبية)')) {
                    await window.simulator.runDemo('burger_joint');
                }
            } else {
                toast.warning('المحاكي غير جاهز بعد. يرجى الانتظار ثوانٍ.');
            }
        });

        // Open Project
        this.container.querySelectorAll('.btn-open').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                this.loadProject(id);
            });
        });

        // Card Click (same as open)
        this.container.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('button') || e.target.closest('select')) return;
                const id = card.dataset.id;
                this.loadProject(id);
            });
        });

        // Delete Project
        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('هل أنت متأكد من نقل هذه الدراسة إلى سلة المحذوفات؟')) {
                    const id = (e.target.closest('[data-id]') || e.target).dataset?.id;
                    await ProjectManager.deleteProject(id);
                    this.render();
                }
            });
        });

        // Duplicate Project (نسخ مشروع — خطة التطوير)
        this.container.querySelectorAll('.btn-duplicate').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = (e.target.closest('[data-id]') || e.target).dataset?.id;
                if (!id) return;
                try {
                    const result = await ProjectManager.duplicateProject(id);
                    if (result.success) {
                        toast.success('تم نسخ المشروع بنجاح');
                        this.render();
                    } else {
                        toast.error(result.error || 'فشل نسخ المشروع');
                    }
                } catch (err) {
                    console.error('Duplicate failed:', err);
                    toast.error('فشل نسخ المشروع');
                }
            });
        });

        // Runway: Folders
        const folderFilter = this.container.querySelector('#dashboardFolderFilter');
        if (folderFilter) {
            folderFilter.addEventListener('change', () => {
                this.selectedFolderId = folderFilter.value || null;
                this.render();
            });
        }
        const btnNewFolder = this.container.querySelector('#btnNewFolder');
        if (btnNewFolder) {
            btnNewFolder.addEventListener('click', () => {
                const name = prompt('اسم المجلد (مثلاً: مشاريع 2026)');
                if (!name || !name.trim()) return;
                const folders = DashboardView.getFolders();
                folders.push({ id: crypto.randomUUID(), name: name.trim() });
                DashboardView.setFolders(folders);
                this.selectedFolderId = folders[folders.length - 1].id;
                this.render();
            });
        }
        const dashboardSearch = this.container.querySelector('#dashboardSearch');
        if (dashboardSearch) {
            dashboardSearch.addEventListener('input', () => {
                this.searchQuery = dashboardSearch.value || '';
                this.render();
            });
        }

        // Folder Select Event Delegation
        this.container.addEventListener('change', async (e) => {
            const sel = e.target.closest('.project-folder-select');
            if (!sel) return;
            e.stopPropagation();
            const id = sel.dataset.id;
            const folderId = sel.value || null;
            try {
                const result = await ProjectManager.loadProject(id);
                if (!result?.data) return;
                const data = result.data;
                if (!data.projectInfo) data.projectInfo = {};
                data.projectInfo.folderId = folderId;
                data.projectInfo.id = id;
                await ProjectManager.saveProject(data);
                this.render();
            } catch (err) {
                console.error('Failed to update project folder:', err);
            }
        });
    }

    async loadProject(id) {
        // Show loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center';
        loadingOverlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex flex-col items-center gap-4">
                <div class="loader"></div>
                <div class="text-sm text-muted">جاري تحميل المشروع...</div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);

        try {
            // Try loading from cloud first, then local
            const result = await ProjectManager.loadProject(id);

            if (result?.data) {
                // Load into store
                this.store.set(result.data);

                // Save to local cache if loaded from cloud
                try {
                    await this.store.saveLocal();
                } catch (saveErr) {
                    console.warn('Failed to update local cache:', saveErr);
                }

                // Notify store listeners
                this.store.notify();

                if (this.onProjectSelect) {
                    this.onProjectSelect(id);
                }

                toast.success('تم تحميل المشروع بنجاح');

                // Navigate to workspace
                if (typeof enterWorkspaceMode === 'function') {
                    enterWorkspaceMode();
                }
            } else {
                toast.error('المشروع غير موجود');
                this.render();
            }
        } catch (e) {
            console.error('Error loading project:', e);
            toast.error('فشل تحميل المشروع: ' + (e.message || 'خطأ غير معروف'));

            // Try to reload dashboard
            try {
                await this.render();
            } catch (renderErr) {
                console.error('Failed to re-render dashboard:', renderErr);
            }
        } finally {
            // Remove loading overlay
            if (loadingOverlay.parentNode) {
                loadingOverlay.remove();
            }
        }
    }
}

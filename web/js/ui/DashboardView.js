import Swal from 'sweetalert2';
import { ProjectManager } from '../services/ProjectManager.js';
import { getAuthUser, signOut } from '../../supabaseClient.js';
import { toast } from '../utils/toast.js';
import { PRICING_DISPLAY, buildWhatsAppLink } from '../config.js';
import { PRICING_PACKAGES, formatPrice, CURRENCY_SYMBOL } from '../core/pricing.js';
import { QualityCalculator } from '../utils/QualityCalculator.js';
import { escapeHtml } from '../utils/escape.js';
import { calculateStudyCompleteness } from '../utils/studyCompleteness.js';
import { FundingSimulator } from './widgets/FundingSimulator.js';
import { FounderCardGenerator } from './widgets/FounderCardGenerator.js';
import { SensitivityWidget } from './widgets/SensitivityWidget.js';
import { ReadyStudiesView } from './ReadyStudiesView.js';
import { DatabaseFilesView } from './DatabaseFilesView.js';
import { STEPS, SIDEBAR_SECTIONS } from '../core/wizardSteps.js';
import { stepReportType, stepCanReport, STEP_TYPE_BADGE } from '../core/stepReportType.js';
import { DATA_SOURCE_CATALOG } from '../services/DataConnectors.js';

const FOLDERS_STORAGE_KEY = 'feas_folders';

import { ResourcesMenu } from './widgets/ResourcesMenu.js';

/* ─── نظام الأيقونات الموحّد (بديل الإيموجي) ───
   أولاً: رموز الـsprite المعرفة في index.html (i-*)،
   ثانياً: رموز inline بنفس اللغة (stroke 1.75 / 24×24 / currentColor) لما لا يوجد في الـsprite. */
const icon = (id, cls = '') =>
    `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#${id}"/></svg>`;

const INLINE_PATHS = {
    // حقيبة عمل — «دراسة احترافية»
    briefcase: '<rect x="2.5" y="7.5" width="19" height="13" rx="2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M2.5 12.5h19"/>',
    // تشغيل — «جولة تجريبية»
    play: '<path d="M8 5.5v13l10-6.5Z"/>',
    // دورق مختبر — «مختبر الأفكار»
    flask: '<path d="M10 3h4"/><path d="M11 3v5.2L5.7 17.4a2 2 0 0 0 1.8 3.1h9a2 2 0 0 0 1.8-3.1L13 8.2V3"/><path d="M8 15h8"/>',
    // مصباح فكرة — «فرضية الستارت آب»
    bulb: '<path d="M9.5 18v-1.2c0-1-.6-1.9-1.3-2.6a6 6 0 1 1 7.6 0c-.7.7-1.3 1.6-1.3 2.6V18"/><path d="M9.5 21h5"/>',
    // سهم تقدم (RTL: يشير يساراً)
    chev: '<path d="m14.5 6-6 6 6 6"/>',
    // فقاعة حوار — «رحلة الاستشارة»
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20.5l1.7-4.9A8.5 8.5 0 1 1 21 11.5Z"/>',
    // شخصان — «رحلة الشريك»
    users: '<circle cx="9.5" cy="8" r="3.5"/><path d="M3 20c0-3.2 2.9-5.3 6.5-5.3S16 16.8 16 20"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4"/><path d="M18.5 15.2c1.7.8 2.5 2.4 2.5 4.8"/>',
    // سحابة — شارة الحفظ السحابي
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a4 4 0 0 0 0-8Z"/>',
    // حاسوب — شارة الحفظ المحلي
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2.5 19.5h19"/>',
    // مجلد — «دراساتك»
    folder: '<path d="M3.5 6.5h6l1.6 2h9.4v8.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z"/><path d="M3.5 8.5h17"/>',
    // اتجاه صاعد — نصيحة رفع الجودة
    trend: '<path d="m3.5 17 5.5-5.5 4 4 7.5-7.5"/><path d="M14.5 8h6v6"/>',
    // خريطة — «دليل سريع»
    map: '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    // ميزان — «هل أرقامي منطقية؟»
    scale: '<path d="M12 3v18M6 7h12"/><path d="M6 7 3 13a3 3 0 0 0 6 0Zm12 0-3 6a3 3 0 0 0 6 0Z"/>',
    // قائمة — «قائمة تحقق التمويل»
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    // هدف — «الدراسة المبدئية»
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    // بنك — «التمويل»
    bank: '<path d="m3 9 9-5 9 5"/><path d="M5 10v7M9.7 10v7M14.3 10v7M19 10v7"/><path d="M3 20h18"/>',
    // درع — «التوافق»
    shield: '<path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6Z"/><path d="m9 12 2 2 4-4"/>',
    // مخطط — «اختبارات مالية»
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16l3-4 3 2 4-6"/>',
    // نبض — «مراقبة/تشغيل»
    activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    // تحميل — «تصدير»
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    // لوحة — «بناء التقرير»
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5A2 2 0 0 1 11 3h2a2 2 0 0 1 2 1.5V6H9Z"/><path d="M9 11h6M9 15h6"/>',
    // صاروخ — «نصائح المسرّعات»
    rocket: '<path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2M9 12a12 12 0 0 1 8-9c2 0 3 1 3 3a12 12 0 0 1-9 8Z"/><circle cx="14.5" cy="9.5" r="1.5"/><path d="M9 12l-3 .5 5.5 5.5.5-3"/>',
    // كتاب — «نصائح للمبتدئين / مركز المعرفة»
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M19 3v18"/>'
};

const inlineIcon = (name, cls = '') =>
    `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${INLINE_PATHS[name] || ''}</svg>`;

/** إزالة الإيموجي من نصوص قادمة من الخارج (مثل شارة QualityCalculator) */
const stripEmoji = (s) => (s || '').replace(/[\p{Extended_Pictographic}️‍]/gu, '').trim();

export class DashboardView {
    constructor(containerId, store, onProjectSelect, options = {}) {
        this.container = document.getElementById(containerId);
        this.store = store;
        this.onProjectSelect = onProjectSelect;
        this.selectedFolderId = null;
        this.searchQuery = '';
        this.activeHomePanel = options.activeHomePanel || 'studies';
        this.options = options;
        Object.assign(this, options); // for template: this.onShowX, etc.
        this.currentUser = null;
        this.readyStudiesView = null;
        this.databaseFilesView = null;
    }

    async render() {
        this.container.innerHTML = `
            <div class="dashboard-loading">
                <div class="loader"></div>
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
                <div class="dv-error">
                    <p>حدث خطأ أثناء تحميل البيانات.</p>
                    <button class="btn btn--secondary" onclick="window.location.reload()">إعادة المحاولة</button>
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
        // تدقيق 2026-07-08 (ملاحظة حرجة UX+معماري): Number(null) يساوي 0 في جافاسكربت —
        // فكان الزر يظهر لأي زائر جديد بلا أي مشروع محفوظ لأن Number.isInteger(0) صحيح
        // وSTEPS[0] موجود دائماً. الآن: نتحقق من وجود المفتاح فعلياً، ونتطلّب مشروعاً
        // محفوظاً حقيقياً (نفس عدّاد «دراساتك» المعروض) — لا معنى لـ«تابع» بلا شيء لمتابعته.
        const rawLastStepIndex = localStorage.getItem('feas_last_step_index');
        const lastStepIndex = rawLastStepIndex !== null ? Number(rawLastStepIndex) : NaN;
        const lastStep = hasProjects && Number.isInteger(lastStepIndex) && STEPS[lastStepIndex] ? STEPS[lastStepIndex] : null;

        const folderOptions = [
            '<option value="">جميع المشاريع</option>',
            ...folders.map(f => `<option value="${f.id}" ${this.selectedFolderId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`)
        ].join('');

        // شرط عرض روابط الأدوات: تُرندَر فقط إن وُجد ردّها (عقد قديم محفوظ)
        const stepIcon = (step) => {
            if (step.isPreliminaryCheck) return 'target';
            if (step.isProjectAlternatives || step.isComparison) return 'scale';
            if (step.isTemplateSelector || step.isReportBuilder || step.isAppendices) return 'clipboard';
            if (step.isOperationalSim || step.isPostLaunch) return 'activity';
            if (step.isFinancing || step.isLoanSchedule) return 'bank';
            if (step.isStressTest || step.isSensitivity || step.isMonteCarlo || step.isScenarios || step.isDashboard) return 'chart';
            if (step.isDecisionDashboard || step.isExecutiveSummary || step.isInvestorAnalysis || step.isValuation) return 'trend';
            if (step.isRiskMatrix || step.id === 'legal') return 'shield';
            return 'list';
        };
        // تصنيف نوع الخطوة (تحليل/إدخال/مختلط) وشاراتها موحَّدة في core/stepReportType.js
        // — نفس المصدر يغذّي حقن زر «إصدار تقرير» في ToolReport، فلا ينحرف التصنيفان.
        const journeySections = SIDEBAR_SECTIONS.map((section, sectionIndex) => {
            const steps = STEPS.slice(section.range[0], section.range[1] + 1);
            return `
                <details class="dv-journey">
                    <summary class="dv-journey__head">
                        <span class="dv-toolcol__num dv-num">${sectionIndex + 1}</span>
                        <h3 class="dv-toolcol__title">${section.label}</h3>
                        <span class="dv-journey__count dv-num">${steps.length}</span>
                    </summary>
                    <div class="dv-journey__steps">
                        ${steps.map((step, offset) => {
                            const stepIndex = section.range[0] + offset;
                            const badge = STEP_TYPE_BADGE[stepReportType(step)];
                            const canReport = stepCanReport(step);
                            return `
                                <button type="button" class="dv-toolrow dv-toolrow--compact" data-journey-step="${stepIndex}">
                                    <span class="dv-toolrow__ic">${inlineIcon(stepIcon(step))}</span>
                                    <span class="dv-toolrow__body">
                                        <span class="dv-toolrow__name">${step.label}<span class="dv-tag-type ${badge.cls}">${badge.label}</span>${canReport ? '<span class="dv-tag-report">تقرير</span>' : ''}</span>
                                    </span>
                                    <span class="dv-toolrow__go">${inlineIcon('chev')}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </details>
            `;
        }).join('');
        const stepIndexBy = (matcher, fallbackIndex = 0) => {
            const idx = STEPS.findIndex(matcher);
            return idx >= 0 ? idx : fallbackIndex;
        };
        const toolButton = (tool) => `
            <button type="button"
                ${tool.id ? `id="${tool.id}"` : ''}
                ${Number.isInteger(tool.step) ? `data-journey-step="${tool.step}"` : ''}
                ${tool.sourceUrl ? `data-source-url="${tool.sourceUrl}"` : ''}
                class="dv-toolrow${tool.compact === false ? '' : ' dv-toolrow--compact'}">
                <span class="dv-toolrow__ic">${inlineIcon(tool.icon || 'list')}</span>
                <span class="dv-toolrow__body">
                    <span class="dv-toolrow__name">${tool.name}${tool.engine ? '<span class="dv-tag-engine">محرّك</span>' : ''}${tool.tag ? `<span class="dv-tag-source" title="${tool.sourceUrl ? 'رابط خارجي — يفتح موقع المصدر في تبويب جديد، وليس سحباً آلياً للبيانات' : ''}">${tool.tag}</span>` : ''}</span>
                    <span class="dv-toolrow__desc">${tool.desc}</span>
                </span>
                <span class="dv-toolrow__go">${inlineIcon('chev')}</span>
            </button>
        `;
        const toolkitGroups = [
            {
                title: 'جمع البيانات',
                note: 'قبل ما تكتب الأرقام',
                tools: [
                    { name: 'قائمة جمع معلومات المشروع', desc: 'النشاط، الموقع، الترخيص، المصادر الأولية', icon: 'clipboard', step: stepIndexBy(s => s.id === 'projectInfo', 3) },
                    { name: 'نموذج مقابلة العملاء', desc: 'أسئلة للتحقق من المشكلة والطلب', icon: 'chat', step: stepIndexBy(s => s.id === 'marketing', 16) },
                    { name: 'زيارة المنافسين والأسعار', desc: 'اجمع أسعار وحركة وملاحظات ميدانية', icon: 'scale', step: stepIndexBy(s => s.id === 'marketing', 16) },
                    { name: 'قائمة عروض الموردين', desc: 'أصول، معدات، إيجارات، واشتراكات', icon: 'list', step: stepIndexBy(s => s.id === 'technical', 8) },
                    { name: 'استيراد بيانات من ملف جدولي', desc: 'رفع بيانات أولية من ملف خارجي', icon: 'download', id: 'linkImportCsvToolkit' }
                ]
            },
            {
                title: 'مصادر البيانات والربط',
                note: 'حكومي، خرائط، API، ملفات',
                tools: DATA_SOURCE_CATALOG.map(src => ({
                    name: src.name,
                    desc: src.desc,
                    icon: src.icon,
                    tag: src.connection,
                    sourceUrl: src.url,
                    id: src.actionId
                }))
            },
            {
                title: 'السوق والمنافسة',
                note: 'تحويل البحث إلى أرقام',
                tools: [
                    { name: 'حجم السوق والطلب', desc: 'تقدير العملاء والطلب المتوقع', icon: 'chart', step: stepIndexBy(s => s.id === 'marketing', 16), engine: true },
                    { name: 'تحليل المنافسين', desc: 'قارن السعر، القوة، الضعف، والتموضع', icon: 'scale', step: stepIndexBy(s => s.id === 'marketing', 16) },
                    { name: 'العرض والطلب', desc: 'هل السوق فيه فجوة أم تشبع؟', icon: 'trend', step: stepIndexBy(s => s.id === 'marketing', 16), engine: true },
                    { name: 'استلهام أمثلة', desc: 'نماذج مشاريع وقوالب قريبة من قطاعك', icon: 'bulb', id: 'linkExamplesToolkit' }
                ]
            },
            {
                title: 'التحليل المالي',
                note: 'اختبار القرار بالأرقام',
                tools: [
                    { name: 'محاكي قبول التمويل', desc: 'فحص سريع لجاهزية طلب التمويل', icon: 'bank', id: 'btnFundingSimToolkit', engine: true },
                    { name: 'تحليل نقطة التعادل', desc: 'كم تحتاج مبيعات حتى لا تخسر؟', icon: 'target', step: stepIndexBy(s => s.isBreakEven, 26), engine: true },
                    { name: 'اختبار التحمل', desc: 'ماذا يحدث لو انخفضت المبيعات؟', icon: 'chart', step: stepIndexBy(s => s.isStressTest, 30), engine: true },
                    { name: 'تحليل الحساسية', desc: 'أكثر متغير يؤثر على الربحية', icon: 'trend', step: stepIndexBy(s => s.isSensitivity, 31), engine: true },
                    { name: 'مونت كارلو', desc: 'احتمالات الربح والخسارة بدل رقم واحد', icon: 'flask', step: stepIndexBy(s => s.isMonteCarlo, 35), engine: true },
                    { name: 'تقييم الشركة', desc: 'قيمة المشروع للتفاوض مع مستثمر', icon: 'chart', step: stepIndexBy(s => s.isValuation, 36), engine: true }
                ]
            },
            {
                title: 'التخطيط والتشغيل',
                note: 'من الدراسة إلى التنفيذ',
                tools: [
                    { name: 'محاكاة التشغيل', desc: 'طاقة، انتظار، ضغط تشغيلي', icon: 'activity', step: stepIndexBy(s => s.isOperationalSim, 14), engine: true },
                    { name: 'خطة التوظيف', desc: 'المناصب والرواتب ونسبة التوطين (نطاقات) المطلوبة لنشاطك', icon: 'users', step: stepIndexBy(s => s.id === 'hr', 9) },
                    { name: 'خطة المشتريات والأصول', desc: 'معدات، أثاث، تقنية، وتجهيزات', icon: 'list', step: stepIndexBy(s => s.id === 'technical', 8) },
                    { name: 'خطة التنفيذ', desc: 'مراحل، تواريخ، ومسؤوليات', icon: 'map', step: stepIndexBy(s => s.isTimeline, 20) },
                    { name: 'أول تسعين يوم بعد الإطلاق', desc: 'متابعة الأداء الفعلي مقابل الخطة', icon: 'activity', step: stepIndexBy(s => s.isPostLaunch, 37), engine: true }
                ]
            },
            {
                title: 'التحقق والجودة',
                note: 'قبل التصدير والتقديم',
                tools: [
                    { name: 'فحص اكتمال الدراسة', desc: 'اعرف النواقص قبل اعتماد القرار', icon: 'shield', id: 'linkStudyCompleteness', engine: true },
                    { name: 'هل أرقامي منطقية؟', desc: 'مقارنة أرقامك بالقطاع', icon: 'scale', id: 'linkBenchmarkingFromJourneys', engine: true },
                    { name: 'تحليل المخاطر', desc: 'احتمال، أثر، وخطة تخفيف', icon: 'shield', step: stepIndexBy(s => s.isRiskMatrix, 29) },
                    { name: 'توافق منشآت', desc: 'جدول مرجعي يقارن أقسام دراستك بالنموذج الاسترشادي', icon: 'shield', id: 'linkMonshaatToolkit' },
                    { name: 'معاييرنا', desc: 'كيف تُفحص جودة المخرجات', icon: 'book', id: 'linkTrustCriteriaToolkit' }
                ]
            },
            {
                title: 'الإخراج والتقديم',
                note: 'حوّل الدراسة إلى ملف جاهز',
                tools: [
                    { name: 'بناء التقرير', desc: 'رتّب الأقسام قبل التصدير', icon: 'clipboard', step: stepIndexBy(s => s.isReportBuilder, 42) },
                    { name: 'تصدير التقرير والجداول', desc: 'نسخ جاهزة للمراجعة والإرسال', icon: 'download', id: 'linkExportToolkit' },
                    { name: 'نسخة التمويل', desc: 'قائمة متطلبات وتقرير مناسب للممول', icon: 'bank', id: 'linkFinancingToolkit' },
                    { name: 'عرض المستثمر', desc: 'عرض تقديمي مختصر للشريك أو المستثمر', icon: 'rocket', step: stepIndexBy(s => s.isDecisionDashboard, 40) },
                    { name: 'موارد وإرشاد', desc: 'جهات داعمة وروابط مفيدة', icon: 'book', id: 'linkResourcesToolkit' }
                ]
            }
        ];
        const toolkitHtml = toolkitGroups.map(group => `
            <details class="dv-toolkit">
                <summary class="dv-toolkit__head">
                    <h3 class="dv-toolkit__title">${group.title}</h3>
                    <span class="dv-toolkit__note">${group.note}</span>
                </summary>
                <div class="dv-toolkit__items">
                    ${group.tools.map(toolButton).join('')}
                </div>
            </details>
        `).join('');
        const currentTheme = (() => {
            try {
                const stored = localStorage.getItem('feas_theme') || 'light';
                if (stored === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                return stored === 'dark' ? 'dark' : 'light';
            } catch (_) { return 'light'; }
        })();
        const activeHomePanel = ['studies', 'engines', 'support', 'additional', 'databases'].includes(this.activeHomePanel)
            ? this.activeHomePanel
            : 'studies';
        const allSupportTools = toolkitGroups.flatMap(group => group.tools);
        const journeyToolsCount = allSupportTools.filter(tool => Number.isFinite(tool.step)).length;
        const independentToolsCount = allSupportTools.length - journeyToolsCount;
        const supportToolsCount = allSupportTools.length;
        const homePanelId = (panel) => ({
            studies: 'homePanel-studies',
            engines: 'toolsAndEngines',
            support: 'studyToolkits',
            additional: 'additionalReadyStudies',
            databases: 'databaseFilesRootPanel'
        }[panel] || 'homePanel-studies');
        const homeNavButton = (panel, iconName, title, desc, badge) => `
            <button type="button"
                class="dv-bento-tile dv-bento-tile--small ${activeHomePanel === panel ? 'is-active' : ''}"
                data-dv-panel-button="${panel}"
                role="tab"
                aria-controls="${homePanelId(panel)}"
                aria-selected="${activeHomePanel === panel ? 'true' : 'false'}">
                <span class="dv-bento-tile__label"><span class="dv-bento-tile__ic">${inlineIcon(iconName)}</span> ${title}</span>
                <span class="dv-bento-tile__count dv-num">${badge}</span>
                <span class="dv-bento-tile__hint">${desc}</span>
            </button>
        `;

        this.container.innerHTML = `
            <div class="dashboard-view dv animate-entry">

                <!-- ١. شريط العمل (مساحة عمل — لا هيرو تسويقي) -->
                <header class="dv-topbar">
                    <button type="button" id="dvBrandHome" class="dv-brand" title="الرئيسية">
                        <span class="dv-brand__mark">ق</span>
                        <span class="dv-brand__name">قرار</span>
                    </button>
                    <span class="dv-brand__ctx">مساحة العمل — دراسة الجدوى</span>
                    <!-- Resource Menu Anchor (ResourcesMenu يملؤها) -->
                    <div id="resources-menu-root" class="dv-resources"></div>
                    <span class="dv-topbar__sp"></span>
                    <!-- تدقيق محتوى: زر تبديل المظهر (headerThemeToggle/btnThemeToggle) كان بلا أي
                         وسيلة وصول في وضع اللوحة — حاويتاهما (.app-header وsidebar) مخفيتان بالكامل
                         في dashboard-mode. زر مكافئ هنا داخل شريط عمل ظاهر دائماً. -->
                    <button type="button" id="dvThemeToggle" class="btn-icon" aria-label="تبديل المظهر" title="المظهر: داكن / فاتح">
                        <span data-theme-icon="dark" style="${currentTheme === 'dark' ? '' : 'display:none'}"><svg class="ic" aria-hidden="true"><use href="#i-moon"/></svg></span>
                        <span data-theme-icon="light" style="${currentTheme === 'light' ? '' : 'display:none'}"><svg class="ic" aria-hidden="true"><use href="#i-sun"/></svg></span>
                        <span data-theme-icon="auto" style="display:none"><svg class="ic" aria-hidden="true"><use href="#i-auto"/></svg></span>
                    </button>
                    <div class="dv-topbar__auth">
                        ${!this.currentUser ? `
                            <button type="button" id="dashboardLogin" class="btn btn--sm btn--secondary">${icon('i-user')} تسجيل الدخول</button>
                        ` : `
                            <span class="dv-userchip"><span class="dv-userchip__dot"></span> ${userEmail}</span>
                            <button type="button" id="btnUserProfile" class="btn btn--sm btn--ghost" title="حسابي">${icon('i-user')} حسابي</button>
                            <button type="button" id="btnLogout" class="btn btn--sm btn--ghost dv-logout">خروج</button>
                        `}
                    </div>
                </header>

                <!-- ٢. مساحة العمل: شبكة Bento بدل التنقل الجانبي (اعتماد 2026-07-16) -->
                <div class="dv-workspace" id="homeWorkspace">
                    <div class="dv-home-panels">
                        <section class="dv-section dv-home-panel" id="homePanel-studies" data-home-panel="studies" ${activeHomePanel !== 'studies' ? 'hidden' : ''}>

                            <div class="dv-bento" role="tablist" aria-label="مساحتك">
                                ${hasProjects ? `
                                <div class="dv-bento-tile dv-bento-tile--hero">
                                    <div>
                                        <span class="dv-bento-tile__eyebrow">${inlineIcon('folder')} متابعة</span>
                                        <h3 class="dv-bento-tile__heroTitle">${escapeHtml(filtered[0]?.name || 'مشروعك')}</h3>
                                        ${lastStep ? `<p class="dv-bento-tile__hint">آخر خطوة: ${lastStep.label}</p>` : ''}
                                    </div>
                                    ${lastStep ? `<button type="button" id="btnContinueLastStep" class="btn btn--primary">${inlineIcon('play')} تابع من حيث توقفت</button>` : ''}
                                </div>
                                ` : ''}

                                <div class="dv-bento-tile dv-bento-tile--wide">
                                    <span class="dv-bento-tile__eyebrow">${inlineIcon('bulb')} ابدأ</span>
                                    <div class="dv-bento-tile__stack">
                                        <button type="button" id="cardFullStudy" class="btn btn--primary">${icon('i-plus')} دراسة جديدة</button>
                                    </div>
                                </div>

                                ${hasProjects ? `<div class="dv-bento-tile dv-bento-tile--wide dv-bento-tile--quality">${await this.renderQualityStrip(filtered)}</div>` : ''}

                                ${homeNavButton('engines', 'chart', 'الأدوات والمحرّكات', 'اختصارات خطوات الدراسة والنتائج', STEPS.length)}
                                ${homeNavButton('support', 'clipboard', 'أدوات مساندة للدراسة', 'جمع بيانات، تحقق، تصدير، وربط', supportToolsCount)}
                                ${homeNavButton('additional', 'book', 'دراسات جدوى جاهزة', 'ملفات جاهزة للتحميل', 'ملفات')}
                                ${homeNavButton('databases', 'list', 'قواعد بيانات', 'أدلة وبيانات القطاعات', 'ملفات')}
                            </div>

                            <div class="dv-section__head dv-section__head--row">
                                <h2 class="dv-section__title">دراساتك <span class="dv-count dv-num">(${filtered.length})</span></h2>
                                ${hasProjects ? `
                                <div class="dv-toolbar__organize">
                                    <label for="dashboardFolderFilter" class="dv-toolbar__label">عرض:</label>
                                    <select id="dashboardFolderFilter" name="folderFilter" class="input input--sm dv-toolbar__select">
                                        ${folderOptions}
                                    </select>
                                    <button type="button" id="btnNewFolder" class="btn btn--sm btn--secondary">${icon('i-folder')} مجلد جديد</button>
                                    <input type="text" id="dashboardSearch" name="searchQuery" aria-label="بحث عن مشروع" class="input input--sm dv-toolbar__search" placeholder="بحث بالاسم..." value="${(this.searchQuery || '').replace(/"/g, '&quot;')}" />
                                </div>
                                ` : ''}
                            </div>

                            <!-- تدقيق محتوى: باقتا «مراجَع بخبير»/«خدمة كاملة» لم تكونا مذكورتين
                                 إطلاقاً في مساحة العمل — الفرصة البيعية الوحيدة كانت مؤجَّلة لحظة
                                 التصدير النهائية عبر PaywallModal.js فقط. بطاقة تعريفية مبكرة هنا. -->
                            ${hasProjects ? this.renderExpertCta() : ''}

                            <!-- Projects Grid -->
                            ${!hasProjects ? this.renderEmptyState() : `
                                <div class="dv-projects" id="projectsGrid">
                                    ${filtered.map(p => {
            try {
                return this.renderProjectCard(p);
            } catch (err) {
                console.error('Error rendering project card:', err);
                return '<div class="card">خطأ في عرض المشروع</div>';
            }
        }).join('')}
                                </div>
                            `}
                        </section>

                        <section class="dv-section dv-home-panel" id="additionalReadyStudies" data-home-panel="additional" ${activeHomePanel !== 'additional' ? 'hidden' : ''}>
                            <div id="readyStudiesRoot"></div>
                        </section>

                        <section class="dv-section dv-home-panel" id="databaseFilesRootPanel" data-home-panel="databases" ${activeHomePanel !== 'databases' ? 'hidden' : ''}>
                            <div id="databaseFilesRoot"></div>
                        </section>

                        <!-- 4. مختصر رحلة الدراسة — نفس خطوات القائمة اليسرى داخل صفحة مستقلة -->
                        <section class="dv-section dv-section--tools dv-home-panel" id="toolsAndEngines" data-home-panel="engines" ${activeHomePanel !== 'engines' ? 'hidden' : ''}>
                            <div class="dv-section__head">
                                <h2 class="dv-section__title">الأدوات والمحرّكات</h2>
                                <p class="dv-section__sub">مختصر رحلة المستخدم كاملة — كل خطوات الدراسة مصنّفة هنا وتفتح مباشرة.</p>
                            </div>
                            <div class="dv-toolsbar">
                                <input type="search" id="toolsSearch" class="input input--sm dv-toolsbar__search" aria-label="بحث في الأدوات والخطوات" placeholder="ابحث في الخطوات والأدوات..." />
                                <span class="dv-toolsbar__hint">الأقسام تفتح تلقائياً عند وجود نتيجة</span>
                            </div>
                            <div class="dv-tools dv-tools--journey">
                                ${journeySections}
                            </div>
                            <!-- الاختصارات الثلاثة الأخرى (تمويل/تصدير/موارد) أُزيلت من هنا — كانت مكرَّرة
                                 حرفياً (نفس المعالج) مع أدوات «التحليل المالي» و«الإخراج والتقديم» في تبويب
                                 «أدوات مساندة للدراسة»، بفهرس بحث منفصل لكل نسخة. أُبقي على محاكي التمويل
                                 وحده لأنه الفحص الأهم لهذا التبويب تحديداً. -->
                            <h3 class="dv-toolcol__title dv-quicktools__heading">اختصار سريع</h3>
                            <div class="dv-quicktools">
                                ${toolButton({ id: 'btnFundingSim', icon: 'bank', name: 'محاكي قبول التمويل', desc: 'اختبار سريع لجاهزية التمويل', engine: true, compact: false })}
                            </div>
                        </section>

                        <section class="dv-section dv-section--tools dv-home-panel" id="studyToolkits" data-home-panel="support" ${activeHomePanel !== 'support' ? 'hidden' : ''}>
                            <div class="dv-section__head">
                                <h2 class="dv-section__title">أدوات مساندة للدراسة</h2>
                                <p class="dv-section__sub">جمع بيانات، تحليل، تخطيط، جودة، وإخراج — كلها مرتبطة بخطوات الدراسة أو بمحركات جاهزة.</p>
                            </div>
                            <div class="dv-toolsbar">
                                <input type="search" id="supportToolsSearch" class="input input--sm dv-toolsbar__search" aria-label="بحث في الأدوات المساندة" placeholder="ابحث في الأدوات المساندة..." />
                                <span class="dv-toolsbar__hint">استخدمها قبل أو أثناء تعبئة الدراسة</span>
                            </div>
                            <div class="dv-tools-count-note" role="status">
                                ${journeyToolsCount} اختصاراً لخطوات الدراسة، و${independentToolsCount} أداة/مصدر مستقل فعلياً (${supportToolsCount} إجمالاً).
                            </div>
                            <div class="dv-toolkits">
                                <div class="dv-toolkit-grid">
                                    ${toolkitHtml}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

            </div>

            <!-- Competitor Gap 2: Sensitivity Widget (معطّل حالياً — انظر ملاحظة ما بعد الرندر) -->
            <div id="sensitivity-widget-root" class="hidden"></div>

            <!-- Funding Simulator Modal -->
            <div id="funding-sim-root" class="dv-modal hidden">
                <div class="dv-modal__panel">
                    <button id="btnCloseFundingSim" class="dv-modal__close" aria-label="إغلاق">&times;</button>
                    <div id="funding-sim-container"></div>
                </div>
            </div>

            <!-- Founder Card Root (Viral Growth) -->
            <div id="founder-card-root"></div>
        `;

        // Post-render initialization
        // (عدّاد جاهزية الفكرة أُزيل من الهيرو الجديد — لا معنى لعرض 0% في صفحة «ابدأ دراسة جديدة»)
        if (projects && projects.length > 0) {
            // Sensitivity Widget (Floating or Inline)
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

        const readyStudiesRoot = this.container.querySelector('#readyStudiesRoot');
        if (readyStudiesRoot) {
            this.readyStudiesView = new ReadyStudiesView('readyStudiesRoot');
            if (this.activeHomePanel === 'additional') {
                this.readyStudiesView.render();
            }
        }

        const databaseFilesRoot = this.container.querySelector('#databaseFilesRoot');
        if (databaseFilesRoot) {
            this.databaseFilesView = new DatabaseFilesView('databaseFilesRoot');
            if (this.activeHomePanel === 'databases') {
                this.databaseFilesView.render();
            }
        }

        this.bindEvents();
        // كان معرَّفاً بالكامل ولا يُستدعى إطلاقاً (تدقيق مجلس الحرب) — دليل الوصول
        // الوحيد لتوجيه أول زيارة نحو «جدوى سريعة» أو «دراسة احترافية» بعد حذف الهيرو.
        if (!hasProjects) this.maybeShowOnboarding();
        this.hydrateProjectCompleteness(filtered);
    }

    // تحميل مؤجَّل لشارة «جودة المسودة» للبطاقات التي وصلت بلا بيانات كاملة (غالباً
    // كل الدراسات) — بعد أول رسم فوري للصفحة، لا قبله (انظر renderProjectCard أعلاه).
    hydrateProjectCompleteness(projects) {
        (projects || []).forEach(project => {
            if (project.data && project.data.projectInfo) return; // كانت متاحة فوراً أصلاً
            const slot = this.container.querySelector(`[data-completeness-for="${project.id}"]`);
            if (!slot) return;
            ProjectManager.loadProject(project.id)
                .then(loaded => {
                    const freshSlot = this.container.querySelector(`[data-completeness-for="${project.id}"]`);
                    if (!freshSlot) return; // المستخدم غادر البطاقة (فلترة/بحث) قبل اكتمال التحميل
                    const projectData = loaded?.data || project;
                    freshSlot.outerHTML = this.buildCompletenessHTML(projectData);
                })
                .catch(err => console.warn('Could not hydrate completeness for project:', project.id, err));
        });
    }

    maybeShowOnboarding() {
        const key = 'feas_onboarding_v1_dismissed';
        let dismissed = false;
        try { dismissed = localStorage.getItem(key) === '1'; } catch (_) { }
        if (dismissed) return;
        if (document.getElementById('onboardingOverlay')) return;

        const overlay = document.createElement('div');
        // تدقيق بصري: "is-open" كانت تُضاف منذ لحظة الإنشاء نفسها (قبل أي appendChild)،
        // فلا تحصل حالة "مغلق" (opacity:0) على أي إطار رسم فعلي قبل تطبيق "مفتوح" —
        // فينعدم أثر transition المعرَّف في CSS ويظهر التلاشي كقفزة جافة. أُضيفت بعد الإدراج بإطارين.
        overlay.className = 'modal-overlay modal-overlay--nonblocking';
        overlay.id = 'onboardingOverlay';

        overlay.innerHTML = `
            <div class="modal-card modal-card--onboarding" style="max-width:560px;" role="region" aria-labelledby="onboardingTitle">
                <div class="modal-header">
                    <h3 id="onboardingTitle">مرحباً بك في محاكي الجدوى</h3>
                    <button type="button" class="btn-close" aria-label="إغلاق">×</button>
                </div>
                <div class="modal-body text-sm">
                    <p class="text-muted dv-onb__lead">ابدأ بأسرع طريق للوصول لقرار واضح، ثم صدّر تقريرك.</p>
                    <ol class="dv-onb__steps">
                        <li>
                            <b>دراسة احترافية</b>
                            <span>تفاصيل مناسبة للتمويل والتقديم للجهات.</span>
                        </li>
                        <li>
                            <b>تصدير</b>
                            <span>من داخل الدراسة: استخدم زر «تصدير» للحصول على التقرير والجداول والملف القابل للتعديل.</span>
                        </li>
                    </ol>
                    <div class="dv-onb__actions">
                        <button type="button" id="btnOnboardingFull" class="btn btn--primary btn--sm">${inlineIcon('briefcase')} ابدأ دراسة احترافية</button>
                        <button type="button" id="btnOnboardingDismiss" class="btn btn--ghost btn--sm">فهمت</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        // rAF مزدوج: يضمن أن المتصفح رسم حالة "مغلق" (بلا is-open) في إطار فعلي أولاً،
        // فيكون لديه قيمة بداية ينتقل منها عند إضافة is-open في الإطار التالي.
        // + شبكة أمان setTimeout: rAF قد لا يُطلَق إطلاقاً في تبويب غير نشط/مصغَّر (تحقّق حي)،
        // فتبقى النافذة عالقة على opacity:0 (مخفية تماماً) بلا شبكة أمان — classList.remove/add آمنة التكرار.
        const revealOnboarding = () => overlay.classList.add('is-open');
        requestAnimationFrame(() => requestAnimationFrame(revealOnboarding));
        setTimeout(revealOnboarding, 300);
        const previousBodyOverflow = document.body.style.overflow;

        const closeBtn = overlay.querySelector('.btn-close');
        const btnDismiss = overlay.querySelector('#btnOnboardingDismiss');
        const btnFull = overlay.querySelector('#btnOnboardingFull');

        const restoreOverflow = () => { document.body.style.overflow = previousBodyOverflow; };
        const markDismissed = () => { try { localStorage.setItem(key, '1'); } catch (_) { } };

        const close = () => {
            markDismissed();
            overlay.remove();
            restoreOverflow();
            this.dismissOnboardingTip = null;
            const focusBack = this.container.querySelector('#cardFullStudy');
            if (focusBack) setTimeout(() => focusBack.focus(), 0);
        };

        const cleanup = () => {
            document.removeEventListener('keydown', onEsc);
        };

        const closeAndCleanup = () => { close(); cleanup(); };

        const onEsc = (e) => { if (e.key === 'Escape') closeAndCleanup(); };
        document.addEventListener('keydown', onEsc);
        this.dismissOnboardingTip = closeAndCleanup;

        closeBtn?.addEventListener('click', closeAndCleanup);
        btnDismiss?.addEventListener('click', closeAndCleanup);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAndCleanup(); });

        btnFull?.addEventListener('click', () => {
            closeAndCleanup();
            this.container.querySelector('#cardFullStudy')?.click();
        });

        setTimeout(() => (closeBtn || btnFull || btnDismiss)?.focus(), 0);
    }


    renderEmptyState() {
        // حالة «تصفية بلا نتائج»: توجد دراسات لكن البحث/المجلد لم يُطابق شيئاً
        const isFiltered = !!(this.searchQuery || this.selectedFolderId);
        if (isFiltered) {
            const reason = this.searchQuery
                ? `لا توجد دراسة باسم «${(this.searchQuery || '').replace(/</g, '&lt;')}»`
                : 'لا توجد دراسات في هذا المجلد بعد';
            return `
                <div class="empty-state dv-empty dvh-empty dvh-empty--filtered">
                    <span class="dv-empty__ic">${icon('i-folder')}</span>
                    <h3 class="dv-empty__title">${reason}</h3>
                    <p class="dv-empty__sub">جرّب تعديل البحث أو اعرض جميع المشاريع.</p>
                    <div class="dv-empty__actions">
                        <button type="button" id="btnClearDashboardFilter" class="btn btn--secondary">${icon('i-reset')} عرض جميع المشاريع</button>
                    </div>
                </div>
            `;
        }

        // الحالة الفارغة الحقيقية: لا دراسات إطلاقاً — دعوة قوية لبدء أول دراسة
        return `
            <div class="empty-state dv-empty dvh-empty">
                <span class="dv-empty__ic">${icon('i-folder')}</span>
                <h3 class="dv-empty__title">ابدأ أول دراسة جدوى لمشروعك</h3>
                <p class="dv-empty__sub">لا توجد دراسات محفوظة بعد. ابدأ دراسة احترافية كاملة.</p>
                <ul class="dvh-empty__benefits">
                    <li>${inlineIcon('chart')} توقعات مالية ٥ سنوات</li>
                    <li>${inlineIcon('trend')} مؤشرات القرار: عائد وقيمة</li>
                    <li>${inlineIcon('download')} تقرير وجداول قابلة للتصدير</li>
                    <li>${inlineIcon('shield')} ضريبة القيمة المضافة والزكاة والتأمينات محسوبة تلقائياً</li>
                </ul>
                <p class="dv-empty__price">${PRICING_DISPLAY?.startPrice || 'ابدأ مجاناً'}</p>
                <div class="dv-empty__actions">
                    <button type="button" id="btnNewProjectEmpty" class="btn btn--primary">${icon('i-plus')} دراسة جديدة (كاملة)</button>
                </div>
            </div>
        `;
    }

    // مقياس «جودة المسودة» يُبنى هنا لاستخدامه فوراً (بيانات جاهزة) أو لاحقاً (تحميل مؤجَّل).
    buildCompletenessHTML(projectData) {
        try {
            const completeness = calculateStudyCompleteness(projectData);
            const percentage = completeness.percentage;
            const level = percentage >= 80 ? 'is-good' : percentage >= 50 ? 'is-mid' : 'is-low';
            const tips = typeof completeness.getTipsToRaiseScore === 'function' ? completeness.getTipsToRaiseScore().slice(0, 1) : [];
            return `
                <div class="dv-quality-mini ${level}">
                    <div class="dv-quality-mini__row">
                        <span title="نسبة اكتمال حقول الدراسة — لا تقيس جودة القرار المالي نفسه">جودة المسودة</span>
                        <b class="dv-num">${percentage}%</b>
                    </div>
                    <div class="dv-track dv-track--thin"><div class="dv-track__fill" style="width: ${percentage}%"></div></div>
                    ${percentage < 100 && tips.length ? `<p class="dv-quality-mini__tip" title="نصائح لرفع النقاط">${inlineIcon('trend')} ${tips[0]}</p>` : ''}
                </div>
            `;
        } catch (e) {
            console.warn('Could not calculate completeness for project:', e);
            return '';
        }
    }

    // مُتزامنة عمداً: قائمة المشاريع عناوين خفيفة بلا `data` غالباً، وتحميل الدراسة الكاملة
    // (شبكياً للمحفوظ سحابياً) لكل بطاقة كان يُعلِّق رسم الصفحة كاملة بانتظار الجميع دفعة
    // واحدة فقط لحساب نسبة زخرفية. الآن: رسم فوري ببيانات ما هو متاح، وتحميل مؤجَّل
    // لشارة «جودة المسودة» فقط عبر hydrateProjectCompleteness() بعد أول رسم.
    renderProjectCard(project) {
        // -u-nu-latn: يفرض أرقاماً لاتينية — بدونها ar-SA يُخرج أرقاماً هندية شرقية (١٠/٧/٢٠٢٦)
        // تتعارض مع باقي الأرقام المعروضة بخط JetBrains Mono اللاتيني في نفس البطاقة (.dv-num).
        const date = new Date(project.lastModified || project.updated_at).toLocaleDateString('ar-SA-u-nu-latn');
        const isCloud = project.source === 'cloud' || project.source === 'synced';
        const isLocal = project.source === 'local';
        const hasInlineData = !!(project.data && project.data.projectInfo);
        const projectData = hasInlineData ? project.data : null;

        const folders = DashboardView.getFolders();
        const folderOptions = [
            '<option value="">بدون مجلد</option>',
            ...folders.map(f => `<option value="${f.id}" ${(project.folderId || null) === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`)
        ].join('');

        const completenessHTML = hasInlineData
            ? this.buildCompletenessHTML(projectData)
            : `<div class="dv-quality-mini dv-quality-mini--pending" data-completeness-for="${project.id}"></div>`;

        const badges = [
            isCloud ? `<span class="badge badge--info dv-badge" title="محفوظ سحابياً">${inlineIcon('cloud')} سحابي</span>` : '',
            (isLocal && !isCloud) ? `<span class="badge badge--warning dv-badge" title="محفوظ محلياً فقط">${inlineIcon('laptop')} محلي</span>` : '',
            (hasInlineData && projectData.projectInfo?.members?.length > 0) ? `<span class="badge badge--success dv-badge" title="مشترك مع فريق">${icon('i-user')} مشترك</span>` : ''
        ].filter(Boolean).join('');

        const safeName = escapeHtml(project.name || 'مشروع بدون اسم');
        return `
            <div class="project-card dv-card dv-project" data-id="${project.id}" role="button" tabindex="0" aria-label="فتح دراسة ${safeName}">
                <div class="dv-project__head">
                    <span class="dv-card__ic dv-card__ic--soft dv-card__ic--sm">${icon('i-chart')}</span>
                    <div class="dv-project__id">
                        <h3 class="dv-project__name" title="${safeName}">${safeName}</h3>
                        <p class="dv-project__date">آخر تعديل: <span class="dv-num">${date}</span></p>
                    </div>
                    <span class="dvh-project__enter" aria-hidden="true">${inlineIcon('chev')}</span>
                </div>

                ${badges ? `<div class="dv-project__badges">${badges}</div>` : ''}
                ${isLocal && !isCloud ? `<p class="dv-project__local-warning" role="note">هذه المسودة محفوظة على هذا الجهاز فقط. صدّر نسخة احتياطية قبل تغيير الجهاز أو مسح بيانات المتصفح.</p>` : ''}

                ${folders.length ? `
                <div class="dv-project__folder">
                    <label class="dv-project__folder-label">مجلد:</label>
                    <select class="project-folder-select input input--sm w-full text-xs" data-id="${project.id}" onclick="event.stopPropagation()">${folderOptions}</select>
                </div>` : ''}

                ${completenessHTML}

                <div class="dv-project__actions">
                    <button class="btn btn--sm btn--secondary dv-project__open btn-open" data-id="${project.id}">فتح</button>
                    <button class="btn btn--sm btn--ghost dv-iconbtn btn-share" data-id="${project.id}" title="عرض المستثمر (مشاركة)">${icon('i-share')}</button>
                    <button class="btn btn--sm btn--ghost dv-iconbtn btn-duplicate" data-id="${project.id}" title="نسخ المشروع">${icon('i-clipboard')}</button>
                    <button class="btn btn--sm btn--ghost dv-iconbtn dv-iconbtn--danger btn-delete" data-id="${project.id}" title="نقل لسلة المحذوفات">${icon('i-trash')}</button>
                </div>
            </div>
        `;
    }

    // البيانات القادمة من قائمة المشاريع عناوين خفيفة بلا `projectInfo` (نفس علة renderProjectCard) —
    // فالشرط القديم `!latest.projectInfo` كان يتحقق دائماً فيُسقط الشريط صامتاً لكل مستخدم حقيقي.
    async renderQualityStrip(projects) {
        if (!projects || projects.length === 0) return '';
        const header = projects[0];
        let latest = header;
        if (!latest.projectInfo) {
            try {
                const loaded = await ProjectManager.loadProject(header.id);
                latest = loaded?.data || null;
            } catch (_) { latest = null; }
        }
        if (!latest || !latest.projectInfo) return '';

        try {
            const q = QualityCalculator.calculate(latest);
            const badgeLabel = stripEmoji(q.badge) || 'بيانات أساسية';
            return `
                <section id="quality-strip" class="dv-section">
                    <div class="dv-quality">
                        <div class="dv-quality__info">
                            <div class="dv-quality__head">
                                <span class="dv-pill dv-pill--onband">${badgeLabel}</span>
                                <h3 class="dv-quality__title">اكتمال بيانات الدراسة — <span class="dv-quality__name">${escapeHtml(latest.projectInfo.name || '')}</span></h3>
                            </div>
                            <p class="dv-quality__hint">أكملت <b class="dv-num">${q.score}%</b> من الدراسة. ${q.missing.length > 0 ? 'خطوتك التالية: ' + q.missing[0].label : 'ممتاز! الدراسة مكتملة.'}</p>
                            <p class="dv-quality__caveat">هذه النسبة تقيس اكتمال البيانات المدخلة فقط، لا سلامة القرار المالي — راجع مؤشرات NPV وIRR ونقطة التعادل لمعرفة ذلك.</p>
                        </div>
                        <div class="dv-quality__cta-wrap">
                            <div class="dv-track dv-track--onband"><div class="dv-track__fill" style="width: ${q.score}%"></div></div>
                            <button class="btn btn--sm dv-quality__cta btn-open" data-id="${header.id}">${icon('i-pen')} حسّن النتيجة</button>
                        </div>
                    </div>
                </section>
            `;
        } catch (e) { console.error(e); return ''; }
    }

    // بطاقة تعريفية بباقة «مراجَع بخبير» ضمن مساحة العمل نفسها — قبل ذلك لم تكن الباقات
    // المدفوعة الأعلى هامشاً (تتطلب تدخلاً بشرياً فعلياً) تظهر إلا داخل نافذة القفل
    // (PaywallModal.js) عند محاولة التصدير، أي في آخر لحظة ممكنة من رحلة المستخدم.
    renderExpertCta() {
        try {
            const pkg = PRICING_PACKAGES.find(p => p.id === 'reviewed');
            if (!pkg) return '';
            const waLink = buildWhatsAppLink(`مرحباً، أرغب بمراجعة خبير لدراستي عبر منصة «قرار» (باقة «${pkg.name}» — ${formatPrice(pkg.price)} ${CURRENCY_SYMBOL}).`);
            // waLink يكون null إن كان رقم واتساب غير مضبوط بعد — لا نعرض رابطاً مكسوراً
            // (نفس منطق التراجع الرشيق في PaywallModal.js وlanding.html).
            const ctaAction = waLink
                ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn--sm btn--secondary">تواصل عبر واتساب</a>`
                : `<span class="text-xs text-muted">قناة واتساب غير متاحة حالياً</span>`;
            return `
                <div class="dv-expert-cta">
                    <span class="dv-expert-cta__ic">${icon('i-user')}</span>
                    <div class="dv-expert-cta__body">
                        <strong>محتار في افتراضاتك؟ دع خبيراً يراجع دراستك</strong>
                        <span>${formatPrice(pkg.price)} ${CURRENCY_SYMBOL} — مراجعة مختص وتحليل حساسية موسّع قبل التسليم</span>
                    </div>
                    ${ctaAction}
                </div>
            `;
        } catch (e) { console.warn('renderExpertCta failed:', e); return ''; }
    }

    bindEvents() {
        // Login
        const btnLogin = this.container.querySelector('#dashboardLogin');
        if (btnLogin) {
            btnLogin.addEventListener('click', async () => {
                const { AuthModal } = await import('./AuthModalStub.js');
                new AuthModal('authModalContainer', {
                    onSuccess: () => this.render() // Refresh dashboard on success
                }).open();
            });
        }

        // تبديل المظهر (تدقيق محتوى: كان زرا #btnThemeToggle/#headerThemeToggle بلا أي
        // وسيلة وصول في وضع اللوحة لأن حاويتيهما مخفيتان بالكامل بـ dashboard-mode).
        // زر مكافئ هنا يبدّل نفس مفتاح localStorage['feas_theme'] المستخدم في theme-init.js.
        this.container.querySelector('#dvThemeToggle')?.addEventListener('click', (e) => {
            let current = 'light';
            try { current = localStorage.getItem('feas_theme') || 'light'; } catch (_) { /* تجاهل */ }
            if (current === 'auto') current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            const next = current === 'light' ? 'dark' : 'light';
            try { localStorage.setItem('feas_theme', next); } catch (_) { /* تجاهل */ }
            document.documentElement.setAttribute('data-theme', next);
            const btn = e.currentTarget;
            const darkIc = btn.querySelector('[data-theme-icon="dark"]');
            const lightIc = btn.querySelector('[data-theme-icon="light"]');
            if (darkIc) darkIc.style.display = next === 'dark' ? '' : 'none';
            if (lightIc) lightIc.style.display = next === 'light' ? '' : 'none';
        });

        // حسابي (تدقيق 2026-07-09 — توحيد المصادقة): كان هذا الزر موجوداً فقط داخل
        // AuthComponent.js الميت (حاويته مخفية دائماً)، فصفحة الحساب/إعدادات 2FA
        // (UserProfileView.js) لم تكن قابلة للوصول إطلاقاً من أي مسار حي.
        this.container.querySelector('#btnUserProfile')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showUserProfile'));
        });

        // Logout
        this.container.querySelector('#btnLogout')?.addEventListener('click', async () => {
            const result = await Swal.fire({
                title: 'هل أنت متأكد؟',
                text: 'هل تود تسجيل الخروج؟',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'نعم، سجّل الخروج',
                cancelButtonText: 'إلغاء',
                customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                buttonsStyling: false
            });
            if (result.isConfirmed) {
                await signOut();
            }
        });

        // New Project (Standard / Full Study)
        const handleNew = async () => {
            window.dispatchEvent(new CustomEvent('feasibility:newStudy'));
        };

        // Card: Full Professional Study
        this.container.querySelector('#cardFullStudy')?.addEventListener('click', (e) => {
            this.dismissOnboardingTip?.();
            handleNew();
        });

        const switchHomePanel = (panel, { scroll = false, focusSelector = null } = {}) => {
            if (!['studies', 'engines', 'support', 'additional', 'databases'].includes(panel)) return;
            this.activeHomePanel = panel;

            if (panel === 'additional' && this.readyStudiesView && !this.readyStudiesView.loaded) {
                this.readyStudiesView.render();
            }
            if (panel === 'databases' && this.databaseFilesView && !this.databaseFilesView.loaded) {
                this.databaseFilesView.render();
            }
            this.container.querySelectorAll('[data-dv-panel-button]').forEach(btn => {
                const isActive = btn.dataset.dvPanelButton === panel;
                btn.classList.toggle('is-active', isActive);
                btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            this.container.querySelectorAll('[data-home-panel]').forEach(section => {
                const show = section.dataset.homePanel === panel;
                section.hidden = !show;
                if (show) {
                    // تدقيق بصري: تبديل التبويبات كان فورياً بلا أي حركة — تلاشي دخول خفيف فقط.
                    // شبكة أمان setTimeout: بلا rAF يُطلَق (تبويب غير نشط) يبقى القسم عالقاً على
                    // opacity:0 (مخفياً تماماً رغم hidden=false) — تحقّق حي كشف هذا الخطر فعلياً.
                    section.classList.add('is-appearing');
                    const revealPanel = () => section.classList.remove('is-appearing');
                    requestAnimationFrame(() => requestAnimationFrame(revealPanel));
                    setTimeout(revealPanel, 300);
                }
            });
            if (scroll) {
                this.container.querySelector('#homeWorkspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            if (focusSelector) {
                setTimeout(() => this.container.querySelector(focusSelector)?.focus({ preventScroll: true }), 160);
            }
        };

        this.container.querySelectorAll('[data-dv-panel-button]').forEach(btn => {
            btn.addEventListener('click', () => switchHomePanel(btn.dataset.dvPanelButton));
        });

        // شعار «قرار» بالشريط العلوي (ظاهر دائماً) يعيد المستخدم لتبويب «دراساتك» —
        // ضروري الآن لأن شريط التنقل الجانبي الدائم أُزيل لصالح شبكة Bento داخل تبويب
        // «دراساتك» نفسه، فلا توجد وسيلة رجوع أخرى وأنت داخل تبويب آخر (مثل الأدوات).
        this.container.querySelector('#dvBrandHome')?.addEventListener('click', () => switchHomePanel('studies'));

        this.container.querySelector('#btnContinueLastStep')?.addEventListener('click', () => {
            const index = Number(localStorage.getItem('feas_last_step_index'));
            if (Number.isInteger(index) && STEPS[index]) this.options.onShowStudyStep?.(index);
        });

        // Funding Simulator Toggle
        // تدقيق بصري: .dv-modal بلا أي transition — تظهر النافذة بقفزة جافة. الآن حالة
        // "is-entering" (opacity:0) تُضاف أولاً، وتُزال بعد رسم فعلي (rAF مزدوج) فيتلاشى الظهور.
        this.container.querySelectorAll('#btnFundingSim, #btnFundingSimToolkit').forEach(btn => btn.addEventListener('click', () => {
            const modal = this.container.querySelector('#funding-sim-root');
            if (!modal) return;
            modal.classList.add('is-entering');
            modal.classList.remove('hidden');
            // شبكة أمان setTimeout: بلا rAF يُطلَق (تبويب غير نشط) تبقى النافذة على opacity:0 دائماً.
            const revealModal = () => modal.classList.remove('is-entering');
            requestAnimationFrame(() => requestAnimationFrame(revealModal));
            setTimeout(revealModal, 300);
        }));
        this.container.querySelector('#btnCloseFundingSim')?.addEventListener('click', () => {
            this.container.querySelector('#funding-sim-root').classList.add('hidden');
        });
        this.container.querySelector('#funding-sim-root')?.addEventListener('click', (e) => {
            if (e.target.id === 'funding-sim-root') {
                e.target.classList.add('hidden');
            }
        });

        // زر «دراسة جديدة (كاملة)» في الحالة الفارغة — كان بلا معالج
        this.container.querySelector('#btnNewProjectEmpty')?.addEventListener('click', handleNew);

        // مسح التصفية (بحث/مجلد) من داخل الحالة الفارغة المُصفّاة
        this.container.querySelector('#btnClearDashboardFilter')?.addEventListener('click', () => {
            this.searchQuery = '';
            this.selectedFolderId = null;
            this.render();
        });

        // Initialize Resources Menu
        new ResourcesMenu('resources-menu-root', this.options).render();

        // Journey Links (دليل سريع، منشآت، تمويل، إلخ) — event delegation
        const journeyLinkHandlers = {
            linkQuickStartFromJourneys: () => this.options.onShowQuickStartGuide?.(),
            linkBeginnerFromJourneys: () => this.options.onShowBeginnerGuide?.(),
            linkPreliminaryCheckFromJourneys: () => this.options.onShowPreliminaryCheck?.(),
            linkProjectAlternativesFromJourneys: () => this.options.onShowProjectAlternatives?.(),
            linkTemplatesFromJourneys: () => {
                this.dismissOnboardingTip?.();
                if (this.options.onShowTemplateSelector) this.options.onShowTemplateSelector();
                else window.dispatchEvent(new CustomEvent('feasibility:newStudy'));
            },
            linkMonshaatFromJourneys: () => this.options.onShowMonshaatCompliance?.(),
            linkFinancingToolkit: () => this.options.onShowFinancingGuide?.(),
            linkOperationalSimFromJourneys: () => this.options.onShowOperationalSimulator?.(),
            linkStressTestFromJourneys: () => this.options.onShowStressTest?.(),
            linkSensitivityFromJourneys: () => this.options.onShowSensitivity?.(),
            linkMonteCarloFromJourneys: () => this.options.onShowMonteCarlo?.(),
            linkReportBuilderFromJourneys: () => this.options.onShowReportBuilder?.(),
            linkExportToolkit: () => this.options.onOpenExport?.(),
            linkAcceleratorFromJourneys: () => this.options.onShowAcceleratorTips?.(),
            linkPostFeasibilityFromJourneys: () => this.options.onShowPostFeasibility?.(),
            linkPostLaunchFromJourneys: () => this.options.onShowPostLaunch?.(),
            linkResourcesToolkit: () => this.options.onShowResourcesGuide?.(),
            linkExamplesFromJourneys: () => this.options.onShowExamplesInspire?.(),
            linkExamplesToolkit: () => this.options.onShowExamplesInspire?.(),
            linkIdeaAssessmentFromJourneys: () => this.options.onShowIdeaAssessment?.(),
            linkBenchmarkingFromJourneys: () => this.options.onShowBenchmarking?.(),
            linkStudyCompleteness: () => this.options.onShowStudyCompleteness?.(),
            linkMonshaatToolkit: () => this.options.onShowMonshaatCompliance?.(),
            linkTrustCriteriaToolkit: () => this.options.onShowTrustCriteria?.(),
            linkImportCsvToolkit: () => document.getElementById('fileImportCSV')?.click(),
            linkImportCsvSources: () => document.getElementById('fileImportCSV')?.click(),
            linkPythonConnectorDocs: () => toast.info('ربط مصادر بيانات مخصّصة قيد الإعداد — نحفظ مفاتيح الوصول بأمان على خوادمنا بدل تخزينها في متصفحك.'),
            linkTrustCriteriaStats: () => this.options.onShowTrustCriteria?.()
        };
        this.container.addEventListener('click', (e) => {
            const stepButton = e.target.closest ? e.target.closest('[data-journey-step]') : null;
            if (stepButton) {
                e.preventDefault();
                const index = Number(stepButton.dataset.journeyStep);
                if (Number.isInteger(index)) this.options.onShowStudyStep?.(index);
                return;
            }
            const sourceButton = e.target.closest ? e.target.closest('[data-source-url]') : null;
            if (sourceButton) {
                e.preventDefault();
                const url = sourceButton.dataset.sourceUrl;
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
                return;
            }
            // closest بدل e.target.id مباشرة: يسمح بوجود أيقونات SVG داخل الروابط
            const el = e.target.closest ? e.target.closest('a[id], button[id]') : null;
            const handler = el && journeyLinkHandlers[el.id];
            if (handler) {
                e.preventDefault();
                handler();
            }
        });

        const bindToolSearch = (inputSelector, areaSelector) => {
            const input = this.container.querySelector(inputSelector);
            if (!input) return;
            const toolsArea = this.container.querySelector(areaSelector);
            input.addEventListener('input', () => {
                const q = (input.value || '').trim().toLowerCase();
                const rows = toolsArea ? toolsArea.querySelectorAll('.dv-toolrow') : [];
                rows.forEach(row => {
                    const text = (row.textContent || '').toLowerCase();
                    row.hidden = Boolean(q) && !text.includes(q);
                });
                const groups = toolsArea ? toolsArea.querySelectorAll('.dv-journey, .dv-toolkit') : [];
                groups.forEach(group => {
                    const hasVisibleRow = Boolean(group.querySelector('.dv-toolrow:not([hidden])'));
                    group.hidden = Boolean(q) && !hasVisibleRow;
                    if (q && hasVisibleRow && 'open' in group) group.open = true;
                });
                const quick = toolsArea ? toolsArea.querySelector('.dv-quicktools') : null;
                if (quick) {
                    const hasVisibleQuick = Boolean(quick.querySelector('.dv-toolrow:not([hidden])'));
                    quick.hidden = Boolean(q) && !hasVisibleQuick;
                }
            });
        };
        bindToolSearch('#toolsSearch', '#toolsAndEngines');
        bindToolSearch('#supportToolsSearch', '#studyToolkits');

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

        // Open Project
        this.container.querySelectorAll('.btn-open').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                // btn.dataset بدل e.target.dataset: النقر قد يقع على أيقونة SVG داخل الزر
                const id = btn.dataset.id;
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
            // إتاحة لوحة المفاتيح: Enter/Space يفتح البطاقة (role="button"/tabindex="0")
            // — نتجاهل حين يكون التركيز على زر/قائمة داخلية حتى لا نتعارض مع أفعالها
            card.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
                if (e.target !== card) return;
                e.preventDefault();
                this.loadProject(card.dataset.id);
            });
        });

        // Delete Project
        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const result = await Swal.fire({
                    title: 'هل أنت متأكد؟',
                    text: 'هل أنت متأكد من نقل هذه الدراسة إلى سلة المحذوفات؟',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'نعم، انقل',
                    cancelButtonText: 'إلغاء',
                    customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
                    buttonsStyling: false
                });
                if (result.isConfirmed) {
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
        loadingOverlay.className = 'dv-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="dv-loading-box">
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

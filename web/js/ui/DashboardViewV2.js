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

export class DashboardViewV2 {
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

export class DashboardViewV2 {
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
            <div class="dv2-workspace animate-entry">
                <!-- Sidebar -->
                <aside class="dv2-sidebar">
                    <div class="dv2-brand">
                        <div class="dv2-brand-mark">ق</div>
                        قرار
                    </div>
                    
                    <div style="margin-top: 32px; display: flex; flex-direction: column; gap: 8px;">
                        <button class="dv2-nav-btn is-active" id="btnSidebarHome">
                            <svg class="ic" aria-hidden="true"><use href="#i-folder"/></svg>
                            مساحة العمل
                        </button>
                        <button class="dv2-nav-btn text-indigo-400/90 hover:text-indigo-400 hover:bg-indigo-400/10" id="btnSidebarGlobalAnalytics">
                            <svg class="ic" aria-hidden="true"><use href="#i-pie-chart"/></svg>
                            لوحة الإحصائيات الشاملة
                        </button>
                        <button class="dv2-nav-btn text-slate-400/90 hover:text-slate-400 hover:bg-slate-400/10" id="btnSidebarDataRoom">
                            <svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg>
                            غرفة البيانات
                        </button>
                        <button class="dv2-nav-btn text-emerald-400/90 hover:text-emerald-400 hover:bg-emerald-400/10" id="btnSidebarKanban">
                            <svg class="ic" aria-hidden="true"><use href="#i-check-square"/></svg>
                            مدير المهام والتنفيذ
                        </button>
                        <button class="dv2-nav-btn text-cyan-400/90 hover:text-cyan-400 hover:bg-cyan-400/10" id="btnSidebarCompetitorIntel">
                            <svg class="ic" aria-hidden="true"><use href="#i-crosshair"/></svg>
                            رادار الذكاء التنافسي
                        </button>
                        <button class="dv2-nav-btn text-blue-400/90 hover:text-blue-400 hover:bg-blue-400/10" id="btnSidebarHRSandbox">
                            <svg class="ic" aria-hidden="true"><use href="#i-users"/></svg>
                            محاكي الموارد البشرية (HR)
                        </button>
                        <button class="dv2-nav-btn text-indigo-400/90 hover:text-indigo-400 hover:bg-indigo-400/10" id="btnSidebarMultiBranch">
                            <svg class="ic" aria-hidden="true"><use href="#i-map"/></svg>
                            محاكي التوسع والفروع
                        </button>
                        <button class="dv2-nav-btn text-red-500/90 hover:text-red-500 hover:bg-red-500/10" id="btnSidebarCrisis">
                            <svg class="ic" aria-hidden="true"><use href="#i-alert-triangle"/></svg>
                            غرفة إدارة الأزمات والطوارئ
                        </button>
                        <button class="dv2-nav-btn text-rose-400/90 hover:text-rose-400 hover:bg-rose-400/10" id="btnSidebarPricingLab">
                            <svg class="ic" aria-hidden="true"><use href="#i-tag"/></svg>
                            مختبر التسعير السيكولوجي
                        </button>
                        <button class="dv2-nav-btn text-teal-400/90 hover:text-teal-400 hover:bg-teal-400/10" id="btnSidebarSupplyChain">
                            <svg class="ic" aria-hidden="true"><use href="#i-truck"/></svg>
                            محاكي سلاسل الإمداد
                        </button>
                        <button class="dv2-nav-btn text-slate-300/90 hover:text-slate-300 hover:bg-slate-300/10" id="btnSidebarComplianceRadar">
                            <svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg>
                            رادار التشريعات والامتثال
                        </button>
                        <button class="dv2-nav-btn text-emerald-400/90 hover:text-emerald-400 hover:bg-emerald-400/10" id="btnSidebarCopilot">
                            <svg class="ic" aria-hidden="true"><use href="#i-cpu"/></svg>
                            مساعد الذكاء الاصطناعي (Copilot)
                        </button>
                        <button class="dv2-nav-btn" id="btnSidebarTeam">
                            <svg class="ic" aria-hidden="true"><use href="#i-users"/></svg>
                            فريق العمل
                        </button>
                        <button class="dv2-nav-btn" id="btnSidebarReadyStudies">
                            <svg class="ic" aria-hidden="true"><use href="#i-book"/></svg>
                            الدراسات الجاهزة
                        </button>
                        <button class="dv2-nav-btn" id="btnSidebarTemplates">
                            <svg class="ic" aria-hidden="true"><use href="#i-grid"/></svg>
                            معرض النماذج
                        </button>
                        <button class="dv2-nav-btn" id="btnSidebarTrash">
                            <svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg>
                            سلة المهملات
                        </button>
                    </div>

                    <!-- Business Network Links -->
                    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 8px;">
                        <div class="text-[10px] text-white/40 font-bold px-4 mb-1">مجتمع الأعمال والنمو</div>
                        <button class="dv2-nav-btn text-emerald-400/90 hover:text-emerald-400 hover:bg-emerald-400/10" id="btnSidebarMarketplace">
                            <svg class="ic" aria-hidden="true"><use href="#i-shopping-bag"/></svg>
                            سوق مقدمي الخدمات
                        </button>
                        <button class="dv2-nav-btn text-amber-400/90 hover:text-amber-400 hover:bg-amber-400/10" id="btnSidebarInvestorNetwork">
                            <svg class="ic" aria-hidden="true"><use href="#i-briefcase"/></svg>
                            شبكة المستثمرين (Deal-Flow)
                        </button>
                        <button class="dv2-nav-btn text-pink-400/90 hover:text-pink-400 hover:bg-pink-400/10" id="btnSidebarCommunity">
                            <svg class="ic" aria-hidden="true"><use href="#i-users"/></svg>
                            مجتمع قرار
                        </button>
                        <button class="dv2-nav-btn text-purple-400/90 hover:text-purple-400 hover:bg-purple-400/10" id="btnSidebarMandA">
                            <svg class="ic" aria-hidden="true"><use href="#i-target"/></svg>
                            مركز صفقات الاستحواذ
                        </button>
                        <button class="dv2-nav-btn text-emerald-500/90 hover:text-emerald-500 hover:bg-emerald-500/10" id="btnSidebarGovTenders">
                            <svg class="ic" aria-hidden="true"><use href="#i-briefcase"/></svg>
                            رادار المناقصات والعطاءات
                        </button>
                        <button class="dv2-nav-btn text-fuchsia-400/90 hover:text-fuchsia-400 hover:bg-fuchsia-400/10" id="btnSidebarTokenization">
                            <svg class="ic" aria-hidden="true"><use href="#i-layers"/></svg>
                            منصة ترميز الحصص (Tokenization)
                        </button>
                        <button class="dv2-nav-btn text-amber-400/90 hover:text-amber-400 hover:bg-amber-400/10" id="btnSidebarIPOReadiness">
                            <svg class="ic" aria-hidden="true"><use href="#i-trending-up"/></svg>
                            منصة الاكتتاب العام (IPO)
                        </button>
                    </div>

                    <!-- Ecosystem & Support Links -->
                    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 8px;">
                        <div class="text-[10px] text-white/40 font-bold px-4 mb-1">الخدمات والدعم</div>
                        <button class="dv2-nav-btn" id="btnSidebarAdvisory">
                            <svg class="ic" aria-hidden="true"><use href="#i-message-circle"/></svg>
                            الاستشارات والدعم
                        </button>
                        <button class="dv2-nav-btn text-yellow-400/90 hover:text-yellow-400 hover:bg-yellow-400/10" id="btnSidebarExperts">
                            <svg class="ic" aria-hidden="true"><use href="#i-star"/></svg>
                            سوق الخبراء والمستشارين
                        </button>
                        <button class="dv2-nav-btn" id="btnSidebarFunding">
                            <svg class="ic" aria-hidden="true"><use href="#i-dollar-sign"/></svg>
                            منصة التمويل
                        </button>
                        <button class="dv2-nav-btn text-primary/90 hover:text-primary hover:bg-primary/10" id="btnSidebarIntegrations">
                            <svg class="ic" aria-hidden="true"><use href="#i-grid"/></svg>
                            التكاملات والذكاء الاصطناعي
                        </button>
                        <button class="dv2-nav-btn text-blue-400/90 hover:text-blue-400 hover:bg-blue-400/10" id="btnSidebarAcademy">
                            <svg class="ic" aria-hidden="true"><use href="#i-book-open"/></svg>
                            أكاديمية قرار
                        </button>
                        <button class="dv2-nav-btn text-purple-400/90 hover:text-purple-400 hover:bg-purple-400/10" id="btnSidebarBilling">
                            <svg class="ic" aria-hidden="true"><use href="#i-credit-card"/></svg>
                            الطلبات والفواتير
                        </button>
                        <button class="dv2-nav-btn text-red-400/90 hover:text-red-400 hover:bg-red-400/10" id="btnSidebarSupportTickets">
                            <svg class="ic" aria-hidden="true"><use href="#i-mail"/></svg>
                            الشكاوى والتذاكر
                        </button>
                    </div>
                    
                    <div style="margin-top: auto;">
                        <div class="dv2-view-toggle">
                            <button type="button" onclick="window.location.hash='#/home'">الكلاسيكية</button>
                            <button type="button" class="active">المتطورة (V2)</button>
                        </div>
                    </div>
                </aside>

                <!-- Main Content -->
                <main class="dv2-main">
                    <!-- Topbar -->
                    <header class="dv2-topbar dv2-glass-panel">
                        <div style="font-weight: 600;">مرحباً بك في قرار! 👋</div>
                        <div class="dv2-topbar-actions">
                            ${!this.currentUser ? `
                                <button type="button" id="dashboardLogin" class="dv2-btn-secondary">تسجيل الدخول</button>
                            ` : `
                                <button type="button" id="btnNotifications" class="dv2-btn-secondary relative" style="padding: 8px; margin-left: 8px; border-radius: 50%; width: 36px; h-36px; display: flex; align-items: center; justify-content: center;" title="الإشعارات">
                                    <svg class="ic w-5 h-5" aria-hidden="true"><use href="#i-bell"/></svg>
                                    <span class="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900"></span>
                                </button>
                                <button type="button" id="btnProfile" class="dv2-btn-secondary">حسابي</button>
                                <span style="font-weight: 500; font-size: 0.9rem;">${userEmail}</span>
                                <button type="button" id="btnLogout" class="dv2-btn-secondary dv-logout" style="padding: 8px 16px;">خروج</button>
                            `}
                        </div>
                    </header>

                    <!-- Hero Section -->
                    <section class="dv2-hero">
                        <h1>دراسة الجدوى، أصبحت أسهل وأذكى</h1>
                        <p>ابدأ مشروعك الجديد بثقة مع أدوات التحليل المالي والمحاكاة الذكية التي نوفرها لك.</p>
                        <div class="dv2-hero-actions">
                            <button type="button" id="cardFullStudy" class="dv2-btn-primary">
                                <svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg>
                                دراسة جديدة
                            </button>
                        </div>
                    </section>

                    <!-- Projects -->
                    <section>
                        <div class="dv2-projects-header">
                            <h2>دراساتك المحفوظة</h2>
                            ${hasProjects ? `
                                <div style="display: flex; gap: 12px;">
                                    <select id="dashboardFolderFilter" class="input input--sm" style="background: var(--v2-glass-bg); border-radius: 8px; border: 1px solid var(--v2-glass-border); padding: 8px 12px;">
                                        ${folderOptions}
                                    </select>
                                    <input type="text" id="dashboardSearch" class="input input--sm" placeholder="ابحث في دراساتك..." style="background: var(--v2-glass-bg); border-radius: 8px; border: 1px solid var(--v2-glass-border); padding: 8px 12px;" value="${(this.searchQuery || '').replace(/"/g, '&quot;')}" />
                                </div>
                            ` : ''}
                        </div>
                        
                        ${!hasProjects ? this.renderEmptyState() : `
                            <div class="dv2-grid" id="projectsGrid">
                                ${filtered.map(p => {
                                    try {
                                        let cardHtml = this.renderProjectCard(p);
                                        cardHtml = cardHtml.replace('class="dv-card', 'class="dv2-card');
                                        return cardHtml;
                                    } catch (err) {
                                        console.error('Error rendering project card:', err);
                                        return '<div class="dv2-card">خطأ في عرض المشروع</div>';
                                    }
                                }).join('')}
                            </div>
                        `}
                    </section>
                </main>
                
                <!-- Hidden roots to satisfy DashboardView JS logic -->
                <div id="readyStudiesRoot" class="hidden"></div>
                <div id="databaseFilesRoot" class="hidden"></div>
                <div id="warehouseDatabaseFilesRoot" class="hidden"></div>
                <div id="warehouseHrFilesRoot" class="hidden"></div>
                <div id="sensitivity-widget-root" class="hidden"></div>
                <div id="funding-sim-root" class="dv-modal hidden">
                    <div class="dv-modal__panel">
                        <button id="btnCloseFundingSim" class="dv-modal__close" aria-label="إغلاق">&times;</button>
                        <div id="funding-sim-container"></div>
                    </div>
                </div>
                <div id="founder-card-root" class="hidden"></div>
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
            ...folders.map(f => `<option value="${f.id}" ${this.selectedFolderId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`)
        ].join('');

        this.bindEvents();
        if (!hasProjects) this.maybeShowOnboarding();
        this.hydrateProjectCompleteness(filtered);
    }

    // تحميل مؤجَّل لشارة «جودة المسودة» للبطاقات التي وصلت بلا بيانات كاملة
    hydrateProjectCompleteness(projects) {
        (projects || []).forEach(project => {
            if (project.data && project.data.projectInfo) return;
            const slot = this.container.querySelector(`[data-completeness-for="${project.id}"]`);
            if (!slot) return;
            ProjectManager.loadProject(project.id)
                .then(loaded => {
                    const freshSlot = this.container.querySelector(`[data-completeness-for="${project.id}"]`);
                    if (!freshSlot) return; 
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

        return `
            <div class="empty-state dv-empty dvh-empty">
                <span class="dv-empty__ic">${icon('i-folder')}</span>
                <h3 class="dv-empty__title">ابدأ أول دراسة جدوى لمشروعك</h3>
                <p class="dv-empty__sub">لا توجد دراسات محفوظة بعد. ابدأ دراسة احترافية كاملة.</p>
                <div class="dv-empty__actions">
                    <button type="button" id="btnNewProjectEmpty" class="btn btn--primary">${icon('i-plus')} دراسة جديدة (كاملة)</button>
                </div>
            </div>
        `;
    }

    buildCompletenessHTML(projectData) {
        try {
            const completeness = calculateStudyCompleteness(projectData);
            const percentage = completeness.percentage;
            const level = percentage >= 80 ? 'is-good' : percentage >= 50 ? 'is-mid' : 'is-low';
            const tips = typeof completeness.getTipsToRaiseScore === 'function' ? completeness.getTipsToRaiseScore().slice(0, 1) : [];
            return `
                <div class="dv-quality-mini ${level}">
                    <div class="dv-quality-mini__row">
                        <span title="نسبة اكتمال حقول الدراسة">جودة المسودة</span>
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

    renderProjectCard(project) {
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

        const safeName = escapeHtml(project.name || 'مشروع بدون اسم');
        return `
            <div class="project-card dv-card dv-project" data-id="${project.id}" role="button" tabindex="0" aria-label="فتح دراسة ${safeName}">
                <div class="dv-project__head">
                    <span class="dv-card__ic dv-card__ic--soft dv-card__ic--sm">${icon('i-chart')}</span>
                    <div class="dv-project__id">
                        <h3 class="dv-project__name" title="${safeName}">${safeName}</h3>
                        <p class="dv-project__date">آخر تعديل: <span class="dv-num">${date}</span></p>
                    </div>
                </div>
                ${completenessHTML}
                <div class="dv-project__actions">
                    <button class="btn btn--sm btn--secondary dv-project__open btn-open" data-id="${project.id}">فتح</button>
                </div>
            </div>
        `;
    }

    renderExpertCta() {
        try {
            const pkg = PRICING_PACKAGES.find(p => p.id === 'reviewed');
            if (!pkg) return '';
            const waLink = buildWhatsAppLink(`مرحباً، أرغب بمراجعة خبير لدراستي عبر منصة «قرار» (باقة «${pkg.name}» — ${formatPrice(pkg.price)} ${CURRENCY_SYMBOL}).`);
            const ctaAction = waLink
                ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn--sm btn--secondary">تواصل عبر واتساب</a>`
                : `<span class="text-xs text-muted">قناة واتساب غير متاحة حالياً</span>`;
            return `
                <div class="dv-expert-cta">
                    <span class="dv-expert-cta__ic">${icon('i-user')}</span>
                    <div class="dv-expert-cta__body">
                        <strong>محتار في افتراضاتك؟ دع خبيراً يراجع دراستك</strong>
                    </div>
                    ${ctaAction}
                </div>
            `;
        } catch (e) { console.warn('renderExpertCta failed:', e); return ''; }
    }

    bindEvents() {
        // Navigation events for missing pages
        this.container.querySelector('#btnNotifications')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showNotifications'));
        });
        this.container.querySelector('#btnSidebarTeam')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showTeamManagement'));
        });
        this.container.querySelector('#btnProfile')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showUserProfile'));
        });
        this.container.querySelector('#btnSidebarTrash')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showTrash'));
        });
        
        // Workspace Additions
        this.container.querySelector('#btnSidebarHome')?.addEventListener('click', () => {
            window.location.hash = '#/home';
        });
        this.container.querySelector('#btnSidebarGlobalAnalytics')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showGlobalAnalytics'));
        });
        this.container.querySelector('#btnSidebarDataRoom')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showDataRoom'));
        });
        this.container.querySelector('#btnSidebarKanban')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showExecutionKanban'));
        });
        this.container.querySelector('#btnSidebarCompetitorIntel')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showCompetitorIntelligence'));
        });
        this.container.querySelector('#btnSidebarHRSandbox')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showHRSandbox'));
        });
        this.container.querySelector('#btnSidebarMultiBranch')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showMultiBranchScaling'));
        });
        this.container.querySelector('#btnSidebarCrisis')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showCrisisManagement'));
        });
        this.container.querySelector('#btnSidebarPricingLab')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showPricingStrategyLab'));
        });
        this.container.querySelector('#btnSidebarSupplyChain')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showSupplyChainSandbox'));
        });
        this.container.querySelector('#btnSidebarComplianceRadar')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showComplianceRadar'));
        });
        this.container.querySelector('#btnSidebarCopilot')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showAIAssistantCopilot'));
        });

        // Business Network Links
        this.container.querySelector('#btnSidebarMarketplace')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showMarketplace'));
        });
        this.container.querySelector('#btnSidebarInvestorNetwork')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showInvestorNetwork'));
        });
        this.container.querySelector('#btnSidebarCommunity')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showCommunityForum'));
        });
        this.container.querySelector('#btnSidebarMandA')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showMandAHub'));
        });
        this.container.querySelector('#btnSidebarFranchiseHub')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showFranchiseHub'));
        });
        
        this.container.querySelector('#btnSidebarGovTenders')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showGovTendersRadar'));
        });
        this.container.querySelector('#btnSidebarTokenization')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showTokenizationHub'));
        });
        this.container.querySelector('#btnSidebarIPOReadiness')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showIPOReadiness'));
        });
        
        // Services & Support Links
        this.container.querySelector('#btnSidebarAdvisory')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showAdvisory'));
        });
        this.container.querySelector('#btnSidebarBilling')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showBillingHistory'));
        });
        this.container.querySelector('#btnSidebarSupportTickets')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showSupportTickets'));
        });
        this.container.querySelector('#btnSidebarIntegrations')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showIntegrationsHub'));
        });
        this.container.querySelector('#btnSidebarFunding')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showFundingCenter'));
        });
        this.container.querySelector('#btnSidebarAcademy')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:showAcademy'));
        });
        this.container.querySelector('#btnSidebarTemplates')?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('feasibility:newStudy'));
        });
        this.container.querySelector('#btnSidebarReadyStudies')?.addEventListener('click', () => {
            if (this.options.onShowReadyStudies) {
                this.options.onShowReadyStudies();
            } else {
                window.location.hash = '#/ready-studies';
            }
        });

        // Login
        const btnLogin = this.container.querySelector('#dashboardLogin');
        if (btnLogin) {
            btnLogin.addEventListener('click', async () => {
                const { PhoneAuthModal } = await import('./PhoneAuthModal.js');
                new PhoneAuthModal('authModalContainer', {
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

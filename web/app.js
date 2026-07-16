import Swal from 'sweetalert2';
import { store } from './js/core/store.js';
import { TEMPLATES } from './js/core/templates.js';
import { TABLE_SCHEMAS, createEmptyStudy } from './js/core/schema.js';
import { STEPS, SECTIONS, SIDEBAR_SECTIONS, stepIndexById, STEPS_ABSORBED_IN_CATEGORY_VIEW, isStepVisibleInStudyMode } from './js/core/wizardSteps.js';
import { Sidebar } from './js/ui/Sidebar.js';
import { Wizard } from './js/ui/Wizard.js';
import { renderStepComponent } from './js/ui/stepComponentRegistry.js';
import { attachToolReport } from './js/ui/components/ToolReport.js';
import { StudyJourney } from './js/ui/StudyJourney.js';
import { StudyCategoryView } from './js/ui/StudyCategoryView.js';
import { calculateStudy as runFullModel } from './js/core/engine.js';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { OverlayScrollbars } from 'overlayscrollbars';
import 'overlayscrollbars/overlayscrollbars.css';
// المكونات الثقيلة تُحمّل عند أول زيارة للخطوة (Lazy Loading في navigateTo)
import { toast } from './js/utils/toast.js';
import { AutoSave } from './js/utils/autoSave.js';
import { ProgressTracker } from './js/utils/progressTracker.js';
import { monitoring } from './js/utils/monitoring.js';
import { AuthGuard } from './js/middleware/AuthGuard.js';
import './js/services/connectors/index.js';
import { initShellController } from './js/app-controller.js';
import { ModeSelector } from './js/ui/ModeSelector.js';
import { startFullStudyFromQuick } from './js/core/quickFeasibilityProject.js';
import { trackEvent } from './js/utils/analytics.js';
import { enhanceFieldHelp, observeFieldHelp } from './js/ui/components/FieldHelpEnhancer.js';

document.addEventListener('DOMContentLoaded', async () => {
 try {
  const installArabicUiGuard = () => {
    // كل الأنماط بحدود كلمات (\b) حصراً: الاستبدال بلا حدود كان يفسد أي نص يحوي
    // النمط داخل كلمة («QAR» صارت «فحص الجودةR»). أسماء الصيغ المعروفة عالمياً
    // (PDF/Excel/Word/CSV/JSON/HTML/PowerPoint) لا تُستبدل إطلاقاً: مصادرها عربية
    // أصلاً بجانب اسم الصيغة، واستبدالها كان يولّد نصاً ملتصقاً («تقرير تقريرتقرير شامل»).
    const replacements = [
      [/\bMarket Structure\b/gi, 'هيكل السوق'],
      [/\bPerfect Competition\b/gi, 'منافسة تامة'],
      [/\bMonopolistic Competition\b/gi, 'منافسة احتكارية'],
      [/\bOligopoly\b/gi, 'احتكار القلة'],
      [/\bMonopoly\b/gi, 'احتكار تام'],
      [/\bMarket Gap\b/gi, 'الفجوة السوقية'],
      [/\bMarket Simulation\b/gi, 'محاكاة السوق'],
      [/\bMarket Analysis\b/gi, 'تحليل السوق'],
      [/\bMarket Opportunity\b/gi, 'فرصة السوق'],
      [/\bMarket Snapshot\b/gi, 'لمحة السوق'],
      [/\bMarket Share\b/gi, 'الحصة السوقية'],
      [/\bMarket\b/gi, 'السوق'],
      [/\bStructure\b/gi, 'الهيكل'],
      [/\bDashboard\b/gi, 'لوحة التحكم'],
      [/\bPitch Deck\b/gi, 'العرض التقديمي'],
      [/\bPitch\b/gi, 'العرض'],
      [/\bGO\/NO-GO\b/gi, 'نفّذ أو راجع'],
      [/\bNO-GO\b/gi, 'لا تنفّذ'],
      [/\bGO\b/g, 'نفّذ'],
      [/\bNPV\b/gi, 'صافي القيمة الحالية'],
      [/\bIRR\b/gi, 'معدل العائد الداخلي'],
      [/\bROI\b/gi, 'العائد على الاستثمار'],
      [/\bWACC\b/gi, 'متوسط تكلفة رأس المال'],
      [/\bEBITDA\b/gi, 'الربح التشغيلي'],
      [/\bDCF\b/gi, 'التدفقات النقدية المخصومة'],
      [/\bTAM\/SAM\/SOM\b/gi, 'إجمالي السوق والسوق المتاح والحصة المستهدفة'],
      [/\bTAM\b/gi, 'إجمالي السوق'],
      [/\bSAM\b/gi, 'السوق المتاح'],
      [/\bSOM\b/gi, 'الحصة المستهدفة'],
      [/\bSWOT\b/gi, 'التحليل الرباعي'],
      [/\bTOWS\b/gi, 'مصفوفة الاستراتيجيات'],
      [/\bKPI\b/gi, 'مؤشر أداء'],
      [/\bStartup\b/gi, 'شركة ناشئة'],
      [/\bQuick Feasibility\b/gi, 'جدوى سريعة'],
      [/\bQuick\b/gi, 'سريع'],
      [/\bBenchmarking\b/gi, 'المقارنة المرجعية'],
      [/\bBenchmark\b/gi, 'معيار مقارنة'],
      [/\bPayback\b/gi, 'فترة الاسترداد'],
      [/\b(Breakeven|Break-Even)\b/gi, 'نقطة التعادل'],
      [/\bCOGS\b/gi, 'تكلفة البضاعة المباعة'],
      [/\bOPEX\b/gi, 'المصروفات التشغيلية'],
      [/\bCAPEX\b/gi, 'المصاريف الرأسمالية'],
      [/\bGoogle Sheets\b/gi, 'جداول جوجل'],
      [/\bGoogle\b/gi, 'جوجل'],
      [/\bSupabase\b/gi, 'خدمة قاعدة البيانات'],
      [/\bOpenStreetMap\b/gi, 'خريطة مفتوحة المصدر'],
      [/\bZoom\b/gi, 'اجتماع مرئي'],
      [/\b(Calendly|Cal\.com)\b/gi, 'نظام حجز المواعيد'],
      [/\b(LivePlan|Bizplan|Upmetrics|PlanGuru)\b/gi, 'منصة أجنبية']
    ];

    const arabize = (value) => {
      if (!value || !/[A-Za-z]/.test(value)) return value;
      // L8: اختصار إنجليزي بين قوسين بعد المصطلح العربي — مثل (NPV) أو (TAM/SAM/SOM)
      // أو (GO/NO-GO) — يُحفظ كما هو: لا يُعرّب ولا يُحذف. نقنّعه قبل التعريب ثم نعيده.
      const keep = [];
      let out = String(value).replace(/\(([A-Z][A-Za-z0-9/\-]{1,24})\)/g, (m, abbr) => '￼' + (keep.push(abbr) - 1) + '￼');
      for (const [pattern, replacement] of replacements) {
        out = out.replace(pattern, replacement);
      }
      out = out.replace(/\s*\([A-Za-z][A-Za-z0-9\s/&+_.:-]*\)/g, '');
      out = out.replace(/￼(\d+)￼/g, (m, i) => '(' + keep[+i] + ')');
      return out;
    };

    const attrs = ['title', 'placeholder', 'aria-label', 'alt'];
    const processNode = (node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches?.('script, style, code, pre')) return;
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
        acceptNode(textNode) {
          const parent = textNode.parentElement;
          if (!parent || parent.matches('script, style, code, pre')) return NodeFilter.FILTER_REJECT;
          return /[A-Za-z]/.test(textNode.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(textNode => {
        const next = arabize(textNode.nodeValue);
        if (next !== textNode.nodeValue) textNode.nodeValue = next;
      });
      node.querySelectorAll?.('*').forEach(el => {
        if (el.matches('script, style, code, pre')) return;
        attrs.forEach(attr => {
          if (!el.hasAttribute(attr)) return;
          const current = el.getAttribute(attr);
          const next = arabize(current);
          if (next !== current) el.setAttribute(attr, next);
        });
      });
      attrs.forEach(attr => {
        if (!node.hasAttribute?.(attr)) return;
        const current = node.getAttribute(attr);
        const next = arabize(current);
        if (next !== current) node.setAttribute(attr, next);
      });
    };

    processNode(document.body);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          const next = arabize(mutation.target.nodeValue);
          if (next !== mutation.target.nodeValue) mutation.target.nodeValue = next;
        }
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            const next = arabize(node.nodeValue);
            if (next !== node.nodeValue) node.nodeValue = next;
          } else {
            processNode(node);
          }
        });
        if (mutation.type === 'attributes') {
          processNode(mutation.target);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: attrs
    });
  };
  installArabicUiGuard();

  // Check for study mode preference
  const savedMode = localStorage.getItem('study_mode_preference');

  // نافذة ModeSelector عند أول زيارة مُعطَّلة: نافذة الترحيب (Onboarding) في DashboardView
  // تغطي اختيار الوضع، وظهور نافذتين متراكبتين يُربك المستخدم.
  // يمكن التبديل بين الوضعين لاحقاً من الشريط الجانبي (سريع / مفصل).
  const SHOW_FIRST_VISIT_MODE_SELECTOR = false;
  if (SHOW_FIRST_VISIT_MODE_SELECTOR && !savedMode) {
    const modeSelector = new ModeSelector((mode) => {
      console.log('User selected mode:', mode);
      localStorage.setItem('study_mode_preference', mode);
      // Here you would trigger specific logic based on mode
      // For now, we just save the preference
      if (mode === 'quick') {
        toast.success('تم تفعيل وضع الدراسة السريعة');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.success('تم تفعيل وضع الدراسة التفصيلية');
        setTimeout(() => window.location.reload(), 1500);
      }
    });
    // Small delay to ensure UI is ready
    setTimeout(() => modeSelector.render(), 1000);
  }
  // Initialize monitoring
  monitoring.captureMessage('Application started', 'info', {
    url: window.location.href,
    userAgent: navigator.userAgent
  });

  // Initialize Auth Guard
  const authResult = await AuthGuard.init({
    requireAuth: false, // Set to true to force login
    onAuthChange: ({ event, user, isAuthenticated }) => {
      console.log('[App] Auth state changed:', event, isAuthenticated);

      // Show notification on login/logout
      if (event === 'SIGNED_IN' && user) {
        toast.success(`مرحباً ${user.email}!`);
      } else if (event === 'SIGNED_OUT') {
        toast.info('تم تسجيل الخروج');
      }
    }
  });

  console.log('[App] Auth initialized:', authResult);

  // وصول من الصفحة الرئيسية عبر زر «دخول/تسجيل» (index.html?auth=1):
  // نفتح شاشة المصادقة فوراً. بعد نجاح الدخول تُغلق الشاشة ويكمل المستخدم إلى الدراسة.
  // إن كان مسجّلاً مسبقاً لا نعرضها. وننظّف المعامل من الرابط حتى لا تتكرر عند التحديث.
  const wantsAuth = new URLSearchParams(window.location.search).get('auth');
  if (wantsAuth && !authResult?.authenticated) {
    AuthGuard.showAuthPrompt();
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('auth');
    window.history.replaceState({}, '', cleanUrl);
  }

  // إسناد مصدر الزيارة من صفحة الهبوط (index.html?cta=hero/nav/price-self/final/footer):
  // يُحفظ في sessionStorage ليُرفق لاحقاً بأول حدث قياس تحويل يُضاف (لا قياس مُفعَّل بعد)
  // وبطلب إنشاء جلسة الدفع، حتى تُنسب عمليات الدفع الفعلية لعنصر الصفحة الذي قادها.
  const landingCta = new URLSearchParams(window.location.search).get('cta');
  if (landingCta) {
    try { sessionStorage.setItem('landing_cta', landingCta); } catch (_) { /* تجاهل بيئات بلا sessionStorage */ }
    const cleanCtaUrl = new URL(window.location.href);
    cleanCtaUrl.searchParams.delete('cta');
    window.history.replaceState({}, '', cleanCtaUrl);
    trackEvent('landing_cta_view', { cta: landingCta });
  }

  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const sidebarDom = document.querySelector('.sidebar');
  initShellController({
    sidebarDom,
    sidebarOverlay,
    btnToggleSidebar
  });

  // Component Instance Cache
  const components = {};
  let studyJourney = null;
  let categoryView = null;
  let navigationRequestId = 0;
  let latestRequestedStepIndex = 0;
  const CATEGORY_STEPS = SIDEBAR_SECTIONS.map(category => ({ id: category.id, label: category.label }));
  const CATEGORY_JOURNEY_SECTIONS = SIDEBAR_SECTIONS.map((category, index) => ({
    id: category.id,
    label: category.label,
    range: [index, index]
  }));
  const CATEGORY_SIDEBAR_SECTIONS = [{
    id: 'study_categories',
    label: 'تصنيفات الدراسة',
    range: [0, CATEGORY_STEPS.length - 1]
  }];

  // Dashboard vars defined above (lines 141-142), duplicates removed.
  let projectsDashboard = null; // The main landing dashboard

  // Function to switch to workspace mode. The full journey now lives in-page,
  // so the legacy left sidebar stays hidden and the main stage uses the full width.
  const enterWorkspaceMode = () => {
    const shell = document.querySelector('.app-shell');
    shell?.classList.remove('dashboard-mode');
    shell?.classList.add('no-sidebar');
    const appHeader = document.getElementById('appHeader');
    if (appHeader) appHeader.style.removeProperty('display');

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.classList.remove('is-open');
      sidebar.style.display = 'none';
    }

    const stepperNav = document.getElementById('stepperNav');
    if (stepperNav) {
      stepperNav.style.display = 'none';
    }

    const sidebarOverlay = document.getElementById('sidebarOverlay');
    sidebarOverlay?.classList.remove('is-open');
    document.getElementById('btnToggleSidebar')?.setAttribute('aria-expanded', 'false');
  };

  const showLandingDashboard = async () => {
    syncHash('home');
    document.querySelector('.app-shell')?.classList.add('dashboard-mode');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    const { DashboardView } = await import('./js/ui/DashboardView.js');
    const goToStudyStep = (matcher, fallbackIndex = 0) => {
      enterWorkspaceMode();
      const idx = STEPS.findIndex(matcher);
      navigateTo(idx >= 0 ? idx : fallbackIndex);
    };
    projectsDashboard = new DashboardView('wizardContainer', store, (projectId) => {
      enterWorkspaceMode();
      const state = store.getState();
      if (!state.projectInfo?.concept) {
        navigateTo(0);
      } else {
        navigateTo(3);
      }
    }, {
      onShowStudyStep: (index) => {
        enterWorkspaceMode();
        navigateTo(index);
      },
      onStartQuickFeasibility: () => startQuickFeasibilityWizard(),
      // خطوة القوالب أُزيلت من المسار — «اختيار نقطة البداية» صار نافذةً (TemplateGallery)
      onShowTemplateSelector: () => window.dispatchEvent(new CustomEvent('feasibility:newStudy')),
      onShowPreliminaryCheck: () => goToStudyStep(s => s.isPreliminaryCheck, 0),
      onShowProjectAlternatives: () => goToStudyStep(s => s.isProjectAlternatives, 1),
      onShowAdvisory: () => showAdvisoryView(),
      onShowMonshaatCompliance: () => showMonshaatComplianceView(),
      onShowFinancingGuide: () => showFinancingGuideView(),
      onShowBeginnerGuide: () => showBeginnerGuideView(),
      onShowHypothesis: () => showHypothesisView(),
      onShowIdeaAssessment: () => showIdeaAssessmentView(),
      onShowPartnerSelection: () => showPartnerSelectionView(),
      onShowResourcesGuide: () => showResourcesGuideView(),
      onShowTrustCriteria: () => showTrustCriteriaView(),
      onShowKnowledgeCenter: () => showKnowledgeCenterView(),
      onShowAcceleratorTips: () => showAcceleratorTipsView(),
      onShowPostFeasibility: () => showPostFeasibilityView(),
      onShowQuickStartGuide: () => showQuickStartGuideView(),
      onShowExamplesInspire: () => showExamplesInspireView(),
      onShowBenchmarking: () => {
        // «هل أرقامي منطقية؟»: القسم مضمّن داخل لوحة التحكم المالي — ننتقل ثم نمرّر إليه بدل الوقوف بأعلى الصفحة
        goToStudyStep(s => s.isDashboard, STEPS.length - 1);
        setTimeout(() => document.getElementById('benchmarkingSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
      },
      onShowStudyCompleteness: async () => {
        // «فحص اكتمال الدراسة»: كان يذهب للوحة المالية العامة (معرّف مكرّر). الآن يعرض نسبة الاكتمال والنواقص
        try {
          const { calculateStudyCompleteness } = await import('./js/utils/studyCompleteness.js');
          const c = calculateStudyCompleteness(store.getState());
          const missing = c.getMissingSections().slice(0, 4).map(s => s.label).join('، ');
          toast.info(`نسبة اكتمال الدراسة: ${c.percentage}%` + (missing ? ` — النواقص: ${missing}` : ' — مكتملة'), 8000);
        } catch (e) { console.warn('completeness check failed', e); }
        goToStudyStep(s => s.isDecisionDashboard, STEPS.length - 4);
      },
      onShowOperationalSimulator: () => goToStudyStep(s => s.isOperationalSim, 14),
      onShowStressTest: () => goToStudyStep(s => s.isStressTest, 30),
      onShowSensitivity: () => goToStudyStep(s => s.isSensitivity, 31),
      onShowMonteCarlo: () => goToStudyStep(s => s.isMonteCarlo || s.id === SECTIONS.MONTE_CARLO, 35),
      onShowReportBuilder: () => goToStudyStep(s => s.isReportBuilder, STEPS.length - 2),
      onShowPostLaunch: () => goToStudyStep(s => s.isPostLaunch, 37),
      onOpenExport: () => {
        if (typeof openExportMenu === 'function') openExportMenu();
      }
    });
    projectsDashboard.render();
  };

  const showExamplesInspireView = () => {
    syncHash('examples');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/ExamplesInspireView.js').then(({ ExamplesInspireView }) => {
      const view = new ExamplesInspireView('wizardContainer', {
        store,
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        },
        onTemplateApplied: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.display = 'flex';
          enterWorkspaceMode();
          navigateTo(3);
        }
      });
      view.render();
    }).catch(err => {
      console.error('ExamplesInspireView load failed:', err);
      toast.error('تعذر فتح أمثلة الدراسات');
    });
  };

  const showAdvisoryView = () => {
    syncHash('advisory');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/AdvisoryView.js').then(({ AdvisoryView }) => {
      const view = new AdvisoryView('wizardContainer', store, {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        }
      });
      view.render();
    }).catch(err => {
      console.error('AdvisoryView load failed:', err);
      toast.error('تعذر فتح صفحة الاستشارة');
    });
  };

  const showMonshaatComplianceView = () => {
    syncHash('monshaat');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/MonshaatComplianceView.js').then(({ MonshaatComplianceView }) => {
      const view = new MonshaatComplianceView('wizardContainer', {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        }
      });
      view.render();
    }).catch(err => {
      console.error('MonshaatComplianceView load failed:', err);
      toast.error('تعذر فتح صفحة توافق المعايير');
    });
  };

  const showFinancingGuideView = () => {
    syncHash('financing');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/FinancingGuideView.js').then(({ FinancingGuideView }) => {
      const view = new FinancingGuideView('wizardContainer', store, {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        },
        onOpenExport: () => {
          if (typeof openExportMenu === 'function') openExportMenu();
        }
      });
      view.render();
    }).catch(err => {
      console.error('FinancingGuideView load failed:', err);
      toast.error('تعذر فتح صفحة الجدوى والتمويل');
    });
  };

  const showBeginnerGuideView = () => {
    syncHash('beginner');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/BeginnerGuideView.js').then(({ BeginnerGuideView }) => {
      const view = new BeginnerGuideView('wizardContainer', {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        },
        onStart: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.display = 'flex';
          enterWorkspaceMode();
          navigateTo(2);
        }
      });
      view.render();
    }).catch(err => {
      console.error('BeginnerGuideView load failed:', err);
      toast.error('تعذر فتح دليل المبتدئ');
    });
  };

  const showIdeaAssessmentView = () => {
    syncHash('idea');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/IdeaAssessmentView.js').then(({ IdeaAssessmentView }) => {
      const view = new IdeaAssessmentView('wizardContainer', store, {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        }
      });
      view.render();
    }).catch(err => {
      console.error('IdeaAssessmentView load failed:', err);
      toast.error('تعذر فتح تقييم الفكرة');
    });
  };

  const showHypothesisView = () => {
    syncHash('hypothesis');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/HypothesisView.js').then(({ HypothesisView }) => {
      const view = new HypothesisView();
      document.getElementById('wizardContainer').innerHTML = ''; // Clear container
      document.getElementById('wizardContainer').appendChild(view.render());
    }).catch(err => {
      console.error('HypothesisView load failed:', err);
      toast.error('تعذر فتح فرضية الرواد');
    });
  };

  const showPartnerSelectionView = () => {
    syncHash('partner');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/PartnerSelectionView.js').then(({ PartnerSelectionView }) => {
      const view = new PartnerSelectionView('wizardContainer', {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        }
      });
      view.render();
    }).catch(err => {
      console.error('PartnerSelectionView load failed:', err);
      toast.error('تعذر فتح معايير اختيار شريك/ممول');
    });
  };

  const showResourcesGuideView = () => {
    syncHash('resources');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/ResourcesGuideView.js').then(({ ResourcesGuideView }) => {
      const view = new ResourcesGuideView('wizardContainer', {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        }
      });
      view.render();
    }).catch(err => {
      console.error('ResourcesGuideView load failed:', err);
      toast.error('تعذر فتح موارد وإرشاد');
    });
  };

  const showTrustCriteriaView = () => {
    syncHash('trust');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/TrustCriteriaView.js').then(({ TrustCriteriaView }) => {
      const view = new TrustCriteriaView('wizardContainer', {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        }
      });
      view.render();
    }).catch(err => {
      console.error('TrustCriteriaView load failed:', err);
      toast.error('تعذر فتح صفحة معاييرنا');
    });
  };

  const showKnowledgeCenterView = () => {
    syncHash('knowledge');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/KnowledgeCenterView.js').then(({ KnowledgeCenterView }) => {
      const view = new KnowledgeCenterView('wizardContainer', {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        }
      });
      view.render();
    }).catch(err => {
      console.error('KnowledgeCenterView load failed:', err);
      toast.error('تعذر فتح مركز المعرفة');
    });
  };

  const showAcceleratorTipsView = () => {
    syncHash('accelerator');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/AcceleratorTipsView.js').then(({ AcceleratorTipsView }) => {
      const view = new AcceleratorTipsView('wizardContainer', {
        store,
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        }
      });
      view.render();
    }).catch(err => {
      console.error('AcceleratorTipsView load failed:', err);
      toast.error('تعذر فتح نصائح التقديم للمسرّعات');
    });
  };

  const showPostFeasibilityView = () => {
    syncHash('postfeasibility');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/PostFeasibilityView.js').then(({ PostFeasibilityView }) => {
      const view = new PostFeasibilityView('wizardContainer', {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        }
      });
      view.render();
    }).catch(err => {
      console.error('PostFeasibilityView load failed:', err);
      toast.error('تعذر فتح ما بعد الجدوى');
    });
  };

  const showQuickStartGuideView = () => {
    syncHash('quickstart');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/QuickStartGuideView.js').then(({ QuickStartGuideView }) => {
      const view = new QuickStartGuideView('wizardContainer', {
        onBack: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        },
        onStartQuick: () => {
          startQuickFeasibilityWizard();
        },
        onStartFull: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.display = 'flex';
          enterWorkspaceMode();
          navigateTo(2);
        }
      });
      view.render();
    }).catch(err => {
      console.error('QuickStartGuideView load failed:', err);
      toast.error('تعذر فتح دليل البدء السريع');
    });
  };

  const startQuickFeasibilityWizard = () => {
    syncHash('quickwizard');
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    import('./js/ui/QuickFeasibilityWizard.js').then(({ QuickFeasibilityWizard }) => {
      const quickWizard = new QuickFeasibilityWizard('wizardContainer', store, {
        onExit: () => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.removeProperty('display');
          showLandingDashboard();
        },
        onFinish: async (quickData) => {
          try {
            await startFullStudyFromQuick(store, quickData);
            if (sidebarEl) sidebarEl.style.removeProperty('display');
            if (stepperNavEl) stepperNavEl.style.removeProperty('display');
            if (breadcrumbBar) breadcrumbBar.style.display = 'flex';
            enterWorkspaceMode();
            await navigateTo(3);
          } catch (err) {
            console.error('Failed to start full study from quick feasibility:', err);
            toast.error('تعذر إنشاء الدراسة الكاملة');
          }
        }
      });
      quickWizard.render();
    }).catch(err => {
      console.error('QuickFeasibilityWizard load failed:', err);
      toast.error('تعذر فتح مسار الجدوى السريعة');
    });
  };

  const categoryNavigationEnabled = window.__FEASIBILITY_LEGACY_STEPS__ !== true;
  const categoryIndexForStep = (stepIndex) => SIDEBAR_SECTIONS.findIndex(category => (
    stepIndex >= category.range[0] && stepIndex <= category.range[1]
  ));
  // صفحة الفئة تعرض كل الخطوات دفعة واحدة على نفس الصفحة (بخلاف المعالج التسلسلي) —
  // فأي خطوة استوعبتها شاشة مدموجة يجب استبعادها هنا، وإلا تتصادم حاويات جداولها
  // (انظر تعريف STEPS_ABSORBED_IN_CATEGORY_VIEW في wizardSteps.js).
  const absorbedStepIndexes = new Set(
    STEPS_ABSORBED_IN_CATEGORY_VIEW.map(id => STEPS.findIndex(s => s.id === id)).filter(i => i >= 0)
  );
  const currentStudyMode = () => store.getState()?.appSettings?.mode
    || localStorage.getItem('study_mode_preference') || 'advanced';
  // الخطوات الظاهرة في صفحة الفئات = غير المستوعَبة في شاشة مدموجة + الظاهرة في وضع
  // التفصيل الحالي (تدقيق 2026-07-13: كان يتجاهل الوضع تماماً فلا أثر لـ«مصغّر/بسيط»).
  const categoryVisibleStepIndexes = (mode = currentStudyMode()) => STEPS
    .map((_, index) => index)
    .filter(i => !absorbedStepIndexes.has(i) && isStepVisibleInStudyMode(STEPS[i].id, mode));
  // فهارس التصنيفات (SIDEBAR_SECTIONS) التي فيها خطوة ظاهرة واحدة على الأقل بهذا الوضع.
  const visibleCategoryIndexesForMode = (mode = currentStudyMode()) => {
    const visible = new Set(categoryVisibleStepIndexes(mode));
    const categories = [];
    SIDEBAR_SECTIONS.forEach((cat, idx) => {
      for (let i = cat.range[0]; i <= cat.range[1]; i++) {
        if (visible.has(i)) { categories.push(idx); break; }
      }
    });
    return categories;
  };
  // مزامنة كل أدوات التنقل بالفئات مع الوضع الحالي (خطوات ظاهرة + تصنيفات ظاهرة +
  // رحلة الدراسة تعرض التصنيفات غير الفارغة فقط) — مصدر واحد يستدعيه navigateToCategory
  // وapplyMode معاً كي لا ينحرفا.
  const syncCategoryNavToMode = () => {
    const mode = currentStudyMode();
    const visibleCats = visibleCategoryIndexesForMode(mode);
    categoryView?.setVisibleStepIndexes(categoryVisibleStepIndexes(mode));
    categoryView?.setVisibleCategoryIndexes(visibleCats);
    if (visibleCats.length) {
      studyJourney?.setSteps(visibleCats.map(i => CATEGORY_STEPS[i]), visibleCats);
    }
  };

  const navigateToCategory = async (categoryIndex, focusStepIndex = null) => {
    const requestId = ++navigationRequestId;
    let safeCategoryIndex = Math.min(Math.max(Number(categoryIndex) || 0, 0), SIDEBAR_SECTIONS.length - 1);
    // في وضع مصغّر/بسيط قد يكون التصنيف المطلوب فارغاً تماماً — نُعيد التوجيه لأقرب
    // تصنيف ظاهر (الأمامي أولاً) بدل عرض صفحة «لا توجد أقسام» بلا فائدة.
    const visibleCats = visibleCategoryIndexesForMode();
    if (visibleCats.length && !visibleCats.includes(safeCategoryIndex)) {
      safeCategoryIndex = visibleCats.find(c => c >= safeCategoryIndex) ?? visibleCats[visibleCats.length - 1];
    }
    const category = SIDEBAR_SECTIONS[safeCategoryIndex];
    if (!category) return;
    
    // UI Feedback for premium navigation
    NProgress.start();

    enterWorkspaceMode();
    const activeStepIndex = Number.isInteger(focusStepIndex) ? focusStepIndex : category.range[0];
    latestRequestedStepIndex = activeStepIndex;
    try {
      localStorage.setItem('feas_last_step_index', String(activeStepIndex));
      localStorage.setItem('feas_last_category_index', String(safeCategoryIndex));
    } catch (_) { }

    syncHash('category/' + safeCategoryIndex);
    sidebar.setActive(safeCategoryIndex);

    const breadcrumbBar = document.getElementById('breadcrumbBar');
    const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    if (breadcrumbBar && breadcrumbCurrent) {
      breadcrumbBar.style.display = 'flex';
      breadcrumbCurrent.textContent = category.label;
    }

    if (!categoryView) {
      categoryView = new StudyCategoryView('wizardContainer', store, TABLE_SCHEMAS, {
        steps: STEPS,
        categories: SIDEBAR_SECTIONS,
        onNavigateCategory: navigateToCategory,
        onGoHome: showLandingDashboard,
        // عدّاد «أنجزت X من Y» داخل .category-toc (بند 2.3) — نفس progressTracker
        // الحي المحدَّث من refreshCompletion() عبر كل تغيير في المخزن، لا نسخة منفصلة.
        progressTracker
      });
    }
    syncCategoryNavToMode();

    const rendered = await categoryView.render(safeCategoryIndex, {
      focusStepIndex: activeStepIndex,
      isCurrent: () => requestId === navigationRequestId
    });
    
    NProgress.done();

    if (!rendered || requestId !== navigationRequestId) return;

    enhanceFieldHelp(document.getElementById('wizardContainer'));
    studyJourney?.update(safeCategoryIndex);
    window.aiChatModal?.setCategoryContext(category.id, category.label);

    const mainStage = document.querySelector('.main-stage');
    if (mainStage && activeStepIndex === category.range[0]) mainStage.scrollTop = 0;
    document.getElementById('wizardContainer')?.focus({ preventScroll: true });
  };

  const navigateTo = async (index) => {
    if (categoryNavigationEnabled) {
      const categoryIndex = categoryIndexForStep(Number(index) || 0);
      return navigateToCategory(categoryIndex >= 0 ? categoryIndex : 0, Number(index) || 0);
    }
    const requestId = ++navigationRequestId;
    try {
      enterWorkspaceMode();

      let targetIndex = index;
      // (أُزيلت خطوة القوالب من المسار؛ نقطة البداية صارت نافذةً قبل الدخول)

      const step = STEPS[targetIndex];
      if (!step) return;
      latestRequestedStepIndex = targetIndex;

      index = targetIndex; // تحديث المتغير المحلي ليتناسق مع الحلقات أدناه

      try {
        localStorage.setItem('feas_last_step_index', String(targetIndex));
      } catch (_) { }

      syncHash('step/' + targetIndex);

      sidebar.setActive(targetIndex);
      wizard.renderStep(step.id, step, targetIndex);

      // Breadcrumbs
      const breadcrumbBar = document.getElementById('breadcrumbBar');
      const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
      if (breadcrumbBar && breadcrumbCurrent) {
        breadcrumbBar.style.display = 'flex';
        breadcrumbCurrent.textContent = step.label || step.id || '';
      }

      const containerId = 'wizardContainer';

      // موزّع «علَم الخطوة → المكوّن» موحَّد الآن في stepComponentRegistry.js (تدقيق
      // 2026-07-11) — كان مكرَّراً هنا وفي StudyCategoryView.renderStepInto بسلسلتين
      // مستقلتين وجب تطابقهما يدوياً؛ الآن مصدر واحد لكلا المستهلكين.
      const { rendered } = await renderStepComponent(step, containerId, index, {
        store,
        onNavigate: navigateTo,
        isCurrent: () => requestId === navigationRequestId,
        cache: components,
        wizardFactory: () => wizard,
        runFullModel
      });
      if (rendered === false) return;

      // قد تكتمل استيرادات المكوّنات الكسولة بترتيب مختلف عند النقر السريع.
      // إذا أصبحت هذه العملية قديمة، أعد رسم أحدث وجهة فقط ولا تُلحق بها شريطاً قديماً.
      if (requestId !== navigationRequestId) {
        Promise.resolve().then(() => navigateTo(latestRequestedStepIndex));
        return;
      }

      // خطوات التحليل الحسابي تكتب innerHTML خاصاً بها بلا شريط تنقّل — نُلحق «السابق/التالي»
      // كي لا يعلق المستخدم المبتدئ فيها (idempotent: لا يكرّر شريط خطوات النموذج).
      wizard.appendNav(index);
      // جميع الشاشات، بما فيها المكونات المتخصصة والجداول، تحصل على شرح سياقي
      // موحّد لكل خانة. الاستدعاء آمن ومتكرر ولا يضاعف الأيقونات الموجودة.
      enhanceFieldHelp(document.getElementById(containerId));
      // خانة «إصدار تقرير» للأدوات التحليلية/المختلطة (المسار القديم أحادي الخطوة).
      attachToolReport(step, containerId, store);
      studyJourney?.update(targetIndex);

      // الانتقال بين الخطوات يعيد المستخدم إلى بدايتها دائماً، بدلاً من إبقائه عند
      // موضع التمرير القديم فيرى منتصف خطوة جديدة بلا عنوان أو سياق.
      const mainStage = document.querySelector('.main-stage');
      if (mainStage) mainStage.scrollTop = 0;
      document.getElementById(containerId)?.focus({ preventScroll: true });
    } catch (error) {
      console.error('Navigation error:', error);
      toast.error('حدث خطأ أثناء الانتقال بين الخطوات');
    }
  };


  // Wrapper: resolve step index when using filtered steps (simple/mini mode)
  const handleStepClick = (stepOrIndex) => {
    if (categoryNavigationEnabled && typeof stepOrIndex === 'object') {
      const categoryIndex = SIDEBAR_SECTIONS.findIndex(category => category.id === stepOrIndex.id);
      if (categoryIndex >= 0) {
        navigateToCategory(categoryIndex);
        return;
      }
    }
    const idx = typeof stepOrIndex === 'object'
      ? STEPS.findIndex(s => s.id === stepOrIndex.id && s.label === stepOrIndex.label)
      : stepOrIndex;
    if (typeof idx === 'number' && idx >= 0) navigateTo(idx);
  };

  // Initialize Progress Tracker (must be created before wiring stage bar + sidebar)
  const progressTracker = new ProgressTracker(STEPS.length);

  // كشف الإكمال تلقائياً من بيانات الدراسة (كان detectCompletion غير مستدعى إطلاقاً
  // فيبقى عدّاد «X خطوة مكتملة» صفراً دائماً) — مع تخميد لتفادي إعادة الحساب لكل ضغطة مفتاح
  let _completionDetectTimer = null;
  const refreshCompletion = () => {
    if (_completionDetectTimer) clearTimeout(_completionDetectTimer);
    _completionDetectTimer = setTimeout(() => {
      try {
        progressTracker.detectCompletion(store.getState(), STEPS);
      } catch (e) {
        console.warn('[App] completion detection failed:', e);
      }
    }, 500);
  };

  const sidebar = new Sidebar('stepperNav', STEPS, handleStepClick, store);
  // Store sidebar instance globally for access in enterWorkspaceMode
  window.sidebarInstance = sidebar;

  const wizard = new Wizard('wizardContainer', store, TABLE_SCHEMAS, { steps: STEPS, onNavigate: navigateTo, onGoHome: showLandingDashboard });
  components.wizard = wizard;

  // يغطّي أيضاً الخانات والصفوف التي يضيفها المستخدم داخل الخطوة بعد الرسم الأول.
  observeFieldHelp(document.getElementById('wizardContainer'), {
    isActive: () => /#\/?(?:step|category)\/\d+/.test(window.location.hash)
  });

  studyJourney = new StudyJourney({
    steps: CATEGORY_STEPS,
    masterSteps: CATEGORY_STEPS,
    sections: CATEGORY_JOURNEY_SECTIONS,
    unitLabel: 'التصنيف',
    mapHeading: 'انتقل إلى أي تصنيف',
    onNavigate: navigateToCategory
  });

  sidebar.setProgressTracker(progressTracker);

  studyJourney.update(0);

  // كشف الإكمال عند الإقلاع وعند كل تغيير في البيانات
  refreshCompletion();
  store.subscribe(() => refreshCompletion());

  // --- Fail-Safe: Force Sidebar Visibility ---
  try {
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl) {
      // Remove potentially conflicting inline styles
      sidebarEl.style.removeProperty('display');

      // Force rendering immediately
      sidebar.render().then(() => {
        console.log('[App] Sidebar rendered successfully');
      }).catch(err => {
        console.error('[App] Sidebar render failed:', err);
        // Fallback content if render fails
        const nav = document.getElementById('stepperNav');
        if (nav && nav.children.length === 0) {
          nav.innerHTML = '<div style="padding:10px; color:red;">خطأ في تحميل القائمة. يرجى تحديث الصفحة.</div>';
        }
      });
    }
  } catch (e) {
    console.error('[App] Sidebar fail-safe error:', e);
  }
  // ------------------------------------------

  // Breadcrumb: الرئيسية → step 0
  const breadcrumbHome = document.querySelector('[data-breadcrumb-home]');
  if (breadcrumbHome) {
    breadcrumbHome.addEventListener('click', (e) => {
      e.preventDefault();
      showLandingDashboard();
    });
  }

  const hasMeaningfulUnsavedChanges = () => {
    if (!store._dirty) return false;
    const ignoredKeys = new Set(['id', 'createdAt', 'updatedAt', 'version', 'appSettings']);
    const normalize = (value) => JSON.stringify(value, (key, val) => (
      ignoredKeys.has(key) ? undefined : val
    ));

    try {
      return normalize(store.getState()) !== normalize(createEmptyStudy());
    } catch (_) {
      return true;
    }
  };

  // الدراسات: دراسة جديدة — تنبيه حفظ (مركز تنمية) ثم فتح معرض القوالب
  window.addEventListener('feasibility:newStudy', async () => {
    const openGallery = () => {
      import('./js/ui/TemplateGallery.js').then(({ TemplateGallery }) => {
        new TemplateGallery('templateGalleryOverlay', store).open();
      }).catch(() => { });
    };
    if (hasMeaningfulUnsavedChanges()) {
      const overlay = document.createElement('div');
      overlay.className = 'unsaved-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'unsaved-modal-title');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
      overlay.innerHTML = `
        <div class="unsaved-modal" style="background:var(--c-bg-card, #1e293b); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:24px; max-width:400px; width:100%; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          <h3 id="unsaved-modal-title" class="text-lg font-bold mb-3">لم تحفظ التغييرات</h3>
          <p class="text-muted text-sm mb-6">هل تريد الحفظ قبل الخروج؟</p>
          <div class="flex gap-3 flex-wrap justify-end">
            <button type="button" id="unsaved-cancel" class="btn btn--ghost btn--sm">إلغاء</button>
            <button type="button" id="unsaved-discard" class="btn btn--secondary btn--sm">خروج دون حفظ</button>
            <button type="button" id="unsaved-save" class="btn btn--primary btn--sm">حفظ الآن</button>
          </div>
        </div>
      `;
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      overlay.querySelector('#unsaved-cancel').addEventListener('click', () => overlay.remove());
      overlay.querySelector('#unsaved-discard').addEventListener('click', () => { overlay.remove(); openGallery(); });
      overlay.querySelector('#unsaved-save').addEventListener('click', async () => {
        overlay.querySelector('#unsaved-save').disabled = true;
        overlay.querySelector('#unsaved-save').textContent = 'جاري الحفظ...';
        try {
          await store.flush();
          overlay.remove();
          openGallery();
        } catch (err) {
          console.error(err);
          overlay.querySelector('#unsaved-save').disabled = false;
          overlay.querySelector('#unsaved-save').textContent = 'حفظ الآن';
        }
      });
      return;
    }
    openGallery();
  });

  // الاستماع لحدث تحميل المشروع (من القالب أو غيره)
  window.addEventListener('project-loaded', async (e) => {
    const source = e.detail?.source || '';
    if (source === 'blank') {
      // تدقيق 2026-07-08: navigateTo(0) يكتب feas_last_step_index=0 فوراً، فيظهر زر
      // «تابع من حيث توقفت» لاحقاً حتى لهذه الجلسة الفارغة تحديداً — امسحه صراحة عند
      // بدء دراسة جديدة فارغة بدل تركه يشير لجلسة لا محتوى حقيقياً فيها.
      localStorage.removeItem('feas_last_step_index');
      navigateTo(0);
    } else {
    const projectInfoIdx = stepIndexById('projectInfo'); // أول تطابق = خطوة النموذج الرئيسية
    navigateTo(projectInfoIdx >= 0 ? projectInfoIdx : 0); // الانتقال لمعلومات المشروع مباشرة
    }
    const { toast } = await import('./js/utils/toast.js');
    if (e.detail?.name) {
      toast.success(`بدأ العمل على: ${e.detail.name}`);
    }
  });

  // الدراسات: فتح دراسة محفوظة (من السحابة أو محلياً)
  window.addEventListener('feasibility:openStudy', async (e) => {
    const id = e.detail?.id;
    if (!id) return;
    const { ProjectManager } = await import('./js/services/ProjectManager.js');
    const { toast } = await import('./js/utils/toast.js');
    try {
      const result = await ProjectManager.loadProject(id);
      if (result?.data) {
        store.set(store.mergeWithDefaults(result.data));
        navigateTo(0);
        const msg = result.source === 'cloud' ? 'تم تحميل الدراسة من السحابة' : 'تم تحميل الدراسة';
        toast.success(msg);
      } else {
        toast.error('لم تُعثر على الدراسة');
      }
    } catch (err) {
      toast.error('فشل تحميل الدراسة');
    }
  });

  // صفحة المستخدم (حسابي): عرض في المنطقة الرئيسية عند الطلب
  const wizardContainer = document.getElementById('wizardContainer');
  window.addEventListener('feasibility:showUserProfile', async () => {
    // تدقيق 2026-07-09 (توحيد المصادقة): الزر الوحيد الذي كان يُطلق هذا الحدث سابقاً
    // عاش داخل AuthComponent.js الميت (غير قابل للوصول)، فلم يُختبر هذا المسار حياً من
    // قبل. زر «حسابي» الجديد في DashboardView.js يفتح هذه الصفحة من الرئيسية (لا من
    // داخل خطوة معالج) — إن استخدمنا savedStepIndex=wizard.currentStepIndex فقط، فزر
    // «رجوع» كان سيُدخل المستخدم لخطوة معالج عشوائية بدل إعادته للرئيسية فعلياً.
    const cameFromHome = _currentRoute === 'home';
    const savedStepIndex = wizard.currentStepIndex;
    const { UserProfileView } = await import('./js/ui/UserProfileView.js');
    const userProfileView = new UserProfileView(wizardContainer, {
      onBack: () => cameFromHome ? showLandingDashboard() : navigateTo(savedStepIndex)
    });
    await userProfileView.render();
  });

  // صفحة التكاملات (من حسابي أو مباشرة)
  window.addEventListener('feasibility:showIntegrations', async (e) => {
    const savedStepIndex = wizard.currentStepIndex;
    const backToProfile = e.detail?.onBackToProfile;
    const { IntegrationsView } = await import('./js/ui/IntegrationsView.js');
    const view = new IntegrationsView(wizardContainer, {
      onBack: () => {
        if (backToProfile) {
          window.dispatchEvent(new CustomEvent('feasibility:showUserProfile'));
        } else {
          navigateTo(savedStepIndex);
        }
      }
    });
    await view.render();
  });

  // سلة المحذوفات (من الشريط الجانبي)
  window.addEventListener('feasibility:showTrash', async () => {
    const savedStepIndex = wizard.currentStepIndex;
    try {
      const { TrashView } = await import('./js/ui/TrashView.js');
      const view = new TrashView();
      const el = await view.render();
      wizardContainer.innerHTML = '';
      // زر «عودة» داخل الواجهة يستخدم history.back — نوفر مساراً صريحاً أيضاً
      const backBtn = el.querySelector('button.btn-secondary');
      if (backBtn) {
        backBtn.removeAttribute('onclick');
        backBtn.addEventListener('click', () => navigateTo(savedStepIndex));
      }
      wizardContainer.appendChild(el);
    } catch (err) {
      console.error('TrashView load failed:', err);
      toast.error('تعذر فتح سلة المحذوفات');
    }
  });

  // لوحة المستثمر (Investor Dashboard)
  window.addEventListener('feasibility:showInvestorDashboard', async () => {
    const savedStepIndex = wizard.currentStepIndex;
    // Hide sidebar for full immersion
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl) sidebarEl.style.display = 'none';

    const { InvestorDashboard } = await import('./js/ui/InvestorDashboard.js');
    const db = new InvestorDashboard('wizardContainer', store, {
      onExit: () => {
        // Restore sidebar
        if (sidebarEl) sidebarEl.style.removeProperty('display');
        navigateTo(savedStepIndex);
      }
    });
    db.render();
  });

  // لوحة الافتراضات المركزية (خطة 2026-07-12، الدفعة 4، البند 1): شاشة واحدة تجمع
  // الأرقام الجوهرية (إيرادات/فريق/تمويل/افتراضات) بلا تنقّل بين 41 قسماً — تُفتح من
  // زر «معايرة سريعة» في ترويسة العمل أو من لوحة القرار. تحفظ خطوة المعالج الحالية
  // وتستعيدها عند الخروج.
  // تدقيق تحقّق حي 2026-07-12: نمط savedStepIndex=wizard.currentStepIndex (مستخدَم في
  // 4 معالجات أخرى مشابهة: showUserProfile/showIntegrations/showTrash/showInvestorDashboard)
  // خاطئ فعلياً مع مسار التنقّل الأساسي الحالي (StudyCategoryView) — navigateTo() يفوّض
  // بالكامل لـnavigateToCategory وTypeScript لا يمسّ متغيّر wizard العالمي إطلاقاً، فيبقى
  // wizard.currentStepIndex مجمَّداً عند 0 (قيمة المُنشئ) بصرف النظر عن موضع المستخدم
  // الفعلي — زر «رجوع» كان سيُعيده دوماً لأول تصنيف بدل خطوته الحقيقية (اكتُشف بتحقق حي
  // فعلي، ثبَّتها تفادياً لهذه الشاشة الجديدة تحديداً؛ الأربعة الأخرى خارج نطاق هذه المهمة).
  // latestRequestedStepIndex (معرَّف أعلى الملف) يتحدث فعلياً مع كل تنقّل حقيقي — المصدر الصحيح.
  window.addEventListener('feasibility:openAssumptionsPanel', async () => {
    const savedStepIndex = latestRequestedStepIndex;
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';

    const { CentralAssumptionsView } = await import('./js/ui/CentralAssumptionsView.js');
    const view = new CentralAssumptionsView(wizardContainer, store, {
      onExit: () => {
        view.cleanup();
        if (sidebarEl) sidebarEl.style.removeProperty('display');
        if (stepperNavEl) stepperNavEl.style.removeProperty('display');
        navigateTo(savedStepIndex);
      },
      onNavigateToStep: (sectionId) => {
        const idx = stepIndexById(sectionId);
        if (idx >= 0) {
          view.cleanup();
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          navigateTo(idx);
        }
      }
    });
    view.render();
  });

  // قفزة من قائمة تحذيرات فحص الجودة قبل التصدير (ExportMenu.js، دفعة 3 2026-07-12)
  // إلى الخطوة المسؤولة عن التحذير — navigateTo() تحسم فئة/فهرس الخطوة داخلياً.
  window.addEventListener('feasibility:navigateToStep', (e) => {
    const stepIndex = e?.detail?.stepIndex;
    if (Number.isInteger(stepIndex) && stepIndex >= 0) navigateTo(stepIndex);
  });

  // اختصارات لوحة المفاتيح
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const dropdown = document.getElementById('exportDropdown');
      if (dropdown && dropdown.style.display !== 'none') dropdown.style.display = 'none';
      const openModal = document.querySelector('.modal[style*="display"]');
      if (openModal) openModal.style.display = 'none';
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toast.info('بحث شامل (Cmd+K): قريباً');
    }
  });

  // انتهاء الجلسة تلقائياً بعد 30 دقيقة خمول
  // تدقيق 2026-07-09 (توحيد المصادقة): كان يستدعي supabase.auth.signOut() مباشرة بدل
  // signOut() الموحّدة — يتجاوز مسح مسودات feas_project_* الحساسة (ملاحظة عالية #44
  // الأصلية عولجت لزر الخروج اليدوي فقط، لا لهذا المسار الثاني). signOut() الموحّدة
  // تُنفّذ location.reload() أيضاً بعد المسح — سلوك صحيح لخروج فعلي، لا فرق عن الزر اليدوي.
  (async () => {
    const { startIdleTimeout } = await import('./js/utils/idleTimeout.js');
    startIdleTimeout({
      onWarn: () => toast.warning('انتهت فترة الخمول قريباً. تحريك الماوس أو لوحة المفاتيح يمدّد الجلسة.'),
      onIdle: async () => {
        toast.info('انتهت الجلسة بسبب الخمول (30 دقيقة).');
        try {
          const { signOut } = await import('./supabaseClient.js');
          await signOut();
        } catch (_) { }
      }
    });
  })();

  // 3. Render  // Initial Load Strategy
  // If we have a stored current project ID? No, we don't track "active project" in localStorage per se, just last save.
  // Let's always show Dashboard first for this "Platform" feel.

  // ═══════════════════════════════════════════════════════════════════
  // موجّه داخلي (In-App Router) — تنقّل واعٍ بتاريخ المتصفح
  // كل انتقال يكتب عنواناً في الرابط (#/…)، فيشتغل زر الرجوع/التقديم صح،
  // وتصير روابط الخطوات قابلة للحفظ والمشاركة.
  // ═══════════════════════════════════════════════════════════════════
  let _currentRoute = null;   // العنوان المعروض حالياً (مثل 'home' أو 'step/3')
  let _isRestoring = false;   // true أثناء الرسم استجابةً لتغيّر الرابط (رجوع/تقديم/رابط مباشر)

  // خريطة الصفحات الفرعية: اسم العنوان → دالة العرض
  const SUBVIEW_ROUTES = {
    examples: showExamplesInspireView,
    advisory: showAdvisoryView,
    monshaat: showMonshaatComplianceView,
    financing: showFinancingGuideView,
    beginner: showBeginnerGuideView,
    idea: showIdeaAssessmentView,
    hypothesis: showHypothesisView,
    partner: showPartnerSelectionView,
    resources: showResourcesGuideView,
    trust: showTrustCriteriaView,
    knowledge: showKnowledgeCenterView,
    accelerator: showAcceleratorTipsView,
    postfeasibility: showPostFeasibilityView,
    quickstart: showQuickStartGuideView,
    quickwizard: startQuickFeasibilityWizard
  };

  // قراءة العنوان من الرابط (بدون '#/')
  const parseHash = () => (window.location.hash || '').replace(/^#\/?/, '').trim();

  // تسجيل انتقال جديد في تاريخ المتصفح (لا يفعل شيئاً أثناء الاستعادة)
  const syncHash = (route) => {
    const isFirst = (_currentRoute === null);
    _currentRoute = route;
    if (_isRestoring) return;
    const target = '#/' + route;
    if (window.location.hash === target) return;
    try {
      if (isFirst) window.history.replaceState(null, '', target);
      else window.history.pushState(null, '', target);
    } catch (_) {
      window.location.hash = target;
    }
  };

  // عرض صفحة المشاركة (وضع المستثمر) — عرض مغمور بلا شريط جانبي
  const renderShareRoute = async (projectId) => {
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    try {
      const { ShareView } = await import('./js/ui/ShareView.js');
      new ShareView('wizardContainer', store, null).render(projectId);
    } catch (e) {
      console.error('ShareView load failed:', e);
      toast.error('تعذر فتح صفحة المشاركة');
    }
  };

  // بوابة المراجعين (2026-07-13) — عرض مغمور بلا شريط جانبي، مقصور على
  // مستخدمين مُدرَجين فعلياً بجدول reviewers (التحقق داخل ReviewerDashboardView
  // نفسها عبر AuthGuard.isReviewer؛ هذا الفرع فقط يهيّئ الحاوية ويستورد الملف).
  const renderReviewerRoute = async () => {
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    try {
      const { ReviewerDashboardView } = await import('./js/ui/ReviewerDashboardView.js');
      await new ReviewerDashboardView('wizardContainer').render();
    } catch (e) {
      console.error('ReviewerDashboardView load failed:', e);
      toast.error('تعذر فتح بوابة المراجعين');
    }
  };

  // لوحة الأدمن (2026-07-16) — عرض مغمور بلا شريط جانبي، مقصور على مستخدمين
  // مُدرَجين فعلياً بجدول admins (التحقق داخل AdminDashboardView نفسها عبر
  // AuthGuard.isAdmin؛ هذا الفرع فقط يهيّئ الحاوية ويستورد الملف).
  const renderAdminRoute = async () => {
    const sidebarEl = document.querySelector('.sidebar');
    const stepperNavEl = document.getElementById('stepperNav');
    const breadcrumbBar = document.getElementById('breadcrumbBar');
    if (sidebarEl) sidebarEl.style.display = 'none';
    if (stepperNavEl) stepperNavEl.style.display = 'none';
    if (breadcrumbBar) breadcrumbBar.style.display = 'none';
    try {
      const { AdminDashboardView } = await import('./js/ui/AdminDashboardView.js');
      await new AdminDashboardView('wizardContainer').render();
    } catch (e) {
      console.error('AdminDashboardView load failed:', e);
      toast.error('تعذر فتح لوحة الأدمن');
    }
  };

  // رسم الواجهة المطابقة للعنوان — بدون كتابة تاريخ جديد (يُستدعى عند الرجوع/التقديم)
  const routeToView = async (route) => {
    _isRestoring = true;
    _currentRoute = route;
    try {
      if (route === '' || route === 'home') {
        await showLandingDashboard();
      } else if (route.startsWith('category/')) {
        const categoryIndex = parseInt(route.slice(9), 10);
        if (Number.isInteger(categoryIndex) && categoryIndex >= 0 && categoryIndex < SIDEBAR_SECTIONS.length) {
          await navigateToCategory(categoryIndex);
        } else await showLandingDashboard();
      } else if (route.startsWith('step/')) {
        const idx = parseInt(route.slice(5), 10);
        if (Number.isInteger(idx) && idx >= 0 && idx < STEPS.length) await navigateTo(idx);
        else await showLandingDashboard();
      } else if (route.startsWith('share/')) {
        await renderShareRoute(route.slice(6));
      } else if (route.startsWith('reviewer')) {
        await renderReviewerRoute();
      } else if (route.startsWith('admin')) {
        await renderAdminRoute();
      } else if (route.startsWith('payment-return')) {
        // Moyasar/Stripe يُعيدان توجيه المتصفح هنا بعد الدفع (انظر create-checkout
        // Edge Function: returnUrl يبني هذا الرابط تحديداً بمعامل order=<orderId>).
        const queryStr = route.includes('?') ? route.slice(route.indexOf('?') + 1) : '';
        const orderId = new URLSearchParams(queryStr).get('order');
        const { PaymentReturnView } = await import('./js/ui/PaymentReturnView.js');
        const view = new PaymentReturnView(wizardContainer, {
          orderId,
          onContinue: () => showLandingDashboard(),
        });
        await view.render();
      } else if (SUBVIEW_ROUTES[route]) {
        SUBVIEW_ROUTES[route]();
      } else {
        await showLandingDashboard();
      }
    } catch (e) {
      console.error('[Router] routeToView failed:', e);
    } finally {
      _isRestoring = false;
    }
  };

  // استجابة لزر الرجوع/التقديم أو أي تغيّر خارجي في الرابط
  const syncFromUrl = () => {
    const route = parseHash();
    const normalized = route === '' ? 'home' : route;
    if (normalized === _currentRoute) return; // نعرضها أصلاً → تفادي الحلقات المتكررة
    routeToView(normalized);
  };

  window.addEventListener('popstate', syncFromUrl);
  window.addEventListener('hashchange', syncFromUrl);

  // شعار «قرار» في الترويسات = زر العودة للصفحة الرئيسية
  ['.app-header__brand', '.brand-name', '.brand-name-mobile'].forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.style.cursor = 'pointer';
      el.setAttribute('title', 'العودة للصفحة الرئيسية');
      el.setAttribute('role', 'link');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', 'قرار — العودة للصفحة الرئيسية');
      el.addEventListener('click', () => showLandingDashboard());
      // WCAG 2.1.1: تفعيل بلوحة المفاتيح (Enter/Space) لا بالفأرة فقط
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          showLandingDashboard();
        }
      });
    });
  });

  // أول رسم — نحترم الرابط: رابط مباشر لصفحة يفتحها، وإلا الصفحة الرئيسية
  const initialRoute = parseHash();
  if (initialRoute && initialRoute !== 'home') {
    routeToView(initialRoute);
  } else {
    showLandingDashboard();
  }

  // 4. Initialize Auto-save
  const autoSave = new AutoSave(store);

  // Check if there's a previous autosave
  if (autoSave.hasAutoSave()) {
    const lastSaved = autoSave.getLastSavedTime();
    const minutesAgo = Math.floor((Date.now() - lastSaved) / 60000);

    toast.info(
      `تم العثور على حفظ تلقائي من ${minutesAgo} دقيقة. سيتم الحفظ تلقائياً كل 30 ثانية.`,
      8000
    );
  }

  autoSave.start();

  // تنبيه الحفظ عند إغلاق التبويب أو الخروج (مركز تنمية)
  window.addEventListener('beforeunload', (e) => {
    if (hasMeaningfulUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = 'لم تحفظ التغييرات. هل تريد الحفظ قبل الخروج؟';
    }
  });

  // دالة تطبيق وضع العرض (بسيط/مصغر/كامل) على الخطوات والشريط الجانبي
  function applyMode(mode) {
    const effective = mode || (store.getState().appSettings?.mode) || localStorage.getItem('study_mode_preference') || 'advanced';
    // المسار السريع: 5-7 خطوات أساسية فقط (نظام مستقل عن مصغّر/بسيط)
    const quickVisible = [
      SECTIONS.PROJECT_INFO, // Basic Info
      'projectDetails',      // تفاصيل الفكرة (كانت تلتقط بتكرار PROJECT_INFO قبل توحيد المعرّفات)
      'projectIntro',        // Description (Simplified)
      SECTIONS.TECHNICAL,    // Costs (Magic Fill)
      SECTIONS.HR,           // Staff (Magic Fill)
      SECTIONS.REVENUE,      // Sales
      SECTIONS.FINANCIAL_STATEMENTS, // Results
      SECTIONS.DECISION_DASHBOARD,   // Final Decision
      SECTIONS.EXECUTIVE_SUMMARY     // Report
    ];

    let visibleSteps = STEPS;
    let stepIndexMap = null;
    // مصغّر/بسيط: مصدر واحد isStepVisibleInStudyMode (wizardSteps.js) — لا قوائم مكرّرة.
    if (effective === 'mini' || effective === 'simple') {
      visibleSteps = STEPS.filter(s => isStepVisibleInStudyMode(s.id, effective));
      stepIndexMap = visibleSteps.map(step => STEPS.indexOf(step));
    } else if (effective === 'quick') {
      // Note: filter preserves order and duplicates. SECTIONS.PROJECT_INFO matches 2 steps.
      // Expected steps: Info(1), Info(2), Intro, Tech, HR, Revenue, Statements, Decision, Summary. (Total 9)
      visibleSteps = STEPS.filter(s => quickVisible.includes(s.id));
      stepIndexMap = visibleSteps.map(step => STEPS.indexOf(step));

      // Override sidebar sections for Quick Mode
      // Group 1: Inputs (Indices 0-5: Info*2, Intro, Tech, HR, Revenue)
      // Group 2: Results (Indices 6-8: Statements, Decision, Summary)
      sidebar.sections = [
        { id: 'quick_inputs', label: 'البيانات الأساسية', range: [0, 5] },
        { id: 'quick_results', label: 'النتائج والقرار', range: [6, visibleSteps.length - 1] }
      ];
    } else {
      // Reset to default sections for advanced mode
      sidebar.sections = SIDEBAR_SECTIONS;
    }

    if (categoryNavigationEnabled) {
      sidebar.steps = CATEGORY_STEPS;
      sidebar.stepIndexMap = null;
      sidebar.sections = CATEGORY_SIDEBAR_SECTIONS;
      wizard.steps = STEPS;
      wizard.stepIndexMap = null;
      // يضبط الخطوات + التصنيفات الظاهرة + رحلة الدراسة حسب الوضع (مصدر واحد).
      syncCategoryNavToMode();
      // إعادة رسم صفحة الفئة المعروضة حالياً كي يسري الوضع الجديد فوراً (لا انتظار
      // تنقّل تالٍ) — فقط إن كنا فعلاً على صفحة فئة.
      if (categoryView && /#\/?category\//.test(window.location.hash || '')) {
        navigateToCategory(sidebar.activeStep || 0);
      }
    } else {
      sidebar.steps = visibleSteps;
      sidebar.stepIndexMap = stepIndexMap;
      wizard.steps = visibleSteps;
      // في المسار القديم، يجب تحويل فهرس الخطوة المرئية إلى فهرسها المطلق.
      wizard.stepIndexMap = stepIndexMap;
      studyJourney?.setSteps(visibleSteps, stepIndexMap);
    }

    // Save effective mode to store for persistence
    if (store.getState().appSettings?.mode !== effective) {
      store.update('appSettings', { ...(store.getState().appSettings || {}), mode: effective });
    }

    sidebar.render();

    const activeJourneyIndex = categoryNavigationEnabled
      ? Math.min(Math.max(sidebar.activeStep || 0, 0), CATEGORY_STEPS.length - 1)
      : (sidebar.activeStep || 0);
    studyJourney?.update(activeJourneyIndex);
  }

  // آخر تحديث منذ X دقائق — جدوى كلاود (يُحدَّث عند الحفظ)
  function updateLastUpdateStatus() {
    const el = document.getElementById('lastUpdateStatus');
    if (!el) return;
    const state = store.getState();
    const updatedAt = state?.updatedAt;
    if (!updatedAt) {
      el.textContent = '—';
      return;
    }
    const then = new Date(updatedAt).getTime();
    const now = Date.now();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) el.textContent = 'آخر تحديث الآن — تعديلك سريع.';
    else if (diffMins < 60) el.textContent = `آخر تحديث منذ ${diffMins} دقيقة — تعديلك سريع.`;
    else el.textContent = `آخر تحديث منذ ${Math.floor(diffMins / 60)} ساعة — تعديلك سريع.`;
  }
  if (store.subscribeSaveStatus) {
    store.subscribeSaveStatus(() => {
      updateLastUpdateStatus();
    });
  }
  store.subscribe(() => updateLastUpdateStatus());
  updateLastUpdateStatus();

  // 7. Reactive Loop - Update dashboard when data changes
  store.subscribe((state, changedSection) => {
    // Check for Mode Change
    if (changedSection === 'appSettings' && state.appSettings?.mode) {
      applyMode(state.appSettings.mode);
    }

    // If dashboard is visible, re-render it
    const dashboardContainer = document.getElementById('wizardContainer');
    if (dashboardContainer && dashboardContainer.querySelector('.decision-banner')) {
      if (components.dashboard) {
        components.dashboard.render();
      }
    }
  });

  // تطبيق وضع العرض عند التحميل الأول (مثلاً من مشروع محفوظ)
  applyMode(store.getState().appSettings?.mode);

  // ═══════════════════════════════════════════════════════════════════
  // Unified Export Menu
  // ═══════════════════════════════════════════════════════════════════

  const btnExportMenu = document.getElementById('btnExportMenu');
  // We can eventually remove 'exportDropdown' from DOM if not used, 
  // or keep it if we want to reuse the HTML structure, but ExportMenu uses a modal overlay.

  function openExportMenu() {
    import('./js/ui/ExportMenu.js').then(({ ExportMenu }) => {
      new ExportMenu('exportMenuOverlay', store).open();
    }).catch((err) => {
      console.error('Failed to open export menu:', err);
      toast.error('حدث خطأ أثناء فتح قائمة التصدير');
    });
  }

  if (btnExportMenu) {
    btnExportMenu.addEventListener('click', async (e) => {
      e.stopPropagation();
      openExportMenu();
    });
  }

  const headerExportMenu = document.getElementById('headerExportMenu');
  if (headerExportMenu) {
    headerExportMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      openExportMenu();
    });
  }

  const btnFabExport = document.getElementById('btnFabExport');
  if (btnFabExport) {
    btnFabExport.addEventListener('click', () => openExportMenu());
  }
  document.getElementById('mobileOpenExport')?.addEventListener('click', () => openExportMenu());
  document.getElementById('mobileOpenAI')?.addEventListener('click', () => {
    if (window.aiChatModal) window.aiChatModal.toggle();
    else toast.info('المستشار الذكي يُحمّل الآن.');
  });

  // مشاركة الدراسة (Runway: تعاون + صلاحيات محرر/مشاهد)
  const btnShareStudy = document.getElementById('btnShareStudy');
  if (btnShareStudy) {
    btnShareStudy.addEventListener('click', () => {
      import('./js/ui/ShareStudyView.js').then(({ ShareStudyView }) => {
        const shareView = new ShareStudyView('shareStudyOverlay', store, {
          onClose: () => { },
          onInvite: null // عند ربط API: إرسال دعوة إلى السحابة
        });
        shareView.open();
      }).catch((err) => {
        console.error('ShareStudyView load failed:', err);
        toast.error('تعذر فتح نافذة المشاركة');
      });
    });
  }

  // المستشار الذكي التفاعلي (AI Chat) — المرحلة 2 (KPI-10.4: ربط باختبار الضغط)
  import('./js/ui/AIChatModal.js').then(({ AIChatModal }) => {
    const aiChat = new AIChatModal(store);
    aiChat.mount();
    window.aiChatModal = aiChat;
    // تحميل هذا الوحدة كسول (dynamic import) — قد يكتمل بعد أول navigateToCategory،
    // فتفوته نصيحة القسم الأول. نلتقط التصنيف الحالي فوراً من آخر خطوة مطلوبة.
    const currentCategory = SIDEBAR_SECTIONS.find(c => latestRequestedStepIndex >= c.range[0] && latestRequestedStepIndex <= c.range[1]);
    if (currentCategory) aiChat.setCategoryContext(currentCategory.id, currentCategory.label);
  }).catch((e) => console.warn('AIChatModal load failed:', e));

  // ═══════════════════════════════════════════════════════════════════
  // Multi-Project Support: Save/Load Studies
  // ═══════════════════════════════════════════════════════════════════

  // Save Study as JSON
  const btnSaveStudy = document.getElementById('btnSaveStudy');
  const saveStudyText = document.getElementById('saveStudyText');
  const saveStudyProgress = document.getElementById('saveStudyProgress');

  // Sidebar secondary actions toggle (Reduce clutter)
  const btnMoreActions = document.getElementById('btnMoreActions');
  const sidebarSecondaryActions = document.getElementById('sidebarSecondaryActions');
  const SIDEBAR_MORE_KEY = 'feasibility_sidebar_more_actions_open';

  if (btnMoreActions && sidebarSecondaryActions) {
    const applyMoreState = (open) => {
      sidebarSecondaryActions.style.display = open ? 'block' : 'none';
      btnMoreActions.setAttribute('aria-expanded', open ? 'true' : 'false');
      try { localStorage.setItem(SIDEBAR_MORE_KEY, open ? '1' : '0'); } catch (_) { }
    };

    let isOpen = false;
    try { isOpen = localStorage.getItem(SIDEBAR_MORE_KEY) === '1'; } catch (_) { }
    applyMoreState(isOpen);

    btnMoreActions.addEventListener('click', (e) => {
      e.preventDefault();
      isOpen = !isOpen;
      applyMoreState(isOpen);
    });
  }

  /** Shared save study action (sidebar + header toolbar) */
  async function performSaveStudy() {
    try {
      const state = store.getState();
      const projectName = state.projectInfo?.name || 'مشروع';
      const timestamp = new Date().toISOString().slice(0, 10);

      const { calculateStudyCompleteness } = await import('./js/utils/studyCompleteness.js');
      const completeness = calculateStudyCompleteness(state);

      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `دراسة_${projectName}_${timestamp}.json`;
      a.click();

      URL.revokeObjectURL(url);

      const missingSections = completeness.getMissingSections().slice(0, 3);
      let message = `تم حفظ الدراسة بنجاح — نسبة الاكتمال: ${completeness.percentage}%`;
      if (missingSections.length > 0 && completeness.percentage < 80) {
        const missingLabels = missingSections.map(s => s.label).join('، ');
        message += `\nننصح بإكمال: ${missingLabels}`;
      }
      toast.success(message, 7000);

      // الأزرار تحوي أيقونات SVG — نلتقط innerHTML ونستعيده كي لا تُمحى الأيقونة بعد الحفظ
      if (saveStudyText) {
        const originalHTML = saveStudyText.innerHTML;
        saveStudyText.textContent = 'تم الحفظ ✓';
        setTimeout(() => { if (saveStudyText) saveStudyText.innerHTML = originalHTML; }, 2000);
      }
      const headerSaveEl = document.getElementById('headerSaveStudy');
      if (headerSaveEl) {
        const orig = headerSaveEl.innerHTML;
        headerSaveEl.textContent = 'تم ✓';
        setTimeout(() => { if (headerSaveEl) headerSaveEl.innerHTML = orig; }, 2000);
      }
    } catch (error) {
      console.error('Save study error:', error);
      alert('حدث خطأ أثناء حفظ الدراسة');
    }
  }

  if (btnSaveStudy) {
    async function updateSaveButtonProgress() {
      try {
        const { calculateStudyCompleteness } = await import('./js/utils/studyCompleteness.js');
        const state = store.getState();
        const completeness = calculateStudyCompleteness(state);
        if (saveStudyProgress) {
          saveStudyProgress.textContent = `${completeness.percentage}% مكتملة`;
          saveStudyProgress.style.display = 'block';
        }
      } catch (e) {
        console.warn('Could not update save button progress:', e);
      }
    }
    if (store.subscribe) store.subscribe(() => updateSaveButtonProgress());
    updateSaveButtonProgress();
    btnSaveStudy.addEventListener('click', performSaveStudy);
  }

  const headerSaveStudy = document.getElementById('headerSaveStudy');
  if (headerSaveStudy) headerSaveStudy.addEventListener('click', performSaveStudy);

  // «معايرة سريعة» — زر ترويسة دائم (مرئي من أي خطوة) يفتح لوحة الافتراضات المركزية
  // (خطة 2026-07-12، الدفعة 4، البند 1): يعالج مباشرة أكبر إحباط وثّقه اختبار العميل
  // الحقيقي (التنقل بين 41 قسماً لمعايرة أرقام مترابطة أثناء محاولة الوصول لـGO).
  const headerAssumptionsPanel = document.getElementById('headerAssumptionsPanel');
  if (headerAssumptionsPanel) {
    headerAssumptionsPanel.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('feasibility:openAssumptionsPanel'));
    });
  }

  const headerGoHome = document.getElementById('headerGoHome');
  if (headerGoHome) headerGoHome.addEventListener('click', () => showLandingDashboard());

  // Load Study from JSON
  const btnLoadStudy = document.getElementById('btnLoadStudy');
  const fileLoadStudy = document.getElementById('fileLoadStudy');

  if (btnLoadStudy && fileLoadStudy) {
    // Trigger file input when button is clicked
    btnLoadStudy.addEventListener('click', () => {
      fileLoadStudy.click();
    });

    // Handle file selection
    fileLoadStudy.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.name.endsWith('.json')) {
        alert('الرجاء اختيار ملف JSON فقط');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);

          // Validate basic structure
          if (!data.id || !data.projectInfo) {
            throw new Error('Invalid study file format');
          }

          // Confirm before loading
          const projectName = data.projectInfo?.name || 'دراسة غير معروفة';
          const loadConfirmResult = await Swal.fire({
            title: 'هل أنت متأكد؟',
            text: `هل تريد تحميل دراسة "${projectName}"؟ سيتم استبدال الدراسة الحالية.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'نعم، حمّل',
            cancelButtonText: 'إلغاء',
            customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
            buttonsStyling: false
          });
          if (!loadConfirmResult.isConfirmed) {
            fileLoadStudy.value = ''; // Reset file input
            return;
          }

          // Load data into store
          store.state = data;
          store.save(); // Debounced
          store.notify();

          // Force save to disk before reloading
          await store.flush();

          // Reload page to refresh UI
          location.reload();
        } catch (error) {
          console.error('Load study error:', error);
          alert('حدث خطأ أثناء تحميل الدراسة. تأكد من صحة ملف JSON.');
        } finally {
          fileLoadStudy.value = '';
        }
      };

      reader.readAsText(file, 'UTF-8');
    });
  }

  // Import from CSV (Phase 4)
  const btnImportCSV = document.getElementById('btnImportCSV');
  const fileImportCSV = document.getElementById('fileImportCSV');
  if (btnImportCSV && fileImportCSV) {
    btnImportCSV.addEventListener('click', () => fileImportCSV.click());
    fileImportCSV.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const { importFromCSV } = await import('./js/utils/csvImporter.js');
          const state = store.getState ? store.getState() : store.get();
          const result = importFromCSV(ev.target.result, state);
          if (result.success && result.data) {
            const mergeConfirmResult = await Swal.fire({
              title: 'هل أنت متأكد؟',
              text: 'سيتم دمج البيانات المستوردة مع الدراسة الحالية. متابعة؟',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'نعم، ادمج',
              cancelButtonText: 'إلغاء',
              customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
              buttonsStyling: false
            });
            if (!mergeConfirmResult.isConfirmed) {
              fileImportCSV.value = '';
              return;
            }
            await store.hydrateFromDraft(result.data);
            toast.success('تم استيراد البيانات بنجاح');
          } else {
            toast.error(result.errors?.[0] || 'فشل الاستيراد');
          }
        } catch (err) {
          console.error('CSV import error:', err);
          toast.error('حدث خطأ أثناء الاستيراد');
        }
        fileImportCSV.value = '';
      };
      reader.readAsText(file, 'UTF-8');
    });
  }

  // تاريخ الإصدارات — عرض آخر 10 نسخ واستعادة
  const btnVersionHistory = document.getElementById('btnVersionHistory');
  if (btnVersionHistory && store.getVersionHistory) {
    btnVersionHistory.addEventListener('click', () => {
      const history = store.getVersionHistory();
      if (!history.length) {
        toast.info('لا توجد نسخ محفوظة بعد. احفظ الدراسة أولاً.');
        return;
      }
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay is-open';
      overlay.id = 'versionHistoryOverlay';
      const list = history.map((v, i) => {
        const d = new Date(v.timestamp);
        const label = d.toLocaleString('ar-SA');
        return `<div class="flex gap-2 align-center mb-2" style="justify-content:space-between;padding:8px;border:1px solid var(--c-border);border-radius:8px;">
          <span class="text-sm">${label}</span>
          <button type="button" class="btn btn--secondary btn-sm" data-restore-index="${history.length - 1 - i}">استعادة</button>
        </div>`;
      }).reverse().join('');
      overlay.innerHTML = `
        <div class="modal-card" style="max-width:400px;" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3>تاريخ الإصدارات</h3>
            <button type="button" class="btn-close" aria-label="إغلاق">×</button>
          </div>
          <div class="modal-body text-sm">
            <p class="text-muted mb-3">آخر ${history.length} نسخة (الأحدث أولاً). استعادة نسخة تستبدل الدراسة الحالية.</p>
            <div id="versionHistoryList">${list}</div>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
      const close = () => {
        overlay.remove();
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onEsc);
      };
      const onEsc = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onEsc);
      overlay.querySelector('.btn-close').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      overlay.querySelectorAll('[data-restore-index]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.getAttribute('data-restore-index'), 10);
          const ok = await store.restoreVersion(idx);
          close();
          if (ok) toast.success('تم استعادة النسخة'); else toast.error('فشل استعادة النسخة');
        });
      });
    });
  }

  // نافذة «كيف يُولَّد المحتوى؟» — إعلامية فقط (أُزيل مسار مفتاح OpenAI العميلي الميت والمضلِّل)
  const btnAISettings = document.getElementById('btnAISettings');
  const aiSettingsModal = document.getElementById('aiSettingsModal');

  if (btnAISettings && aiSettingsModal) {
    btnAISettings.addEventListener('click', () => aiSettingsModal.showModal());
  }
  // تنظيف: إزالة أي مفتاح OpenAI مخزَّن سابقاً (لم يعد يُستخدم)
  try { localStorage.removeItem('openai_api_key'); } catch (_) {}

  // Reset Study (clear and start over)
  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      const resetConfirmResult = await Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'سيتم مسح جميع بيانات الدراسة الحالية والبدء من جديد.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، امسح',
        cancelButtonText: 'إلغاء',
        customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
        buttonsStyling: false
      });
      if (!resetConfirmResult.isConfirmed) return;
      try {
        await store.reset();
        if (typeof navigateTo === 'function') navigateTo(0);
        toast.success('تم إعادة الضبط بنجاح');
      } catch (e) {
        console.error('Reset error:', e);
        toast.error('حدث خطأ أثناء إعادة الضبط');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Mobile Navigation Logic
  // ═══════════════════════════════════════════════════════════════════
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileOverlay = document.getElementById('mobileOverlay');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavClose = document.getElementById('mobileNavClose');
  const mobileStepperNav = document.getElementById('mobileStepperNav');
  const btnMobileExport = document.getElementById('btnMobileExport');

  // ═══════════════════════════════════════════════════════════════════
  // Routing & Share Logic (Investor Mode)
  // ═══════════════════════════════════════════════════════════════════
  const handleRoute = async () => {
    const hash = window.location.hash;

    // Share View Route (Investor Mode) e.g. #/share/123
    if (hash.startsWith('#/share')) {
      const sidebarEl = document.querySelector('.sidebar');
      const stepperNavEl = document.getElementById('stepperNav');
      const breadcrumbBar = document.getElementById('breadcrumbBar');
      const mainContainer = document.querySelector('.main-content'); // Main wrapper

      // Hide Nav elements for immersive view
      if (sidebarEl) sidebarEl.style.display = 'none';
      if (stepperNavEl) stepperNavEl.style.display = 'none';
      if (breadcrumbBar) breadcrumbBar.style.display = 'none';
      if (mainContainer) {
        mainContainer.classList.remove('lg:mr-64');
        mainContainer.classList.add('w-full', 'px-0', 'py-0');
      }

      // Render Share View
      const { ShareView } = await import('./js/ui/ShareView.js');
      const projectId = hash.split('/')[2];
      // Load project first if ID exists (functionality depends on store implementation)
      // Here we assume store.state is already set or we act on current state
      new ShareView('wizardContainer', store, null).render(projectId);
      return;
    }

    // Normal Routes (restore layout)
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl) sidebarEl.style.removeProperty('display');
    if (document.getElementById('stepperNav')) document.getElementById('stepperNav').style.removeProperty('display');
    if (document.getElementById('breadcrumbBar')) document.getElementById('breadcrumbBar').style.removeProperty('display');
    const mainContainer = document.querySelector('.main-content');
    if (mainContainer) {
      mainContainer.classList.add('lg:mr-64');
      mainContainer.classList.remove('w-full', 'px-0', 'py-0');
    }

    // Process step navigation — تجاهل أي hash غير رقمي بدل إرجاع المستخدم للخطوة 0 بعنف
    const stripped = hash.replace('#', '').trim();
    if (stripped !== '' && /^\d+$/.test(stripped)) {
      const hashIndex = parseInt(stripped, 10);
      if (hashIndex >= 0 && hashIndex < STEPS.length) {
        navigateTo(hashIndex);
      }
    }
  };

  // التوجيه موحّد الآن أعلى الملف (In-App Router) ويستمع لـ popstate/hashchange مرة واحدة.
  // handleRoute القديم لم يعد مربوطاً؛ أي تغيّر في الرابط (بما فيه فتح رابط مشاركة) يمر عبر syncFromUrl.

  // Global Click delegation for Share Buttons
  document.addEventListener('click', (e) => {
    const btnShare = e.target.closest('.btn-share');
    if (btnShare) {
      e.stopPropagation();
      const projectId = btnShare.dataset.id;
      // In a real app, we would fetch/load the project by ID here.
      // For now, we assume the user opens the project they have access to.
      window.location.hash = `#/share/${projectId}`;
    }
  });

  // Toggle mobile menu
  const toggleMobileMenu = (open) => {
    if (open) {
      mobileOverlay?.classList.add('is-open');
      mobileNav?.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    } else {
      mobileOverlay?.classList.remove('is-open');
      mobileNav?.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  // Render mobile navigation
  const renderMobileNav = () => {
    if (!mobileStepperNav) return;
    // احترام وضع العرض (سريع/مبسّط/مصغّر): نعرض نفس الخطوات المرئية في الشريط الجانبي،
    // لا كامل STEPS.length دائما — سابقاً كانت قائمة الجوّال تتجاهل الوضع فتُغرق مستخدم الجوّال.
    const visibleSteps = (sidebar.steps && sidebar.steps.length) ? sidebar.steps : STEPS;
    const globalIndexOf = (step, localIdx) =>
      (sidebar.stepIndexMap && sidebar.stepIndexMap[localIdx] != null)
        ? sidebar.stepIndexMap[localIdx]
        : STEPS.indexOf(step);

    mobileStepperNav.innerHTML = visibleSteps.map((step, localIdx) => {
      const gIdx = globalIndexOf(step, localIdx);
      return `
      <div class="step-item ${gIdx === sidebar.activeStep ? 'is-active' : ''}" data-index="${gIdx}">
        <div class="step-icon">${sidebar.getStepIcon(gIdx)}</div>
        <div class="step-label">${step.label}</div>
      </div>`;
    }).join('');

    // Bind click events
    mobileStepperNav.querySelectorAll('.step-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        if (categoryNavigationEnabled) navigateToCategory(idx);
        else navigateTo(idx);
        toggleMobileMenu(false);
        // Also update mobile nav visually
        renderMobileNav();
      });
    });
  };

  // Event listeners
  mobileMenuBtn?.addEventListener('click', () => {
    renderMobileNav();
    toggleMobileMenu(true);
  });

  mobileOverlay?.addEventListener('click', () => toggleMobileMenu(false));
  mobileNavClose?.addEventListener('click', () => toggleMobileMenu(false));

  // Apply OverlayScrollbars to main stage (مرة واحدة عند التحميل، لا في كل ضغطة)
  const mainStageEl = document.querySelector('.main-stage');
  if (mainStageEl) {
    OverlayScrollbars(mainStageEl, {
      scrollbars: { autoHide: 'scroll', theme: 'os-theme-dark' }
    });
  }

  // Mobile export button
  btnMobileExport?.addEventListener('click', async () => {
    toggleMobileMenu(false);
    const { ExportMenu } = await import('./js/ui/ExportMenu.js');
    const exportMenu = new ExportMenu('exportMenuOverlay', store);
    exportMenu.open();
  });

  // Keyboard shortcut to close mobile menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNav?.classList.contains('is-open')) {
      toggleMobileMenu(false);
    }
  });

  // إشارة نجاح التهيئة لحارس init-watchdog.js — يمنعه من عرض شاشة الخطأ.
  window.__qararAppBooted = true;
 } catch (initError) {
  console.error('[App Init] فشل تشغيل التطبيق:', initError);
  if (window.__qararEarlyErrors) {
    window.__qararEarlyErrors.push(String(initError?.message || initError));
  }
  if (typeof window.__qararShowInitFallback === 'function') {
    window.__qararShowInitFallback();
  }
 }
});

import { store } from './js/core/store.js';
import { TEMPLATES } from './js/core/templates.js';
import { TABLE_SCHEMAS, createEmptyStudy } from './js/core/schema.js';
import { STEPS, SECTIONS, SIDEBAR_SECTIONS, stepIndexById } from './js/core/wizardSteps.js';
import { Sidebar } from './js/ui/Sidebar.js';
import { Wizard } from './js/ui/Wizard.js';
import { calculateStudy as runFullModel } from './js/core/engine.js';
// المكونات الثقيلة تُحمّل عند أول زيارة للخطوة (Lazy Loading في navigateTo)
import { toast } from './js/utils/toast.js';
import { AuthComponent } from './js/ui/AuthComponent.js';
import { AutoSave } from './js/utils/autoSave.js';
import { ProgressTracker } from './js/utils/progressTracker.js';
import { monitoring } from './js/utils/monitoring.js';
import { AuthGuard } from './js/middleware/AuthGuard.js';
import './js/services/connectors/index.js';
import { initShellController } from './js/app-controller.js';
import { ModeSelector } from './js/ui/ModeSelector.js';

document.addEventListener('DOMContentLoaded', async () => {
  const installArabicUiGuard = () => {
    const replacements = [
      [/Market Structure/gi, 'هيكل السوق'],
      [/Perfect Competition/gi, 'منافسة تامة'],
      [/Monopolistic Competition/gi, 'منافسة احتكارية'],
      [/Oligopoly/gi, 'احتكار القلة'],
      [/Monopoly/gi, 'احتكار تام'],
      [/Market Gap/gi, 'الفجوة السوقية'],
      [/Market Simulation/gi, 'محاكاة السوق'],
      [/Market Analysis/gi, 'تحليل السوق'],
      [/Market Opportunity/gi, 'فرصة السوق'],
      [/Market Snapshot/gi, 'لمحة السوق'],
      [/Market Share/gi, 'الحصة السوقية'],
      [/Market/gi, 'السوق'],
      [/Structure/gi, 'الهيكل'],
      [/Dashboard/gi, 'لوحة التحكم'],
      [/Pitch Deck/gi, 'العرض التقديمي'],
      [/Pitch/gi, 'العرض'],
      [/PowerPoint/gi, 'عرض تقديمي'],
      [/PDF/gi, 'تقرير'],
      [/Excel/gi, 'جداول'],
      [/Word/gi, 'ملف قابل للتعديل'],
      [/CSV/gi, 'ملف جدولي'],
      [/JSON/gi, 'نسخة احتياطية'],
      [/HTML/gi, 'صفحة قابلة للطباعة'],
      [/GO\/NO-GO/gi, 'نفّذ أو راجع'],
      [/NO-GO/gi, 'لا تنفّذ'],
      [/\bGO\b/g, 'نفّذ'],
      [/NPV/gi, 'صافي القيمة الحالية'],
      [/IRR/gi, 'معدل العائد الداخلي'],
      [/ROI/gi, 'العائد على الاستثمار'],
      [/WACC/gi, 'متوسط تكلفة رأس المال'],
      [/EBITDA/gi, 'الأرباح قبل الفوائد والضرائب والإهلاك'],
      [/DCF/gi, 'التدفقات النقدية المخصومة'],
      [/TAM\/SAM\/SOM/gi, 'إجمالي السوق والسوق المتاح والحصة المستهدفة'],
      [/TAM/gi, 'إجمالي السوق'],
      [/SAM/gi, 'السوق المتاح'],
      [/SOM/gi, 'الحصة المستهدفة'],
      [/SWOT/gi, 'تحليل نقاط القوة والضعف والفرص والتهديدات'],
      [/TOWS/gi, 'مصفوفة الاستراتيجيات'],
      [/KPI/gi, 'مؤشر أداء'],
      [/QA/gi, 'فحص الجودة'],
      [/Startup/gi, 'شركة ناشئة'],
      [/Quick Feasibility/gi, 'جدوى سريعة'],
      [/Quick/gi, 'سريع'],
      [/Benchmarking/gi, 'المقارنة المرجعية'],
      [/Benchmark/gi, 'معيار مقارنة'],
      [/Payback/gi, 'فترة الاسترداد'],
      [/Breakeven|Break-Even/gi, 'نقطة التعادل'],
      [/COGS/gi, 'تكلفة البضاعة المباعة'],
      [/OPEX/gi, 'المصروفات التشغيلية'],
      [/CAPEX/gi, 'المصاريف الرأسمالية'],
      [/Google Sheets/gi, 'جداول جوجل'],
      [/Google/gi, 'جوجل'],
      [/Supabase/gi, 'خدمة قاعدة البيانات'],
      [/OpenStreetMap/gi, 'خريطة مفتوحة المصدر'],
      [/Zoom/gi, 'اجتماع مرئي'],
      [/Calendly|Cal\.com/gi, 'نظام حجز المواعيد'],
      [/LivePlan|Bizplan|Upmetrics|PlanGuru/gi, 'منصة أجنبية']
    ];

    const arabize = (value) => {
      if (!value || !/[A-Za-z]/.test(value)) return value;
      // L8: اختصار إنجليزي مفرد بين قوسين بعد المصطلح العربي — مثل (NPV) أو (EBITDA) —
      // يُحفظ كما هو: لا يُعرّب ولا يُحذف. نقنّعه قبل التعريب ثم نعيده.
      const keep = [];
      let out = String(value).replace(/\(([A-Z][A-Za-z]{1,9})\)/g, (m, abbr) => '￼' + (keep.push(abbr) - 1) + '￼');
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

      // Update UI based on auth state
      const authContainer = document.getElementById('authContainer');
      if (authContainer) {
        const authComponent = new AuthComponent('authContainer');
        authComponent.render();
      }

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

  // ═══════════════════════════════════════════════════════════════════
  // Header Stage Bar (Phases)
  // ═══════════════════════════════════════════════════════════════════

  const headerStageBar = document.getElementById('headerStageBar');
  const renderHeaderStageBar = ({ activeStepIndex = 0, progressTracker = null, sections = null } = {}) => {
    if (!headerStageBar) return;
    const isCompleted = (idx) => (progressTracker && typeof progressTracker.isCompleted === 'function')
      ? progressTracker.isCompleted(idx)
      : false;

    const stageSections = Array.isArray(sections) ? sections : (Array.isArray(SIDEBAR_SECTIONS) ? SIDEBAR_SECTIONS : []);
    headerStageBar.innerHTML = stageSections.map((s) => {
      const start = s?.range?.[0] ?? 0;
      const end = s?.range?.[1] ?? 0;
      const active = activeStepIndex >= start && activeStepIndex <= end;
      const complete = start <= end && Array.from({ length: (end - start + 1) }).every((_, i) => isCompleted(start + i));
      return `
        <span class="stage-chip ${active ? 'is-active' : ''} ${complete ? 'is-complete' : ''}" title="${s.label}">
          <span class="stage-chip__dot" aria-hidden="true"></span>
          <span class="stage-chip__label">${s.label}</span>
        </span>
      `;
    }).join('');

    // مؤشّر «أين أنا» على الجوّال — الترويسة العلوية مخفية على الجوّال فيبقى المستخدم بلا معلم
    const mobileStage = document.getElementById('mobileStageIndicator');
    if (mobileStage) {
      const curSection = stageSections.find((s) => {
        const start = s?.range?.[0] ?? 0;
        const end = s?.range?.[1] ?? 0;
        return activeStepIndex >= start && activeStepIndex <= end;
      });
      const total = Array.isArray(STEPS) ? STEPS.length : 0;
      mobileStage.textContent = curSection
        ? `${curSection.label} · ${activeStepIndex + 1}/${total}`
        : '';
    }
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
          if (breadcrumbBar) breadcrumbBar.style.display = 'block';
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
          if (breadcrumbBar) breadcrumbBar.style.display = 'block';
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
          if (breadcrumbBar) breadcrumbBar.style.display = 'block';
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
        onFinish: (quickData) => {
          if (sidebarEl) sidebarEl.style.removeProperty('display');
          if (stepperNavEl) stepperNavEl.style.removeProperty('display');
          if (breadcrumbBar) breadcrumbBar.style.display = 'block';
          enterWorkspaceMode();
          const state = store.getState();
          const projectInfo = state.projectInfo || {};
          store.update('projectInfo', {
            ...projectInfo,
            name: quickData.projectName || projectInfo.name,
            concept: quickData.sector || projectInfo.concept,
            city: quickData.city || projectInfo.city
          });
          if (quickData.generated) {
            if (quickData.generated.execSummary) {
              const es = state.executiveSummary || {};
              store.update('executiveSummary', { ...es, projectOverview: quickData.generated.execSummary });
            }
            if (quickData.generated.market) {
              const m = state.marketing || {};
              const ma = m.marketAnalysis || {};
              store.update('marketing', { ...m, marketAnalysis: { ...ma, summary: quickData.generated.market } });
            }
            if (Array.isArray(quickData.generated.competitors) && quickData.generated.competitors.length) {
              store.update('marketing', { ...(store.getState().marketing || {}), competitors: quickData.generated.competitors });
            }
            if (Array.isArray(quickData.generated.risks) && quickData.generated.risks.length) {
              const ra = state.riskAnalysis || {};
              store.update('riskAnalysis', { ...ra, risks: quickData.generated.risks });
            }
          }
          navigateTo(3);
        }
      });
      quickWizard.render();
    }).catch(err => {
      console.error('QuickFeasibilityWizard load failed:', err);
      toast.error('تعذر فتح مسار الجدوى السريعة');
    });
  };

  const navigateTo = async (index) => {
    try {
      enterWorkspaceMode();

      let targetIndex = index;
      // (أُزيلت خطوة القوالب من المسار؛ نقطة البداية صارت نافذةً قبل الدخول)

      const step = STEPS[targetIndex];
      if (!step) return;

      index = targetIndex; // تحديث المتغير المحلي ليتناسق مع الحلقات أدناه

      try {
        localStorage.setItem('feas_last_step_index', String(targetIndex));
      } catch (_) { }

      syncHash('step/' + targetIndex);

      sidebar.setActive(targetIndex);
      wizard.renderStep(step.id, step, targetIndex);

      // Keep header stage bar in sync with navigation
      renderHeaderStageBar({ activeStepIndex: targetIndex, progressTracker, sections: sidebar.sections });

      // Breadcrumbs
      const breadcrumbBar = document.getElementById('breadcrumbBar');
      const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
      if (breadcrumbBar && breadcrumbCurrent) {
        breadcrumbBar.style.display = 'block';
        breadcrumbCurrent.textContent = step.label || step.id || '';
      }

      const containerId = 'wizardContainer';

      // Cleanup any previous trash view if sticking around
      // (Usually handled by wizard.renderStep clearing container, but good to be safe)

      if (step.isDashboard) {
        if (!components.dashboard) {
          const { FinancialDashboard } = await import('./js/ui/FinancialDashboard.js');
          components.dashboard = new FinancialDashboard(containerId, store);
        }
        components.dashboard.render();
      } else if (step.isZakatTax) {
        if (!components.zakat) {
          const { ZakatView } = await import('./js/ui/ZakatView.js');
          components.zakat = new ZakatView(containerId, store);
        }
        components.zakat.render();
      } else if (step.isPreliminaryCheck || step.id === 'preliminaryCheck') {
        if (!components.preliminaryCheck) {
          const { PreliminaryCheckView } = await import('./js/ui/PreliminaryCheckView.js');
          components.preliminaryCheck = new PreliminaryCheckView(containerId, store, navigateTo);
        }
        components.preliminaryCheck.render();
      } else if (step.isProjectAlternatives || step.id === 'projectAlternatives') {
        if (!components.projectAlternatives) {
          const { ProjectAlternativesView } = await import('./js/ui/ProjectAlternativesView.js');
          components.projectAlternatives = new ProjectAlternativesView(containerId, store, navigateTo);
        }
        components.projectAlternatives.render();
      } else if (step.isTimeline || step.id === SECTIONS.TIMELINE) {
        if (!components.timeline) {
          const { Timeline } = await import('./js/ui/Timeline.js');
          components.timeline = new Timeline(containerId, store);
        }
        components.timeline.render();
      } else if (step.isMonteCarlo) {
        if (!components.monteCarlo) {
          const { MonteCarloAnalysis } = await import('./js/ui/MonteCarloAnalysis.js');
          components.monteCarlo = new MonteCarloAnalysis(containerId, store);
        }
        components.monteCarlo.render();
      } else if (step.isValuation) {
        if (!components.valuation) {
          const { ValuationAnalysis } = await import('./js/ui/ValuationAnalysis.js');
          components.valuation = new ValuationAnalysis(containerId, store);
        }
        components.valuation.render();
      } else if (step.isScenario || step.isScenarios) {
        if (step.id === 'scenarioSwitcher') {
          if (!components.scenarioSwitcher) {
            const { ScenarioSwitcher } = await import('./js/ui/ScenarioSwitcher.js');
            components.scenarioSwitcher = new ScenarioSwitcher(containerId, store);
          }
          components.scenarioSwitcher.render();
        } else {
          if (!components.scenarioAnalysis) {
            const { ScenarioAnalysis } = await import('./js/ui/ScenarioAnalysis.js');
            components.scenarioAnalysis = new ScenarioAnalysis(containerId, store, navigateTo);
          }
          components.scenarioAnalysis.render(index);
        }
      } else if (step.isPostLaunch) {
        if (!components.postLaunch) {
          const { PostLaunchTracker } = await import('./js/ui/PostLaunchTracker.js');
          components.postLaunch = new PostLaunchTracker(containerId, store);
        }
        components.postLaunch.render();
      } else if (step.isBusinessModel) {
        if (!components.businessModel) {
          const { BusinessModelView } = await import('./js/ui/BusinessModelView.js');
          components.businessModel = new BusinessModelView(containerId, store, navigateTo);
        }
        components.businessModel.render(index);
      } else if (step.isComparison) {
        if (!components.studyComparison) {
          const { StudyComparison } = await import('./js/ui/StudyComparison.js');
          components.studyComparison = new StudyComparison(containerId, store, navigateTo);
        }
        await components.studyComparison.render();
      } else if (step.isDecisionDashboard) {
        if (!components.decisionDashboard) {
          const { DecisionDashboard } = await import('./js/ui/DecisionDashboard.js');
          components.decisionDashboard = new DecisionDashboard(containerId, store);
        }
        try {
          await components.decisionDashboard.render();
        } catch (err) {
          console.error('Failed to render DecisionDashboard:', err);
        }
      } else if (step.isExecutiveSummary) {
        if (!components.executiveSummary) {
          const { ExecutiveSummary } = await import('./js/ui/ExecutiveSummary.js');
          components.executiveSummary = new ExecutiveSummary(containerId, store, navigateTo);
        }
        components.executiveSummary.render(index);
      } else if (step.isReportBuilder) {
        if (!components.reportBuilder) {
          const { ReportBuilderView } = await import('./js/ui/ReportBuilderView.js');
          components.reportBuilder = new ReportBuilderView(containerId, store);
        }
        components.reportBuilder.render();
      } else if (step.id === SECTIONS.SERVICES) {
        if (!components.serviceAnalysis) {
          const { ServiceAnalysis } = await import('./js/ui/ServiceAnalysis.js');
          components.serviceAnalysis = new ServiceAnalysis(containerId, store, navigateTo);
        }
        components.serviceAnalysis.render(index);
      } else if (step.id === SECTIONS.LEGAL) {
        if (!components.legalStudy) {
          const { LegalStudy } = await import('./js/ui/LegalStudy.js');
          components.legalStudy = new LegalStudy(containerId, store, navigateTo);
        }
        components.legalStudy.render(index);
      } else if (step.isStrategic) {
        if (!components.strategicAnalysis) {
          const { StrategicAnalysis } = await import('./js/ui/StrategicAnalysis.js');
          components.strategicAnalysis = new StrategicAnalysis(containerId, store, navigateTo);
        }
        components.strategicAnalysis.render(index);
      } else if (step.isMarketAnalysis) {
        if (!components.marketAnalysis) {
          const { MarketAnalysis } = await import('./js/ui/MarketAnalysis.js');
          components.marketAnalysis = new MarketAnalysis(containerId, store, navigateTo);
        }
        components.marketAnalysis.render(index);
      } else if (step.isRiskMatrix) {
        if (!components.riskMatrix) {
          const { RiskMatrix } = await import('./js/ui/RiskMatrix.js');
          components.riskMatrix = new RiskMatrix(containerId, store, navigateTo);
        }
        components.riskMatrix.render(index);
      } else if (step.isFinancing) {
        if (!components.financing) {
          const { FinancingStructure } = await import('./js/ui/FinancingStructure.js');
          components.financing = new FinancingStructure(containerId, store, navigateTo);
        }
        components.financing.render(index);
      } else if (step.isOrgStructure) {
        if (!components.orgStructure) {
          const { OrgStructure } = await import('./js/ui/OrgStructure.js');
          components.orgStructure = new OrgStructure(containerId, store, navigateTo);
        }
        components.orgStructure.render(index);
      } else if (step.isOperationalSim) {
        if (!components.operationalSim) {
          const { OperationalSim } = await import('./js/ui/OperationalSim.js');
          components.operationalSim = new OperationalSim(containerId, store, navigateTo);
        }
        components.operationalSim.render(index);
      } else if (step.isInvestorAnalysis) {
        if (!components.investorAnalysis) {
          const { InvestorAnalysis } = await import('./js/ui/InvestorAnalysis.js');
          components.investorAnalysis = new InvestorAnalysis(containerId, store, navigateTo);
        }
        components.investorAnalysis.render(index);
      } else if (step.isStressTest) {
        if (!components.stressTest) {
          const { StressTest } = await import('./js/ui/StressTest.js');
          components.stressTest = new StressTest(containerId, store, navigateTo);
        }
        components.stressTest.render(index);
      } else if (step.isAppendices) {
        if (!components.appendices) {
          const { AppendicesView } = await import('./js/ui/AppendicesView.js');
          components.appendices = new AppendicesView(containerId, store, navigateTo);
        }
        components.appendices.render(index);
      } else if (step.isIntroduction || step.id === 'projectIntro') {
        if (!components.introduction) {
          const { IntroductionView } = await import('./js/ui/IntroductionView.js');
          components.introduction = new IntroductionView(containerId, store, navigateTo);
        }
        components.introduction.render(index);
      } else if (step.isSmartGoals) {
        if (!components.smartGoals) {
          const { SmartGoals } = await import('./js/ui/SmartGoals.js');
          components.smartGoals = new SmartGoals(containerId, store, navigateTo);
        }
        components.smartGoals.render(index);
      } else if (step.isFinancialStatements) {
        if (!components.financialStatements) {
          const { FinancialStatements } = await import('./js/ui/FinancialStatements.js');
          components.financialStatements = new FinancialStatements(containerId, store, navigateTo);
        }
        components.financialStatements.render(index);
      } else if (step.isLoanSchedule) {
        if (!components.loanSchedule) {
          const { LoanScheduleView } = await import('./js/ui/LoanScheduleView.js');
          components.loanSchedule = new LoanScheduleView(containerId, store);
        }
        const results = runFullModel(store.getState());
        components.loanSchedule.render(results.loanSchedule);
      } else if (step.isBalanceSheet) {
        if (!components.balanceSheet) {
          const { BalanceSheetView } = await import('./js/ui/BalanceSheetView.js');
          components.balanceSheet = new BalanceSheetView(containerId, store);
        }
        const results = runFullModel(store.getState());
        components.balanceSheet.render(results.balanceSheets);
      } else if (step.isBreakEven) {
        if (!components.breakEvenAnalysis) {
          const { BreakEvenAnalysis } = await import('./js/ui/BreakEvenAnalysis.js');
          components.breakEvenAnalysis = new BreakEvenAnalysis(containerId, store);
        }
        components.breakEvenAnalysis.render();
      } else if (step.isSensitivity) {
        if (!components.sensitivityAnalysis) {
          const { SensitivityAnalysis } = await import('./js/ui/SensitivityAnalysis.js');
          components.sensitivityAnalysis = new SensitivityAnalysis(containerId, store, navigateTo);
        }
        components.sensitivityAnalysis.render(index);
      } else {
        wizard.renderStep(step.id, step, index);
      }

      // خطوات التحليل الحسابي تكتب innerHTML خاصاً بها بلا شريط تنقّل — نُلحق «السابق/التالي»
      // كي لا يعلق المستخدم المبتدئ فيها (idempotent: لا يكرّر شريط خطوات النموذج).
      wizard.appendNav(index);
    } catch (error) {
      console.error('Navigation error:', error);
      toast.error('حدث خطأ أثناء الانتقال بين الخطوات');
    }
  };


  // Wrapper: resolve step index when using filtered steps (simple/mini mode)
  const handleStepClick = (stepOrIndex) => {
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
        renderHeaderStageBar({
          activeStepIndex: (window.sidebarInstance?.activeStep) || 0,
          progressTracker,
          sections: window.sidebarInstance?.sections
        });
      } catch (e) {
        console.warn('[App] completion detection failed:', e);
      }
    }, 500);
  };

  const sidebar = new Sidebar('stepperNav', STEPS, handleStepClick, store);
  // Store sidebar instance globally for access in enterWorkspaceMode
  window.sidebarInstance = sidebar;

  const wizard = new Wizard('wizardContainer', store, TABLE_SCHEMAS, { steps: STEPS, onNavigate: navigateTo });
  components.wizard = wizard;

  sidebar.setProgressTracker(progressTracker);

  // Initial render for header stage bar
  renderHeaderStageBar({ activeStepIndex: 0, progressTracker });

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

  // 2. Initialize Auth Component
  const authComponent = new AuthComponent('authContainer');
  authComponent.render();
  window.addEventListener('feasibility:userProfileUpdated', () => authComponent.render());

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
    const savedStepIndex = wizard.currentStepIndex;
    const { UserProfileView } = await import('./js/ui/UserProfileView.js');
    const userProfileView = new UserProfileView(wizardContainer, {
      onBack: () => navigateTo(savedStepIndex)
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
  (async () => {
    const { startIdleTimeout } = await import('./js/utils/idleTimeout.js');
    startIdleTimeout({
      onWarn: () => toast.warning('انتهت فترة الخمول قريباً. تحريك الماوس أو لوحة المفاتيح يمدّد الجلسة.'),
      onIdle: async () => {
        toast.info('انتهت الجلسة بسبب الخمول (30 دقيقة).');
        try {
          const { getSupabaseClient } = await import('./supabaseClient.js');
          const { ok, supabase } = await getSupabaseClient();
          if (ok && supabase) await supabase.auth.signOut();
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

  // رسم الواجهة المطابقة للعنوان — بدون كتابة تاريخ جديد (يُستدعى عند الرجوع/التقديم)
  const routeToView = async (route) => {
    _isRestoring = true;
    _currentRoute = route;
    try {
      if (route === '' || route === 'home') {
        await showLandingDashboard();
      } else if (route.startsWith('step/')) {
        const idx = parseInt(route.slice(5), 10);
        if (Number.isInteger(idx) && idx >= 0 && idx < STEPS.length) await navigateTo(idx);
        else await showLandingDashboard();
      } else if (route.startsWith('share/')) {
        await renderShareRoute(route.slice(6));
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
    const simpleHidden = [
      SECTIONS.TECH_RESOURCES, SECTIONS.LOGISTICS, SECTIONS.ADMINISTRATIVE,
      SECTIONS.ORG_STRUCTURE, SECTIONS.SERVICES, SECTIONS.STRATEGIC,
      SECTIONS.RISK_ANALYSIS, 'sensitivity', SECTIONS.SCENARIOS,
      SECTIONS.MONTE_CARLO, SECTIONS.VALUATION, SECTIONS.ACTUALS, 'fintech'
    ];
    // نموذج مصغر: فكرة، سوق، تكاليف، إيرادات، قرار — الحد الأدنى لبنك التنمية/الغرفة
    const miniVisible = [
      'preliminaryCheck', 'projectAlternatives', SECTIONS.PROJECT_INFO, 'projectDetails', SECTIONS.KEY_PEOPLE, 'projectIntro', SECTIONS.SMART_GOALS,
      SECTIONS.TECHNICAL, SECTIONS.HR, SECTIONS.LEGAL, SECTIONS.MARKETING, SECTIONS.STRATEGIC, SECTIONS.REVENUE,
      SECTIONS.FINANCING, SECTIONS.ASSUMPTIONS, SECTIONS.FINANCIAL_STATEMENTS, 'financial_eval', 'sensitivity',
      SECTIONS.EXECUTIVE_SUMMARY
    ];
    // المسار السريع: 5-7 خطوات أساسية فقط
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
    if (effective === 'mini') {
      visibleSteps = STEPS.filter(s => miniVisible.includes(s.id));
      stepIndexMap = visibleSteps.map(step => STEPS.indexOf(step));
    } else if (effective === 'simple') {
      visibleSteps = STEPS.filter(s => !simpleHidden.includes(s.id));
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

    sidebar.steps = visibleSteps;
    sidebar.stepIndexMap = stepIndexMap;
    wizard.steps = visibleSteps;

    // Save effective mode to store for persistence
    if (store.getState().appSettings?.mode !== effective) {
      store.update('appSettings', { ...(store.getState().appSettings || {}), mode: effective });
    }

    sidebar.render();

    // Update stage bar to reflect the new sections mapping (especially quick mode)
    renderHeaderStageBar({ activeStepIndex: sidebar.activeStep || 0, progressTracker, sections: sidebar.sections });
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
          if (!confirm(`هل تريد تحميل دراسة "${projectName}"?\n\nسيتم استبدال الدراسة الحالية.`)) {
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
            if (!confirm('سيتم دمج البيانات المستوردة مع الدراسة الحالية. متابعة؟')) {
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
      if (!confirm('هل أنت متأكد؟ سيتم مسح جميع بيانات الدراسة الحالية والبدء من جديد.')) return;
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
    // لا كامل STEPS.length دائماً — سابقاً كانت قائمة الجوّال تتجاهل الوضع فتُغرق مستخدم الجوّال.
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
        navigateTo(idx);
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
});

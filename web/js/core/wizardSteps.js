/**
 * Single source of truth for Wizard steps and Sidebar sections.
 * When adding a step: 1) append to STEPS, 2) adjust the range of the target section in SIDEBAR_SECTIONS.
 */

import { SECTIONS } from './schema.js';

export { SECTIONS };

export const STEPS = [
  // البداية والتعريف (0-6) — نقطة البداية (اختيار القالب/الوضع) صارت في نافذة «اختر نقطة البداية» قبل المسار
  { id: 'preliminaryCheck', label: "الدراسة المبدئية", isPreliminaryCheck: true }, // اختيارية، يمكن تخطيها
  { id: 'projectAlternatives', label: "اختيار المشروع (مقارنة أفكار)", isProjectAlternatives: true, isAdvancedStep: true }, // مقارنة أفكار مبدئية (د. الروضي)
  { id: SECTIONS.PROJECT_INFO, label: "معلومات المشروع ونموذج العمل (ريادي/شركات)", isForm: true, tables: ['glossary', 'dataGatheringChecklist'] }, // Main fields + خطوات جمع المعلومات
  // معرّف فريد للتنقل مع بقاء البيانات في قسم projectInfo (dataSection يستهلكه Wizard.js)
  { id: 'projectDetails', dataSection: SECTIONS.PROJECT_INFO, label: "تفاصيل الفكرة (المنتجات والخدمات)", tables: ['products', 'introServices', 'customerValues'] },
  { id: SECTIONS.KEY_PEOPLE, label: "الأشخاص الرئيسون", tables: ['keyPeople', 'partnershipContracts'] },
  { id: 'projectIntro', label: "مقدمة الجدوى الموحدة", isIntroduction: true, isAdvancedStep: true },
  { id: SECTIONS.SMART_GOALS, label: "الأهداف الذكية", isSmartGoals: true, isAdvancedStep: true },

  // السوقية والاستراتيجية (8-12) — السوق يحدد الطلب قبل الطاقة والأصول
  { id: SECTIONS.MARKETING, label: "الدراسة السوقية", tables: ['marketAnalysis', 'historicalData', 'supplyDemandBalance', 'competitors', 'competitorBenchmarking', 'marketingPlan'] },
  // تحجيم السوق (TAM/SAM/SOM) — ركن معياري (IFC/UNIDO) يغذّي جاهزية السوق في لوحة القرار (marketSizing.som)
  { id: 'marketSizing', label: "تحجيم السوق (TAM/SAM/SOM)", isMarketAnalysis: true },
  { id: SECTIONS.STRATEGIC, label: "التحليل الاستراتيجي", isStrategic: true },
  { id: SECTIONS.REVENUE, label: "مصادر الإيرادات", tables: ['revenueStreams'] },
  { id: SECTIONS.SERVICES, label: "تحليل الخدمات المفصل", isServiceAnalysis: true, isAdvancedStep: true },

  // الفنية والقانونية (12-19)
  { id: SECTIONS.TECHNICAL, label: "الدراسة الفنية (الأصول)", tables: ['establishmentCosts', 'capacityModel', 'capacityUtilization', 'buildings', 'equipment', 'furniture', 'locationAssessment'] },
  { id: SECTIONS.HR, label: "الموارد البشرية (الرواتب)", tables: ['positions', 'advisoryBoard'] },
  { id: SECTIONS.TECH_RESOURCES, label: "الموارد التقنية", tables: ['techResources'] },
  { id: SECTIONS.LOGISTICS, label: "الموارد اللوجستية", tables: ['logistics'] },
  { id: SECTIONS.ADMINISTRATIVE, label: "الموارد الإدارية", tables: ['administrative'] },
  { id: SECTIONS.ORG_STRUCTURE, label: "الهيكل التنظيمي والحوكمة", tables: ['operationalKpis'], isOrgStructure: true },
  { id: 'operational_sim', label: "محاكاة التشغيل (صفوف الانتظار)", isOperationalSim: true, isAdvancedStep: true },
  { id: SECTIONS.LEGAL, label: "الدراسة القانونية", tables: ['licenses'] },

  // الدراسة المالية (20-26)
  { id: SECTIONS.FINANCING, label: "مصادر وهيكلة التمويل", isFinancing: true },
  { id: 'investor_analysis', label: "تحليل الجدوى الاستثمارية", isInvestorAnalysis: true, isAdvancedStep: true },
  { id: SECTIONS.ASSUMPTIONS, label: "الافتراضات المالية", tables: [] },
  { id: SECTIONS.FINANCIAL_STATEMENTS, label: "القوائم المالية التقديرية", isFinancialStatements: true },
  { id: 'balance_sheet', label: "الميزانية العمومية", isBalanceSheet: true, isAdvancedStep: true },
  { id: SECTIONS.BREAK_EVEN, label: "تحليل نقطة التعادل", isBreakEven: true },
  { id: 'financial_eval', label: "مؤشرات التقييم المالي (نظرة مبكرة)", isExecutiveSummary: true },

  // المخاطر (27-31)
  { id: SECTIONS.RISK_ANALYSIS, label: "تحليل المخاطر", isRiskMatrix: true },
  { id: 'stress_test', label: "اختبار التحمل", isStressTest: true, isAdvancedStep: true },
  { id: 'sensitivity', label: "تحليل الحساسية", isSensitivity: true, isAdvancedStep: true },
  { id: SECTIONS.SCENARIOS, label: "مستويات السيناريوهات", isScenarios: true, isAdvancedStep: true },
  { id: SECTIONS.MONTE_CARLO, label: "محاكاة مونت كارلو", isMonteCarlo: true, isAdvancedStep: true },

  // التخطيط (32-34)
  { id: SECTIONS.TIMELINE, label: "الجدول الزمني للتنفيذ", isTimeline: true },
  { id: SECTIONS.ZAKAT_TAX, label: "حساب الزكاة والضريبة", isZakatTax: true, isAdvancedStep: true },
  { id: SECTIONS.VALUATION, label: "تقييم الشركة", isValuation: true, isAdvancedStep: true },

  // الملاحق والمصادر (35)
  { id: SECTIONS.APPENDICES, label: "الملاحق والمصادر والمراجع", tables: ['references', 'reviewers'], isAppendices: true, isAdvancedStep: true },

  // النتائج والقرار النهائي (36-41)
  { id: SECTIONS.BUSINESS_MODEL, label: "نموذج العمل", isBusinessModel: true },
  { id: SECTIONS.DECISION_DASHBOARD, label: "لوحة القرار الاستثماري", isDecisionDashboard: true, isAdvancedStep: true },
  { id: SECTIONS.EXECUTIVE_SUMMARY, label: "الملخص التنفيذي النهائي", isExecutiveSummary: true },
  { id: 'reportBuilder', label: "بناء التقرير (ترتيب الأقسام)", isReportBuilder: true, isAdvancedStep: true },
  { id: 'dashboard', label: "لوحة التحكم المالي العامة", isDashboard: true },
  { id: SECTIONS.ACTUALS, label: "مراقبة الأداء الفعلي", isPostLaunch: true, isAdvancedStep: true }, // ما بعد الافتتاح — تبقى الأخيرة
];

/** Ranges [start, end] inclusive; must match STEPS indices. Update when adding steps. */
export const SIDEBAR_SECTIONS = [
  { id: 'setup', label: 'البداية والتعريف', range: [0, 6] },
  { id: 'marketing', label: 'الدراسة السوقية والاستراتيجية', range: [7, 11] },
  { id: 'technical', label: 'الدراسة الفنية والقانونية', range: [12, 19] },
  { id: 'financial', label: 'الدراسة المالية والتمويل', range: [20, 26] },
  { id: 'strategic', label: 'تحليل المخاطر', range: [27, 31] },
  { id: 'advanced', label: 'التخطيط والتحليلات المتقدمة', range: [32, 34] },
  { id: 'appendices', label: 'الملاحق والمصادر', range: [35, 35] },
  { id: 'results', label: 'النتائج والقرار النهائي', range: [36, 41] },
];

/**
 * أسماء المراحل التعليمية — تُشتق تلقائياً من SIDEBAR_SECTIONS كي لا تنحرف
 * عن الخطوات عند إضافة/حذف خطوة (كانت قائمة مصمتة وانحرفت 16 خطوة فعلياً).
 */
const SECTION_PHASE_LABELS = {
  setup: { phase: 'مبدئية', label: 'المرحلة المبدئية' },
  marketing: { phase: 'تسويقية', label: 'المرحلة التسويقية والاستراتيجية' },
  technical: { phase: 'فنية', label: 'المرحلة الفنية والقانونية' },
  financial: { phase: 'مالية', label: 'المرحلة المالية' },
  strategic: { phase: 'استراتيجية', label: 'تحليل المخاطر' },
  advanced: { phase: 'متقدمة', label: 'التخطيط والتحليلات المتقدمة' },
  appendices: { phase: 'ملاحق', label: 'الملاحق والمصادر' },
  results: { phase: 'نتائج', label: 'النتائج والقرار النهائي' },
};

export const PHASE_LABELS = STEPS.map((_, idx) => {
  const section = SIDEBAR_SECTIONS.find(s => idx >= s.range[0] && idx <= s.range[1]);
  return (section && SECTION_PHASE_LABELS[section.id]) || { phase: 'حالية', label: 'المرحلة الحالية' };
});

/** يُرجع اسم المرحلة التعليمية للخطوة (للعرض في المعالج). */
function getPhaseForStep(stepIndex) {
  const entry = PHASE_LABELS[stepIndex];
  return entry ? entry.label : 'المرحلة الحالية';
}

/**
 * Bizplan-style: لماذا نطلب هذا الخطوة + كيف تملأه (شرح في كل خطوة).
 * يُرجع { why, how } أو null إن لم يُعرّف للخطوة.
 * الترتيب يطابق STEPS واحداً بواحد — الحارس أدناه يكشف أي انحراف.
 */
export const STEP_HELP = [
  // البداية والتعريف
  { why: 'نساعدك على تقييم أولي سريع قبل الدخول في التفاصيل.', how: 'أجب عن الأسئلة القصيرة؛ يمكنك تخطي هذه الخطوة والمتابعة.' },
  { why: 'مقارنة عدة أفكار تساعد في اختيار الأفضل قبل استثمار الوقت في دراسة واحدة.', how: 'أدخل أفكارك وقارنها حسب المعايير (السوق، الربحية، المخاطر).' },
  { why: 'معلومات المشروع أساس كل الأقسام التالية؛ الاسم والقطاع يظهران في التقرير.', how: 'املأ الاسم، النشاط، الموقع؛ استخدم قائمة جمع المعلومات كتذكير.' },
  { why: 'تفاصيل المنتجات والخدمات تحدد ما ستبيعه وتُبنى عليه الإيرادات لاحقاً.', how: 'اذكر المنتجات أو الخدمات الرئيسية وقيمة كل منها للعميل.' },
  { why: 'الفريق والشركاء يؤثرون في الجدوى والقدرة على التنفيذ.', how: 'أضف المناصب والأسماء وعقود الشراكة إن وُجدت.' },
  { why: 'المقدمة توحّد صياغة الجدوى وتُظهر للمراجع أن الدراسة منظمة.', how: 'اترك النص الافتراضي أو عدّله ليعكس مشروعك.' },
  { why: 'الأهداف الذكية تجعل النتائج قابلة للقياس والمتابعة.', how: 'حدد أهدافاً محددة وقابلة للقياس وواقعية ومرتبطة بزمن.' },
  // السوقية والاستراتيجية
  { why: 'الدراسة السوقية تبرر حجم الطلب والعرض والمنافسة والإيرادات المتوقعة.', how: 'املأ تحليل السوق، العرض والطلب، المنافسين، خطة التسويق والتوقعات.' },
  { why: 'تحجيم السوق (TAM/SAM/SOM) يقدّر إجمالي السوق والسوق المتاح وحصتك المستهدفة — ركن أساسي لتقدير الإيرادات وقرار الجدوى، وتقرؤه لوحة القرار لقياس جاهزية السوق.', how: 'أدخل TAM ثم SAM ثم SOM (حصتك ≤ المتاح ≤ الإجمالي)، أو استخدم «اقتراح من بيانات هيئة الإحصاء».' },
  { why: 'SWOT يلخص نقاط القوة والضعف والفرص والتهديدات لاتخاذ قرار استراتيجي.', how: 'أدخل نقاطاً واضحة في كل محور؛ استخدم مصفوفة TOWS للاستراتيجيات.' },
  { why: 'مصادر الإيرادات تغذّي النموذج المالي؛ بدونها لا يمكن حساب الربحية.', how: 'حدد كل مصدر إيراد (منتج، خدمة، اشتراك) والكمية والسعر.' },
  { why: 'تحليل الخدمات المفصل يربط الخدمة بالتكلفة والإيراد بشكل دقيق.', how: 'صِف كل خدمة ووقت التنفيذ والتكلفة والإيراد المتوقع.' },
  // الفنية والقانونية
  { why: 'الأصول والتكاليف التأسيسية تحدد رأس المال المطلوب ونقطة التعادل لاحقاً.', how: 'أدخل تكاليف الأراضي والمباني والمعدات والأثاث؛ صنّف كل بند بوضوح.' },
  { why: 'الرواتب من أكبر التكاليف التشغيلية؛ تؤثر في التدفق النقدي والربحية.', how: 'أضف كل منصب وعدد الشهور والراتب (ثابت أو متغير).' },
  { why: 'الموارد التقنية (برمجيات، سيرفرات) قد تكون ضرورية لتشغيل المشروع.', how: 'اذكر البنود والتكلفة الدورية (شهرية/سنوية).' },
  { why: 'النقل والتخزين يؤثران في التكلفة ووقت التسليم.', how: 'أدخل بنود النقل والتخزين والكميات والتكاليف.' },
  { why: 'التكاليف الإدارية (إيجار مكتب، كهرباء، اتصالات) جزء من التشغيل.', how: 'أضف البنود الإدارية والتكلفة لكل بند.' },
  { why: 'الهيكل التنظيمي يوضح المسؤوليات ومؤشرات الأداء التشغيلية.', how: 'صِف الهيكل ومؤشرات الأداء الرئيسية (KPI) إن وُجدت.' },
  { why: 'محاكاة التشغيل تساعد في تقدير زمن الانتظار والطاقة الاستيعابية.', how: 'أدخل معدلات الوصول والخدمة إن لديك أرقاماً؛ وإلا يمكن تخطيها.' },
  { why: 'التراخيص والامتثال القانوني مطلوبان قبل التشغيل.', how: 'أضف التراخيص والتكلفة والمدة؛ راجع متطلبات البلد والقطاع.' },
  // الدراسة المالية
  { why: 'هيكلة التمويل تحدد من أين يأتي رأس المال (ذاتي، قرض) وتأثير ذلك على التدفق.', how: 'أدخل مبلغ القرض وفترة السماح وسعر الفائدة وطريقة السداد.' },
  { why: 'تحليل الجدوى الاستثمارية يوضح العائد من وجهة نظر المستثمر.', how: 'راجع المؤشرات (NPV، IRR) والسيناريوهات المعروضة.' },
  { why: 'الافتراضات (تضخم، خصم، نمو مبيعات) تؤثر في كل الحسابات المالية.', how: 'أدخل معدل التضخم ومعدل الخصم ونمو المبيعات؛ استند إلى بيانات البنك المركزي السعودي (SAMA) وتقارير القطاع.' },
  { why: 'القوائم المالية التقديرية تلخص الإيرادات والتكاليف والتدفق والربح.', how: 'راجع الجداول المُولَّدة من المدخلات؛ عدّل المدخلات إن احتجت.' },
  { why: 'الميزانية العمومية تعرض الأصول والخصوم وحقوق الملكية في نقاط زمنية.', how: 'راجع الأرقام المُولَّدة من النموذج.' },
  { why: 'نقطة التعادل توضح عند أي حجم مبيعات يتساوى الإيراد مع التكلفة.', how: 'راجع الرسم والرقم؛ يساعد في قرارات التسعير والحجم.' },
  { why: 'مؤشرات التقييم (NPV، IRR، فترة الاسترداد) أساس قرار GO/NO-GO.', how: 'راجع اللوحة والتوصية؛ عدّل الافتراضات لرؤية التأثير.' },
  // المخاطر
  { why: 'تحليل المخاطر يوضح التهديدات ودرجة التأثير وخطط التخفيف.', how: 'أدخل المخاطر واحتمالها وتأثيرها وطريقة المعالجة.' },
  { why: 'اختبار التحمل يوضح ماذا يحدث عند تغيّر الإيراد أو التكلفة.', how: 'حرّك المؤشرات لرؤية تأثير التغيّر على NPV والاسترداد.' },
  { why: 'تحليل الحساسية يحدد أي متغير أكثر تأثيراً على النتيجة.', how: 'راجع الرسم؛ المتغيرات الأكثر حساسية تحتاج دقة في التقدير.' },
  { why: 'السيناريوهات (أساسي، أفضل، أسوأ) تعطي صورة متكاملة عن المجازفة.', how: 'راجع النتائج الثلاثة؛ عدّل معاملات كل سيناريو إن احتجت.' },
  { why: 'محاكاة مونت كارلو تعطي توزيعاً احتمالياً للنتيجة بدلاً من رقم واحد.', how: 'شغّل المحاكاة وراجع الرسم والنسب؛ اختياري للمتقدمين.' },
  // التخطيط
  { why: 'الجدول الزمني يربط المهام بمراحل التنفيذ والتكلفة.', how: 'أدخل المراحل والمهام والتواريخ والتكلفة المرتبطة.' },
  { why: 'الزكاة والضريبة قد تكونان واجبتين حسب النشاط والبلد.', how: 'أدخل النسب والمبالغ المعفاة إن تنطبق؛ راجع استشارياً.' },
  { why: 'تقييم الشركة يفيد في المفاوضات مع مستثمر أو بيع.', how: 'راجع الطرق المعروضة (صافي الأصول، DCF إن وُجد).' },
  // الملاحق
  { why: 'الملاحق والمصادر تدعم مصداقية الدراسة وتسهّل المراجعة.', how: 'أضف المراجع وأسماء المراجعين إن وُجدت.' },
  // النتائج والقرار النهائي
  { why: 'نموذج العمل يلخص كيف تربح المشروع ومن هم العملاء والقيمة المقدمة.', how: 'املأ أو راجع البطاقة المعروضة.' },
  { why: 'لوحة القرار تعطيك التوصية النهائية (GO/NO-GO/REVISE) ومؤشرات القرار.', how: 'راجع التوصية والمؤشرات واقرأ "لماذا" و"الخطوات التالية".' },
  { why: 'الملخص التنفيذي يجمع خلاصة الدراسة في صفحة واحدة للمستثمر أو البنك.', how: 'راجع النص المُولَّد وعدّله إن احتجت.' },
  { why: 'ترتيب الأقسام يحدد كيف يظهر التقرير النهائي عند التصدير.', how: 'اسحب الأقسام لترتيبها؛ أضف أو احذف أقساماً إن أردت.' },
  { why: 'لوحة التحكم المالية تعرض الأداء والسيناريوهات واقتراحات التحسين.', how: 'راجع الرسوم والمؤشرات واقتراحات التحسين.' },
  { why: 'مراقبة الأداء الفعلي تقارن التقديرات بما حدث فعلياً بعد الإطلاق.', how: 'أدخل البيانات الفعلية دورياً وقارنها بالتوقعات.' },
];

// حارس انحراف: الشروحات يجب أن تطابق عدد الخطوات واحداً بواحد
if (STEP_HELP.length !== STEPS.length) {
  console.error(`[wizardSteps] انحراف: STEP_HELP فيه ${STEP_HELP.length} مدخلاً بينما STEPS فيه ${STEPS.length} خطوة — الشروحات ستظهر على الخطوات الخطأ!`);
}

/** يُرجع شرح الخطوة (لماذا + كيف) للعرض في المعالج. */
function getStepHelp(stepIndex) {
  if (stepIndex < 0 || stepIndex >= STEP_HELP.length) return null;
  return STEP_HELP[stepIndex] || null;
}

/** يُرجع رقم ترتيب الخطوة بناءً على معرّفها (ID). */
export function stepIndexById(id) {
  return STEPS.findIndex(s => s.id === id);
}

// تصدير صريح لاستيراد Wizard.js وغيره (يتجنب مشاكل ESM/HMR)
export const MAJOR_PHASES = [
  { id: 'phase1', label: 'التقييم والسوق', range: [0, 11] }, // setup & marketing
  { id: 'phase2', label: 'البناء الفني والمالي', range: [12, 26] }, // technical & financial
  { id: 'phase3', label: 'المخاطر والقرار', range: [27, 41] }, // strategic, advanced, appendices, results
];

export function getMajorPhaseForStep(stepIndex) {
  const phaseIndex = MAJOR_PHASES.findIndex(p => stepIndex >= p.range[0] && stepIndex <= p.range[1]);
  return { phase: MAJOR_PHASES[phaseIndex] || MAJOR_PHASES[0], index: Math.max(0, phaseIndex) };
}

export { getPhaseForStep, getStepHelp };

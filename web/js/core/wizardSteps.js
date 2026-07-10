/**
 * Single source of truth for Wizard steps and Sidebar sections.
 * When adding a step: 1) append to STEPS, 2) adjust the range of the target section in SIDEBAR_SECTIONS.
 */

import { SECTIONS } from './schema.js';

export { SECTIONS };

export const STEPS = [
  // البداية والتعريف (0-6) — نقطة البداية (اختيار القالب/الوضع) صارت في نافذة «اختر نقطة البداية» قبل المسار
  { id: 'preliminaryCheck', label: "الدراسة المبدئية", isPreliminaryCheck: true }, // اختيارية، يمكن تخطيها
  { id: 'projectAlternatives', label: "مقارنة الأفكار", isProjectAlternatives: true, isAdvancedStep: true }, // مقارنة أفكار مبدئية (د. الروضي)
  { id: SECTIONS.PROJECT_INFO, label: "معلومات المشروع", isForm: true, tables: [], optionalTables: ['dataGatheringChecklist'] }, // الحقول أولاً؛ قائمة التجهيز اختيارية ومطوية
  // معرّف فريد للتنقل مع بقاء البيانات في قسم projectInfo (dataSection يستهلكه Wizard.js)
  // شاشة «ماذا تبيع وبكم» المدموجة (2026-07-11): تجمع المنتجات/الخدمات/القيمة للعميل
  // مع مصادر الإيرادات في شاشة واحدة عبر OfferingView. البيانات تبقى في أقسامها
  // الأصلية (projectInfo.* و revenue.streams)؛ خطوة «مصادر الإيرادات» تُخفى من
  // المسار المبسّط (flow=advanced) لأنها تُدخَل هنا.
  { id: 'projectDetails', dataSection: SECTIONS.PROJECT_INFO, label: "ماذا تبيع وبكم", tables: ['products', 'introServices', 'customerValues'], isOfferingView: true },
  { id: SECTIONS.KEY_PEOPLE, label: "الأشخاص الرئيسون", tables: ['keyPeople', 'partnershipContracts'] },
  { id: 'projectIntro', label: "فرضية المشروع", isIntroduction: true, isAdvancedStep: true },
  { id: SECTIONS.SMART_GOALS, label: "الأهداف الذكية", isSmartGoals: true, isAdvancedStep: true },

  // السوقية والاستراتيجية (8-12) — السوق يحدد الطلب قبل الطاقة والأصول
  // تحجيم السوق (TAM/SAM/SOM) — ركن معياري (IFC/UNIDO) يغذّي جاهزية السوق في لوحة القرار (marketSizing.som)
  { id: 'marketSizing', label: "تحجيم السوق", isMarketAnalysis: true },
  { id: SECTIONS.MARKETING, label: "الدراسة السوقية", tables: ['marketAnalysis', 'historicalData', 'supplyDemandBalance', 'competitors', 'competitorBenchmarking', 'marketingPlan'] },
  { id: SECTIONS.STRATEGIC, label: "التحليل الاستراتيجي", isStrategic: true },
  { id: SECTIONS.REVENUE, label: "مصادر الإيرادات", tables: ['revenueStreams'] },
  { id: SECTIONS.SERVICES, label: "تحليل الخدمات", isServiceAnalysis: true, isAdvancedStep: true },

  // الفنية والقانونية (12-19)
  { id: SECTIONS.TECHNICAL, label: "الأصول والتجهيزات", tables: ['establishmentCosts', 'capacityModel', 'capacityUtilization', 'buildings', 'equipment', 'furniture', 'locationAssessment'] },
  { id: 'operational_sim', label: "محاكاة التشغيل", isOperationalSim: true, isAdvancedStep: true },
  { id: SECTIONS.HR, label: "الفريق والرواتب", tables: ['positions', 'advisoryBoard'] },
  // شاشة «المصاريف التشغيلية» المدموجة (2026-07-11): تجمع الأقسام الثلاثة بصرياً عبر
  // OperatingCostsView. القسم يبقى techResources (المحرّك يقرؤه كما هو)؛ logistics
  // وadministrative تبقيان خطوتين مستقلتين للوضع الكامل/المتقدم، لكن المسار المبسّط
  // (INPUT_STEPS) يخفيهما لأنهما تُدخلان داخل هذه الشاشة الواحدة.
  { id: SECTIONS.TECH_RESOURCES, label: "المصاريف التشغيلية", tables: ['techResources'], isOperatingCosts: true },
  { id: SECTIONS.LOGISTICS, label: "الموارد اللوجستية", tables: ['logistics'] },
  { id: SECTIONS.ADMINISTRATIVE, label: "الموارد الإدارية", tables: ['administrative'] },
  { id: SECTIONS.ORG_STRUCTURE, label: "الهيكل التنظيمي والحوكمة", tables: ['operationalKpis'], isOrgStructure: true },
  { id: SECTIONS.LEGAL, label: "الدراسة القانونية", tables: ['licenses'] },

  // التنفيذ والجدولة (20) — بعد اكتمال المتطلبات الفنية والقانونية وقبل التمويل
  { id: SECTIONS.TIMELINE, label: "خطة التنفيذ", isTimeline: true },

  // الدراسة المالية (21-28) — الافتراضات والمدخلات أولاً، ثم التمويل والمخرجات
  { id: SECTIONS.ASSUMPTIONS, label: "الافتراضات المالية", tables: [] },
  { id: SECTIONS.FINANCING, label: "التمويل", isFinancing: true },
  { id: SECTIONS.FINANCIAL_STATEMENTS, label: "القوائم المالية التقديرية", isFinancialStatements: true },
  { id: 'balance_sheet', label: "الميزانية العمومية", isBalanceSheet: true, isAdvancedStep: true },
  { id: SECTIONS.BREAK_EVEN, label: "تحليل نقطة التعادل", isBreakEven: true },
  { id: SECTIONS.ZAKAT_TAX, label: "الزكاة والضريبة", isZakatTax: true, isAdvancedStep: true },
  { id: 'investor_analysis', label: "تحليل الجدوى الاستثمارية", isInvestorAnalysis: true, isAdvancedStep: true },
  { id: SECTIONS.VALUATION, label: "تقييم الشركة", isValuation: true, isAdvancedStep: true },

  // المخاطر (29-33) — من العام إلى السيناريوهات ثم الاختبارات الأعمق
  { id: SECTIONS.RISK_ANALYSIS, label: "تحليل المخاطر", isRiskMatrix: true },
  { id: SECTIONS.SCENARIOS, label: "السيناريوهات", isScenarios: true, isAdvancedStep: true },
  { id: 'sensitivity', label: "تحليل الحساسية", isSensitivity: true, isAdvancedStep: true },
  { id: 'stress_test', label: "اختبار التحمل", isStressTest: true, isAdvancedStep: true },
  { id: SECTIONS.MONTE_CARLO, label: "محاكاة مونت كارلو", isMonteCarlo: true, isAdvancedStep: true },

  // الملاحق والمصادر (34)
  { id: SECTIONS.APPENDICES, label: "الأدلة والمرفقات", tables: ['references', 'reviewers'], isAppendices: true, isAdvancedStep: true },

  // النتائج والقرار النهائي (35-40)
  { id: SECTIONS.BUSINESS_MODEL, label: "نموذج العمل", isBusinessModel: true },
  { id: 'dashboard', label: "لوحة المؤشرات المالية", isDashboard: true },
  { id: SECTIONS.DECISION_DASHBOARD, label: "لوحة القرار الاستثماري", isDecisionDashboard: true, isAdvancedStep: true },
  { id: SECTIONS.EXECUTIVE_SUMMARY, label: "الملخص التنفيذي", isExecutiveSummary: true },
  { id: 'reportBuilder', label: "بناء التقرير", isReportBuilder: true, isAdvancedStep: true },
  { id: SECTIONS.ACTUALS, label: "مراقبة الأداء الفعلي", isPostLaunch: true, isAdvancedStep: true }, // ما بعد الافتتاح — تبقى الأخيرة
];

/** Ranges [start, end] inclusive; must match STEPS indices. Update when adding steps. */
export const SIDEBAR_SECTIONS = [
  { id: 'setup', label: 'البداية والتعريف', range: [0, 6] },
  { id: 'marketing', label: 'الدراسة السوقية والاستراتيجية', range: [7, 11] },
  { id: 'technical', label: 'الدراسة الفنية والقانونية', range: [12, 19] },
  { id: 'advanced', label: 'خطة التنفيذ', range: [20, 20] },
  { id: 'financial', label: 'الدراسة المالية والتمويل', range: [21, 28] },
  { id: 'strategic', label: 'تحليل المخاطر', range: [29, 33] },
  { id: 'appendices', label: 'الأدلة والمرفقات', range: [34, 34] },
  { id: 'results', label: 'النتائج والقرار النهائي', range: [35, 40] },
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
  advanced: { phase: 'تنفيذ', label: 'خطة التنفيذ' },
  appendices: { phase: 'أدلة', label: 'الأدلة والمرفقات' },
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
const STEP_HELP_SOURCE = [
  // البداية والتعريف
  { why: 'نساعدك على تقييم أولي سريع قبل الدخول في التفاصيل.', how: 'أجب عن الأسئلة القصيرة؛ يمكنك تخطي هذه الخطوة والمتابعة.' },
  { why: 'مقارنة عدة أفكار تساعد في اختيار الأفضل قبل استثمار الوقت في دراسة واحدة.', how: 'أدخل أفكارك وقارنها حسب المعايير (السوق، الربحية، المخاطر).' },
  { why: 'معلومات المشروع أساس كل الأقسام التالية؛ الاسم والقطاع يظهران في التقرير.', how: 'املأ الاسم، النشاط، الموقع؛ استخدم قائمة جمع المعلومات كتذكير.' },
  { why: 'تفاصيل المنتجات والخدمات تحدد ما ستبيعه وتُبنى عليه الإيرادات لاحقاً.', how: 'اذكر المنتجات أو الخدمات الرئيسية وقيمة كل منها للعميل.' },
  { why: 'الفريق والشركاء يؤثرون في الجدوى والقدرة على التنفيذ.', how: 'أضف أدوار الفريق المؤسس والأسماء وعقود الشراكة إن وُجدت.' },
  { why: 'فرضية المشروع تربط المشكلة بالحل وسبب قدرتك على النجاح.', how: 'اكتب المشكلة والحل وسبباً واقعياً واحداً يفسر لماذا سيختارك العميل.' },
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
  { why: 'إيجار موقع مطعمك (الصالة/المطبخ) عادة أكبر بند تكلفة ثابتة شهرية — بالإضافة للكهرباء والاتصالات والمصاريف الإدارية الأخرى.', how: 'ابدأ بإيجار موقع المطعم الشهري، ثم أضف الكهرباء والاتصالات وبقية البنود الإدارية.' },
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
  { why: 'الزكاة والضريبة قد تكونان واجبتين حسب النشاط والبلد.', how: 'أدخل النسب والمبالغ المعفاة إن تنطبق؛ راجع استشارياً.' },
  { why: 'تقييم الشركة يفيد في المفاوضات مع مستثمر أو بيع.', how: 'راجع الطرق المعروضة (صافي الأصول، DCF إن وُجد).' },
  // المخاطر
  { why: 'تحليل المخاطر يوضح التهديدات ودرجة التأثير وخطط التخفيف.', how: 'أدخل المخاطر واحتمالها وتأثيرها وطريقة المعالجة.' },
  { why: 'اختبار التحمل يوضح ماذا يحدث عند تغيّر الإيراد أو التكلفة.', how: 'حرّك المؤشرات لرؤية تأثير التغيّر على NPV والاسترداد.' },
  { why: 'تحليل الحساسية يحدد أي متغير أكثر تأثيراً على النتيجة.', how: 'راجع الرسم؛ المتغيرات الأكثر حساسية تحتاج دقة في التقدير.' },
  { why: 'السيناريوهات (أساسي، أفضل، أسوأ) تعطي صورة متكاملة عن المجازفة.', how: 'راجع النتائج الثلاثة؛ عدّل معاملات كل سيناريو إن احتجت.' },
  { why: 'محاكاة مونت كارلو تعطي توزيعاً احتمالياً للنتيجة بدلاً من رقم واحد.', how: 'شغّل المحاكاة وراجع الرسم والنسب؛ اختياري للمتقدمين.' },
  // التخطيط
  { why: 'الجدول الزمني يربط المهام بمراحل التنفيذ والتكلفة.', how: 'أدخل المراحل والمهام والتواريخ والتكلفة المرتبطة.' },
  // الملاحق
  { why: 'الأدلة والمرفقات تثبت أرقام الدراسة وتسهّل مراجعتها.', how: 'أرفق المصادر وعروض الأسعار والاستبيانات وأسماء المراجعين إن وُجدت.' },
  // النتائج والقرار النهائي
  { why: 'نموذج العمل يلخص كيف تربح المشروع ومن هم العملاء والقيمة المقدمة.', how: 'املأ أو راجع البطاقة المعروضة.' },
  { why: 'لوحة القرار تعطيك التوصية النهائية (GO/NO-GO/REVISE) ومؤشرات القرار.', how: 'راجع التوصية والمؤشرات واقرأ "لماذا" و"الخطوات التالية".' },
  { why: 'الملخص التنفيذي يجمع خلاصة الدراسة في صفحة واحدة للمستثمر أو البنك.', how: 'راجع النص المُولَّد وعدّله إن احتجت.' },
  { why: 'ترتيب الأقسام يحدد كيف يظهر التقرير النهائي عند التصدير.', how: 'اسحب الأقسام لترتيبها؛ أضف أو احذف أقساماً إن أردت.' },
  { why: 'لوحة التحكم المالية تعرض الأداء والسيناريوهات واقتراحات التحسين.', how: 'راجع الرسوم والمؤشرات واقتراحات التحسين.' },
  { why: 'مراقبة الأداء الفعلي تقارن التقديرات بما حدث فعلياً بعد الإطلاق.', how: 'أدخل البيانات الفعلية دورياً وقارنها بالتوقعات.' },
];

// تثبيت الشرح بمعرّف الخطوة، لا بموقعها: يسمح بتحسين ترتيب الرحلة دون أن ينتقل
// شرح خطوة إلى خطوة أخرى بالخطأ.
const STEP_HELP_SOURCE_IDS = [
  'preliminaryCheck', 'projectAlternatives', SECTIONS.PROJECT_INFO, 'projectDetails',
  SECTIONS.KEY_PEOPLE, 'projectIntro', SECTIONS.SMART_GOALS,
  SECTIONS.MARKETING, 'marketSizing', SECTIONS.STRATEGIC, SECTIONS.REVENUE, SECTIONS.SERVICES,
  SECTIONS.TECHNICAL, SECTIONS.HR, SECTIONS.TECH_RESOURCES, SECTIONS.LOGISTICS,
  SECTIONS.ADMINISTRATIVE, SECTIONS.ORG_STRUCTURE, 'operational_sim', SECTIONS.LEGAL,
  SECTIONS.FINANCING, 'investor_analysis', SECTIONS.ASSUMPTIONS,
  SECTIONS.FINANCIAL_STATEMENTS, 'balance_sheet', SECTIONS.BREAK_EVEN,
  SECTIONS.ZAKAT_TAX, SECTIONS.VALUATION, SECTIONS.RISK_ANALYSIS, 'stress_test',
  'sensitivity', SECTIONS.SCENARIOS, SECTIONS.MONTE_CARLO, SECTIONS.TIMELINE,
  SECTIONS.APPENDICES, SECTIONS.BUSINESS_MODEL, SECTIONS.DECISION_DASHBOARD,
  SECTIONS.EXECUTIVE_SUMMARY, 'reportBuilder', 'dashboard', SECTIONS.ACTUALS
];
const STEP_HELP_BY_ID = new Map(STEP_HELP_SOURCE_IDS.map((id, index) => [id, STEP_HELP_SOURCE[index]]));
export const STEP_HELP = STEPS.map(step => STEP_HELP_BY_ID.get(step.id) || null);

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
  { id: 'phase2', label: 'البناء الفني والمالي', range: [12, 28] }, // technical, execution, financial
  { id: 'phase3', label: 'المخاطر والقرار', range: [29, 40] }, // risk, evidence, results
];

export function getMajorPhaseForStep(stepIndex) {
  const phaseIndex = MAJOR_PHASES.findIndex(p => stepIndex >= p.range[0] && stepIndex <= p.range[1]);
  return { phase: MAJOR_PHASES[phaseIndex] || MAJOR_PHASES[0], index: Math.max(0, phaseIndex) };
}

export { getPhaseForStep, getStepHelp };

/* ═══════════════════════════════════════════════════════════════════════════
   طبقة إعادة الهيكلة (تدقيق تجربة المستخدم 2026-07-11)
   ───────────────────────────────────────────────────────────────────────────
   المشكلة: المعالج كان 41 «خطوة» خطّية تخلط الإدخال بالنتائج، ففقد المستخدم
   إحساس التقدّم (يظن أن أمامه ٢٠ خطوة عمل بينما نصفها «اقرأ نتيجة»).

   الحل — بلا لمس المحرّكات: تبقى STEPS كاملةً (٤١) كسجل مرجعي للمحرّكات والحفظ
   والتوجيه (تقرأ البيانات بمعرّف القسم — أي حذف يكسر الحسابات). نضيف فوقها
   «تدفّقاً» لكل خطوة، ونشتق منه قوائم عرض جديدة دون حذف أي شيء:
     • input      → خطوة إدخال فعلية يملؤها المستخدم (١٦ خطوة = مسار المعالج الجديد)
     • result     → شاشة مخرجات تُقرأ فقط → تنتقل للوحة النتائج المستقلة
     • advanced   → أداة اختيارية تُخفى خلف زر «أدوات متقدمة»
     • postlaunch → ما بعد الإطلاق (ليست جزءاً من دراسة الجدوى أصلاً)

   التفعيل في app.js: مرّر getStreamlinedWizardSteps() كـ steps للمعالج
   (نفس نمط الأوضاع mini/simple/quick الموجود أصلاً بسطر ~1503)، وابنِ صفحة
   نتائج من RESULTS_DASHBOARD_TABS تظهر بعد آخر خطوة إدخال.
   ═══════════════════════════════════════════════════════════════════════════ */

// تدفّق كل خطوة بمعرّفها (لا بموقعها) — يسمح بإعادة الترتيب دون انزياح التصنيف.
const STEP_FLOW_ENTRIES = [
  // ── فكرتك ──
  ['preliminaryCheck', 'input'],
  ['projectAlternatives', 'advanced'],        // مقارنة أفكار — قيّمة لكن ليست لكل مستخدم
  [SECTIONS.PROJECT_INFO, 'input'],
  ['projectDetails', 'input'],                // المنتجات/الخدمات (هدف دمج مع الإيرادات)
  [SECTIONS.KEY_PEOPLE, 'input'],
  ['projectIntro', 'input'],                  // فرضية المشروع (هدف دمج مع الأهداف الذكية)
  [SECTIONS.SMART_GOALS, 'advanced'],         // سرد يتداخل مع الفرضية → متقدم
  // ── سوقك ──
  ['marketSizing', 'advanced'],               // TAM/SAM/SOM → يُدمج ضمن الدراسة السوقية
  [SECTIONS.MARKETING, 'input'],
  [SECTIONS.STRATEGIC, 'input'],
  [SECTIONS.REVENUE, 'advanced'],             // مدموج داخل OfferingView (ماذا تبيع وبكم)
  [SECTIONS.SERVICES, 'advanced'],            // تحليل خدمات مكرّر مع المنتجات/الإيراد
  // ── تشغيلك وتكاليفك ──
  [SECTIONS.TECHNICAL, 'input'],
  ['operational_sim', 'advanced'],            // محاكاة طوابير نيتشية
  [SECTIONS.HR, 'input'],
  [SECTIONS.TECH_RESOURCES, 'input'],         // يمثّل شاشة «المصاريف التشغيلية» المدموجة
  [SECTIONS.LOGISTICS, 'advanced'],           // يُدمج بصرياً ضمن المصاريف التشغيلية
  [SECTIONS.ADMINISTRATIVE, 'advanced'],      // يُدمج بصرياً ضمن المصاريف التشغيلية
  [SECTIONS.ORG_STRUCTURE, 'advanced'],
  [SECTIONS.LEGAL, 'input'],
  // ── مالك ──
  [SECTIONS.TIMELINE, 'input'],
  [SECTIONS.ASSUMPTIONS, 'input'],
  [SECTIONS.FINANCING, 'input'],
  [SECTIONS.FINANCIAL_STATEMENTS, 'result'],
  ['balance_sheet', 'result'],
  [SECTIONS.BREAK_EVEN, 'result'],
  [SECTIONS.ZAKAT_TAX, 'advanced'],           // يحتاج إدخال نِسَب لكن مخرجاته حسابية
  ['investor_analysis', 'result'],
  [SECTIONS.VALUATION, 'result'],
  // ── مخاطرك ──
  [SECTIONS.RISK_ANALYSIS, 'input'],
  [SECTIONS.SCENARIOS, 'advanced'],
  ['sensitivity', 'result'],
  ['stress_test', 'result'],
  [SECTIONS.MONTE_CARLO, 'result'],
  // ── أدلة ونتائج ──
  [SECTIONS.APPENDICES, 'advanced'],
  [SECTIONS.BUSINESS_MODEL, 'result'],
  ['dashboard', 'result'],
  [SECTIONS.DECISION_DASHBOARD, 'result'],
  [SECTIONS.EXECUTIVE_SUMMARY, 'result'],
  ['reportBuilder', 'advanced'],              // أداة ما‑قبل‑تصدير، لا خطوة
  [SECTIONS.ACTUALS, 'postlaunch'],           // بعد الإطلاق — خارج نطاق الجدوى
];
const STEP_FLOW = new Map(STEP_FLOW_ENTRIES);

/** تدفّق الخطوة: input | result | advanced | postlaunch (افتراض آمن: input). */
export function stepFlow(step) {
  return STEP_FLOW.get(step?.id) || 'input';
}

// حارس انحراف: كل خطوة يجب أن تُصنَّف صراحةً (يكشف أي خطوة جديدة غير مصنّفة).
const _unclassified = STEPS.filter(s => !STEP_FLOW.has(s.id)).map(s => s.id);
if (_unclassified.length) {
  console.error(`[wizardSteps] خطوات بلا تصنيف تدفّق: ${_unclassified.join(', ')} — ستُعرض كإدخال افتراضاً.`);
}

/** مسار المعالج الجديد: خطوات الإدخال فقط (١٦) — هذا ما يراه المستخدم كـ«خطوات». */
export const INPUT_STEPS = STEPS.filter(s => stepFlow(s) === 'input');

/** شاشات النتائج المفصولة — تُبنى كلوحة مخرجات مستقلة بعد آخر خطوة إدخال. */
export const RESULTS_DASHBOARD_TABS = STEPS
  .filter(s => stepFlow(s) === 'result')
  .map(s => ({ id: s.id, label: s.label, stepIndex: STEPS.indexOf(s) }));

/** أدوات اختيارية تُخفى خلف «أدوات متقدمة» (تبقى متاحة، بلا إثقال المبتدئ). */
export const ADVANCED_TOOLS = STEPS
  .filter(s => stepFlow(s) === 'advanced')
  .map(s => ({ id: s.id, label: s.label, stepIndex: STEPS.indexOf(s) }));

/**
 * المراحل الخمس لمسار الإدخال — قصة واضحة: فكرة → سوق → تشغيل → مال → مخاطر.
 * كل مرحلة تسرد معرّفات خطوات الإدخال التابعة لها (بالترتيب المنطقي المقترح).
 */
export const INPUT_PHASES = [
  { id: 'idea',     label: 'فكرتك',            stepIds: ['preliminaryCheck', SECTIONS.PROJECT_INFO, 'projectDetails', 'projectIntro'] },
  { id: 'market',   label: 'سوقك',             stepIds: [SECTIONS.MARKETING, SECTIONS.STRATEGIC] },
  { id: 'ops',      label: 'تشغيلك وتكاليفك',  stepIds: [SECTIONS.TECHNICAL, SECTIONS.HR, SECTIONS.TECH_RESOURCES, SECTIONS.KEY_PEOPLE, SECTIONS.LEGAL] },
  { id: 'finance',  label: 'مالك',             stepIds: [SECTIONS.ASSUMPTIONS, SECTIONS.FINANCING, SECTIONS.TIMELINE] },
  { id: 'risk',     label: 'مخاطرك',           stepIds: [SECTIONS.RISK_ANALYSIS] },
];

/**
 * يبني قائمة خطوات المعالج المبسّط + خريطة الفهرسة (محلي→مطلق داخل STEPS الكاملة)
 * — بنفس عقد الأوضاع mini/simple/quick في app.js. مرّر نتيجته كـ options.steps.
 */
export function getStreamlinedWizardSteps() {
  const visibleSteps = INPUT_STEPS;
  const stepIndexMap = visibleSteps.map(step => STEPS.indexOf(step));
  return { visibleSteps, stepIndexMap };
}

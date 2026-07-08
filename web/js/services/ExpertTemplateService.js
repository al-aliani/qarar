/**
 * Local expert-template registry.
 *
 * MVP storage is local so the product can support adding trusted templates now.
 * The shape is intentionally metadata-first to make server/admin approval easy later.
 */
import { createEmptyStudy, SECTIONS } from '../core/schema.js';
import { validateExpertTemplateCertification } from './ExpertTemplateGovernance.js';

const STORAGE_KEY = 'qarar_expert_templates_v1';

const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
const text = (value) => String(value ?? '').trim();
const numberOrZero = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
};
const urlOrBlank = (value) => {
    const url = text(value);
    return /^https?:\/\//i.test(url) ? url : '';
};

function createSaasFeasibilityPlatformStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = {
        ...(data[SECTIONS.PROJECT_INFO] || {}),
        name: 'منصة دراسة جدوى رقمية',
        description: 'منصة SaaS تساعد رواد الأعمال والمستشارين على بناء دراسات جدوى مالية وسوقية، مع قوالب مختصين ومراجعات مدفوعة وتقارير قابلة للتقديم للممولين.',
        city: 'الرياض',
        district: 'النرجس',
        concept: 'موقع دراسة جدوى / منصة SaaS',
        businessModel: 'Independent',
        targetCapital: 1550000,
        selfFundingAmount: 700000,
        targetSegment: 'رواد الأعمال، مكاتب الاستشارات الصغيرة، وحاضنات الأعمال في السعودية',
        identityStatement: 'منصة رقمية موثوقة لدراسات الجدوى تجمع بين المحاكاة المالية، قوالب المختصين، ومخرجات قابلة للمراجعة.',
        valueProposition: 'تقليل وقت إعداد دراسة الجدوى مع إبقاء الأرقام قابلة للتعديل والمراجعة، وربط القوالب بخبرة مختصين بدلاً من قوالب عامة.',
        products: [
            { type: 'final', name: 'اشتراك أساسي', description: 'إعداد دراسة جدوى ذاتية مع حفظ المشاريع وتصدير مخرجات أولية.', uniqueFeatures: 'واجهة عربية وتدفق خطوة بخطوة.', valueAdded: 'خفض تكلفة البداية على رائد الأعمال.', customerBenefit: 'فهم جدوى الفكرة بسرعة وبأرقام قابلة للتعديل.' },
            { type: 'final', name: 'اشتراك احترافي', description: 'مؤشرات مالية متقدمة، سيناريوهات، وتقارير أعمق للمستثمر أو البنك.', uniqueFeatures: 'DSCR، NPV، IRR، حساسية وسيناريوهات.', valueAdded: 'رفع جودة القرار قبل التقديم.', customerBenefit: 'ملف أكثر تنظيماً ومصداقية.' },
            { type: 'final', name: 'قوالب مختصين معتمدة', description: 'قوالب قطاعية يضيفها مختصون مع نطاق وخبرة وسعر واضح.', uniqueFeatures: 'اسم المختص ونطاق الاعتماد ظاهر للعميل.', valueAdded: 'تحويل خبرة المختص إلى منتج قابل للبيع.', customerBenefit: 'البدء من نموذج أقرب للواقع من القوالب العامة.' }
        ],
        introServices: [
            { type: 'essential', name: 'محاكي دراسة الجدوى', description: 'إدخال البيانات وتحويلها إلى مؤشرات مالية وتشغيلية.' },
            { type: 'supporting', name: 'سوق قوالب المختصين', description: 'إضافة وبيع قوالب قطاعية من خبراء معتمدين داخل المنصة.' },
            { type: 'secondary', name: 'مراجعة استشارية مدفوعة', description: 'طلب مراجعة مختص للدراسة قبل عرضها على ممول أو مستثمر.' }
        ],
        customerValues: [
            { customerType: 'رائد أعمال مبتدئ', customerNeed: 'فهم جدوى الفكرة قبل صرف رأس مال كبير', valueWeProvide: 'دراسة منظمة ومؤشرات قرار واضحة' },
            { customerType: 'مختص قطاعي', customerNeed: 'بيع خبرته كقالب واستشارة', valueWeProvide: 'واجهة حفظ قالب مع بيانات الخبرة والنطاق والسعر' },
            { customerType: 'حاضنة/مسرعة', customerNeed: 'رفع جودة ملفات المتقدمين', valueWeProvide: 'مخرجات موحدة قابلة للمراجعة والمقارنة' }
        ]
    };
    data[SECTIONS.TECHNICAL] = {
        ...(data[SECTIONS.TECHNICAL] || {}),
        establishmentCosts: [
            { name: 'تأسيس الشركة والتراخيص التقنية', amount: 35000, amortizationRate: 0.20 },
            { name: 'تصميم الهوية والمحتوى الأولي', amount: 70000, amortizationRate: 0.20 },
            { name: 'تدقيق أمني وقانوني أولي', amount: 55000, amortizationRate: 0.20 }
        ],
        equipment: [
            { name: 'أجهزة عمل للفريق المؤسس', quantity: 8, price: 6500, depreciationRate: 0.25, notes: 'أجهزة تطوير وخدمة عملاء' }
        ],
        furniture: [
            { name: 'تجهيز مكتب مرن صغير', quantity: 1, price: 45000, depreciationRate: 0.20, notes: 'مقاعد، طاولات، وتجهيز اجتماع' }
        ],
        capacityUtilization: [
            { year: 1, rate: 0.55, notes: 'إطلاق وتسويق وتجارب مستخدمين' },
            { year: 2, rate: 0.75, notes: 'تحسين التحويل والشراكات' },
            { year: 3, rate: 0.90, notes: 'استقرار قنوات النمو' }
        ],
        productionProcessDescription: 'تطوير المنتج، اختبار النماذج المالية، مراجعة القوالب، تشغيل الاشتراكات، دعم العملاء، وتحسين التقارير بناءً على ملاحظات المستخدمين.'
    };
    data[SECTIONS.TECH_RESOURCES] = {
        techResources: [
            { name: 'تطوير MVP للمنصة', quantity: 1, price: 220000, depreciationRate: 0.33, notes: 'واجهات، محرك مالي، تقارير، إدارة مشاريع' },
            { name: 'إعداد السحابة والذكاء الاصطناعي والفوترة', quantity: 1, price: 85000, depreciationRate: 0.33, notes: 'بنية تشغيل أولية وتكاملات' }
        ]
    };
    data[SECTIONS.HR] = {
        ...(data[SECTIONS.HR] || {}),
        positions: [
            { position: 'مدير منتج', count: 1, salary: 18000, months: 12, nationality: 'saudi' },
            { position: 'مطوّر Full Stack', count: 2, salary: 16000, months: 12, nationality: 'saudi' },
            { position: 'محلل مالي/جدوى', count: 1, salary: 14000, months: 12, nationality: 'saudi' },
            { position: 'مسؤول نجاح عملاء', count: 1, salary: 9000, months: 12, nationality: 'saudi' },
            { position: 'مسوّق نمو', count: 1, salary: 12000, months: 12, nationality: 'saudi' }
        ]
    };
    data[SECTIONS.ADMINISTRATIVE] = {
        administrative: [
            { name: 'استضافة وسحابة وذكاء اصطناعي', monthly: 26000, notes: 'تزيد مع الاستخدام' },
            { name: 'اشتراكات أدوات تطوير ودعم', monthly: 9000, notes: 'إدارة مشاريع، مراقبة، بريد، دعم' },
            { name: 'مكتب مرن ومصاريف إدارية', monthly: 11000, notes: 'مكتب واجتماعات وخدمات' }
        ]
    };
    data[SECTIONS.LOGISTICS] = { logistics: [] };
    data[SECTIONS.MARKETING] = {
        ...(data[SECTIONS.MARKETING] || {}),
        marketAnalysis: {
            summary: 'سوق أدوات التخطيط المالي ودراسات الجدوى الرقمية يستهدف رواد الأعمال والمستشارين، ويتطلب ثقة في الأرقام وقابلية مراجعة لا مجرد نص مولد.',
            targetSegment: 'رواد الأعمال السعوديون، مكاتب الاستشارات الصغيرة، والحاضنات.',
            trends: 'نمو استخدام أدوات SaaS، الحاجة لتقارير تمويلية موحدة، وزيادة الطلب على الاستشارات المتخصصة.',
            marketGap: 'معظم الأدوات العامة لا تفصل بين قرار المستثمر وقرار البنك ولا تربط القوالب بخبير مسؤول.'
        },
        campaigns: [
            { name: 'إطلاق وتسويق رقمي أولي', type: 'capital', amount: 120000, monthly: 0, notes: 'إطلاق، محتوى، حملات أولية' },
            { name: 'تسويق نمو شهري', type: 'operating', amount: 0, monthly: 45000, notes: 'إعلانات، محتوى، شراكات' }
        ],
        competitors: [
            { name: 'قوالب Excel عامة', strength: 'رخيصة وسهلة', weakness: 'لا تحقق ولا ربط خبير', notes: '' },
            { name: 'مكاتب استشارات تقليدية', strength: 'خبرة بشرية', weakness: 'تكلفة ووقت أعلى', notes: '' }
        ]
    };
    data[SECTIONS.MARKET_SIZING] = {
        ...(data[SECTIONS.MARKET_SIZING] || {}),
        tam: { value: 120000000, description: 'إنفاق تقديري على إعداد ومراجعة دراسات الجدوى والاستشارات الأولية للشركات الصغيرة', source: 'تقدير خبير مطلوب التوثيق', year: '2026' },
        sam: { value: 36000000, description: 'العملاء القابلون للوصول رقمياً داخل السعودية', geoScope: 'السعودية' },
        som: { value: 3600000, description: 'حصة مستهدفة أولية خلال 3 سنوات', sharePct: 10, justification: 'نمو تدريجي عبر الاشتراكات وقوالب المختصين' }
    };
    data[SECTIONS.REVENUE] = {
        streams: [
            { service: 'اشتراك أساسي', type: 'operating', customersPerMonth: 1500, avgPrice: 79, variableCostRate: 0.18, growthRate: 0.22 },
            { service: 'اشتراك احترافي', type: 'operating', customersPerMonth: 300, avgPrice: 249, variableCostRate: 0.20, growthRate: 0.25 },
            { service: 'عمولة قوالب مختصين', type: 'operating', customersPerMonth: 160, avgPrice: 180, variableCostRate: 0.35, growthRate: 0.18 },
            { service: 'مراجعة استشارية مدفوعة', type: 'operating', customersPerMonth: 40, avgPrice: 1800, variableCostRate: 0.45, growthRate: 0.15 }
        ]
    };
    data[SECTIONS.FINANCING] = {
        ...(data[SECTIONS.FINANCING] || {}),
        totalInvestment: 1550000,
        targetDSCR: 1.5,
        sources: {
            ...(data[SECTIONS.FINANCING]?.sources || {}),
            equity: { amount: 700000, percentage: 45.2, description: 'تمويل ذاتي' },
            bankLoan: { amount: 850000, percentage: 54.8, interestRate: 0.085, termYears: 5, gracePeriodMonths: 6, repaymentType: 'equal', bank: '' },
            investors: { amount: 0, percentage: 0, equityShare: 0, preMoneyValuation: 0, postMoneyValuation: 0, investorType: '' },
            governmentSupport: { amount: 0, percentage: 0, program: '' }
        }
    };
    data[SECTIONS.ASSUMPTIONS] = {
        ...(data[SECTIONS.ASSUMPTIONS] || {}),
        discountRate: 0.14,
        inflationRate: 0.03,
        rampUpMonths: 9,
        workingCapitalMonths: 2,
        projectionYears: 5,
        revenueGrowthJustification: 'نمو الاشتراكات تدريجي عبر المحتوى، الشراكات، وتحسن معدل التحويل بعد إثبات المنتج.'
    };
    data[SECTIONS.LEGAL] = {
        ...(data[SECTIONS.LEGAL] || {}),
        legalForm: 'شركة ذات مسؤولية محدودة',
        // تدقيق 2026-07-08 (ملاحظة منخفضة #64): isCapex حقل غير مقروء إطلاقاً في
        // engine.js (كل بنود licenses تُحتسَب رأسمالياً بلا شرط أصلاً) — حُذف كي لا
        // يوحي بتمييز فعلي غير موجود.
        licenses: [
            { name: 'سجل تجاري وتقنية معلومات', quantity: 1, price: 3000, notes: 'تأكيد النشاط مع وزارة التجارة' },
            { name: 'سياسة خصوصية وشروط استخدام', quantity: 1, price: 12000, notes: 'مراجعة قانونية للمنصة والبيانات' }
        ]
    };
    data[SECTIONS.BUSINESS_MODEL] = {
        valueProposition: 'دراسة جدوى رقمية قابلة للمراجعة مع قوالب مختصين بدلاً من قوالب عامة.',
        customerSegments: 'رواد أعمال، مختصون، مكاتب استشارات، حاضنات.',
        channels: 'الموقع، المحتوى، الشراكات، الإحالات، الحملات الرقمية.',
        customerRelationships: 'دعم ذاتي، مراجعات مدفوعة، ومجتمع مختصين.',
        revenueStreams: 'اشتراكات، عمولات قوالب، مراجعات استشارية.',
        keyResources: 'المحرك المالي، قاعدة القوالب، المختصون، الثقة والامتثال.',
        keyActivities: 'تطوير المنصة، مراجعة القوالب، التسويق، دعم العملاء.',
        keyPartners: 'مختصون قطاعيون، حاضنات، مزودو دفع وسحابة.',
        costStructure: 'فريق تقني ومالي، سحابة وAI، تسويق، امتثال ودعم.'
    };
    data[SECTIONS.RISK_ANALYSIS] = {
        risks: [
            { name: 'بطء اكتساب العملاء', type: 'سوقي', probability: 'medium', impact: 'high', estimatedFinancialImpact: 250000, timeHorizon: 'short', mitigation: 'اختبار قنوات اكتساب متعددة وشراكات مع حاضنات', residualRisk: 'medium', earlyWarning: 'ارتفاع CAC أو انخفاض التحويل', owner: 'مدير النمو' },
            { name: 'ضعف موثوقية القوالب', type: 'تشغيلي', probability: 'medium', impact: 'high', estimatedFinancialImpact: 180000, timeHorizon: 'short', mitigation: 'اعتماد واضح ونطاق استخدام ومراجعة مختص', residualRisk: 'medium', earlyWarning: 'شكاوى من اختلاف الأرقام', owner: 'مدير المنتج' },
            { name: 'تكلفة الذكاء الاصطناعي والسحابة', type: 'مالي', probability: 'medium', impact: 'medium', estimatedFinancialImpact: 120000, timeHorizon: 'medium', mitigation: 'حدود استخدام وتسعير باقات يغطي التكلفة المتغيرة', residualRisk: 'low', earlyWarning: 'ارتفاع التكلفة لكل دراسة', owner: 'القائد التقني' }
        ]
    };
    return data;
}

/**
 * تدقيق 2026-07-08 (ملاحظة حرجة، مدير المنتج): لا يوجد أي قالب مطعم فعلي رغم أن
 * دستور المنتج (القسم 10، MVP) يشترطه صراحة — القالب الوحيد المتاح كان SaaS لا مطعماً.
 * الأرقام أدناه (إيجار/عمالة/تكلفة متغيرة) ضُبطت لتقع ضمن نطاقات sectorBenchmarks.js
 * الفعلية لقطاع fnb (تكلفة متغيرة 28-45%، إيجار/مبيعات 8-15%، عمالة/مبيعات 20-32%)
 * وتحقّقت فعلياً عبر calculateStudy الحقيقي (لا نتائج مصطنعة) — الثلاثة تصدر REVISE
 * بسبب واحد فقط: حساسية السيناريو المتشائم (-20% إيراد و+15% تكلفة معاً) — تُركت
 * كما هي عمداً بدل تجميلها، لتكون نقطة انطلاق صادقة لمكتب استشاري/مختص فعلي، لا
 * دراسة "جاهزة للبيع" مموَّهة (نفس المبدأ الذي أفرغ TEMPLATES سابقاً).
 */
function createFastFoodStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = {
        ...data[SECTIONS.PROJECT_INFO],
        name: 'مطعم وجبات سريعة — مسودة مختص',
        description: 'مطعم وجبات سريعة صغير (صالة محدودة + تيك أواي + توصيل) في حي سكني نشط.',
        city: 'الرياض', district: 'النرجس',
        concept: 'مطعم وجبات سريعة',
        businessModel: 'Independent',
        targetCapital: 817700, selfFundingAmount: 367700,
        targetSegment: 'أسر وموظفون في الحي — وجبات سريعة بسعر متوسط',
    };
    data[SECTIONS.TECHNICAL] = {
        ...data[SECTIONS.TECHNICAL],
        establishmentCosts: [
            { name: 'تراخيص وتأسيس', amount: 40000, amortizationRate: 0.20 },
            { name: 'تصميم وهوية بصرية وواجهة', amount: 35000, amortizationRate: 0.20 },
        ],
        equipment: [
            { name: 'معدات مطبخ (قلايات، شوايات، تبريد)', quantity: 1, price: 220000, depreciationRate: 0.15 },
        ],
        furniture: [
            { name: 'طاولات وكراسي ومنطقة انتظار', quantity: 1, price: 70000, depreciationRate: 0.20 },
        ],
        capacityUtilization: [
            { year: 1, rate: 0.60 }, { year: 2, rate: 0.80 }, { year: 3, rate: 0.90 },
        ],
        productionProcessDescription: 'استلام طلب (صالة/تطبيق) → تحضير سريع (2-6 دقائق) → تعبئة → تسليم/توصيل.'
    };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [{ name: 'نظام نقاط بيع POS + ربط تطبيقات توصيل', quantity: 1, price: 15000, depreciationRate: 0.33 }] };
    data[SECTIONS.HR] = {
        ...data[SECTIONS.HR],
        positions: [
            { position: 'مدير فرع', count: 1, salary: 7500, months: 12, nationality: 'saudi' },
            { position: 'طباخ', count: 2, salary: 3800, months: 12, nationality: 'expat' },
            { position: 'كاشير/خدمة عملاء', count: 2, salary: 3200, months: 12, nationality: 'saudi' },
            { position: 'عامل تحضير وتنظيف', count: 1, salary: 2800, months: 12, nationality: 'expat' },
        ],
    };
    data[SECTIONS.ADMINISTRATIVE] = {
        administrative: [
            { name: 'إيجار المحل', monthly: 10000 },
            { name: 'كهرباء وماء', monthly: 2500 },
            { name: 'اتصالات وإنترنت', monthly: 300 },
        ]
    };
    data[SECTIONS.LOGISTICS] = { logistics: [{ name: 'مواد تغليف ومستلزمات توصيل', monthly: 2000, variablePercent: 0.8 }] };
    data[SECTIONS.MARKETING] = {
        ...data[SECTIONS.MARKETING],
        campaigns: [
            { name: 'إطلاق افتتاحي', type: 'capital', amount: 25000, monthly: 0 },
            { name: 'تسويق رقمي شهري', type: 'operating', amount: 0, monthly: 6000 },
        ],
    };
    data[SECTIONS.REVENUE] = {
        streams: [
            { service: 'وجبات صالة وتيك أواي', type: 'operating', customersPerMonth: 3200, avgPrice: 34, variableCostRate: 0.31, growthRate: 0.05 },
            { service: 'توصيل عبر التطبيقات', type: 'operating', customersPerMonth: 1850, avgPrice: 40, variableCostRate: 0.38, growthRate: 0.08 },
        ]
    };
    data[SECTIONS.FINANCING] = {
        ...data[SECTIONS.FINANCING],
        // تدقيق 2026-07-08 (ملاحظة عالية #38 + متوسطة #39): بعد ربط «% متغير» اللوجستيات
        // بالمحرك، ثم إضافة بنود تراخيص شائعة (الغرفة التجارية/ZATCA/اللافتات/الصحية) —
        // الرقم مطابق لـresults.capex.total الحقيقي في كل مرة (تحقّق عبر calculateStudy).
        totalInvestment: 814600, targetDSCR: 1.25,
        sources: {
            ...data[SECTIONS.FINANCING].sources,
            equity: { amount: 367700, percentage: 45.0 },
            bankLoan: { amount: 450000, percentage: 54.9, interestRate: 0.07, termYears: 5, gracePeriodMonths: 3, repaymentType: 'equal' },
        },
    };
    data[SECTIONS.ASSUMPTIONS] = { ...data[SECTIONS.ASSUMPTIONS], discountRate: 0.12, inflationRate: 0.02, projectionYears: 5 };
    data[SECTIONS.LEGAL] = {
        ...data[SECTIONS.LEGAL],
        // تدقيق 2026-07-08 (ملاحظة متوسطة #39): كانت القائمة تقتصر على 4 بنود وتُغفل
        // متطلبات سعودية شائعة — أُضيفت الغرفة التجارية/ZATCA/اللافتات/الشهادة الصحية.
        licenses: [
            { name: 'سجل تجاري', quantity: 1, price: 1200 },
            { name: 'انضمام الغرفة التجارية', quantity: 1, price: 800 },
            { name: 'تسجيل ضريبي/زكوي (ZATCA)', quantity: 1, price: 0 },
            { name: 'رخصة بلدية', quantity: 1, price: 3000 },
            { name: 'رخصة لافتات المحل', quantity: 1, price: 500 },
            { name: 'شهادة الدفاع المدني', quantity: 1, price: 1500 },
            { name: 'رخصة هيئة الغذاء والدواء', quantity: 1, price: 2000 },
            { name: 'شهادة صحية للعاملين', quantity: 1, price: 400 },
        ]
    };
    return data;
}

function createCasualDiningStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = {
        ...data[SECTIONS.PROJECT_INFO],
        name: 'مطعم كاجوال دايننج — مسودة مختص',
        description: 'مطعم صالة كاملة (غداء وعشاء) بخدمة نُدُل، لمنطقة سكنية/تجارية راقية نسبياً.',
        city: 'جدة', district: 'الشاطئ',
        concept: 'مطعم كاجوال دايننج',
        businessModel: 'Independent',
        targetCapital: 2265000, selfFundingAmount: 1000000,
        targetSegment: 'أسر وموظفون يبحثون عن تجربة صالة متوسطة إلى راقية',
    };
    data[SECTIONS.TECHNICAL] = {
        ...data[SECTIONS.TECHNICAL],
        establishmentCosts: [
            { name: 'تراخيص وتأسيس', amount: 60000, amortizationRate: 0.20 },
            { name: 'تصميم داخلي وديكور وهوية', amount: 180000, amortizationRate: 0.20 },
        ],
        equipment: [
            { name: 'معدات مطبخ احترافية (خطوط طهي، تبريد، تهوية)', quantity: 1, price: 520000, depreciationRate: 0.12 },
        ],
        furniture: [
            { name: 'أثاث صالة (طاولات، كراسي، إضاءة، ديكور)', quantity: 1, price: 380000, depreciationRate: 0.15 },
        ],
        capacityUtilization: [
            { year: 1, rate: 0.55 }, { year: 2, rate: 0.75 }, { year: 3, rate: 0.88 },
        ],
        productionProcessDescription: 'استقبال/حجز → طلب على الطاولة → تحضير في المطبخ → تقديم عبر النادل → محاسبة.'
    };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [{ name: 'نظام نقاط بيع + حجوزات + إدارة مطبخ', quantity: 1, price: 35000, depreciationRate: 0.25 }] };
    data[SECTIONS.HR] = {
        ...data[SECTIONS.HR],
        positions: [
            { position: 'مدير مطعم', count: 1, salary: 12000, months: 12, nationality: 'saudi' },
            { position: 'رئيس طهاة (Head Chef)', count: 1, salary: 14000, months: 12, nationality: 'expat' },
            { position: 'طباخ', count: 3, salary: 4200, months: 12, nationality: 'expat' },
            { position: 'نادل/خدمة صالة', count: 5, salary: 3400, months: 12, nationality: 'saudi' },
            { position: 'مضيف/كاشير', count: 2, salary: 3200, months: 12, nationality: 'saudi' },
            { position: 'عامل تنظيف وغسيل أواني', count: 2, salary: 2700, months: 12, nationality: 'expat' },
        ],
    };
    data[SECTIONS.ADMINISTRATIVE] = {
        administrative: [
            { name: 'إيجار المحل', monthly: 25000 },
            { name: 'كهرباء وماء وغاز', monthly: 7000 },
            { name: 'اتصالات وإنترنت وأنظمة', monthly: 800 },
        ]
    };
    data[SECTIONS.LOGISTICS] = { logistics: [{ name: 'توريد مواد غذائية وتخزين', monthly: 3000, variablePercent: 0.7 }] };
    data[SECTIONS.MARKETING] = {
        ...data[SECTIONS.MARKETING],
        campaigns: [
            { name: 'إطلاق افتتاحي وتصوير احترافي', type: 'capital', amount: 60000, monthly: 0 },
            { name: 'تسويق رقمي وشراكات مؤثرين', type: 'operating', amount: 0, monthly: 15000 },
        ],
    };
    data[SECTIONS.REVENUE] = {
        streams: [
            { service: 'صالة (غداء وعشاء)', type: 'operating', customersPerMonth: 3800, avgPrice: 95, variableCostRate: 0.32, growthRate: 0.05 },
            { service: 'توصيل وطلبات خارجية', type: 'operating', customersPerMonth: 900, avgPrice: 110, variableCostRate: 0.40, growthRate: 0.10 },
        ]
    };
    data[SECTIONS.FINANCING] = {
        ...data[SECTIONS.FINANCING],
        // تدقيق 2026-07-08 (وجده التحقق العدائي، محدَّث بعد #38 و#39): totalInvestment
        // مطابق لـresults.capex.total الفعلي (تحقّق عبر calculateStudy مباشرة، لا تقدير
        // يدوي) — يتغيّر كلما تغيّر منطق رأس المال العامل أو بنود التراخيص.
        totalInvestment: 2260700, targetDSCR: 1.25,
        sources: {
            ...data[SECTIONS.FINANCING].sources,
            equity: { amount: 1000000, percentage: 44.1 },
            bankLoan: { amount: 1265000, percentage: 55.9, interestRate: 0.075, termYears: 7, gracePeriodMonths: 6, repaymentType: 'equal' },
        },
    };
    data[SECTIONS.ASSUMPTIONS] = { ...data[SECTIONS.ASSUMPTIONS], discountRate: 0.13, inflationRate: 0.02, projectionYears: 5 };
    data[SECTIONS.LEGAL] = {
        ...data[SECTIONS.LEGAL],
        // تدقيق 2026-07-08 (ملاحظة متوسطة #39): كانت القائمة تقتصر على 4 بنود وتُغفل
        // متطلبات سعودية شائعة — أُضيفت الغرفة التجارية/ZATCA/اللافتات/الشهادة الصحية.
        licenses: [
            { name: 'سجل تجاري', quantity: 1, price: 1200 },
            { name: 'انضمام الغرفة التجارية', quantity: 1, price: 800 },
            { name: 'تسجيل ضريبي/زكوي (ZATCA)', quantity: 1, price: 0 },
            { name: 'رخصة بلدية (مطعم صالة)', quantity: 1, price: 5000 },
            { name: 'رخصة لافتات المحل', quantity: 1, price: 700 },
            { name: 'شهادة الدفاع المدني', quantity: 1, price: 2500 },
            { name: 'رخصة هيئة الغذاء والدواء', quantity: 1, price: 2000 },
            { name: 'شهادة صحية للعاملين', quantity: 1, price: 600 },
        ]
    };
    return data;
}

function createCloudKitchenStudy() {
    const data = createEmptyStudy();
    data[SECTIONS.PROJECT_INFO] = {
        ...data[SECTIONS.PROJECT_INFO],
        name: 'مطبخ سحابي (علامتان للتوصيل) — مسودة مختص',
        description: 'وحدة إنتاج بلا صالة عملاء، تشغّل علامتين تجاريتين للتوصيل عبر تطبيقات الطلب فقط.',
        city: 'الدمام', district: 'الصناعية الثانية',
        concept: 'مطبخ سحابي',
        businessModel: 'Independent',
        targetCapital: 737000, selfFundingAmount: 412000,
        targetSegment: 'عملاء تطبيقات التوصيل (لا صالة) في نطاق 3-5 كم',
    };
    data[SECTIONS.TECHNICAL] = {
        ...data[SECTIONS.TECHNICAL],
        establishmentCosts: [
            { name: 'تراخيص وتأسيس', amount: 25000, amortizationRate: 0.20 },
            { name: 'هوية بصرية وتصوير المنتج للتطبيقات', amount: 20000, amortizationRate: 0.20 },
        ],
        equipment: [
            { name: 'معدات مطبخ إنتاج مضغوط (بلا صالة)', quantity: 1, price: 165000, depreciationRate: 0.15 },
        ],
        furniture: [
            { name: 'أرفف تخزين وتجهيز خلفي', quantity: 1, price: 20000, depreciationRate: 0.20 },
        ],
        capacityUtilization: [
            { year: 1, rate: 0.65 }, { year: 2, rate: 0.85 }, { year: 3, rate: 0.95 },
        ],
        productionProcessDescription: 'استلام طلب من تطبيق → تحضير → تعبئة توصيل مخصصة → تسليم لمندوب التطبيق.'
    };
    data[SECTIONS.TECH_RESOURCES] = { techResources: [{ name: 'أنظمة إدارة طلبات متعددة المنصات', quantity: 1, price: 18000, depreciationRate: 0.33 }] };
    data[SECTIONS.HR] = {
        ...data[SECTIONS.HR],
        positions: [
            { position: 'مشرف مطبخ', count: 1, salary: 6500, months: 12, nationality: 'saudi' },
            { position: 'طباخ', count: 3, salary: 3600, months: 12, nationality: 'expat' },
            { position: 'مسؤول تعبئة وتغليف طلبات', count: 2, salary: 2800, months: 12, nationality: 'expat' },
        ],
    };
    data[SECTIONS.ADMINISTRATIVE] = {
        administrative: [
            { name: 'إيجار وحدة إنتاج (بلا صالة عملاء)', monthly: 8000 },
            { name: 'كهرباء وماء', monthly: 3000 },
            { name: 'اتصالات وإنترنت', monthly: 400 },
        ]
    };
    data[SECTIONS.LOGISTICS] = { logistics: [{ name: 'تغليف مخصص للتوصيل', monthly: 4000, variablePercent: 0.9 }] };
    data[SECTIONS.MARKETING] = {
        ...data[SECTIONS.MARKETING],
        campaigns: [
            { name: 'إطلاق العلامتين على التطبيقات', type: 'capital', amount: 15000, monthly: 0 },
            { name: 'إعلانات داخل تطبيقات التوصيل', type: 'operating', amount: 0, monthly: 8000 },
        ],
    };
    // مطبخ سحابي: 100% توصيل — عمولة التطبيقات (~25-30%) مضمّنة ضمن variableCostRate
    data[SECTIONS.REVENUE] = {
        streams: [
            { service: 'علامة 1 — توصيل عبر التطبيقات', type: 'operating', customersPerMonth: 2600, avgPrice: 46, variableCostRate: 0.42, growthRate: 0.10 },
            { service: 'علامة 2 — توصيل عبر التطبيقات', type: 'operating', customersPerMonth: 1700, avgPrice: 43, variableCostRate: 0.42, growthRate: 0.10 },
        ]
    };
    data[SECTIONS.FINANCING] = {
        ...data[SECTIONS.FINANCING],
        // تدقيق 2026-07-08 (ملاحظة عالية #38 + متوسطة #39): مطابق لـresults.capex.total
        // الفعلي (انظر ملاحظة createFastFoodStudy أعلاه).
        totalInvestment: 727560, targetDSCR: 1.25,
        sources: {
            ...data[SECTIONS.FINANCING].sources,
            equity: { amount: 412000, percentage: 55.9 },
            bankLoan: { amount: 325000, percentage: 44.1, interestRate: 0.07, termYears: 6, gracePeriodMonths: 6, repaymentType: 'equal' },
        },
    };
    data[SECTIONS.ASSUMPTIONS] = { ...data[SECTIONS.ASSUMPTIONS], discountRate: 0.12, inflationRate: 0.02, projectionYears: 5 };
    data[SECTIONS.LEGAL] = {
        ...data[SECTIONS.LEGAL],
        // تدقيق 2026-07-08 (ملاحظة متوسطة #39): كانت القائمة تقتصر على 4 بنود وتُغفل
        // متطلبات سعودية شائعة — أُضيفت الغرفة التجارية/ZATCA/اللافتات/الشهادة الصحية.
        licenses: [
            { name: 'سجل تجاري', quantity: 1, price: 1200 },
            { name: 'انضمام الغرفة التجارية', quantity: 1, price: 800 },
            { name: 'تسجيل ضريبي/زكوي (ZATCA)', quantity: 1, price: 0 },
            { name: 'رخصة بلدية (مطبخ إنتاجي)', quantity: 1, price: 3000 },
            { name: 'رخصة لافتات المحل', quantity: 1, price: 400 },
            { name: 'شهادة الدفاع المدني', quantity: 1, price: 1500 },
            { name: 'رخصة هيئة الغذاء والدواء', quantity: 1, price: 2000 },
            { name: 'شهادة صحية للعاملين', quantity: 1, price: 400 },
        ]
    };
    return data;
}

export const EXPERT_TEMPLATE_PRESETS = [
    {
        id: 'restaurant_fast_food',
        title: 'مسودة مختص: مطعم وجبات سريعة',
        specialty: 'مطاعم الوجبات السريعة (صالة محدودة + تيك أواي + توصيل)',
        expertName: 'مسودة إعداد للمختص',
        yearsExperience: 0,
        priceLabel: 'يُحدد بعد مراجعة المختص',
        scope: 'مطعم وجبات سريعة صغير بصالة محدودة، اعتماد رئيسي على تيك أواي والتوصيل. الأرقام ضمن نطاقات القطاع القياسية لكن هامش الأمان تحت السيناريو المتشائم يحتاج مراجعة قبل عرضها على ممول.',
        reviewNotes: 'مسودة قابلة للاستخدام كنقطة انطلاق فقط — القرار الأساسي إيجابي لكنه REVISE تحت السيناريو المتشائم (-20% إيراد و+15% تكلفة معاً). راجع هامش الأمان (سعر البيع، تكلفة الطعام، أو رأس المال العامل) قبل اعتماده كدراسة نهائية.',
        buildData: createFastFoodStudy
    },
    {
        id: 'restaurant_casual_dining',
        title: 'مسودة مختص: مطعم كاجوال دايننج',
        specialty: 'مطاعم الصالة الكاملة (كاجوال دايننج)',
        expertName: 'مسودة إعداد للمختص',
        yearsExperience: 0,
        priceLabel: 'يُحدد بعد مراجعة المختص',
        scope: 'مطعم صالة كاملة بخدمة نُدُل، استثمار وتشغيل أكبر من الوجبات السريعة. نفس ملاحظة هامش الأمان تحت السيناريو المتشائم تنطبق هنا أيضاً.',
        reviewNotes: 'مسودة قابلة للاستخدام كنقطة انطلاق فقط — القرار الأساسي إيجابي وقوي (EBITDA صحي) لكنه REVISE تحت السيناريو المتشائم. راجع هامش الأمان قبل اعتماده كدراسة نهائية.',
        buildData: createCasualDiningStudy
    },
    {
        id: 'restaurant_cloud_kitchen',
        title: 'مسودة مختص: مطبخ سحابي (توصيل فقط)',
        specialty: 'مطابخ سحابية / علامات توصيل بلا صالة عملاء',
        expertName: 'مسودة إعداد للمختص',
        yearsExperience: 0,
        priceLabel: 'يُحدد بعد مراجعة المختص',
        scope: 'وحدة إنتاج بلا صالة، تشغّل أكثر من علامة تجارية للتوصيل فقط. استثمار أقل من الصالة الكاملة، لكن الاعتماد الكامل على عمولات تطبيقات التوصيل يرفع نسبة التكلفة المتغيرة.',
        reviewNotes: 'مسودة قابلة للاستخدام كنقطة انطلاق فقط — القرار الأساسي إيجابي لكنه REVISE تحت السيناريو المتشائم. راجع عمولات التطبيقات المفترضة وهامش الأمان قبل اعتماده كدراسة نهائية.',
        buildData: createCloudKitchenStudy
    },
    {
        id: 'saas_feasibility_platform',
        title: 'مسودة مختص: منصة SaaS / موقع دراسة جدوى',
        specialty: 'منصات SaaS وخدمات دراسات الجدوى',
        expertName: 'مسودة إعداد للمختص',
        yearsExperience: 0,
        priceLabel: 'يُحدد بعد مراجعة المختص',
        scope: 'هيكل مبدئي لمنصة SaaS تبيع اشتراكات وقوالب مختصين ومراجعات استشارية. يحتاج مراجعة أسعار واكتساب عملاء قبل اعتماده. (قطاع مساند خارج المطاعم — انظر قرار توسيع النطاق في PRODUCT_CONSTITUTION.md.)',
        reviewNotes: 'هذه ليست دراسة جاهزة للبيع؛ استخدمها كبداية ثم احفظها كقالب مختص بعد مراجعة خبير فعلي.',
        buildData: createSaasFeasibilityPlatformStudy
    }
];

function readRawTemplates() {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.warn('[ExpertTemplateService] Failed to read templates:', err);
        return [];
    }
}

function writeRawTemplates(templates) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('qarar:expert-templates-updated'));
    }
}

function normalizeTemplate(template) {
    const now = new Date().toISOString();
    return {
        id: text(template.id) || crypto.randomUUID(),
        title: text(template.title),
        expertName: text(template.expertName),
        specialty: text(template.specialty),
        yearsExperience: numberOrZero(template.yearsExperience),
        scope: text(template.scope),
        priceLabel: text(template.priceLabel),
        consultationUrl: urlOrBlank(template.consultationUrl),
        reviewNotes: text(template.reviewNotes),
        certification: template.certification || null,
        status: template.status === 'draft' ? 'draft' : 'approved',
        createdAt: text(template.createdAt) || now,
        updatedAt: text(template.updatedAt) || now,
        data: clone(template.data) || {}
    };
}

function prepareTemplateData(studyData, meta) {
    const data = clone(studyData || createEmptyStudy());
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    data.projectInfo = {
        ...(data.projectInfo || {}),
        deleted: false,
        deletedAt: null,
        status: 'draft',
        members: [],
        name: data.projectInfo?.name || meta.title,
        clientName: '',
        preparedBy: meta.expertName || data.projectInfo?.preparedBy || ''
    };
    delete data.projectInfo.id;
    delete data.projectInfo.folderId;

    return data;
}

export function getExpertTemplates() {
    return readRawTemplates()
        .map(normalizeTemplate)
        .filter(t => t.title && t.expertName && t.data && typeof t.data === 'object')
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getExpertTemplatePresets() {
    return EXPERT_TEMPLATE_PRESETS.map(p => ({
        id: p.id,
        title: p.title,
        expertName: p.expertName,
        specialty: p.specialty,
        yearsExperience: p.yearsExperience,
        priceLabel: p.priceLabel,
        scope: p.scope,
        reviewNotes: p.reviewNotes
    }));
}

export function saveExpertTemplate(meta, studyData) {
    const title = text(meta?.title);
    const expertName = text(meta?.expertName);
    const specialty = text(meta?.specialty);

    if (!title) throw new Error('اكتب اسم القالب.');
    if (!expertName) throw new Error('اكتب اسم المختص.');
    if (!specialty) throw new Error('اكتب تخصص القالب أو القطاع.');
    const certification = validateExpertTemplateCertification({ ...meta, title, expertName, specialty }, studyData);
    if (!certification.canPublish) {
        throw new Error(certification.blockers[0] || 'القالب لا يحقق شروط الاعتماد.');
    }

    const existing = readRawTemplates();
    const id = text(meta?.id) || crypto.randomUUID();
    const old = existing.find(t => t.id === id);
    const template = normalizeTemplate({
        ...old,
        ...meta,
        id,
        updatedAt: new Date().toISOString(),
        title,
        expertName,
        specialty,
        certification,
        data: prepareTemplateData(studyData, { title, expertName })
    });

    const next = [template, ...existing.filter(t => t.id !== id)];
    writeRawTemplates(next);
    return template;
}

export function deleteExpertTemplate(id) {
    const target = text(id);
    if (!target) return;
    writeRawTemplates(readRawTemplates().filter(t => t.id !== target));
}

export function applyExpertTemplate(store, template) {
    if (!store || !template?.data) return null;

    const now = new Date().toISOString();
    const base = createEmptyStudy();
    const data = clone(template.data);
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    const merged = store.mergeWithDefaults
        ? store.mergeWithDefaults(data)
        : { ...base, ...data };

    merged.id = crypto.randomUUID();
    merged.createdAt = now;
    merged.updatedAt = now;
    merged.projectInfo = {
        ...(merged.projectInfo || {}),
        folderId: null,
        deleted: false,
        deletedAt: null,
        status: 'draft',
        members: [],
        clientName: '',
        preparedBy: merged.projectInfo?.preparedBy || template.expertName || ''
    };
    delete merged.projectInfo.id;

    store.set(merged);
    return merged;
}

export function applyExpertTemplatePreset(store, presetId) {
    const preset = EXPERT_TEMPLATE_PRESETS.find(p => p.id === text(presetId));
    if (!preset || !store) return null;

    const data = preset.buildData();
    const merged = store.mergeWithDefaults
        ? store.mergeWithDefaults(data)
        : { ...createEmptyStudy(), ...data };

    merged.id = crypto.randomUUID();
    merged.createdAt = new Date().toISOString();
    merged.updatedAt = merged.createdAt;
    merged.projectInfo = {
        ...(merged.projectInfo || {}),
        clientName: '',
        preparedBy: '',
        status: 'draft',
        members: [],
        folderId: null,
        expertTemplatePresetId: preset.id,
        expertTemplatePresetNotice: preset.reviewNotes
    };
    delete merged.projectInfo.id;

    store.set(merged);
    return { preset: getExpertTemplatePresets().find(p => p.id === preset.id), data: merged };
}

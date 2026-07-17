/**
 * Restaurant Feasibility Study Model (Schema) - Full Integrated Edition
 * Based on comprehensive feasibility study standards with connected tables
 */

// حصة صاحب العمل في التأمينات الاجتماعية (GOSI) للسعودي — النظام الجديد (3 يوليو 2024)
// يرفع نسبة المشترك الجديد تدريجياً؛ مشروع جديد كل موظفيه «مشتركون جدد» ⇒ ~12.75% في 2026.
// تدقيق 2026-07-08: كان هذا الرقم مكرراً بقيمتين متضاربتين (0.1175 هنا و0.1275 في
// engine.js) رغم تعليق يدّعي التطابق — ثابت واحد مُصدَّر الآن يستورده كل من هذا
// الملف (كقيمة افتراضية) وengine.js (كحساب فعلي)، بدل نسخة محلية بكل ملف.
export const SAUDI_GOSI_RATE_2026 = 0.1275;

// تدقيق 2026-07-09: كانت نسب سيناريو "متفائل/متشائم" الافتراضية (تُستخدم متى لم
// يُعدِّلها المستخدم بعد) معرَّفة بقيم متضاربة في ملفات مختلفة تقرأ نفس الحقل
// state.scenarios.optimistic (schema.js: 0.25/-0.10، ScenarioSwitcher.js وFinancialDashboard.js:
// 0.15/-0.05) — فيرى المستخدم أرقام NPV مختلفة لنفس السيناريو غير المُعدَّل حسب
// الشاشة التي يفتحها. ثابت واحد مُصدَّر هنا (مصدر الحقيقة: createEmptyStudy أدناه)
// تستورده كل الشاشات بدل نسخ محلية.
export const DEFAULT_SCENARIOS = {
    pessimistic: { revenueChange: -0.20, costChange: 0.15 },
    base: { revenueChange: 0, costChange: 0 },
    optimistic: { revenueChange: 0.25, costChange: -0.10 }
};

export const SECTIONS = {
    PROJECT_INFO: 'projectInfo',
    KEY_PEOPLE: 'keyPeople', // المرحلة الأولى: الأشخاص الرئيسون (الفريق المؤسس)
    TECHNICAL: 'technical',
    HR: 'hr',
    TECH_RESOURCES: 'techResources',
    LOGISTICS: 'logistics',
    ADMINISTRATIVE: 'administrative',
    LEGAL: 'legal',
    MARKETING: 'marketing',
    REVENUE: 'revenue',
    SERVICES: 'services',
    ASSUMPTIONS: 'assumptions',
    // التحليلات الاستراتيجية
    STRATEGIC: 'strategic',
    MARKET_SIZING: 'marketSizing',
    RISK_ANALYSIS: 'riskAnalysis',
    SCENARIOS: 'scenarios',
    // التوصيات الجديدة (UNIDO + المنافسين)
    FINANCING: 'financing',
    ORG_STRUCTURE: 'orgStructure',
    SMART_GOALS: 'smartGoals',
    EXECUTIVE_SUMMARY: 'executiveSummary',
    // الأقسام المالية والقرار الجديدة
    FINANCIAL_STATEMENTS: 'financialStatements',
    ZAKAT_TAX: 'zakatTax',
    BREAK_EVEN: 'breakEven',
    DECISION_DASHBOARD: 'decisionDashboard',
    BUSINESS_MODEL: 'businessModel',
    TIMELINE: 'timeline',
    MONTE_CARLO: 'monteCarlo',
    VALUATION: 'valuation',
    OPERATIONAL: 'operational',
    ACTUALS: 'actuals',
    APPENDICES: 'appendices'
};

/** ترتيب أقسام التقرير الافتراضي (بناء التقرير — السحب والإفلات) */
export const DEFAULT_REPORT_SECTION_ORDER = [
    'executive_summary',
    'preliminary',
    'project_alternatives',
    'project_info',
    'market',
    'intro_feasibility',
    'marketing',
    'financial_kpis',
    'swot',
    'pestel',
    'porter',
    'tows',
    'partner_needs',
    'capex',
    'income_statement',
    'cash_flow',
    'loan_schedule',
    'balance_sheet',
    'business_model',
    'org_structure',
    'risks',
    'scenarios',
    'sensitivity',
    'recommendation'
];

export function createEmptyStudy() {
    return {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: "4.0.0",

        // الدراسة المبدئية (اختيارية): 3–5 أسئلة قبل التفصيل
        preliminaryCheck: {
            isProjectFeasible: "",      // هل المشروع ممكن تنفيذه؟
            suitableForEnvironment: "", // هل المشروع مناسب للبيئة؟
            hasInitialResources: "",    // هل لديك موارد أولية (مال، خبرة، شبكة)؟
            readyForDetailedStudy: ""   // هل أنت جاهز للدراسة التفصيلية؟
        },

        // مرحلة اختيار المشروع قبل التفصيل (د. الروضي): مقارنة أفكار مبدئية
        projectAlternatives: {
            ideas: [
                // { name: '', estimatedCost: 0, estimatedReturn: 0, notes: '' }
            ],
            selectedIndex: 0
        },

        // ═══════════════════════════════════════════════════════════
        // 0️⃣ بيانات المشروع الأساسية
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.PROJECT_INFO]: {
            name: "",
            description: "",
            // لا تُفترض "الرياض" صامتاً: كانت كل دراسة جديدة تُحسب مبدئياً على إيجارات/رواتب
            // الرياض (الأعلى بين المدن) حتى يتذكّر المستخدم تغييرها؛ فارغة تجبره على
            // اختيار واعٍ (getCityStats في SaudiCityStats.js تتعامل مع القيمة الفارغة
            // كأي مدينة غير مدرجة وتستخدم متوسطات 'default' الآمنة).
            city: "",
            district: "",
            concept: "",
            // نموذج العمل: Independent أو Franchise
            businessModel: "Independent",
            // تفاصيل الامتياز (في حالة اختياره)
            franchiseDetails: {
                entryFee: 0,       // رسوم الامتياز (تأسيس)
                royaltyRate: 0,    // نسبة الإتاوة (% من المبيعات)
                marketingFee: 0    // نسبة التسويق (% من المبيعات)
            },
            areaSize: 0,
            timeline: {
                projectStart: "",
                operationStart: "",
                constructionMonths: 6
            },
            // معايير صياغة فكرة المشروع (التقييم الأولي)
            ideaCriteria: {
                feasibility: "",
                uniqueness: "",
                marketFit: "",
                resourceAvailability: ""
            },
            // مقدمة موحدة: الهوية، القيمة، المنتجات، الخدمات، القيمة للعميل
            identityStatement: "",
            valueProposition: "",
            // المنتجات: أولي/نصف مصنع/نهائي، اسم، وصف، خصائص فريدة، قيمة مضافة، فائدة للعميل
            products: [],
            // الخدمات في المقدمة: أساسية/داعمة/ثانوية
            introServices: [],
            // القيمة لكل شريحة عميل (تُستخدم في التسويق والدراسة الفنية)
            customerValues: [],
            // تعريف المصطلحات والرموز (المقدمة)
            glossary: [],
            // تحليل الموقع + الجغرافي المكاني
            locationAnalysis: {
                selectionFactors: "",
                alternativesComparison: "",
                chosenReason: "",
                coordinates: { lat: null, lng: null },
                address: "",
                locationAlternatives: []
            },
            // قائمة خطوات جمع المعلومات (زيارات ميدانية)
            dataGatheringChecklist: [
                { step: "بحث أونلاين (خرائط جوجل، حراج، بيانات حكومية، حسابات المنافسين)", done: false, notes: "" },
                { step: "زيارة منافسين", done: false, notes: "" },
                { step: "زيارة جهات حكومية (تراخيص)", done: false, notes: "" },
                { step: "زيارة جهات تمويل", done: false, notes: "" }
            ],
            // ملف المستثمر (د. الروضي): conservative | speculator | balanced
            investorProfile: "",
            // المؤهل العكسي (حسين بكري): فكرة + خبرة ⇄ أموال مطلوبة
            inverseQualification: { ideaStrength: "", experienceLevel: "" },
            // أهمية للاقتصاد/الأمن القومي (د. الروضي)
            nationalEconomicImportance: "",
            // مدى استفادة المشروع من التكنولوجيا (د. الروضي): low | medium | high
            techInvestmentLevel: "",
            // ═══ تقييم الفرضية (YC / أفكار الستارت آب) ═══
            // فرضية النمو: مشكلة → حل → استبصار (لماذا نربح)
            startupHypothesis: {
                problem: "",   // الظروف الأولية: ما المشكلة؟ لمن؟
                solution: "",  // ما الحل/التجربة التي نجرّبها؟
                insight: ""    // لماذا سنربح؟ (الاستبصار / الميزة غير العادلة)
            },
            // قائمة تحقق جودة المشكلة: شائع، نامٍ، عاجل، مكلف، إلزامي، متكرر
            problemQualityChecklist: {
                popular: false,   // كثيرون يعانونها
                growing: false,   // السوق/المشكلة نامية
                urgent: false,    // تحتاج حلاً عاجلاً
                expensive: false, // مكلفة (فرصة لتحصيل قيمة)
                mandatory: false, // إلزامية (قانون/تنظيم يفرض حلها)
                frequent: false   // متكررة (فرص تحويل متعددة)
            },
            // لماذا سنربح — المزايا غير العادلة (واحد على الأقل)
            unfairAdvantage: {
                types: [],        // ['founder'|'market'|'product10x'|'acquisition'|'network']
                insightText: ""   // شرح موجز للاستبصار
            },
            // تقييم الفكرة (Section 44–50 / YC Startup School) — اختياري، ربط الجدوى بمعايير الستارت آب
            ideaAssessment: {
                problem: "",       // ما المشكلة؟ لمن؟
                solution: "",      // ما الحل؟
                whyUs: "",         // لماذا أنتم؟
                marketSize: "",    // حجم السوق
                competitiveAdvantage: ""  // الميزة التنافسية
            }
        },
        // رابط حجز استشارة (Calendly/Cal.com) — يُعدّل من config إن لزم
        consultationBookingUrl: "",

        // ═══════════════════════════════════════════════════════════
        // 0️⃣١ الأشخاص الرئيسون (المرحلة الأولى - مقدمة الجدوى)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.KEY_PEOPLE]: {
            keyPeople: [
                // { name: "", role: "", experience: "", qualifications: "" }
            ],
            partnershipContracts: [
                // { partnerName: "", role: "", sharePercent: 0, notes: "" }
            ]
        },

        // ═══════════════════════════════════════════════════════════
        // 1️⃣ الدراسة الفنية - يغذي CAPEX
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.TECHNICAL]: {
            // نفقات التأسيس (مرة واحدة — تُطفأ على السنوات)
            establishmentCosts: [
                // { name: "دراسة الجدوى", amount: 5000, amortizationRate: 0.20 }
            ],
            // جدول المباني والإنشاءات
            buildings: [
                // { name: "تشطيب داخلي", quantity: 1, price: 0, depreciationRate: 0.05, notes: "" }
            ],
            // جدول المعدات والأجهزة
            equipment: [
                // { name: "معدات رياضية", quantity: 1, price: 0, depreciationRate: 0.15, notes: "" }
            ],
            // جدول الأثاث
            furniture: [
                // { name: "أثاث مكتبي", quantity: 1, price: 0, depreciationRate: 0.20, notes: "" }
            ],
            // وصف العملية الإنتاجية/التشغيلية
            productionProcessDescription: "",
            // الطاقة الإنتاجية وربطها بالسوق
            productionCapacity: {
                annualCapacity: 0,
                unitOrMeasure: "",
                marketShareLink: ""
            },
            // جدول تدرج الطاقة الإنتاجية (سنوات التشغيل)
            capacityUtilization: [
                // { year: 1, rate: 0.50, notes: "سنة الافتتاح والتجربة" }
                // { year: 2, rate: 0.75, notes: "النمو والتوسع" }
                // { year: 3, rate: 0.90, notes: "الاستقرار" }
            ],
            // تقييم الموقع
            locationAssessment: [
                // { factor: "الكثافة السكانية", rating: 5, notes: "" }
                // { factor: "الكثافة السكانية", rating: 5, notes: "" }
            ],
            // المواد المستهلكة (تشغيلي)
            consumables: [
                // { name: "قرطاسية", monthlyCost: 500, notes: "" }
            ],
            // وسائل النقل (أصول)
            vehicles: [
                // { name: "سيارة توصيل", quantity: 1, price: 50000, depreciationRate: 0.20, notes: "" }
            ],
            // نموذج الطاقة القصوى (مصالحة الطاقة): سقف مادي للمبيعات —
            // المحرك يرفض إيراداً يتطلب عملاء أكثر مما تسمح به الطاقة
            capacityModel: [
                // { seats: 40, turnsPerDay: 4, daysPerMonth: 26, notes: "" }
            ],
            // تقييم المختص الفني (الفجوة المعيارية)
            technicalSpecialistEvaluation: {
                specialistName: '',
                date: '',
                adequacyOfNeeds: '',
                equipmentQuality: '',
                staffAdequacy: '',
                costRevenueAssessment: '',
                materialsAssessment: '',
                otherComments: '',
                recommendations: ''
            },
            // Transcript 8: Environmental Classification
            environmentalClass: "Grey", // Green, Grey, Black_List
            environmentalMitigationCost: 0 // تكلفة معالجة الأثر البيئي للمشاريع الرمادية
        },

        // ═══════════════════════════════════════════════════════════
        // 2️⃣ الموارد البشرية - يغذي OPEX
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.HR]: {
            positions: [
                // { position: "مدير العمليات", count: 1, months: 12, salary: 15000, nationality: "saudi", isVariable: false }
            ],
            gosiRate: SAUDI_GOSI_RATE_2026, // ~12.75% في 2026 (النظام الجديد) — قابل للتعديل من المستخدم
            healthInsurancePerHead: 1500, // Average Market Rate
            govtFees: {
                workCard: 9600, // المقابل المالي السنوي
                visa: 2000,     // رسوم الاستقدام (مرة واحدة - CAPEX or Amortized?) usually Cash Out
                ticket: 2500,   // تذاكر طيران سنوية
                iqama: 650      // رسوم تجديد الإقامة
            }
        },

        // ═══════════════════════════════════════════════════════════
        // 3️⃣ الموارد التقنية - يغذي CAPEX
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.TECH_RESOURCES]: {
            techResources: [
                // { name: "سيرفرات استضافة", quantity: 1, price: 75000, depreciationRate: 0.33, notes: "" }
            ]
        },

        // ═══════════════════════════════════════════════════════════
        // 4️⃣ الموارد اللوجستية - يغذي OPEX
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.LOGISTICS]: {
            // تدقيق 2026-07-09: الخطوة كانت تبدأ فارغة تماماً (سطر معلَّق كمثال فقط) بخلاف
            // ADMINISTRATIVE المجاورة التي حصلت على صف افتراضي ظاهر — صف افتراضي واحد
            // (monthly:0، لا رقم مُختلَق) يوضح للمستخدم المبتدئ ما يُتوقع إدخاله هنا
            // (توصيل/نقل مطعم) دون حقن أي تكلفة صامتة في المحرك.
            // تدقيق دفعة 3 (اختبار عميل بقالة 2026-07-12): «كهرباء ومياه» كانت تُقترح فقط
            // عبر زر التوليد الذكي (generateLogistics) دون أي صف افتراضي ظاهر عند فتح
            // الخطوة أول مرة، رغم أنها أحد أكبر بنود التشغيل الثابتة لأي منشأة فعلية
            // (تبريد/تكييف خصوصاً في تجزئة الأغذية) — صف ظاهر بلا رقم مُختلَق (monthly:0)
            // يجعلها أول ما يُطلب تعبئته بدل أن يتخطاها المستخدم المبتدئ كلياً.
            logistics: [
                { name: 'التوصيل والنقل (منصات التوصيل/نقل مبرّد)', monthly: 0, variablePercent: 0.5, notes: '' },
                { name: 'كهرباء ومياه (تبريد/تكييف)', monthly: 0, variablePercent: 0.30, notes: '' }
            ]
        },

        // ═══════════════════════════════════════════════════════════
        // 5️⃣ الموارد الإدارية - يغذي OPEX
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.ADMINISTRATIVE]: {
            // تدقيق 2026-07-08 (ملاحظة حرجة محتوى): لا حقل مستقل لإيجار موقع المطعم في
            // كامل المخطط، وشرح هذه الخطوة كان يصفها بـ"إيجار مكتب" فقط — يوحي بعدم
            // انطباقها على صالة/مطبخ المطعم نفسه (أكبر بند تكلفة ثابتة عادة)، فقد يتخطاه
            // المستخدم المبتدئ بالكامل. صف افتراضي ظاهر (monthly:0، لا رقم مُختلَق) يجعل
            // إيجار المحل أول ما يُطلب إدخاله، دون حقن أي تكلفة صامتة.
            administrative: [
                { name: 'إيجار المحل (الصالة/المطبخ)', monthly: 0, notes: '' }
            ]
        },

        // ═══════════════════════════════════════════════════════════
        // 6️⃣ الدراسة القانونية - يغذي CAPEX
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.LEGAL]: {
            // لا افتراض صامت: كل دراسة جديدة كانت تُفعَّل تلقائياً بـ"شركة ذات مسؤولية
            // محدودة" (LLC) حتى لمشروع فردي صغير (محل خضار مثلاً) قد تناسبه "مؤسسة
            // فردية" أرخص وأسرع تأسيساً — يُترك فارغاً ليختار المستخدم عن وعي (القائمة
            // في LegalStudy.js تعرض "اختر الشكل القانوني" أصلاً حين تكون القيمة فارغة).
            legalForm: "",
            licenses: [
                // { name: "سجل تجاري", quantity: 1, price: 2000, notes: "" }
            ]
        },

        // ═══════════════════════════════════════════════════════════
        // 7️⃣ الدراسة التسويقية - يغذي CAPEX و OPEX
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.MARKETING]: {
            // تحليل السوق
            marketAnalysis: {
                marketSize: 0,
                growthRate: 0,
                trends: "",
                // نوع الفجوة السوقية: Quantity, Time, Place, Quality, Value
                marketGap: "",
                // استراتيجية التسعير: Cost-Plus, Value-Based, Penetration, Skimming
                pricingStrategy: "",
                // بيانات الطلب التاريخية (لآخر 5 سنوات)
                historicalData: [
                    // { year: 2020, demand: 1000, notes: "" }
                ],
                // استراتيجية التوزيع: Intensive, Selective, Exclusive
                distributionStrategy: "",
                // استراتيجية الدخول: Full_Launch, Pilot_Phase, Outsourcing
                launchStrategy: "Full_Launch",
                // مرونة الطلب (عائلة الماجد): elastic | inelastic | unitary
                demandElasticity: ""
            },
            // المنافسين
            // المنافسين (قائمة)
            competitors: [
                // { name: "", strengths: "", weaknesses: "", marketShare: 0, estimatedDailyCustomers: 0, estimatedAvgTicket: 0 }
            ],
            // مصفوفة المقارنة المعيارية (New Phase 3)
            competitorBenchmarking: [
                // { criterion: "السعر", myRank: 1, comp1Rank: 2, comp2Rank: 3, notes: "" }
            ],
            // تحليل SWOT
            swot: {
                strengths: "",
                weaknesses: "",
                threats: ""
            },
            // المخاطر البيئية (PESTEL Risks)
            environmentalRisks: [
                // { factor: "رفع الدعم عن الوقود", impact: "High", probability: "Medium", mitigation: "التحول للطاقة الشمسية" }
            ],
            // استراتيجيات توليد المبادرات (TOWS) (New Phase 4)
            towsMatrix: {
                so: "", // نقاط قوة + فرص
                wo: "", // نقاط ضعف + فرص
                st: "", // نقاط قوة + تهديدات
                wt: ""  // نقاط ضعف + تهديدات
            },
            // المزيج التسويقي (4P)
            marketingMix: {
                product: "",
                price: "",
                place: "",
                promotion: ""
            },
            pricingOptimization: {
                targetGrossMargin: 0.55,
                willingnessToPay: 0,
                competitorAveragePrice: 0,
                positioning: "balanced",
                notes: ""
            },
            // الحملات - مصنفة: رأسمالي أو تشغيلي
            campaigns: [
                // { name: "حملة إطلاق", type: "capital", amount: 50000, notes: "" }
                // { name: "إعلانات شهرية", type: "operating", monthly: 5000, notes: "" }
            ],
            // الموردون (جدول تفصيلي — الفجوة المعيارية)
            suppliers: [
                // { name: "", supplyNature: "", availability: "", avgDeliveryDays: 0, notes: "" }
            ],
            // نتائج الاستبيان (New Phase 3)
            marketSurveyResults: [
                // { question: "اللون المفضل", answer: "أسود", percentage: 70, notes: "" }
            ],
            // توازن العرض والطلب (الفجوة المعيارية)
            supplyDemandBalance: [],
            // Transcript 8: Market Structure & Pricing Power
            // المنافسة التامة، الاحتكارية، احتكار القلة، الاحتكار التام
            marketStructure: "Monopolistic_Competition",
            // صانع للسعر أو متقبل للسعر (يحدد تلقائياً بناءً على الهيكل)
            pricingPower: "Price_Maker"
        },

        // ═══════════════════════════════════════════════════════════
        // 8️⃣ مصادر الإيرادات - يغذي قائمة الدخل
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.REVENUE]: {
            streams: [
                // { service: "المنصة", customersPerMonth: 300, avgPrice: 75.75, growthRate: 0.07, type: "operating" }
            ]
        },

        // ═══════════════════════════════════════════════════════════
        // 9️⃣ الخدمات المفصلة - تحليل لكل خدمة
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.SERVICES]: {
            items: [
                // {
                //     id: 'pool',
                //     name: 'المسبح',
                //     capex: 0,           // تكاليف رأسمالية خاصة بالخدمة
                //     fixedCosts: 0,      // تكاليف ثابتة شهرية
                //     variableCostPerUnit: 0, // تكلفة متغيرة لكل عميل
                //     pricePerUnit: 0,    // سعر الخدمة
                //     customersPerMonth: 0, // عدد العملاء المتوقع
                //     growthRate: 0.07,   // معدل النمو السنوي
                //     staffCount: 0,      // عدد الموظفين المخصصين
                //     notes: ''
                // }
            ],
            // خدمات افتراضية لماك بلاش
            templates: [
                { id: 'pool', name: 'المسبح', icon: '🏊' },
                { id: 'padel', name: 'البادل', icon: '🎾' },
                { id: 'playground', name: 'الملعب', icon: '⚽' },
                { id: 'gym', name: 'الصالة الرياضية', icon: '💪' },
                { id: 'spa', name: 'السبا', icon: '🧖' },
                { id: 'cafe', name: 'الكافيه', icon: '☕' }
            ]
        },

        // ═══════════════════════════════════════════════════════════
        // 🔟 الافتراضات المالية
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.ASSUMPTIONS]: {
            currency: 'SAR', // عملات خليجية: SAR, AED, KWD, BHD, OMR, QAR
            inflationRate: 0.02,
            // الزكاة 2.5% تُحسب تلقائياً على حصة الملكية السعودية/الخليجية.
            // ضريبة الدخل (20%) تُطبق فقط على حصة الملكية الأجنبية أدناه.
            // (كان taxRate: 0.15 يُطبق على كل مشروع فوق الزكاة = اقتطاع ~17% خطأً؛
            //  الـ15% هي ضريبة القيمة المضافة على المبيعات وليست ضريبة دخل.)
            foreignOwnershipRate: 0, // 0 = مشروع سعودي 100% (زكاة فقط)
            taxRate: 0.20,
            discountRate: 0.10, // معدل خصم متحفظ يناسب مخاطر مشروع مطعمي سعودي (كان 0.05 — يضخّم NPV)
            useWaccAsDiscountRate: false,
            workingCapitalMonths: 3,
            // منحنى التصاعد: عدد الأشهر حتى بلوغ كامل المبيعات المخططة في السنة الأولى
            // (0 = بلا تصاعد — غير واقعي لمشروع جديد؛ المعتاد 6–12 شهراً)
            rampUpMonths: 0,
            // القيمة النهائية (استرشادية — القرار يبقى على NPV المتحفظ بدونها)
            terminalValue: {
                method: 'gordon',   // gordon | none
                growthRate: 0.02    // نمو مستدام بعد سنوات الدراسة (يُقص دون معدل الخصم)
            },
            // دورة رأس المال العامل الفعلية (اختياري — يتفوق على workingCapitalMonths عند تعبئته)
            workingCapitalPolicy: {
                dsoDays: null, // أيام تحصيل المبيعات الآجلة (DSO) — 0 لنشاط كاش
                dpoDays: null, // أيام سداد الموردين (DPO)
                dioDays: null  // أيام بقاء المخزون (DIO)
            },
            contingencyRate: 0.10,
            projectionYears: 5,
            revenueGrowthJustification: '', // مبرر نمو/تثبيت/انخفاض المبيعات
            // تدقيق 2026-07-08: targetDSCR كان غائباً هنا كلياً — كل شاشة كانت تفترض
            // احتياطياً رقماً محلياً مختلفاً (1.25 في المحرك، 1.5 في لوحة القرار) بلا
            // أي افتراض مركزي معلن للمستخدم. الآن جزء من نفس حزمة عتبات القرار الموحّدة.
            thresholds: {
                minNPV: 0,
                minIRR: 0.15,
                maxPayback: 3.5,
                minROI: 0.20,
                targetDSCR: 1.25
            },
            // Transcript 8: Hidden Overheads Contingency
            hiddenOverheadsRate: 5 // نسبة مئوية للطوارئ التشغيلية (5% افتراضي)
        },

        // ═══════════════════════════════════════════════════════════
        // 1️⃣1️⃣ التحليل الاستراتيجي (PESTEL + SWOT + Porter)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.STRATEGIC]: {
            pestel: [
                { factor: 'political', label: 'سياسي', description: '', impact: 'neutral', notes: '' },
                { factor: 'economic', label: 'اقتصادي', description: '', impact: 'neutral', notes: '' },
                { factor: 'social', label: 'اجتماعي', description: '', impact: 'neutral', notes: '' },
                { factor: 'technological', label: 'تقني', description: '', impact: 'neutral', notes: '' },
                { factor: 'environmental', label: 'بيئي', description: '', impact: 'neutral', notes: '' },
                { factor: 'legal', label: 'قانوني', description: '', impact: 'neutral', notes: '' }
            ],
            swot: {
                strengths: [],
                weaknesses: [],
                opportunities: [],
                threats: []
            },
            porter: {
                newEntrants: { level: 'medium', description: '' },
                supplierPower: { level: 'medium', description: '' },
                buyerPower: { level: 'medium', description: '' },
                substitutes: { level: 'medium', description: '' },
                rivalry: { level: 'medium', description: '' }
            }
        },

        // ═══════════════════════════════════════════════════════════
        // 1️⃣2️⃣ تحليل حجم السوق (TAM-SAM-SOM)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.MARKET_SIZING]: {
            tam: { value: 0, description: 'السوق الكلي' },
            sam: { value: 0, description: 'السوق المتاح' },
            som: { value: 0, description: 'حصتك المستهدفة' },
            segments: [
                // { name: '', demographics: '', size: 0, priority: 'primary' }
            ],
            // دراسة إحصائية للسكان (تعداد، ديموغرافيا)
            populationDemographics: {
                totalPopulation: 0,
                source: '',
                year: '',
                youthPercentage: '',
                targetSegmentSize: '',
                notes: ''
            },
            // التقسيم الجغرافي للسوق (الفجوة المعيارية)
            targetDistrict: '',
            targetNeighborhood: '',
            // تحليل القطاع والصناعة
            sectorAnalysis: "",
            industryAnalysis: "",
            // مواءمة رؤية 2030 (الفجوة المعيارية)
            vision2030: {
                alignment: '',           // كيف يرتبط المشروع برؤية 2030
                relevantPrograms: '',    // البرامج ذات الصلة (رؤية 2030، برامج رفع المحتوى المحلي، إلخ)
                impact: ''              // الأثر المتوقع على أهداف الرؤية
            },
            // دراسة اقتصاد الدولة (الفجوة المعيارية)
            nationalEconomy: {
                gdpGrowth: '',          // معدل نمو الناتج المحلي أو الاتجاه
                sectorGrowth: '',       // نمو القطاع المستهدف
                keyIndicators: '',      // مؤشرات وطنية ذات صلة
                trends: ''              // الاتجاهات الاقتصادية المؤثرة
            }
        },

        // ═══════════════════════════════════════════════════════════
        // 1️⃣3️⃣ تحليل المخاطر
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.RISK_ANALYSIS]: {
            risks: [
                // { name: '', type: 'operational', probability: 'medium', impact: 'high', mitigation: '', owner: '' }
            ]
        },

        // ═══════════════════════════════════════════════════════════
        // 1️⃣4️⃣ تحليل السيناريوهات
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.SCENARIOS]: {
            // ASSUMPTION (تدقيق 2026-07-08، ملاحظة منخفضة #59): نسب متشائم/متفائل هنا
            // ثوابت تقديرية عامة بلا مصدر خارجي منشور — قابلة للتعديل الكامل من
            // المستخدم في خطوة "تحليل السيناريوهات"، وليست أرقاماً معتمدة رسمياً.
            pessimistic: { ...DEFAULT_SCENARIOS.pessimistic, description: 'سيناريو متشائم' },
            base: { ...DEFAULT_SCENARIOS.base, description: 'السيناريو الأساسي' },
            optimistic: { ...DEFAULT_SCENARIOS.optimistic, description: 'سيناريو متفائل' },
            sensitivity: {
                variables: ['revenue', 'costs', 'price', 'volume'],
                selectedVariable: 'revenue',
                range: [-0.30, 0.30]
            }
        },

        // ═══════════════════════════════════════════════════════════
        // 1️⃣5️⃣ مصادر وهيكلة التمويل (UNIDO Requirement)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.FINANCING]: {
            totalInvestment: 0,
            sources: {
                equity: { amount: 0, percentage: 0, description: 'تمويل ذاتي' },
                bankLoan: {
                    amount: 0,
                    percentage: 0,
                    interestRate: 0.08,
                    termYears: 5,
                    gracePeriodMonths: 6,
                    bank: ''
                },
                investors: {
                    amount: 0,
                    percentage: 0,
                    equityShare: 0,
                    investorType: '' // ملاك / رأس مال مخاطر
                },
                governmentSupport: {
                    amount: 0,
                    percentage: 0,
                    program: '' // منشآت / كفالة / صندوق صناعي
                }
            },
            loanSchedule: [], // جدول السداد
            wacc: 0 // تكلفة رأس المال المرجح
        },

        // ═══════════════════════════════════════════════════════════
        // 1️⃣6️⃣ الهيكل التنظيمي والحوكمة (UNIDO + MISA Requirement)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.ORG_STRUCTURE]: {
            departments: [
                // { id: 'exec', name: 'الإدارة التنفيذية', parentId: null, head: '', responsibilities: '' }
            ],
            // مؤشرات قياس الأداء التشغيلية (KPI)
            operationalKpis: [
                // { strategicGoal: '', indicator: '', calculationMethod: '', unit: '', targetValue: '', notes: '' }
            ],
            boardOfDirectors: [],
            advisoryBoard: [],  // المجلس الاستشاري: { name, role }
            governance: {
                boardMeetings: 'quarterly',
                auditCommittee: false,
                complianceOfficer: ''
            },
            saudization: {
                targetPercentage: 0,
                currentPercentage: 0,
                plan: ''
            }
        },

        // ═══════════════════════════════════════════════════════════
        // 1️⃣7️⃣ الأهداف الذكية SMART Goals
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.SMART_GOALS]: {
            goals: [
                // {
                //     id: '', specific: '', measurable: '', achievable: '', relevant: '', timeBound: '',
                //     startDate: '',      // تاريخ بداية الهدف
                //     deadline: '',      // تاريخ نهاية الهدف
                //     category: 'financial', targetValue: 0, currentValue: 0, status: 'pending',
                //     ideaLink: ''       // كيف يحقق الهدف الفكرة والهوية
                // }
            ]
        },

        // ═══════════════════════════════════════════════════════════
        // 1️⃣8️⃣ الملخص التنفيذي (Executive Summary)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.EXECUTIVE_SUMMARY]: {
            projectOverview: '',
            problemStatement: '',
            proposedSolution: '',
            uniqueValueProposition: '',
            investmentHighlights: [],
            keyRisks: [],
            investmentRequest: 0,
            expectedROI: 0,
            recommendedAction: 'go' // go, nogo, conditional
        },

        // ═══════════════════════════════════════════════════════════
        // 1️⃣9️⃣ القوائم المالية التقديرية (Estimated Financial Statements)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.ZAKAT_TAX]: {},
        // ملاحظة: أُزيلت 6 تعريفات فارغة مكررة كانت هنا (FINANCIAL_STATEMENTS/BREAK_EVEN/
        // DECISION_DASHBOARD/BUSINESS_MODEL/MONTE_CARLO/VALUATION) — تُدهس بصمت بالتعريفات
        // الحقيقية أدناه في نفس الكائن الحرفي (تدقيق 2026-07-08)؛ لا أثر وظيفي لحذفها.

        // تدقيق 2026-07-09 (دفعة 6): هذا القسم كود ميت فعلياً برغم بقاء SECTIONS.FINANCIAL_STATEMENTS
        // نفسه حياً (خطوة معالج حقيقية + تُقرأ في sectionExporter.js/qaChecks.js) — لا شيء يقرأ
        // أو يكتب incomeStatement/cashFlow/balanceSheet/taxRate/zakatRate هنا تحديداً؛ قوائم الدخل/
        // التدفقات/الميزانية الفعلية تُحسب حياً من المحرك (engine.js)، وtaxRate/zakatRate الحقيقيان
        // مصدرهما assumptions.taxRate ومعدل ثابت منفصل في engine.js، لا هذا الكائن. لم تُحذف
        // الحقول لتفادي كسر schema.guard.test.js (يتحقق أن كل SECTIONS له قيمة افتراضية معرَّفة)
        // — تُبقى فارغة/توثيقية بوضوح بدل الإيحاء بأنها تُقرأ فعلياً في مكان ما.
        [SECTIONS.FINANCIAL_STATEMENTS]: {},

        // ═══════════════════════════════════════════════════════════
        // 2️⃣0️⃣ تحليل نقطة التعادل (Break-even Analysis)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.BREAK_EVEN]: {
            breakEvenUnit: 0,
            breakEvenValue: 0,
            marginOfSafety: 0,
            fixedCostsTotal: 0,
            variableCostsTotal: 0
        },

        // ═══════════════════════════════════════════════════════════
        // نموذج العمل (Business Model Canvas)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.BUSINESS_MODEL]: {
            valueProposition: '',
            customerSegments: '',
            channels: '',
            customerRelationships: '',
            revenueStreams: '',
            keyResources: '',
            keyActivities: '',
            keyPartners: '',
            costStructure: ''
        },

        // ═══════════════════════════════════════════════════════════
        // 2️⃣1️⃣ لوحة القرار (Decision Dashboard)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.DECISION_DASHBOARD]: {
            readiness: {
                market: 'ready',    // ready, needs_work, critical
                financing: 'ready',
                team: 'ready',
                legal: 'ready',
                risk: 'ready'
            },
            criticalSuccessFactors: [],
            monitoredRisks: []
        },

        // ═══════════════════════════════════════════════════════════
        // 2️⃣2️⃣ الجدول الزمني للتنفيذ (Execution Timeline)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.TIMELINE]: {
            activities: [
                { id: 1, name: 'استخراج التراخيص والسجل التجاري', startMonth: 1, duration: 2, category: 'legal' },
                { id: 2, name: 'البحث عن الموقع واستئجار المقر', startMonth: 2, duration: 2, category: 'technical' },
                { id: 3, name: 'أعمال الديكور والتجهيز الفني', startMonth: 4, duration: 4, category: 'technical' },
                { id: 4, name: 'شراء وتركيب المعدات والأثاث', startMonth: 6, duration: 3, category: 'technical' },
                { id: 5, name: 'استقطاب وتوظيف الكادر البشري', startMonth: 7, duration: 3, category: 'hr' },
                { id: 6, name: 'التدريب والحملة التسويقية الافتتاحية', startMonth: 9, duration: 3, category: 'marketing' },
                { id: 7, name: 'الإطلاق التجريبي والرسمي', startMonth: 12, duration: 1, category: 'launch' }
            ]
        },

        // ═══════════════════════════════════════════════════════════
        // 2️⃣3️⃣ محاكاة مونت كارلو (Monte Carlo Simulation)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.MONTE_CARLO]: {
            iterations: 1000,
            // تدقيق 2026-07-08 (ملاحظة متوسطة #32): كانت 0.15 هنا بينما المُستدعي
            // الفعلي الوحيد (MonteCarloAnalysis.js) يمرّر 0.20 مباشرة متجاوزاً هذه
            // القيمة بصمت — وُحِّدت على 0.20 (الرقم المُستخدَم فعلياً). ملاحظة: هذا
            // الحقل توثيقي فقط حالياً؛ الاستدعاء الفعلي لا يقرأ منه بعد (لا واجهة
            // مستخدم لتخصيص التقلّب) — خارج نطاق هذا الإصلاح.
            volatility: 0.20, // 20% standard deviation for variables
            variables: ['revenue', 'opex', 'capex'],
            results: {
                successProbability: 0,
                distribution: []
            }
        },

        // ═══════════════════════════════════════════════════════════
        // محاكاة التشغيل والازدحام (Queueing Simulation) — OperationalSim.js
        // تدقيق 2026-07-08 (ملاحظة عالية #26): كانت OperationalSim.js تكتب مباشرة
        // إلى store.update('operational', ...) دون أن يكون هذا القسم معرَّفاً في
        // SECTIONS/createEmptyStudy، فيهبط كمفتاح يتيم يُنشئه مسار "Section missing،
        // initializing..." الاحتياطي بدل أن يكون جزءاً موثَّقاً من مخطط الدراسة.
        // ملاحظة: هذه محاكاة استرشادية (queueing theory) لأوقات الانتظار/الازدحام
        // فقط — لا تُغذّي حالياً hr.positions أو أي تكلفة رواتب فعلية في المحرك؛
        // اقتراح "عدد الموظفين الأمثل" هنا تقريبي لنقاط الخدمة، وليس قراراً تلقائياً
        // بتعديل الكادر الحقيقي بالتكلفة المالية.
        // خطة الاستفادة 2026-07-12 (بند 1.1): OperationalSim.js يخزّن الآن lastResult
        // بعد كل تشغيل ليقرأه جدول الرواتب (OrgStructure/Wizard) كاقتراح اختياري بزر
        // صريح «إدراج كصف مقترح» — لا كتابة صامتة، ولا تغيير على القرار السابق أعلاه.
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.OPERATIONAL]: {
            arrivalRate: 30,  // عميل/ساعة
            serviceTime: 5,   // دقيقة لكل عميل
            servers: 2,       // نقاط خدمة متزامنة
            lastResult: null  // { recommendedServers, utilization, avgWaitTime } — يُملأ بعد أول تشغيل
        },

        // ═══════════════════════════════════════════════════════════
        // 2️⃣4️⃣ تقييم الشركة (Company Valuation)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.VALUATION]: {
            method: 'dcf', // dcf, multipliers
            terminalGrowth: 0.02,
            discountRate: 0.12,
            multipliers: {
                ebitda: 6,
                revenue: 2
            },
            results: {
                preMoneyValuation: 0,
                postMoneyValuation: 0
            }
        },

        // ═══════════════════════════════════════════════════════════
        // 2️⃣5️⃣ مراقبة الأداء بعد التشغيل (Post-Launch Tracker)
        // ═══════════════════════════════════════════════════════════
        [SECTIONS.ACTUALS]: {
            // حقل قديم محفوظ للتوافق مع الدراسات السابقة بعد إزالة أداة المتابعة من الواجهة.
            months: [],
            // اكتمال فعلي لأنشطة الجدول الزمني (timeline.activities): { [activityId]: شهر الإنجاز الفعلي }
            timelineCompletions: {}
        },

        // ترتيب أقسام التقرير (بناء التقرير — السحب والإفلات)
        reportSectionOrder: [...DEFAULT_REPORT_SECTION_ORDER],

        /** قائمة تحقق متطلبات التقديم للتمويل (KPI-3.5) — تُحمّل في FinancingGuideView وتُحفظ عند التحديث */
        financingReadinessChecklist: [
            { id: 'summary', label: 'ملخص جاهز', done: false },
            { id: 'financial', label: 'جداول مالية مكتملة', done: false },
            { id: 'risks', label: 'مخاطر موثقة', done: false },
            { id: 'guarantees', label: 'ضمانات إن وُجدت', done: false },
            { id: 'contact', label: 'بيانات الاتصال', done: false }
        ],

        // ═══════════════════════════════════════════════════════════
        // 2️⃣6️⃣ الملاحق (الفجوة المعيارية)
        // ═══════════════════════════════════════════════════════════
        appendices: {
            investorProfile: '',
            shareholders: [],
            reviewers: [],
            references: [],
            surveys: [],
            priceQuotes: []
        }
    };
}

// Table column definitions for DynamicTable
export const TABLE_SCHEMAS = {
    keyPeople: {
        title: 'الأشخاص الرئيسون (الفريق المؤسس)',
        aiPrompt: 'suggest_key_people',
        columns: [
            { key: 'name', label: 'الاسم', type: 'text' },
            { key: 'role', label: 'الدور/المسمى', type: 'text' },
            // placeholder حقيقي (لا قيمة مكتوبة) — تدقيق اختبار قبول 2026-07-12: النص
            // الإرشادي كان يُكتب كقيمة فعلية فيتشوّه عند التحرير بلا تحديد الكل أولاً.
            { key: 'experience', label: 'الخبرة (سنوات أو وصف)', type: 'text', placeholder: 'اذكر سنوات خبرتك الفعلية في هذا النشاط أو نشاط مشابه' },
            { key: 'qualifications', label: 'المؤهلات', type: 'text', placeholder: 'اذكر مؤهلاتك أو شهاداتك ذات الصلة، إن وُجدت' }
        ],
        showTotal: false
    },
    products: {
        title: 'المنتجات',
        aiPrompt: 'suggest_products',
        // تدقيق دفعة 3 (اختبار عميل بقالة 2026-07-12): «الخصائص الفريدة» و«القيمة
        // المضافة» كانا عمودين متجاورين يطلبان عملياً نفس الإجابة لمنتج بسيط (خضار
        // طازجة) — العميل التجريبي أعاد صياغة نفس الفكرة مرتين. دُمجا في عمود واحد؛
        // sectionExporter.js/ReportGenerator.js يدمجان قيمتي valueAdded القديمة (إن
        // وُجدت في دراسة محفوظة سابقاً) مع uniqueFeatures عرضاً فقط، فلا يضيع نص
        // أُدخل قبل هذا التغيير.
        columns: [
            { key: 'type', label: 'النوع', type: 'select', options: [{ value: 'primary', label: 'أولي' }, { value: 'semi', label: 'نصف مصنع' }, { value: 'final', label: 'نهائي' }] },
            { key: 'name', label: 'اسم المنتج', type: 'text' },
            { key: 'description', label: 'الوصف', type: 'text' },
            { key: 'uniqueFeatures', label: 'الميزة الفريدة / القيمة المضافة', type: 'text', placeholder: 'ما يميزه عن المنافسين وقيمته الإضافية للعميل — مثال: خضار تُقطف يومياً من مزارع محلية بدل التبريد المستورد' },
            { key: 'customerBenefit', label: 'فائدة العميل', type: 'text' }
        ],
        showTotal: false
    },
    introServices: {
        title: 'الخدمات (المقدمة)',
        aiPrompt: 'suggest_intro_services',
        columns: [
            { key: 'type', label: 'النوع', type: 'select', options: [{ value: 'essential', label: 'أساسية' }, { value: 'supporting', label: 'داعمة' }, { value: 'secondary', label: 'ثانوية' }] },
            { key: 'name', label: 'اسم الخدمة', type: 'text' },
            { key: 'description', label: 'وصف الخدمة', type: 'text' }
        ],
        showTotal: false
    },
    customerValues: {
        title: 'القيمة للعميل (Value Proposition)',
        aiPrompt: 'suggest_customer_values',
        columns: [
            { key: 'customerType', label: 'نوع العميل', type: 'text', placeholder: 'مثال: صاحب مقهى، مستهلك نهائي' },
            { key: 'customerNeed', label: 'ماذا يريد؟ (الاحتياج)', type: 'text' },
            { key: 'valueWeProvide', label: 'القيمة المقدمة (الحل)', type: 'text' }
        ],
        showTotal: false
    },
    establishmentCosts: {
        title: 'نفقات التأسيس (مرة واحدة — إطفاء سنوي)',
        aiPrompt: 'suggest_establishment_costs',
        columns: [
            { key: 'name', label: 'البند', type: 'text', placeholder: 'دراسات، تراخيص، ديكورات حد أدنى...' },
            { key: 'amount', label: 'المبلغ', type: 'number' },
            { key: 'amortizationRate', label: '% إطفاء/سنة', type: 'number', default: 0.20, placeholder: '20% = 0.20' }
        ],
        showTotal: true,
        totalColumn: 'amount'
    },
    buildings: {
        title: 'المباني والإنشاءات',
        aiPrompt: 'suggest_buildings',
        columns: [
            { key: 'name', label: 'البند', type: 'text' },
            { key: 'quantity', label: 'العدد', type: 'number', default: 1 },
            { key: 'price', label: 'السعر', type: 'number' },
            { key: 'total', label: 'الإجمالي', type: 'computed', formula: r => (r.quantity || 1) * (r.price || 0) },
            { key: 'depreciationRate', label: '% استهلاك', type: 'number', default: 0.05 },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'total'
    },
    equipment: {
        title: 'المعدات والأجهزة',
        aiPrompt: 'suggest_equipment',
        columns: [
            { key: 'name', label: 'البند', type: 'text' },
            { key: 'quantity', label: 'العدد', type: 'number', default: 1 },
            { key: 'price', label: 'السعر', type: 'number' },
            { key: 'total', label: 'الإجمالي', type: 'computed', formula: r => (r.quantity || 1) * (r.price || 0) },
            { key: 'depreciationRate', label: '% استهلاك', type: 'number', default: 0.15 },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'total'
    },
    furniture: {
        title: 'الأثاث والتجهيزات',
        aiPrompt: 'suggest_furniture',
        columns: [
            { key: 'name', label: 'البند', type: 'text' },
            { key: 'quantity', label: 'العدد', type: 'number', default: 1 },
            { key: 'price', label: 'السعر', type: 'number' },
            { key: 'total', label: 'الإجمالي', type: 'computed', formula: r => (r.quantity || 1) * (r.price || 0) },
            { key: 'depreciationRate', label: '% استهلاك', type: 'number', default: 0.20 }
        ],
        showTotal: true,
        totalColumn: 'total'
    },
    vehicles: {
        title: 'وسائل النقل والمواصلات',
        aiPrompt: 'suggest_vehicles',
        columns: [
            { key: 'name', label: 'نوع المركبة', type: 'text' },
            { key: 'quantity', label: 'العدد', type: 'number', default: 1 },
            { key: 'price', label: 'السعر', type: 'number' },
            { key: 'total', label: 'الإجمالي', type: 'computed', formula: r => (r.quantity || 1) * (r.price || 0) },
            { key: 'depreciationRate', label: '% استهلاك', type: 'number', default: 0.20 }
        ],
        showTotal: true,
        totalColumn: 'total'
    },
    capacityModel: {
        title: 'الطاقة القصوى (مصالحة المبيعات مع الطاقة الفعلية)',
        columns: [
            { key: 'seats', label: 'المقاعد/الوحدات المتاحة', type: 'number', placeholder: 'مثال: 40 مقعداً أو 5 غرف' },
            { key: 'turnsPerDay', label: 'دورات الاستخدام/اليوم', type: 'number', placeholder: 'مثال: 4' },
            { key: 'daysPerMonth', label: 'أيام التشغيل/الشهر', type: 'number', default: 26 },
            {
                key: 'maxUnitsPerMonth', label: 'أقصى عملاء/شهر', type: 'computed',
                formula: r => Math.round((r.seats || 0) * (r.turnsPerDay || 0) * (r.daysPerMonth || 26))
            },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: false
    },
    consumables: {
        title: 'المواد المستهلكة (التشغيلية)',
        aiPrompt: 'suggest_consumables',
        columns: [
            { key: 'name', label: 'البند', type: 'text', placeholder: 'مثال: قرطاسية، ضيافة، مواد تنظيف' },
            { key: 'monthlyCost', label: 'التكلفة الشهرية', type: 'number' },
            { key: 'annualCost', label: 'التكلفة السنوية', type: 'computed', formula: r => (r.monthlyCost || 0) * 12 },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'annualCost'
    },
    positions: {
        title: 'الوظائف والرواتب',
        aiPrompt: 'suggest_staff',
        smartFill: { label: '🪄 اقتراح الهيكل والرواتب', dataKey: 'staffing' },
        columns: [
            { key: 'position', label: 'المسمى الوظيفي', type: 'text' },
            { key: 'nationality', label: 'الجنسية', type: 'select', options: [{ value: 'saudi', label: 'سعودي 🇸🇦' }, { value: 'expat', label: 'غير سعودي 🌍' }], default: 'expat' },
            { key: 'count', label: 'العدد', type: 'number', default: 1 },
            { key: 'salary', label: 'الراتب الأساسي + السكن', type: 'number' },
            { key: 'months', label: 'أشهر العمل/سنة', type: 'number', default: 12 },
            {
                key: 'salaryGrowthRate', label: 'نمو الراتب السنوي (اختياري)', type: 'number',
                placeholder: 'مثال: 0.10 لنمو 10% سنوياً — اتركه فارغاً لاستخدام معدل التضخم العام'
            },
            {
                key: 'annualCost', label: 'إجمالي التكلفة (مع التأمينات)', type: 'computed',
                // معاينة تقريبية في الجدول قبل حساب المحرك الكامل — تستخدم نفس ثابت GOSI
                // المُصدَّر (SAUDI_GOSI_RATE_2026) بدل رقم محلي مختلف كان يناقض المحرك فعلياً.
                // الوافد: 2% مخاطر مهنية فقط (لا يشمل التأمينات التقاعدية).
                formula: r => {
                    const basic = (r.count || 1) * (r.salary || 0) * (r.months || 12);
                    const gosiRate = r.nationality === 'saudi' ? SAUDI_GOSI_RATE_2026 : 0.02;
                    return basic * (1 + gosiRate);
                }
            },
            { key: 'isVariable', label: 'متغير؟', type: 'checkbox' }
        ],
        showTotal: true,
        totalColumn: 'annualCost'
    },
    techResources: {
        title: 'الموارد التقنية',
        aiPrompt: 'suggest_tech',
        columns: [
            { key: 'name', label: 'البند', type: 'text' },
            { key: 'quantity', label: 'العدد', type: 'number', default: 1 },
            { key: 'price', label: 'القيمة', type: 'number' },
            { key: 'total', label: 'الإجمالي', type: 'computed', formula: r => (r.quantity || 1) * (r.price || 0) },
            { key: 'depreciationRate', label: '% استهلاك', type: 'number', default: 0.25 },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'total'
    },
    logistics: {
        title: 'الموارد اللوجستية',
        aiPrompt: 'suggest_logistics',
        columns: [
            { key: 'name', label: 'البند', type: 'text' },
            { key: 'monthly', label: 'شهري', type: 'number' },
            { key: 'annual', label: 'سنوي', type: 'computed', formula: r => (r.monthly || 0) * 12 },
            { key: 'variablePercent', label: '% متغير', type: 'number', default: 0 },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'annual'
    },
    administrative: {
        title: 'الموارد الإدارية',
        aiPrompt: 'suggest_administrative',
        columns: [
            { key: 'name', label: 'البند', type: 'text' },
            { key: 'monthly', label: 'شهري', type: 'number' },
            { key: 'annual', label: 'سنوي', type: 'computed', formula: r => (r.monthly || 0) * 12 },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'annual'
    },
    licenses: {
        title: 'التراخيص والرسوم القانونية',
        aiPrompt: 'suggest_licenses',
        smartFill: { label: '🪄 جلب التراخيص الحكومية', dataKey: 'licenses' },
        columns: [
            { key: 'name', label: 'البند', type: 'text' },
            { key: 'quantity', label: 'الكمية', type: 'number', default: 1 },
            { key: 'price', label: 'السعر', type: 'number' },
            { key: 'total', label: 'الإجمالي', type: 'computed', formula: r => (r.quantity || 1) * (r.price || 0) },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'total'
    },
    campaigns: {
        title: 'الحملات التسويقية',
        aiPrompt: 'suggest_campaigns',
        columns: [
            { key: 'name', label: 'الحملة', type: 'text' },
            { key: 'channel', label: 'القناة', type: 'text', placeholder: 'مثال: إعلانات مدفوعة، محتوى، شراكات...' },
            { key: 'type', label: 'النوع', type: 'select', options: [{ value: 'capital', label: 'رأسمالي' }, { value: 'operating', label: 'تشغيلي' }] },
            { key: 'amount', label: 'المبلغ', type: 'number' },
            { key: 'monthly', label: 'شهري (للتشغيلي)', type: 'number' },
            {
                key: 'annualGrowthRate', label: 'نمو سنوي مخصص (اختياري)', type: 'number',
                placeholder: 'مثال: 0.15 لنمو 15% سنوياً — اتركه فارغاً لاستخدام معدل التضخم العام'
            },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: false
    },
    competitorBenchmarking: {
        title: 'مقارنة المشروع مع المنافسين (جدول معايير)',
        aiPrompt: 'suggest_competitor_benchmark',
        columns: [
            { key: 'criterion', label: 'عنصر المقارنة', type: 'text', placeholder: 'المنتجات، السعر، الجودة، الموقع...' },
            { key: 'importance', label: 'الأهمية', type: 'select', options: [{ value: 'high', label: 'عالي' }, { value: 'medium', label: 'متوسط' }, { value: 'low', label: 'منخفض' }] },
            { key: 'myRank', label: 'ترتيب المشروع', type: 'number', placeholder: '1=الأفضل' },
            { key: 'comp1Rank', label: 'ترتيب منافس 1', type: 'number' },
            { key: 'comp2Rank', label: 'ترتيب منافس 2', type: 'number' },
            { key: 'comp3Rank', label: 'ترتيب منافس 3', type: 'number' },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: false
    },
    competitors: {
        title: 'تحليل المنافسين',
        aiPrompt: 'competitors',
        columns: [
            { key: 'name', label: 'المنافس', type: 'text' },
            { key: 'strengths', label: 'نقاط القوة', type: 'text' },
            { key: 'weaknesses', label: 'نقاط الضعف', type: 'text' },
            { key: 'marketShare', label: 'الحصة %', type: 'number' },
            { key: 'estimatedDailyCustomers', label: 'عدد عملاء/يوم (تقديري)', type: 'number', placeholder: 'للمقارنة' },
            { key: 'estimatedAvgTicket', label: 'متوسط فاتورة (ريال)', type: 'number', placeholder: 'عدد × متوسط = مبيعات يومية' }
        ],
        showTotal: false
    },
    dataGatheringChecklist: {
        title: 'خطوات جمع المعلومات (زيارات ميدانية)',
        columns: [
            { key: 'step', label: 'الخطوة', type: 'text', placeholder: 'زيارة منافسين، جهات حكومية، جهات تمويل...' },
            { key: 'done', label: 'تم؟', type: 'checkbox', default: false },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: false
    },
    suppliers: {
        title: 'الموردون',
        aiPrompt: 'suggest_suppliers',
        columns: [
            { key: 'name', label: 'اسم المورد', type: 'text' },
            { key: 'supplyNature', label: 'طبيعة التوريدات', type: 'text', placeholder: 'مواد خام، معدات، مستهلكات...' },
            { key: 'availability', label: 'إمكانية الحصول', type: 'text', placeholder: 'سهل، متوسط، صعب' },
            { key: 'avgDeliveryDays', label: 'متوسط فترة التوريد (يوم)', type: 'number' },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: false
    },
    marketSurveyResults: {
        title: 'نتائج الاستبيان الميداني',
        aiPrompt: 'suggest_survey_results',
        columns: [
            { key: 'question', label: 'السؤال/المعيار', type: 'text' },
            { key: 'answer', label: 'النتيجة الأكثر تكراراً', type: 'text' },
            { key: 'percentage', label: 'النسبة المؤيدة %', type: 'number' },
            { key: 'notes', label: 'دلالة النتيجة', type: 'text' }
        ],
        showTotal: false
    },
    operationalKpis: {
        title: 'مؤشرات قياس الأداء التشغيلية',
        aiPrompt: 'suggest_operational_kpis',
        columns: [
            { key: 'strategicGoal', label: 'الهدف الاستراتيجي', type: 'text' },
            { key: 'indicator', label: 'المؤشر', type: 'text' },
            { key: 'calculationMethod', label: 'طريقة الحساب', type: 'text' },
            { key: 'unit', label: 'وحدة القياس', type: 'text', placeholder: 'عدد/يوم، ريال، %...' },
            { key: 'targetValue', label: 'القيمة المعيارية', type: 'text' },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: false
    },
    revenueStreams: {
        title: 'مصادر الإيرادات',
        aiPrompt: 'suggest_revenue',
        // ملاحظة: عمود «تكلفة متغيرة %» يُخزَّن ككسر (0–1) ويقرأه المحرك (revenue.js). إبقاؤه ظاهراً يمنع
        // اقتطاع 30% صامتاً بلا علم المستخدم — أدخل تكلفتك الفعلية (استشارات ≈ 0٪، تجزئة أعلى).
        // ASSUMPTION (تدقيق 2026-07-08، ملاحظة عالية #22): افتراضي growthRate=7% تقدير
        // داخلي عام لا مصدر خارجي منشور له (بخلاف variableCostRate الموثَّق أعلاه) —
        // عدّله بحسب نمو قطاعك الفعلي، ولا تعتمد عليه كرقم مرجعي.
        // تدقيق دفعة 3 (اختبار عميل بقالة 2026-07-12): «تكلفة متغيرة %» وحدها كانت
        // تُجبر بائع تجزئة/بقالة على خلط الهدر والتلف وعمولة منصات التوصيل داخل رقم
        // واحد بلا تفصيل. عمولة التوصيل تبقى مدموجة عمداً داخل variableCostRate
        // للأنشطة التي وثّقتها قوالب الخبراء والاختبارات التراجعية بهذا الافتراض
        // (regression.restaurant) — لا تُفصَل هنا. wasteRate/platformCommissionRate
        // الجديدان اختياريان (افتراضهما صفر) لمن يريد تفصيلاً أدق دون كسر أي دراسة
        // قائمة: المحرك يجمعهما فوق variableCostRate (revenue.js)، فلا يتغيّر شيء
        // ما لم يملأهما المستخدم صراحة. نطاقات sectorBenchmarks.js القطاعية (خصوصاً
        // تجزئة 55–75%) تقارَن بإجمالي التكلفة المتغيرة الفعلي شاملاً هذين العمودين
        // — أدخل تفصيلاً واقعياً بدل تحميل كل شيء على variableCostRate وحده كي لا
        // يظهر إنذار مضاعف زائف عند فصل الهدر/العمولة عن الرقم الإجمالي المعتاد.
        columns: [
            { key: 'service', label: 'الخدمة', type: 'text' },
            { key: 'customersPerMonth', label: 'العملاء/شهر', type: 'number' },
            { key: 'avgPrice', label: 'متوسط السعر', type: 'number' },
            { key: 'variableCostRate', label: 'تكلفة متغيرة %', type: 'number', default: 0.30 },
            { key: 'wasteRate', label: 'تلف وهدر %', type: 'number', default: 0, placeholder: 'اختياري — بقالة/مطعم: نسبة البضاعة التالفة أو المهدرة من المبيعات' },
            { key: 'platformCommissionRate', label: 'عمولة منصة %', type: 'number', default: 0, placeholder: 'اختياري — عمولة تطبيقات توصيل/بيع خارجية إن لم تكن مدموجة أعلاه' },
            { key: 'growthRate', label: 'نمو سنوي %', type: 'number', default: 0.07 },
            { key: 'year1', label: 'السنة 1', type: 'computed', formula: r => (r.customersPerMonth || 0) * 12 * (r.avgPrice || 0) }
        ],
        showTotal: true,
        totalColumn: 'year1'
    },
    // جدول الخدمات المفصل
    serviceItems: {
        title: 'الخدمات المفصلة',
        columns: [
            { key: 'name', label: 'اسم الخدمة', type: 'text' },
            { key: 'icon', label: 'الرمز', type: 'text' },
            { key: 'capex', label: 'CAPEX', type: 'number' },
            { key: 'fixedCosts', label: 'تكاليف ثابتة/شهر', type: 'number' },
            { key: 'variableCostPerUnit', label: 'تكلفة/عميل', type: 'number' },
            { key: 'pricePerUnit', label: 'سعر الخدمة', type: 'number' },
            { key: 'customersPerMonth', label: 'عملاء/شهر', type: 'number' },
            // ASSUMPTION (تدقيق 2026-07-08، ملاحظة عالية #22): نفس تقدير growthRate الداخلي
            // في revenueStreams أعلاه — لا مصدر خارجي، عدّله بحسب قطاعك الفعلي.
            { key: 'growthRate', label: 'نمو سنوي %', type: 'number', default: 0.07 },
            {
                key: 'annualRevenue', label: 'الإيراد السنوي', type: 'computed',
                formula: r => (r.customersPerMonth || 0) * 12 * (r.pricePerUnit || 0)
            },
            {
                key: 'annualProfit', label: 'الربح السنوي', type: 'computed',
                formula: r => {
                    const revenue = (r.customersPerMonth || 0) * 12 * (r.pricePerUnit || 0);
                    const varCosts = (r.customersPerMonth || 0) * 12 * (r.variableCostPerUnit || 0);
                    const fixedCosts = (r.fixedCosts || 0) * 12;
                    return revenue - varCosts - fixedCosts;
                }
            }
        ],
        showTotal: true,
        totalColumn: 'annualProfit'
    },

    // ═══════════════════════════════════════════════════════════
    // جداول التحليل الاستراتيجي
    // ═══════════════════════════════════════════════════════════
    pestelFactors: {
        title: 'تحليل PESTEL',
        columns: [
            { key: 'label', label: 'العامل', type: 'text', readonly: true },
            { key: 'description', label: 'الوصف', type: 'textarea' },
            { key: 'impact', label: 'التأثير', type: 'select', options: [{ value: 'positive', label: 'إيجابي' }, { value: 'negative', label: 'سلبي' }, { value: 'neutral', label: 'محايد' }] },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: false
    },
    swotItems: {
        title: 'التحليل الرباعي (SWOT)',
        columns: [
            { key: 'category', label: 'الفئة', type: 'select', options: [{ value: 'strength', label: 'نقطة قوة' }, { value: 'weakness', label: 'نقطة ضعف' }, { value: 'opportunity', label: 'فرصة' }, { value: 'threat', label: 'تهديد' }] },
            { key: 'item', label: 'البند', type: 'text' },
            { key: 'priority', label: 'الأولوية', type: 'select', options: [{ value: 'high', label: 'عالية' }, { value: 'medium', label: 'متوسطة' }, { value: 'low', label: 'منخفضة' }] }
        ],
        showTotal: false
    },
    marketSegments: {
        title: 'شرائح العملاء',
        aiPrompt: 'suggest_segments',
        columns: [
            { key: 'name', label: 'الشريحة', type: 'text' },
            { key: 'demographics', label: 'الديموغرافيا', type: 'text' },
            { key: 'needs', label: 'الاحتياجات', type: 'text' },
            { key: 'size', label: 'الحجم (ريال)', type: 'number' },
            { key: 'priority', label: 'الأولوية', type: 'select', options: [{ value: 'primary', label: 'أولية' }, { value: 'secondary', label: 'ثانوية' }, { value: 'tertiary', label: 'ثالثة' }] }
        ],
        showTotal: true,
        totalColumn: 'size'
    },
    riskRegister: {
        title: 'سجل المخاطر',
        columns: [
            { key: 'name', label: 'الخطر', type: 'text' },
            { key: 'type', label: 'النوع', type: 'select', options: [{ value: 'operational', label: 'تشغيلي' }, { value: 'financial', label: 'مالي' }, { value: 'market', label: 'سوقي' }, { value: 'legal', label: 'قانوني' }, { value: 'technical', label: 'تقني' }] },
            { key: 'probability', label: 'الاحتمالية', type: 'select', options: [{ value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' }, { value: 'high', label: 'عالية' }] },
            { key: 'impact', label: 'الأثر', type: 'select', options: [{ value: 'low', label: 'منخفض' }, { value: 'medium', label: 'متوسط' }, { value: 'high', label: 'عالي' }] },
            {
                key: 'score', label: 'الدرجة', type: 'computed', formula: r => {
                    const probScore = { low: 1, medium: 2, high: 3 };
                    const impactScore = { low: 1, medium: 3, high: 5 };
                    return (probScore[r.probability] || 1) * (impactScore[r.impact] || 1);
                }
            },
            { key: 'mitigation', label: 'خطة المواجهة', type: 'text' },
            { key: 'owner', label: 'المسؤول', type: 'text' }
        ],
        showTotal: false
    },
    locationAssessment: {
        title: 'تقييم واختيار الموقع',
        aiPrompt: 'suggest_location_factors',
        columns: [
            { key: 'factor', label: 'معيار التقييم', type: 'text' },
            { key: 'rating', label: 'التقييم (1-5)', type: 'number', min: 1, max: 5, default: 3 },
            { key: 'weight', label: 'الأهمية النسبية %', type: 'number', default: 0 },
            { key: 'score', label: 'الدرجة الموزونة', type: 'computed', formula: r => (r.rating || 0) * ((r.weight || 0) / 100) },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: true,
        totalColumn: 'score'
    },
    glossary: {
        title: 'تعريف المصطلحات والرموز',
        aiPrompt: 'suggest_glossary',
        columns: [
            { key: 'term', label: 'المصطلح/الرمز', type: 'text', placeholder: 'NPV, IRR, BEP...' },
            { key: 'definition', label: 'التعريف', type: 'text' }
        ],
        showTotal: false
    },
    references: {
        title: 'المصادر والمراجع',
        columns: [
            { key: 'author', label: 'المؤلف', type: 'text' },
            { key: 'title', label: 'العنوان', type: 'text' },
            { key: 'publisher', label: 'الناشر', type: 'text' },
            { key: 'year', label: 'سنة النشر', type: 'text' },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: false
    },
    reviewers: {
        title: 'المحكمون والمختصون الفنيون',
        columns: [
            { key: 'name', label: 'الاسم', type: 'text' },
            { key: 'role', label: 'الدور', type: 'text', placeholder: 'محكم، مختص فني...' },
            { key: 'qualifications', label: 'المؤهلات', type: 'text' }
        ],
        showTotal: false
    },
    historicalData: {
        title: 'اتجاهات الطلب التاريخية (5 سنوات على الأقل)',
        columns: [
            { key: 'year', label: 'السنة', type: 'number', placeholder: '2020' },
            { key: 'demand', label: 'الطلب/الحجم', type: 'number', placeholder: 'بالوحدة أو الريال' },
            { key: 'notes', label: 'ملاحظات', type: 'text', placeholder: 'الاتجاه الصاعد إيجابي' }
        ],
        showTotal: false
    },
    supplyDemandBalance: {
        title: 'توازن العرض والطلب',
        columns: [
            { key: 'factor', label: 'العامل', type: 'text', placeholder: 'المنتج/السوق المستهدف' },
            { key: 'estimatedSupply', label: 'العرض المقدر', type: 'text' },
            { key: 'estimatedDemand', label: 'الطلب المقدر', type: 'text' },
            { key: 'balanceConclusion', label: 'الخلاصة', type: 'select', options: [{ value: 'opportunity', label: 'فرصة (الطلب > العرض)' }, { value: 'risk', label: 'خطر (العرض > الطلب)' }, { value: 'neutral', label: 'محايد' }] },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: false
    },
    partnershipContracts: {
        title: 'عقود الشراكة',
        columns: [
            { key: 'partnerName', label: 'اسم الشريك', type: 'text' },
            { key: 'role', label: 'الدور/المسؤولية', type: 'text' },
            { key: 'sharePercent', label: 'النسبة %', type: 'number' },
            { key: 'notes', label: 'ملاحظات', type: 'text' }
        ],
        showTotal: false
    }
};

/**
 * fieldOptions.js
 * ─────────────────────────────────────────────────────────────
 * خريطة الحقول التي نحوّلها من نصّ حرّ إلى عناصر اختيار (select / datalist / نعم-لا)
 * الهدف: تقليل ما يكتبه العميل يدوياً، خاصة الحقول الجغرافية والتصنيفية.
 *
 * قيدان حرجان (لا يُخالفان — يكسران المحرّك):
 *  1) businessModel: قيم value تبقى إنجليزية بالضبط (Independent / Franchise / Corporate_Venture)
 *     — المحرّك يقارنها حرفياً. التسمية المعروضة عربية فقط.
 *  2) city: لا يُدار من هنا إطلاقاً — يبقى select ديناميكي في Wizard.renderField
 *     مشتقّ من مفاتيح CITY_STATS بالضبط (وإلا يسقط الذكاء المحلي على default).
 *
 * getFieldOptionSpec(fullKey, labelKey) يُرجع spec المطابق (يجرّب fullKey ثم labelKey)
 * أو null إن لم يكن الحقل مُدارًا هنا.
 */

import { SAUDI_REGIONS } from '../data/SaudiCityStats.js';

// مناطق السعودية الـ13 (value = label = الاسم العربي للمنطقة)
const REGION_OPTIONS = SAUDI_REGIONS.map(r => ({ value: r.name, label: r.name }));

// أحياء شائعة لأبرز المدن — datalist يسمح بالكتابة الحرة أيضاً
const DISTRICT_OPTIONS = [
    // الرياض
    'العليا', 'النرجس', 'الملقا', 'الياسمين', 'حطين', 'القيروان',
    // جدة
    'الروضة', 'الشاطئ', 'السلامة', 'الحمراء',
    // الخبر / الدمام
    'العقربية', 'الراكة',
    // مكة
    'العزيزية', 'الششة',
    // المدينة
    'قباء', 'العوالي'
].map(d => ({ value: d, label: d }));

// أنواع النشاط (concept) — value = label عربي.
// قيد حرج: كل خيار (عدا «أخرى») يجب أن يحوي كلمة مفتاحية يطابقها regex القطاع في
// sectorBenchmarks.js (fnb/retail/service/industrial/logistics/saas) — وإلا يسقط الكشف
// القطاعي فتضيع مقارنات المدقق. يحرس هذا التطابقَ اختبارُ الانحدار في engine.auditorGrade.test.js.
// وُسِّعت القائمة لتشمل القطاعات غير الغذائية التي يفهمها المحرك أصلاً (تجزئة/خدمات/صناعة/لوجستيك/تقني).
const CONCEPT_OPTIONS = [
    // مطاعم ومقاهي (fnb)
    'مطعم',
    'كافيه/مقهى مختص',
    'مطبخ سحابي',
    'مخبز/حلويات',
    'مطعم وجبات سريعة',
    'عربة طعام (Food Truck)',
    'ضيافة/بوفيه',
    // تجزئة (retail)
    'متجر تجزئة / بقالة / سوبرماركت',
    // خدمي (service)
    'استشارات وخدمات مهنية',
    'تعليم وتدريب',
    'رعاية صحية / عيادة',
    'رياضة ولياقة / صالة رياضية',
    'صالون / مركز تجميل',
    'صيانة وتنظيف',
    // صناعي (industrial)
    'مصنع / تصنيع',
    // لوجستي (logistics)
    'نقل وشحن وتخزين',
    // تقني/رقمي (saas)
    'موقع دراسة جدوى / منصة SaaS',
    'تطبيق / منصة رقمية (SaaS)',
    'برمجيات وتقنية',
    // غير ذلك
    'أخرى'
].map(c => ({ value: c, label: c }));

// نموذج العمل — value إنجليزي ثابت (يقارنه المحرّك حرفياً)، label عربي معروض.
const BUSINESS_MODEL_OPTIONS = [
    { value: 'Independent', label: 'مستقل' },
    { value: 'Franchise', label: 'امتياز تجاري (فرنشايز)' },
    { value: 'Corporate_Venture', label: 'مشروع تابع لشركة' }
];

// الشكل القانوني — قيمة عربية مخزّنة كما هي (لا يقارنها المحرّك بأي enum إنجليزي)، value = label.
const LEGAL_FORM_OPTIONS = [
    'مؤسسة فردية',
    'شركة ذات مسؤولية محدودة',
    'شركة تضامن',
    'شركة مساهمة مبسّطة'
].map(f => ({ value: f, label: f }));

// L4 وأخواتها: حقول تُخزَّن قيمتها بالإنجليزية (يقارنها المحرّك حرفياً) لكنها كانت تُعرض
// كنص خام («Grey»، «Full_Launch»). نحوّلها إلى select: value إنجليزي ثابت + label عربي.
const ENV_CLASS_OPTIONS = [
    { value: 'Green', label: 'أخضر (صديق للبيئة ومدعوم)' },
    { value: 'Grey', label: 'رمادي (يتطلب معالجة بيئية)' },
    { value: 'Black_List', label: 'أسود (مرفوض أو عالي المخاطر تنظيمياً)' }
];
const LAUNCH_STRATEGY_OPTIONS = [
    { value: 'Full_Launch', label: 'إطلاق كامل' },
    { value: 'Pilot_Phase', label: 'مرحلة تجريبية' },
    { value: 'Outsourcing', label: 'إسناد خارجي' }
];
const DISTRIBUTION_OPTIONS = [
    { value: 'Intensive', label: 'توزيع مكثف' },
    { value: 'Selective', label: 'توزيع انتقائي' },
    { value: 'Exclusive', label: 'توزيع حصري' }
];
const DEMAND_ELASTICITY_OPTIONS = [
    { value: 'elastic', label: 'مرن (حساس للسعر)' },
    { value: 'inelastic', label: 'غير مرن (غير حساس للسعر)' },
    { value: 'unitary', label: 'وحدوي المرونة' }
];
const PRICING_POWER_OPTIONS = [
    { value: 'Price_Taker', label: 'متقبل للسعر (السوق يحدد السعر)' },
    { value: 'Price_Maker', label: 'صانع للسعر (أنت تحدد السعر)' }
];
const STUDY_TYPE_OPTIONS = [
    { value: 'bank_financing', label: 'تمويل بنكي' },
    { value: 'investor_pitch', label: 'عرض لمستثمر' },
    { value: 'internal_planning', label: 'تخطيط وتشغيل داخلي' },
    { value: 'idea_validation', label: 'اختبار فكرة مبدئي' },
    { value: 'expert_template', label: 'قالب مختص قابل للاعتماد' },
    { value: 'expansion_plan', label: 'توسع أو فرع جديد' },
    { value: 'acquisition_review', label: 'شراء أو استحواذ' }
];
const STUDY_RECIPIENT_TYPE_OPTIONS = [
    { value: 'freelancer', label: 'عمل حر / فرد' },
    { value: 'establishment', label: 'مؤسسة' },
    { value: 'llc', label: 'شركة ذات مسؤولية محدودة' },
    { value: 'corporation', label: 'شركة مساهمة / شركة كبرى' },
    { value: 'investor', label: 'مستثمر أو شريك' },
    { value: 'lender', label: 'بنك أو جهة تمويل' },
    { value: 'incubator', label: 'حاضنة / مسرعة / جهة حكومية' },
    { value: 'consultant', label: 'مختص / مستشار' }
];
// نوع الكيان القانوني (projectInfo.ownershipType) — value إنجليزي ثابت + label عربي
const OWNERSHIP_TYPE_OPTIONS = [
    { value: 'freelancer', label: 'عمل حر / وثيقة عمل حر' },
    { value: 'individual', label: 'مؤسسة فردية' },
    { value: 'establishment', label: 'مؤسسة' },
    { value: 'partnership', label: 'شراكة (شركاء)' },
    { value: 'company', label: 'شركة (ذات مسؤولية محدودة/مساهمة)' },
    { value: 'llc', label: 'شركة ذات مسؤولية محدودة' },
    { value: 'corporation', label: 'شركة مساهمة / شركة كبرى' }
];
// نمط الموسمية (assumptions.seasonalityProfile) — value إنجليزي ثابت + label عربي
const SEASONALITY_OPTIONS = [
    { value: 'flat', label: 'ثابت (بلا موسمية)' },
    { value: 'ramadan', label: 'ذروة رمضان والأعياد' },
    { value: 'summer', label: 'ركود صيفي' },
    { value: 'winter', label: 'ذروة شتوية' }
];

// الشريحة المستهدفة (targetSegment) - datalist ليسمح بالكتابة الحرة
// شرائح سعودية شائعة (value = label عربي) — نفس نمط district
const TARGET_SEGMENT_OPTIONS = [
    'عائلات',
    'شباب 18-35',
    'موظفون',
    'طلاب',
    'سياح وزوار',
    'أفراد - أطفال',
    'أعمال - شركات (B2B)',
    'جهات حكومية (B2G)',
    'الكل'
].map(s => ({ value: s, label: s }));

// ملف المستثمر (projectInfo.investorProfile) — value إنجليزي ثابت (يقارنه المحرّك حرفياً) + label عربي
const INVESTOR_PROFILE_OPTIONS = [
    { value: 'conservative', label: 'محافظ' },
    { value: 'speculator', label: 'مضارب' },
    { value: 'balanced', label: 'متوازن' }
];

// مستوى الاستفادة من التقنية (techInvestmentLevel) — value إنجليزي ثابت + label عربي
const TECH_INVESTMENT_LEVEL_OPTIONS = [
    { value: 'low', label: 'منخفضة' },
    { value: 'medium', label: 'متوسطة' },
    { value: 'high', label: 'عالية' }
];

// الميزة التنافسية (competitiveAdvantage) - datalist
const COMPETITIVE_ADVANTAGE_OPTIONS = [
    { value: 'السعر الأقل', label: 'السعر الأقل' },
    { value: 'الجودة العالية والتميز', label: 'الجودة العالية والتميز' },
    { value: 'الموقع الاستراتيجي', label: 'الموقع الاستراتيجي' },
    { value: 'خدمة عملاء استثنائية', label: 'خدمة عملاء استثنائية' },
    { value: 'تقنية مبتكرة', label: 'تقنية مبتكرة' },
    { value: 'سرعة الإنجاز والتوصيل', label: 'سرعة الإنجاز والتوصيل' }
];

const YESNO = { control: 'yesno' };

/**
 * FIELD_OPTIONS: خريطة (keyPath أو labelKey) → { control, options? }
 * المفاتيح المنطقية (نعم/لا) مأخوذة من schema.js:
 *  - preliminaryCheck.*        (schema ~73)
 *  - problemQualityChecklist.* (schema ~161)
 *  - governance.auditCommittee (schema ~615)
 */
export const FIELD_OPTIONS = {
    // ── حقول جغرافية / تصنيفية ──
    concept: { control: 'select', options: CONCEPT_OPTIONS },
    studyType: { control: 'select', options: STUDY_TYPE_OPTIONS },
    studyRecipientType: { control: 'select', options: STUDY_RECIPIENT_TYPE_OPTIONS },
    businessModel: { control: 'select', options: BUSINESS_MODEL_OPTIONS },
    legalForm: { control: 'select', options: LEGAL_FORM_OPTIONS },
    region: { control: 'select', options: REGION_OPTIONS },
    district: { control: 'datalist', options: DISTRICT_OPTIONS },
    targetSegment: { control: 'datalist', options: TARGET_SEGMENT_OPTIONS },
    competitiveAdvantage: { control: 'datalist', options: COMPETITIVE_ADVANTAGE_OPTIONS },

    // ── قيم enum مخزّنة بالإنجليزية → select بقيمة إنجليزية وتسمية عربية (L4) ──
    environmentalClass: { control: 'select', options: ENV_CLASS_OPTIONS },
    launchStrategy: { control: 'select', options: LAUNCH_STRATEGY_OPTIONS },
    distributionStrategy: { control: 'select', options: DISTRIBUTION_OPTIONS },
    demandElasticity: { control: 'select', options: DEMAND_ELASTICITY_OPTIONS },
    pricingPower: { control: 'select', options: PRICING_POWER_OPTIONS },
    ownershipType: { control: 'select', options: OWNERSHIP_TYPE_OPTIONS },
    seasonalityProfile: { control: 'select', options: SEASONALITY_OPTIONS },
    // قيد: المسار الكامل فقط — appendices.investorProfile نصّ حرّ (نبذة) وليس enum
    'projectInfo.investorProfile': { control: 'select', options: INVESTOR_PROFILE_OPTIONS },
    techInvestmentLevel: { control: 'select', options: TECH_INVESTMENT_LEVEL_OPTIONS },
    'projectInfo.techInvestmentLevel': { control: 'select', options: TECH_INVESTMENT_LEVEL_OPTIONS },

    // ── الدراسة المبدئية (preliminaryCheck) — أزرار نعم/لا ──
    'preliminaryCheck.isProjectFeasible': YESNO,
    'preliminaryCheck.suitableForEnvironment': YESNO,
    'preliminaryCheck.hasInitialResources': YESNO,
    'preliminaryCheck.readyForDetailedStudy': YESNO,
    isProjectFeasible: YESNO,
    suitableForEnvironment: YESNO,
    hasInitialResources: YESNO,
    readyForDetailedStudy: YESNO,

    // ── قائمة جودة المشكلة (problemQualityChecklist) — أزرار نعم/لا ──
    'problemQualityChecklist.popular': YESNO,
    'problemQualityChecklist.growing': YESNO,
    'problemQualityChecklist.urgent': YESNO,
    'problemQualityChecklist.expensive': YESNO,
    'problemQualityChecklist.mandatory': YESNO,
    'problemQualityChecklist.frequent': YESNO,
    popular: YESNO,
    growing: YESNO,
    urgent: YESNO,
    expensive: YESNO,
    mandatory: YESNO,
    frequent: YESNO,

    // ── الحوكمة ──
    'governance.auditCommittee': YESNO,
    auditCommittee: YESNO
};

/**
 * يُرجع spec الحقل المطابق أو null.
 * يجرّب المسار الكامل (fullKey) أولاً ثم مفتاح التسمية (labelKey).
 */
export function getFieldOptionSpec(fullKey, labelKey) {
    if (fullKey && Object.prototype.hasOwnProperty.call(FIELD_OPTIONS, fullKey)) {
        return FIELD_OPTIONS[fullKey];
    }
    if (labelKey && Object.prototype.hasOwnProperty.call(FIELD_OPTIONS, labelKey)) {
        return FIELD_OPTIONS[labelKey];
    }
    return null;
}

export function getOptionLabel(fieldKey, value) {
    const spec = getFieldOptionSpec(fieldKey, fieldKey);
    const found = spec?.options?.find(option => option.value === value);
    return found?.label || value || '';
}

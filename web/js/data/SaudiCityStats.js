/**
 * SaudiCityStats.js
 * قاعدة بيانات الذكاء المحلي للمدن السعودية
 * تحتوي على متوسطات الإيجار، الرواتب، والقوة الشرائية لدعم القرارات الذكية.
 */

export const SAUDI_REGIONS = [
    { id: 'riyadh', name: 'الرياض', cities: ['الرياض', 'الخرج', 'المجمعة'] },
    { id: 'makkah', name: 'مكة المكرمة', cities: ['جدة', 'مكة المكرمة', 'الطائف'] },
    { id: 'sharkia', name: 'المنطقة الشرقية', cities: ['الدمام', 'الخبر', 'الجبيل', 'الأحساء'] },
    { id: 'madinah', name: 'المدينة المنورة', cities: ['المدينة المنورة', 'ينبع'] },
    { id: 'aseer', name: 'عسير', cities: ['أبها', 'خميس مشيط'] },
    { id: 'qassim', name: 'القصيم', cities: ['بريدة', 'عنيزة'] },
    { id: 'tabuk', name: 'تبوك', cities: ['تبوك', 'نيوم'] },
    { id: 'hail', name: 'حائل', cities: ['حائل'] },
    { id: 'north', name: 'الحدود الشمالية', cities: ['عرعر'] },
    { id: 'jouf', name: 'الجوف', cities: ['سكاكا'] },
    { id: 'jazan', name: 'جازان', cities: ['جازان'] },
    { id: 'najran', name: 'نجران', cities: ['نجران'] },
    { id: 'baha', name: 'الباحة', cities: ['الباحة'] },
];

// البيانات الافتراضية لكل مدينة (تقديرية لعام 2025)
// rent_retail: متوسط إيجار المتر التجاري (ريال/سنة)
// rent_office: متوسط إيجار المتر المكتبي
// salary_factor: معامل ضرب للرواتب (الرياض أعلى من غيرها)
// purchasing_power: مؤشر القوة الشرائية (1-10)
// ملاحظة (توحيد 2026-07-13): لا حقل population هنا عمداً — كان نسخة يدوية ثالثة
// من أرقام السكان انحرفت حتى +40% (الخبر) عن لقطة GASTAT الرسمية. مصدر السكان
// الوحيد هو web/data/SaudiDemographics.json عبر core/marketSizingModel.js؛
// اختبار marketSizing.unified يحرس ضد عودته.
export const CITY_STATS = {
    'الرياض': { rent_retail: 1200, rent_office: 600, salary_factor: 1.15, purchasing_power: 10 },
    'جدة': { rent_retail: 1000, rent_office: 500, salary_factor: 1.05, purchasing_power: 9 },
    'الدمام': { rent_retail: 800, rent_office: 450, salary_factor: 1.0, purchasing_power: 8 },
    'الخبر': { rent_retail: 900, rent_office: 500, salary_factor: 1.05, purchasing_power: 9 },
    'مكة المكرمة': { rent_retail: 1500, rent_office: 400, salary_factor: 0.95, purchasing_power: 8, seasonal: true },
    'المدينة المنورة': { rent_retail: 900, rent_office: 400, salary_factor: 0.95, purchasing_power: 7, seasonal: true },
    'أبها': { rent_retail: 600, rent_office: 300, salary_factor: 0.9, purchasing_power: 6, seasonal: true },
    'خميس مشيط': { rent_retail: 550, rent_office: 250, salary_factor: 0.9, purchasing_power: 6 },
    'بريدة': { rent_retail: 500, rent_office: 250, salary_factor: 0.9, purchasing_power: 6 },
    'تبوك': { rent_retail: 450, rent_office: 250, salary_factor: 0.95, purchasing_power: 6 },
    'حائل': { rent_retail: 400, rent_office: 200, salary_factor: 0.9, purchasing_power: 5 },
    'default': { rent_retail: 400, rent_office: 200, salary_factor: 1.0, purchasing_power: 5 }
};

export function getCityStats(city) {
    return CITY_STATS[city] || CITY_STATS['default'];
}

export function getSuggestion(city, sector) {
    const stats = getCityStats(city);
    let rent = stats.rent_retail;

    // تعديل حسب القطاع
    if (sector === 'technology' || sector === 'office') rent = stats.rent_office;
    if (sector === 'industrial') rent = 150; // صناعي رخيص عادة

    return {
        rent_sqm: rent,
        salary_multiplier: stats.salary_factor,
        notes: `تقديرات مستندة لبيانات ${city} (متوسط السوق)`
    };
}

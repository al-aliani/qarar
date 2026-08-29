/**
 * عرض "هل أرقامي منطقية؟" — مقارنة مع معايير القطاع (المهمة 4 — خطة التفوق).
 * مستوحى من جدوى كلاود: عرض Benchmarking يفتقده المستخدم عندهم.
 */
import { getCostRatios } from '../core/costRatios.js';
import { escapeHtml } from '../utils/escape.js';

/** معايير قطاعية — Food Cost، Labor %، Rent %، Gross Margin، Profit Margin (نطاقات %) */
const SECTOR_BENCHMARKS = {
    restaurant: {
        name: 'المطاعم والكافيهات',
        foodCost: [28, 35],
        laborPct: [25, 35],
        rentPct: [5, 15],
        grossMargin: [65, 72],
        profitMargin: [5, 12],
        paybackYears: [2, 4]
    },
    retail: {
        name: 'البيع بالتجزئة',
        foodCost: null,
        laborPct: [15, 25],
        rentPct: [8, 18],
        grossMargin: [35, 50],
        profitMargin: [3, 8],
        paybackYears: [3, 5]
    },
    services: {
        name: 'الخدمات المهنية',
        foodCost: null,
        laborPct: [40, 55],
        rentPct: [5, 12],
        grossMargin: [70, 90],
        profitMargin: [15, 30],
        paybackYears: [1, 2]
    },
    fitness: {
        name: 'النوادي الرياضية',
        foodCost: null,
        laborPct: [30, 45],
        rentPct: [10, 20],
        grossMargin: [60, 75],
        profitMargin: [10, 20],
        paybackYears: [2, 4]
    },
    default: {
        name: 'عام',
        foodCost: null,
        laborPct: [20, 35],
        rentPct: [5, 15],
        grossMargin: [50, 70],
        profitMargin: [5, 15],
        paybackYears: [2, 5]
    }
};

function inferSector(concept) {
    const c = (concept || '').toString().toLowerCase();
    if (/مطعم|مقهى|كافيه|قهوة|برجر|وجبات|طعام|غذاء/i.test(c)) return 'restaurant';
    if (/تجزئة|متجر|بيع| retail /i.test(c)) return 'retail';
    if (/خدمة|استشارة|مكتب|مهني/i.test(c)) return 'services';
    if (/نادي|رياضة|جيم|fitness/i.test(c)) return 'fitness';
    return 'default';
}

function inRange(val, range) {
    if (val == null || !Number.isFinite(val) || !range || !Array.isArray(range)) return null;
    return val >= range[0] && val <= range[1];
}

/**
 * يُرجع HTML لقسم Benchmarking
 * @param {object} results - ناتج runFullModel
 * @param {object} studyData - حالة الدراسة
 */
export function renderBenchmarkingSection(results, studyData) {
    if (!results || !results.incomeStatement || results.incomeStatement.length === 0) return '';

    const y1 = results.incomeStatement[0] || {};
    const rev = y1.revenue ?? 0;
    const vc = y1.variableCosts ?? 0;
    const gross = y1.grossProfit ?? 0;
    const net = y1.netIncome ?? 0;
    const indicators = results.indicators || {};
    const payback = indicators.paybackPeriod ?? indicators.payback ?? null; // runFullModel returns paybackPeriod

    const concept = studyData?.projectInfo?.concept || studyData?.projectInfo?.description || '';
    const sectorKey = inferSector(concept);
    const bench = SECTOR_BENCHMARKS[sectorKey] || SECTOR_BENCHMARKS.default;

    // استخراج Labor و Rent من opex إن وُجد (aggregateOpex يُرجع fixed/variable arrays)
    const foodCostPct = rev > 0 ? (vc / rev) * 100 : null;
    // مجمل الربح من مصدر المحرك الموحّد (indicators.grossMargin = هامش المساهمة التشغيلي،
    // كسر 0..1) لا من حساب محلي. الحساب المحلي grossProfit ÷ الإيراد **الكلي** يقسم على
    // إيراد يشمل غير التشغيلي، فيعرض 99% لمشروع هامشه التشغيلي 65% — نفس العيب المُصحَّح
    // في المحرك (2026-08-25)، وهذه هي الشاشة الوحيدة التي يراه فيها المستخدم فعلاً.
    // الاحتياطي (الحساب القديم) لنتائج مُخزَّنة قبل التصحيح لا تحمل الحقل أصلاً.
    // تصحيح 2026-08-25: `typeof null === 'object'` — فالفحص السابق كان يسقط عند
    // grossMargin=null إلى الحساب المحلي، وهو بالضبط ما يحذّر منه تعليق المحرك:
    // مشروع بلا إيراد تشغيلي (تأجير عقاري مثلاً) grossProfit÷revenue = 100% فتُعرض
    // «100.0% — خارج النطاق» لمنشأة لا تبيع شيئاً. التمييز الآن بوجود الحقل:
    //   null      = المحرك حسبها وقرّر «غير منطبق» ⟶ لا نعرض رقماً
    //   undefined = نتيجة مُخزَّنة قبل التصحيح لا تحمل الحقل ⟶ الاحتياطي المحلي
    const hasEngineGrossMargin = 'grossMargin' in indicators;
    const engineGrossMargin = indicators.grossMargin;
    const grossMarginPct = hasEngineGrossMargin
        ? (Number.isFinite(engineGrossMargin) ? engineGrossMargin * 100 : null)
        : (rev > 0 ? (gross / rev) * 100 : null);
    const profitMarginPct = rev > 0 ? (net / rev) * 100 : null;
    const ratios = getCostRatios(results);
    const laborPct = rev > 0 ? ratios.labor * 100 : null;
    const rentPct = rev > 0 ? ratios.rent * 100 : null;

    const rows = [];

    if (bench.foodCost && foodCostPct != null) {
        const ok = inRange(foodCostPct, bench.foodCost);
        rows.push({
            label: 'تكلفة المواد (Food Cost %)',
            mine: foodCostPct.toFixed(1) + '%',
            range: `${bench.foodCost[0]}-${bench.foodCost[1]}%`,
            ok
        });
    }
    if (bench.grossMargin && grossMarginPct != null) {
        const ok = inRange(grossMarginPct, bench.grossMargin);
        rows.push({
            label: 'مجمل الربح (Gross Margin %)',
            mine: grossMarginPct.toFixed(1) + '%',
            range: `${bench.grossMargin[0]}-${bench.grossMargin[1]}%`,
            ok
        });
    }
    if (bench.laborPct && laborPct != null) {
        const ok = inRange(laborPct, bench.laborPct);
        rows.push({
            label: 'نسبة الرواتب (Labor %)',
            mine: laborPct.toFixed(1) + '%',
            range: `${bench.laborPct[0]}-${bench.laborPct[1]}%`,
            ok
        });
    }
    if (bench.rentPct && rentPct != null) {
        const ok = inRange(rentPct, bench.rentPct);
        rows.push({
            label: 'نسبة الإيجار (Rent %)',
            mine: rentPct.toFixed(1) + '%',
            range: `${bench.rentPct[0]}-${bench.rentPct[1]}%`,
            ok
        });
    }
    if (bench.profitMargin && profitMarginPct != null) {
        const ok = inRange(profitMarginPct, bench.profitMargin);
        rows.push({
            label: 'هامش الربح الصافي (%)',
            mine: profitMarginPct.toFixed(1) + '%',
            range: `${bench.profitMargin[0]}-${bench.profitMargin[1]}%`,
            ok
        });
    }
    if (bench.paybackYears && payback != null && Number.isFinite(payback)) {
        const ok = inRange(payback, bench.paybackYears);
        rows.push({
            label: 'فترة الاسترداد (سنوات)',
            mine: payback.toFixed(1) + ' سنة',
            range: `${bench.paybackYears[0]}-${bench.paybackYears[1]} سنة`,
            ok
        });
    }

    if (rows.length === 0) return '';

    const okCount = rows.filter(r => r.ok === true).length;
    const totalRows = rows.length;
    const allOk = okCount === totalRows;

    return `
        <div class="card glass-card mt-4" id="benchmarkingSection" aria-label="هل أرقامي منطقية؟">
            <h3 class="card-title mb-2 text-gold"><svg class="ic" aria-hidden="true"><use href="#i-chart"/></svg> هل أرقامي منطقية؟</h3>
            <p class="text-xs text-muted mb-3">مقارنة مع معايير قطاع «${escapeHtml(bench.name)}» في السوق السعودي. الأرقام خارج النطاق قد تحتاج مراجعة.</p>
            <div class="benchmarks-container overflow-x-auto">
                <table class="data-table" style="font-size: 0.9rem;">
                    <thead>
                        <tr>
                            <th>المؤشر</th>
                            <th>قيمتك</th>
                            <th>النطاق المعياري</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr>
                                <td>${r.label}</td>
                                <td class="text-mono">${r.mine}</td>
                                <td class="text-muted text-sm">${r.range}</td>
                                <td>${r.ok === true ? '<span class="text-success"><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg> ضمن النطاق</span>' : r.ok === false ? '<span class="text-warning"><svg class="ic" aria-hidden="true"><use href="#i-warning"/></svg> خارج النطاق</span>' : '<span class="text-muted">—</span>'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <p class="text-xs text-muted mt-3 mb-0">${okCount}/${totalRows} مؤشر ضمن النطاق المعياري. ${allOk ? 'أرقامك قريبة من معايير القطاع <svg class="ic" aria-hidden="true"><use href="#i-check"/></svg>' : 'راجع المؤشرات الخارجة عن النطاق إن كانت غير مقصودة.'}</p>
        </div>
    `;
}

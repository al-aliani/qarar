/**
 * عرض "هل أرقامي منطقية؟" — مقارنة مع معايير القطاع (المهمة 4 — خطة التفوق).
 * مستوحى من جدوى كلاود: عرض Benchmarking يفتقده المستخدم عندهم.
 */
import { getCostRatios } from '../core/costRatios.js';
import { resolveSectorBenchmark } from '../core/sectorBenchmarks.js';
import { escapeHtml } from '../utils/escape.js';

/**
 * تدقيق 2026-09-04: كان هنا **جدول معايير قطاعي ثانٍ بكاشف قطاع مستقل** يناقض
 * المصدر الموحّد في core/sectorBenchmarks.js — رغم أن ذاك يوثّق نفسه بأنه «نقطة
 * الدخول الوحيدة كي لا يتناقض حكمان على نفس الرقم».
 *
 * النتيجة على الشاشة: عيادة برواتب 40% من المبيعات تحصل في نفس الجلسة على
 * «مقبول» من بوابة الجودة والمستشار (نطاق خدمي 30–50%) و«⚠ خارج النطاق» من هذه
 * البطاقة (نطاق «عام» 20–35%). وكان كاشفها المحلي لا يطابق «رعاية صحية / عيادة»
 * ولا «صالون / مركز تجميل» ولا «تعليم وتدريب» فيسمّي قطاعها «عام» صراحةً أمام
 * المستخدم — أي أن المنصة تخبره أنها لا تعرف قطاعه.
 *
 * النطاقات الآن مشتقّة من المصدر الموحّد. مجمل الربح يُشتق حسابياً من نطاق التكلفة
 * المتغيرة (١٠٠٪ − التكلفة) بدل رقم مستقل قد ينحرف عنه.
 */

/** كسور 0..1 من المصدر الموحّد ⟶ نسب مئوية للعرض. */
const toPct = ([lo, hi]) => [Math.round(lo * 100), Math.round(hi * 100)];

/**
 * فترة الاسترداد الوحيدة التي لا يحملها المصدر الموحّد — تبقى هنا موسومة صراحةً
 * كتقدير عرض محلي (ASSUMPTION)، لا كأنها معيار رسمي.
 */
const PAYBACK_YEARS_BY_LABEL = {
    'مطاعم ومقاهي': [2, 4],
    'تجزئة': [3, 5],
    'تجزئة عالية الهامش (عطور/تجميل/إكسسوارات/أزياء)': [2, 4],
    'خدمي': [1, 3],
    'صناعي': [3, 6],
    'لوجستي': [3, 5],
    'منصة رقمية/SaaS': [2, 5]
};

/** يبني نطاقات العرض من المعيار الموحّد للدراسة. */
function buildDisplayBenchmark(state) {
    const bench = resolveSectorBenchmark(state);
    const variableCost = toPct(bench.variableCostRate);
    return {
        name: bench.label,
        isGeneric: bench.isGeneric,
        foodCost: variableCost,
        laborPct: toPct(bench.laborToRevenue),
        rentPct: toPct(bench.rentToRevenue),
        // مجمل الربح = ١٠٠٪ − التكلفة المتغيرة، مشتقّ لا مستقل
        grossMargin: [100 - variableCost[1], 100 - variableCost[0]],
        profitMargin: toPct(bench.netProfitToRevenue),
        paybackYears: PAYBACK_YEARS_BY_LABEL[bench.label] || [2, 5]
    };
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

    const bench = buildDisplayBenchmark(studyData);

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
            <p class="text-xs text-muted mb-3">مقارنة مع معايير قطاع «${escapeHtml(bench.name)}» في السوق السعودي — نطاقات تقديرية داخلية لا أرقام رسمية منشورة. الأرقام خارج النطاق قد تحتاج مراجعة.${bench.isGeneric ? ' <strong>لم يُحدَّد نشاط المشروع بدقة، فالمقارنة بنطاق عام</strong> — حدِّد النشاط في «معلومات المشروع» لمقارنة أدقّ.' : ''}</p>
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

/**
 * Idea Score — نتيجة الفكرة (0–100)
 * تُقيّم قوة فكرة المشروع قبل البدء بالتقرير الكامل.
 * تعتمد حصراً على: هامش الربح المتوقع، وحجم السوق (TAM).
 *
 * تدقيق 2026-07-09 (فصل متعمد — علة #1): كانت هذه الدالة تخلط بين اكتمال تعبئة
 * النموذج (40% من المجموع) وبين مؤشرات الجودة المالية الفعلية (هامش + TAM) تحت
 * رقم واحد باسم مضلِّل "نتيجة الفكرة" — أي أن مشروعاً بلا أي جدوى مالية حقيقية
 * كان يمكن أن يحصل على 40/100 فقط لكون المستخدم ملأ الحقول، بمعزل تام عن جودته
 * المالية. لا يجوز أن تكافئ "نتيجة الفكرة" مجرد ملء حقول — لذا الآن:
 * score = margin + tam حصراً (سقفه الطبيعي 100)، وbreakdown.completeness تبقى
 * محسوبة ومُعادة في الكائن الراجع كمعلومة مفيدة للواجهة، لكنها لا تدخل في مجموع
 * score إطلاقاً.
 */

import { calculateStudyCompleteness } from '../utils/studyCompleteness.js';
import { calculateStudy } from './engine.js';
import { resolveSectorBenchmark } from './sectorBenchmarks.js';

/**
 * حساب نتيجة الفكرة من 0 إلى 100 — تعتمد حصراً على جودة الفكرة المالية
 * (هامش الربح 0-50 + حجم السوق TAM 0-50)، لا اكتمال تعبئة النموذج
 * (انظر تعليق الفصل المتعمد أعلى الملف).
 * @param {Object} state - حالة الدراسة (store.getState())
 * @param {Object} [results] - نتيجة المحرك (إن وُجدت) لتجنب إعادة التشغيل
 * @returns {{ score: number, color: 'red'|'yellow'|'green', breakdown: { completeness: number, margin: number, tam: number }, message: string }}
 */
export function calculateIdeaScore(state, results = null) {
    if (!state) return { score: 0, color: 'red', breakdown: { completeness: 0, margin: 0, tam: 0 }, message: 'لا توجد بيانات' };

    const breakdown = { completeness: 0, margin: 0, tam: 0 };

    // اكتمال البيانات — معلوماتي فقط (لا يدخل في score، انظر تعليق الفصل أعلى الملف)
    const completenessData = calculateStudyCompleteness(state);
    const completenessPct = Math.min(100, Math.max(0, completenessData.percentage ?? 0));
    breakdown.completeness = Math.round((completenessPct / 100) * 40);

    // 1) هامش الربح المتوقع — وزن 50%
    // Number(undefined) = NaN وليس null، فـ ?? لا يلتقطها — نستخدم حارس Finite صريحاً
    const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    // تدقيق 2026-07-08 (ملاحظة عالية #42): كانت عتبات 20%/15%/10%/5% أرقاماً مستقلة
    // مكرَّرة مرتين هنا، غير مرتبطة بجدول sectorBenchmarks.js الموحّد المستخدم في
    // بقية المنصة لنفس الغرض (فحص هامش الربح). الآن تُشتَق العتبات من نطاق القطاع
    // الفعلي (netProfitToRevenue) بدل رقم عام واحد يناسب كل القطاعات خطأً.
    const bench = resolveSectorBenchmark(state);
    const [sectorLo, sectorHi] = bench.netProfitToRevenue;
    const scoreMargin = (netMargin) => {
        if (netMargin >= sectorHi) return 50;
        if (netMargin >= sectorLo) return 37;
        if (netMargin >= sectorLo / 2) return 20;
        if (netMargin > 0) return 10;
        return 0;
    };
    let marginScore = 0;
    if (results && typeof results.indicators === 'object') {
        marginScore = scoreMargin(safeNum(results.indicators.netMargin));
    } else {
        try {
            const res = calculateStudy(state);
            if (res && res.indicators) {
                marginScore = scoreMargin(safeNum(res.indicators.netMargin));
            }
        } catch (_) {
            // لا نتائج مالية بعد — نعطي جزءاً من النقاط حسب وجود إيرادات وتكاليف
            const rev = state.revenue?.streams?.length || state.revenue?.revenueStreams?.length || 0;
            const hasCosts = !!(state.technical?.equipment?.length || state.hr?.positions?.length);
            if (rev > 0 && hasCosts) marginScore = 10;
            else if (rev > 0 || hasCosts) marginScore = 5;
        }
    }
    breakdown.margin = marginScore;

    // 2) حجم السوق (TAM) — وزن 50%
    // ASSUMPTION (تدقيق 2026-07-09): خلافاً لعتبات الهامش أعلاه (مُشتقة من نطاق
    // sectorBenchmarks.js الفعلي لكل قطاع)، عتبات TAM أدناه (10م/1م/500ك/100ك/50ك ريال)
    // أرقام داخلية ثابتة يدوياً — لا يوجد في sectorBenchmarks.js أي حقل خاص بحجم
    // السوق/TAM يمكن الاشتقاق منه (تحقّق: sectorBenchmarks.js لا يذكر tam/marketSize
    // إطلاقاً). فهي تقدير تقريبي عام لبوابة تصنيف سريعة فقط، وليست معياراً قطاعياً
    // موثّقاً — لا تُستخدم كرقم مرجعي دقيق.
    const tamRaw = state.marketSizing?.tam?.value ?? state.marketSizing?.tam ?? 0;
    const tamNum = typeof tamRaw === 'object' ? (tamRaw.value ?? tamRaw) : Number(tamRaw) || 0;
    let tamScore = 0;
    if (tamNum > 0) {
        if (tamNum >= 10_000_000) tamScore = 50;
        else if (tamNum >= 1_000_000) tamScore = 40;
        else if (tamNum >= 500_000) tamScore = 33;
        else if (tamNum >= 100_000) tamScore = 25;
        else if (tamNum >= 50_000) tamScore = 17;
        else tamScore = 8;
    }
    breakdown.tam = tamScore;

    // score = margin + tam حصراً — completeness معلوماتية فقط ولا تُحتسب هنا (انظر تعليق الفصل أعلى الملف)
    const score = Math.min(100, Math.round(breakdown.margin + breakdown.tam));

    let color = 'red';
    if (score >= 71) color = 'green';
    else if (score >= 41) color = 'yellow';

    let message = 'فكرة في بدايتها';
    if (score >= 71) message = 'فكرة قوية';
    else if (score >= 41) message = 'فكرة جيدة — يمكن تحسينها';

    return { score, color, breakdown, message };
}

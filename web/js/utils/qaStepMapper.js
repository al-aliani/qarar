/**
 * يربط عناصر فحص الجودة (qaChecks.js/validateInputs.js — كلاهما يحمل { code, path })
 * بفهرس خطوة المعالج (STEPS) المسؤولة عن ذلك المسار، كي تصبح قائمة تحذيرات التصدير
 * قابلة للنقر («كل تحذير يقفز لقسمه») بدل عرض عدد مجرّد بلا تفصيل.
 *
 * تدقيق دفعة 3 (2026-07-12، اختبار عميل بقالة): نافذة التصدير كانت تعرض «تحذيرات: 6»
 * بلا أي تفصيل أو رابط. معظم مسارات qaChecks تطابق مفاتيح SECTIONS مباشرة (أول جزء من
 * path)؛ القلة التي تشير لنتائج محسوبة (kpis/decision/incomeStatement...) أو معايير
 * قطاعية عامة (drivers) تُوجَّه هنا صراحة لأقرب خطوة عرض ذات صلة.
 */
import { stepIndexById } from '../core/wizardSteps.js';

// مسارات لا تقابل قسم إدخال مباشر (مؤشرات/نتائج محسوبة) — تُوجَّه لأقرب خطوة عرض.
const PATH_PREFIX_OVERRIDES = {
    financial: 'dashboard',
    kpis: 'dashboard',
    decision: 'decisionDashboard',
    incomeStatement: 'financialStatements',
    balanceSheets: 'balance_sheet',
    capex: 'technical',
    opex: 'dashboard',
    drivers: 'dashboard',
};

// تحذيرات معايير القطاع (sectorBenchmarks.js checkDriversAgainstBenchmarks) تحمل
// مساراً عاماً واحداً ('drivers') لثلاثتها، لكن كل رمز يخص قسم إدخال مختلف فعلياً —
// أدق من التوجيه العام أعلاه.
const CODE_OVERRIDES = {
    BENCH_VC_RATE_LOW: 'revenue', BENCH_VC_RATE_HIGH: 'revenue',
    BENCH_RENT_RATIO_LOW: 'administrative', BENCH_RENT_RATIO_HIGH: 'administrative',
    BENCH_LABOR_RATIO_LOW: 'hr', BENCH_LABOR_RATIO_HIGH: 'hr',
};

/**
 * @param {{code?:string, path?:string}} item - عنصر تحذير/خطأ من qaChecks.js
 * @returns {number|null} فهرس الخطوة في STEPS، أو null إن تعذّر إيجاد قسم مرتبط
 */
export function resolveQaStepIndex(item) {
    const tryId = (id) => {
        if (!id) return null;
        const idx = stepIndexById(id);
        return idx >= 0 ? idx : null;
    };

    const code = item?.code;
    if (code && CODE_OVERRIDES[code]) {
        const idx = tryId(CODE_OVERRIDES[code]);
        if (idx != null) return idx;
    }

    const path = String(item?.path || '');
    const firstSegment = path.split(/[.[]/)[0];

    const direct = tryId(firstSegment);
    if (direct != null) return direct;

    if (PATH_PREFIX_OVERRIDES[firstSegment]) {
        const idx = tryId(PATH_PREFIX_OVERRIDES[firstSegment]);
        if (idx != null) return idx;
    }

    return null;
}

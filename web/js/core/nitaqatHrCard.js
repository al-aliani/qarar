/**
 * buildNitaqatHrCardData — يجمع تصنيف نطاقات (Nitaqat) + مقارنة تكلفة سعودي/وافد
 * لبطاقة تُعرض أسفل جدول «الوظائف والرواتب» (Wizard.js). دالة نقية بلا DOM، تعيد
 * استخدام نفس كاشف القطاع في sectorBenchmarks.js (SmartAdvisor/بوابة QA) ونفس ثوابت
 * GOSI/الرسوم الحكومية في engine.js (computeAnnualEmployeeCost) — لا كاشف قطاع
 * ولا صيغة تكلفة موازية (خطة الاستفادة 2026-07-12، مهمة Nitaqat، دفعة 4).
 */
import { classifyNitaqatTier } from './nitaqatBands.js';
import { detectSectorBenchmark, SECTOR_BENCHMARKS } from './sectorBenchmarks.js';
import { computeAnnualEmployeeCost } from './engine.js';
import { SAUDI_GOSI_RATE_2026 } from './schema.js';

// راتب أساسي شهري افتراضي لمقارنة التكلفة حين لا توجد رواتب مُدخلة بعد في الجدول —
// رقم توضيحي فقط (يُفصَح عنه في avgSalaryIsAssumed)، لا افتراضاً محاسبياً.
const DEFAULT_ILLUSTRATIVE_SALARY = 8000;

/**
 * @param {object} state - كامل حالة الدراسة
 * @returns {{
 *   tierInfo: {tier:string, label:string, isCompliant:boolean, minCompliantRate:number, isApproximate:true}|null,
 *   sectorLabel: string|null,
 *   totalHeadcount: number,
 *   saudiHeadcount: number,
 *   rate: number|null,
 *   avgSalary: number,
 *   avgSalaryIsAssumed: boolean,
 *   saudiAnnualCost: number,
 *   expatAnnualCost: number,
 *   costDiff: number
 * }}
 */
export function buildNitaqatHrCardData(state) {
    const hr = state?.hr || {};
    const positions = Array.isArray(hr.positions) ? hr.positions : [];

    const totalHeadcount = positions.reduce((acc, p) => acc + (Number(p.count) || 1), 0);
    const saudiHeadcount = positions.reduce((acc, p) => acc + (p.nationality === 'saudi' ? (Number(p.count) || 1) : 0), 0);
    const rate = totalHeadcount > 0 ? saudiHeadcount / totalHeadcount : null;

    const sectorText = state?.projectInfo?.sector || state?.projectInfo?.concept || state?.projectInfo?.activity;
    const bench = detectSectorBenchmark(sectorText);
    const sectorKey = bench ? Object.keys(SECTOR_BENCHMARKS).find(k => SECTOR_BENCHMARKS[k] === bench) : null;

    const tierInfo = rate !== null ? classifyNitaqatTier(rate, sectorKey) : null;

    const enteredSalaries = positions.map(p => Number(p.salary) || 0).filter(s => s > 0);
    const avgSalaryIsAssumed = enteredSalaries.length === 0;
    const avgSalary = avgSalaryIsAssumed
        ? DEFAULT_ILLUSTRATIVE_SALARY
        : enteredSalaries.reduce((a, b) => a + b, 0) / enteredSalaries.length;

    const costParams = {
        salary: avgSalary,
        months: 12,
        gosiRate: state?.assumptions?.gosiRate ?? hr.gosiRate ?? SAUDI_GOSI_RATE_2026,
        healthInsurancePerHead: hr.healthInsurancePerHead || 1500,
        govtFees: hr.govtFees || {}
    };
    const saudiAnnualCost = computeAnnualEmployeeCost({ ...costParams, nationality: 'saudi' });
    const expatAnnualCost = computeAnnualEmployeeCost({ ...costParams, nationality: 'expat' });

    return {
        tierInfo,
        sectorLabel: bench?.label || null,
        totalHeadcount,
        saudiHeadcount,
        rate,
        avgSalary,
        avgSalaryIsAssumed,
        saudiAnnualCost,
        expatAnnualCost,
        costDiff: saudiAnnualCost - expatAnnualCost
    };
}

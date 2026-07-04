
import { REPORT_TITLES, formatSAR, formatPct, formatNum } from "./constants.js";
import { buildRecommendations } from "./recommendations.js";
import { ExecutiveSummary } from "../components/ExecutiveSummary.js";
import { Dashboard } from "../components/Dashboard.js";
import { FinancialTables } from "../components/FinancialTables.js";

/**
 * Generate a complete report draft based on study inputs, outputs, and QA results.
 * @param {Object} ctx
 * @param {Object} ctx.study - The full study object
 * @param {Object} ctx.inputs - The inputs model
 * @param {Object} ctx.outputs - The calculation outputs (base, kpis, etc.)
 * @param {Object} ctx.qa - QA results (hardErrors, softWarnings)
 * @returns {Object} reportDraft - { executive_summary, project_description, operations_plan, financial_analysis, risks_qa, recommendations_text, ... }
 */
export function generateReport({ study, inputs, outputs, qa }) {
  const kpis = outputs?.indicators || {}; // Updated to match engine.js return structure
  const base = outputs || {};
  const costs = inputs?.operations || {};

  // 1. Executive Summary (Rich HTML)
  const execSummary = ExecutiveSummary(study, outputs);

  // 2. Dashboard (Rich HTML + Charts)
  // We can return this as a separate key or part of financial analysis
  const dashboardHTML = Dashboard(study, outputs);

  // 3. Financial Analysis (Rich HTML Tables)
  const financialsHTML = `
    ${dashboardHTML}
    ${FinancialTables(outputs)}
  `;

  // 4. Project Description (Market) - Keep as Text for now or upgrade later
  // ... existing logic for text sections ...
  const channels = inputs?.operations?.revenueStreams || {};
  const channelNames = [];
  if (channels.dineIn?.dailyCovers > 0) channelNames.push("تناول محلي");
  if (channels.pickup?.dailyOrders > 0) channelNames.push("استلام (Pickup)");
  if (channels.delivery?.dailyOrders > 0) channelNames.push("توصيل");

  const projDesc = `
يعتمد نموذج عمل المطعم على تقديم خدمات المأكولات والمشروبات عبر قنوات بيع رئيسية تشمل: ${channelNames.join("، ") || "قنوات متعددة"}.
يستهدف المشروع شريحة العملاء الباحثين عن الجودة والقيمة، مع التركيز على الكفاءة التشغيلية لضمان استدامة النمو.
`.trim();

  // 5. Operations Plan
  const daysPerYear = inputs?.operations?.operatingDaysPerYear || 360;
  const hoursPerDay = inputs?.operations?.dailyHours || 12;
  const opsPlan = `
يعمل المطعم ${daysPerYear} يومًا في السنة، بمتوسط ساعات تشغيل يومية تقدر بـ ${hoursPerDay} ساعة.
تعتمد الخطة التشغيلية على ضبط تكاليف المواد الخام (Food Cost) عند نسبة ${formatPct.format(costs.foodCostPercentage || 0.32)}.
`.trim();

  // 6. Risks & QA
  let risksText = "لا توجد مخاطر حرجة تم رصدها في مرحلة التدقيق الأولي.";
  if (qa?.softWarnings?.length > 0) {
    risksText = `تم رصد بعض التنبيهات التي تتطلب الانتباه لضمان دقة الدراسة:\n`;
    qa.softWarnings.slice(0, 5).forEach(w => {
      risksText += `- ${w.message || w.code}\n`;
    });
  }

  // 7. Recommendations
  const recs = buildRecommendations({ inputs, outputs, qa });
  let recsText = "بناءً على نتائج الدراسة، يوصى بالآتي:\n";
  if (recs.length > 0) {
    recs.slice(0, 5).forEach(r => {
      recsText += `- ${r.title}: ${r.reason} (الأثر: ${r.impact})\n`;
    });
  } else {
    recsText += "الاستمرار في مراقبة الأداء المالي والتشغيلي والالتزام بالخطة الموضوعة.";
  }

  return {
    executive_summary: execSummary,
    project_description: projDesc,
    operations_plan: opsPlan,
    financial_analysis: financialsHTML,
    risks_qa: risksText,
    recommendations: recsText,
    _generatedAt: new Date().toISOString(),
    _kpisSnapshot: {
      npv: kpis.npv,
      irr: kpis.irr,
      payback: kpis.payback
    }
  };
}

/**
 * Calculate report readiness score (0-100).
 * @param {Object} reportDraft
 * @param {Object} qa
 * @returns {Object} { score, missing }
 */
export function calculateReportReadiness(reportDraft, qa) {
  let score = 0;
  const missing = [];
  const maxScore = 100;

  // 1. Sections completion (60%)
  const requiredSections = ['executive_summary', 'project_description', 'operations_plan', 'financial_analysis', 'risks_qa'];
  const sectionWeight = 60 / requiredSections.length;

  requiredSections.forEach(sec => {
    if (reportDraft && reportDraft[sec] && reportDraft[sec].length > 20) {
      score += sectionWeight;
    } else {
      missing.push(`القسم غير مكتمل: ${REPORT_TITLES[sec.toUpperCase()] || sec}`);
    }
  });

  // 2. QA Status (20%)
  if (qa?.hardErrors?.length > 0) {
    missing.push("يوجد أخطاء حرجة (Hard Errors) في الدراسة");
  } else {
    score += 10; // No hard errors
    if (!qa?.softWarnings?.length) {
      score += 10; // No soft warnings
    } else {
      // partial credit if accepted? We don't check acceptance here, just existence.
      missing.push("يوجد تحذيرات (Soft Warnings) قد تؤثر على الدقة");
    }
  }

  // 3. Consistency (20%)
  // This requires checking if the report is stale.
  // We assume the caller handles the stale check via validateReportConsistency and passes a flag or we check _kpisSnapshot here if we had current outputs.
  // For now, we'll just give points if _generatedAt exists.
  if (reportDraft?._generatedAt) {
    score += 20;
  } else {
    missing.push("التقرير لم يتم توليده بعد");
  }

  return {
    score: Math.min(100, Math.round(score)),
    checklist: missing
  };
}

/**
 * Check if the report draft is consistent with current study outputs.
 * @param {Object} reportDraft
 * @param {Object} currentOutputs
 * @returns {Object} { valid: boolean, reason?: string }
 */
export function validateReportConsistency(reportDraft, currentOutputs) {
  if (!reportDraft || !reportDraft._kpisSnapshot) return { valid: false, reason: "لا توجد مسودة سابقة" };
  if (!currentOutputs || !currentOutputs.base || !currentOutputs.base.kpis) return { valid: false, reason: "لا توجد مخرجات حالية" };

  const oldKpis = reportDraft._kpisSnapshot;
  const newKpis = currentOutputs.base.kpis;

  // Check key metrics with small tolerance
  const tol = 0.01;
  const sameNPV = Math.abs((oldKpis.npv || 0) - (newKpis.npv || 0)) < 1; // SAR 1 diff
  const sameIRR = Math.abs((oldKpis.irr || 0) - (newKpis.irr || 0)) < tol;
  const samePayback = Math.abs((oldKpis.payback || 0) - (newKpis.payback || 0)) < tol;

  if (!sameNPV) return { valid: false, reason: `تغير NPV: كان ${Math.round(oldKpis.npv)} أصبح ${Math.round(newKpis.npv)}` };
  if (!sameIRR) return { valid: false, reason: "تغير معدل العائد الداخلي (IRR)" };
  if (!samePayback) return { valid: false, reason: "تغيرت فترة الاسترداد" };

  return { valid: true };
}


/**
 * Report Schema Definition
 * 
 * Defines the structure of the feasibility study report.
 * Designed to be extensible for future UI builders or dynamic rendering.
 */

import { REPORT_TITLES } from "./constants.js";

/**
 * @typedef {Object} ReportBlock
 * @property {string} type - 'paragraph' | 'bullets' | 'tableRef' | 'html'
 * @property {string} [content] - Text content or HTML
 * @property {string[]} [items] - For bullets
 * @property {string} [tableId] - For tableRef
 */

/**
 * @typedef {Object} ReportSection
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {boolean} editable - Whether the user can edit the text content
 * @property {function(Object): string} [autoGenerateFn] - Function to generate initial content from study data
 * @property {ReportBlock[]} [defaultBlocks] - Structure placeholders (optional)
 */

/**
 * Default Report Schema for Saudi Restaurants
 * @type {ReportSection[]}
 */
export const DEFAULT_REPORT_SCHEMA = [
  {
    id: "executive_summary",
    title: REPORT_TITLES.EXECUTIVE_SUMMARY || "الملخص التنفيذي",
    description: "خلاصة النتائج المالية والتشغيلية وأهم التوصيات.",
    editable: true,
    autoGenerateFn: null, // Logic is currently in generateReport.js
  },
  {
    id: "project_description",
    title: REPORT_TITLES.MARKET || "وصف المشروع والسوق",
    description: "نبذة عن فكرة المطعم، الجمهور المستهدف، والميزة التنافسية.",
    editable: true,
  },
  {
    id: "operations_plan",
    title: REPORT_TITLES.OPERATIONS || "الخطة التشغيلية",
    description: "ساعات العمل، القنوات (Dine-in/Delivery)، والافتراضات التشغيلية.",
    editable: true,
  },
  {
    id: "financial_analysis",
    title: REPORT_TITLES.FINANCIALS || "التحليل المالي",
    description: "تحليل الإيرادات، التكاليف، والربحية (NPV, IRR, Payback).",
    editable: true,
  },
  {
    id: "risks_qa",
    title: REPORT_TITLES.RISKS || "المخاطر والتحقق",
    description: "أبرز المخاطر المرصودة وتنبيهات النظام (QA Gate).",
    editable: true,
  },
  {
    id: "recommendations",
    title: REPORT_TITLES.RECOMMENDATIONS || "التوصيات",
    description: "خطوات عملية لتحسين الجدوى وتقليل المخاطر.",
    editable: true, // User might want to refine recommendations
  }
];

/**
 * Helper to get section by ID
 * @param {string} id 
 * @returns {ReportSection|undefined}
 */
export function getReportSection(id) {
  return DEFAULT_REPORT_SCHEMA.find(s => s.id === id);
}

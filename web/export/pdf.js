/**
 * PDF export (print HTML).
 *
 * API:
 *   exportPDF(study, outputs, reportDraft?)
 * where outputs = { modelR, base, scenarios, decision, recommendation?, qaTopWarnings? }
 * @returns {Promise<string>} اسم ملف PDF مقترح عند الحفظ
 */

import { DISCLAIMER_TEXT, REPORT_TITLES } from "../report/constants.js";
import { generateReport } from "../report/generateReport.js";
import { sanitizeFilename, exportDateISO } from "./utils.js";

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>");
}

function toNum(v) {
  if (v === "" || v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const map = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
  let s = String(v)
    .replace(/[٠-٩۰-۹]/g, (ch) => map[ch] ?? ch)
    .replace(/٫/g, ".")
    .replace(/[,\u060C\u066B\u066C]/g, "")
    .replace(/\s|\u00A0/g, "")
    .trim();
  return Number(s);
}

function fmt() {
  const money = new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });
  const pct = new Intl.NumberFormat("ar-SA", { style: "percent", maximumFractionDigits: 1 });
  const num = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 });
  return { money, pct, num };
}

function money(v, f) {
  return Number.isFinite(toNum(v)) ? f.money.format(toNum(v)) : "—";
}
function percent(v, f) {
  const n = toNum(v);
  if (!Number.isFinite(n)) return "—";
  const x = n > 1 ? n / 100 : n;
  return f.pct.format(x);
}
function number(v, f) {
  return Number.isFinite(toNum(v)) ? f.num.format(toNum(v)) : "—";
}

function buildPdfHtml(study, outputs, reportDraft) {
  const f = fmt();

  const modelR = outputs.modelR || {};
  const base = outputs.base || {};
  const scenarios = outputs.scenarios || {};
  const rec = outputs.recommendation || { label: "—", tone: "warn", reason: "" };
  const topWarn = Array.isArray(outputs.qaTopWarnings) ? outputs.qaTopWarnings : [];

  const pnl = Array.isArray(base.pnl) ? base.pnl : [];
  const years = pnl.map((r) => r.year);
  
  // Helper to build a standard financial table (Item vs Years)
  const buildTable = (title, headers, rows) => {
    const th = `<thead><tr>${headers.map(h => `<th>${escHtml(h)}</th>`).join("")}</tr></thead>`;
    const tb = `<tbody>${rows.map(row => {
      const [label, ...vals] = row;
      const cells = vals.map(v => `<td dir="ltr">${Number.isFinite(v) ? money(v, f) : (v || "—")}</td>`).join("");
      return `<tr><td>${escHtml(label)}</td>${cells}</tr>`;
    }).join("")}</tbody>`;
    return `
    <div class="card">
      <h2 style="margin-top:0">${escHtml(title)}</h2>
      <div style="overflow-x:auto">
        <table>${th}${tb}</table>
      </div>
    </div>`;
  };

  // 1. P&L Data
  const pnlHeaders = ["البند", ...years.map((y) => `السنة ${y}`)];
  const pnlRows = [
    ["الإيرادات", ...pnl.map((r) => r.revenueTotal ?? 0)],
    ["تكلفة المبيعات (متغيرة)", ...pnl.map((r) => -(r.variable?.total ?? 0))],
    ["مجمل الربح", ...pnl.map((r) => (r.revenueTotal ?? 0) - (r.variable?.total ?? 0))],
    ["مصاريف تشغيلية (Opex)", ...pnl.map((r) => -(r.fixed?.total ?? 0))],
    ["EBITDA", ...pnl.map((r) => r.ebitda ?? 0)],
    ["الإهلاك", ...pnl.map((r) => -(r.depreciation ?? 0))],
    ["EBIT", ...pnl.map((r) => r.ebit ?? 0)],
    ["الزكاة/الضريبة", ...pnl.map((r) => -(r.tax ?? 0))],
    ["صافي الربح", ...pnl.map((r) => r.netIncome ?? 0)],
  ];

  // 2. Cash Flow Data
  // Note: cashflow array is typically [T1, T2...]. T0 is usually separate in 'cashflows' array or computed.
  // base.cashflows includes T0. base.cashflow is the yearly detail starting T1.
  // We'll stick to T1..T5 for consistency with P&L in this view, or try to include T0 if possible.
  // The 'results.js' included T0. Let's try to match that if we have T0 data.
  // base.cashflows = [T0, T1, T2...] (Net Cash Flow only).
  // To get detailed T0, we usually assume T0 = Initial Investment (negative).
  
  // Let's stick to the years defined in P&L for column alignment, but maybe add "Year 0" col?
  // For simplicity and alignment with P&L, let's show T1..T5 detailed, and maybe a separate line for Initial Investment?
  // Or just replicate results.js: T0..T5.
  
  const cfHeaders = ["البند", "سنة التأسيس", ...years.map((y) => `السنة ${y}`)];
  const t0_val = base.cashflows?.[0] ?? 0;
  const cfDetail = Array.isArray(base.cashflow) ? base.cashflow : [];
  const cfVals = cfDetail.map((r) => r.netCashFlow ?? 0);
  while (cfVals.length < years.length) cfVals.push(0);

  const cfRows = [
    ["صافي الربح", 0, ...pnl.map((r) => r.netIncome ?? 0)],
    ["يضاف: الإهلاك", 0, ...pnl.map((r) => r.depreciation ?? 0)],
    ["الاستثمار (Capex + WC)", t0_val, ...Array(years.length).fill(0)],
    ["صافي التدفق النقدي الحر", t0_val, ...cfVals],
  ];

  const rowsSc = Object.entries(scenarios)
    .map(([k, o]) => {
      const kp = o?.kpis ?? {};
      return `<tr><td>${escHtml(k)}</td><td>${money(kp.npv, f)}</td><td>${percent(kp.irr, f)}</td><td>${number(kp.payback, f)}</td></tr>`;
    })
    .join("");

  const warnHtml = topWarn.length
    ? `<ol style="margin:8px 0 0 0; padding:0 18px 0 0">${topWarn
      .map((w) => `<li style="margin:4px 0">${escHtml(String(w.message || w.detail || w.code || "Warning"))}</li>`)
      .join("")}</ol>`
    : `<div class="muted" style="margin-top:8px">لا توجد تحذيرات QA.</div>`;

  // --- Report Narrative Sections ---
  let reportHtml = "";
  if (reportDraft) {
    const sections = [
      { key: "executive_summary", title: REPORT_TITLES.EXECUTIVE_SUMMARY },
      { key: "project_description", title: REPORT_TITLES.MARKET || "وصف المشروع" },
      { key: "operations_plan", title: REPORT_TITLES.OPERATIONS },
      { key: "financial_analysis", title: REPORT_TITLES.FINANCIALS },
      { key: "risks_qa", title: REPORT_TITLES.RISKS },
      { key: "recommendations", title: REPORT_TITLES.RECOMMENDATIONS }
    ];

    reportHtml = sections
      .map((sec) => {
        const content = reportDraft[sec.key];
        if (!content) return "";
        // If content starts with <div, it's likely Rich HTML from our new components. TRUST IT.
        const isRich = typeof content === 'string' && content.trim().startsWith('<div');
        const safeContent = isRich ? content : escHtml(content);

        return `
        <div class="card">
          <h2 style="margin-top:0">${escHtml(sec.title)}</h2>
          <div style="white-space: pre-wrap; line-height: 1.6;">${safeContent}</div>
        </div>`;
      })
      .join("");
  }

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>تقرير جدوى — مطاعم السعودية</title>
  <style>
    body{font-family: system-ui, "Segoe UI", Tahoma, Arial, sans-serif; margin: 24px; color:#111}
    h1{margin:0 0 6px 0}
    h2{margin:18px 0 8px 0}
    .muted{color:#555}
    .card{border:1px solid #ddd; border-radius:12px; padding:12px; margin-top:12px; page-break-inside: avoid;}
    table{width:100%; border-collapse: collapse}
    th,td{border-bottom:1px solid #eee; padding:8px; text-align:right}
    th{background:#fafafa}
    .kpi{display:flex; gap:14px; flex-wrap:wrap}
    .k{border:1px solid #eee; border-radius:12px; padding:10px 12px; min-width: 180px}
    .k .l{color:#666; font-size:12px}
    .k .v{font-weight:800; margin-top:4px}
    .badge{display:inline-block; padding:6px 10px; border-radius:999px; font-weight:900; border:1px solid #ddd}
    .badge.ok{background:#eafaf1; border-color:#b7e6c8}
    .badge.warn{background:#fff6e5; border-color:#f2d19a}
    .badge.err{background:#ffecef; border-color:#f0b4be}
    @media print {
      body { margin: 0; }
      .card { border: none; padding: 0; margin-bottom: 24px; }
      h2 { border-bottom: 2px solid #eee; padding-bottom: 8px; }
    }
  </style>
</head>
<body>
  <h1>تقرير جدوى — مطاعم السعودية</h1>
  <div class="muted">Study: ${escHtml(study.id)} · Template: ${escHtml(study.templateId || study.templateSlug || "")}@${escHtml(study.templateVersion || "")}</div>

  <div class="card">
    <h2 style="margin-top:0">بطاقة القرار</h2>
    <div class="kpi">
      <div class="k"><div class="l">التوصية</div><div class="v"><span class="badge ${escHtml(rec.tone)}">${escHtml(rec.label)}</span></div></div>
      <div class="k"><div class="l">صافي القيمة الحالية</div><div class="v">${money(base.kpis?.npv, f)}</div></div>
      <div class="k"><div class="l">معدل العائد الداخلي</div><div class="v">${percent(base.kpis?.irr, f)}</div></div>
      <div class="k"><div class="l">فترة الاسترداد</div><div class="v">${number(base.kpis?.payback, f)}</div></div>
      <div class="k"><div class="l">نقطة التعادل (طلبات/يوم)</div><div class="v">${number(base.breakeven?.ordersPerDay, f)}</div></div>
    </div>
    <div class="muted" style="margin-top:10px">${escHtml(rec.reason || "")}</div>
    <div style="margin-top:10px">
      <div class="muted"><strong>أهم تحذيرات الجودة</strong></div>
      ${warnHtml}
    </div>
  </div>

  ${reportHtml}

  <div class="card">
    <h2 style="margin-top:0">تنبيه</h2>
    <div class="muted">${escHtml(DISCLAIMER_TEXT)}</div>
  </div>

  ${buildTable("قائمة الدخل التقديرية", pnlHeaders, pnlRows)}

  ${buildTable("التدفقات النقدية", cfHeaders, cfRows)}

  <div class="card">
    <h2 style="margin-top:0">السيناريوهات</h2>
    <table>
      <thead><tr><th>السيناريو</th><th>صافي القيمة الحالية</th><th>معدل العائد الداخلي</th><th>فترة الاسترداد</th></tr></thead>
      <tbody>${rowsSc || ""}</tbody>
    </table>
  </div>

  <div class="card">
    <h2 style="margin-top:0">مدخلات المطاعم (مختصر)</h2>
    <div class="muted">قنوات الإيراد: صالة/تيك أواي/توصيل · عمولة التوصيل على التوصيل فقط</div>
    <pre style="white-space:pre-wrap; margin-top:10px">${escHtml(JSON.stringify(modelR, null, 2) || "{}")}</pre>
  </div>
</body>
</html>`;
}

export async function exportPDF(study, outputs, reportDraft) {
  if (!study?.id) throw new Error("لا توجد Study حالية.");
  if (!outputs?.modelR || !outputs?.base) throw new Error("outputs غير مكتملة للتصدير.");

  const html = buildPdfHtml(study, outputs, reportDraft);
  const w = window.open("", "_blank");
  if (!w) throw new Error("تعذر فتح نافذة جديدة للطباعة. اسمح بالنوافذ المنبثقة.");
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print(); // المستخدم يختار Save as PDF

  const base = sanitizeFilename(study?.projectInfo?.name || study?.id || "study");
  return `${base}_${exportDateISO()}.pdf`;
}


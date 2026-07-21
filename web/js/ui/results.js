
import { formatSAR, formatPct, formatNum } from "../../report/constants.js";
import { formatIrrPct } from "../utils/indicatorFormat.js";

export function renderResults(container, outputs) {
  if (!container) return;
  if (!outputs || !outputs.base) {
    container.innerHTML = '<div class="note">لا توجد نتائج. يرجى إدخال البيانات والضغط على "حساب".</div>';
    return;
  }

  const base = outputs.base;
  const kpis = base.indicators || base.kpis || {};
  const paybackValue = Number(kpis.paybackPeriod ?? kpis.payback);
  const paybackText = Number.isFinite(paybackValue) && paybackValue > 0
    ? formatNum.format(paybackValue) + " سنوات"
    : "غير محقق";
  const breakEvenValue = Number(kpis.breakEvenPointValue ?? 0);
  const years = base.meta?.years || 5;
  const pnl = Array.isArray(base.incomeStatement) ? base.incomeStatement : (Array.isArray(base.pnl) ? base.pnl : []);

  // Extract arrays from P&L (years 1..N)
  const revenue = pnl.map(r => r?.revenue); // was revenueTotal
  const varCosts = pnl.map(r => r.variableCosts || r.variable?.total || 0);
  const opex = pnl.map(r => r.fixedCosts || r.fixed?.total || 0);
  const ebitda = pnl.map(r => r.ebitda);
  const dep = pnl.map(r => r.depreciation);
  const ebit = pnl.map(r => r.ebit);
  const tax = pnl.map(r => r.tax);
  const netIncome = pnl.map(r => r.netIncome);

  container.innerHTML = "";

  // 1. Dashboard (KPIs)
  const dashboard = document.createElement("div");
  dashboard.className = "results-section";
  dashboard.innerHTML = `<h3>لوحة المؤشرات (Dashboard)</h3>`;

  const kpiGrid = document.createElement("div");
  kpiGrid.className = "kpi-grid";
  kpiGrid.style.display = "grid";
  kpiGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(200px, 1fr))";
  kpiGrid.style.gap = "1rem";
  kpiGrid.style.marginBottom = "2rem";

  const metrics = [
    { label: "صافي القيمة الحالية (NPV)", value: formatSAR.format(kpis.npv || 0), color: (kpis.npv || 0) > 0 ? "green" : "red" },
    { label: "معدل العائد الداخلي (IRR)", value: formatIrrPct(kpis.irr), color: (kpis.irr || 0) > 0.1 ? "green" : "orange" },
    { label: "فترة الاسترداد", value: paybackText, color: "blue" },
    { label: "مضاعف الاستثمار (PI)", value: formatNum.format((kpis.npv + (base.cashFlow?.[0]?.cashFlow ? -base.cashFlow[0].cashFlow : 0)) / -(base.cashFlow?.[0]?.cashFlow || 1)) + "x", color: "gray" },
    { label: "نقطة التعادل (سنوية)", value: Number.isFinite(breakEvenValue) && breakEvenValue > 0 ? formatSAR.format(breakEvenValue) : "غير محسوبة", color: "gray" }

  ];

  metrics.forEach(m => {
    kpiGrid.innerHTML += `
      <div class="card kpi-card" style="border-left: 4px solid ${m.color}; padding: 1rem;">
        <div class="muted" style="font-size:0.9em">${m.label}</div>
        <div style="font-size:1.5em; font-weight:bold; margin-top:0.5rem">${m.value}</div>
      </div>
    `;
  });
  dashboard.appendChild(kpiGrid);
  container.appendChild(dashboard);

  // 2. Income Statement
  const pnlSection = document.createElement("div");
  pnlSection.className = "results-section";
  pnlSection.innerHTML = `<h3>قائمة الدخل التقديرية (Income Statement)</h3>`;

  const pnlTable = document.createElement("div");
  pnlTable.className = "table-responsive";
  const tbl = document.createElement("table");
  tbl.className = "table w-full";

  // Header
  let thead = "<thead><tr><th>البند</th>";
  for (let i = 1; i <= years; i++) thead += `<th>السنة ${i}</th>`;
  thead += "</tr></thead>";

  // Body
  const rows = [
    { label: "الإيرادات", data: revenue },
    { label: "تكلفة المبيعات (متغيرة)", data: varCosts, isMinus: true },
    { label: "مجمل الربح (المساهمة)", data: revenue.map((r, i) => r - varCosts[i]), isBold: true, bg: "#f9fafb" },
    { label: "مصاريف تشغيلية (Opex)", data: opex, isMinus: true },
    { label: "الأرباح قبل الفوائد والضرائب والإهلاك (EBITDA)", data: ebitda, isBold: true },
    { label: "الإهلاك", data: dep, isMinus: true },
    { label: "الأرباح التشغيلية (EBIT)", data: ebit },
    { label: "الزكاة/الضريبة", data: tax, isMinus: true },
    { label: "صافي الربح", data: netIncome, isBold: true, bg: "#ecfdf5" }
  ];

  let tbody = "<tbody>";
  rows.forEach(r => {
    tbody += `<tr style="${r.bg ? 'background:' + r.bg : ''}; ${r.isBold ? 'font-weight:bold' : ''}">`;
    tbody += `<td>${r.label}</td>`;
    r.data.forEach(val => {
      const v = r.isMinus ? -val : val;
      const s = formatNum.format(v);
      tbody += `<td dir="ltr">${s}</td>`;
    });
    tbody += "</tr>";
  });
  tbody += "</tbody>";

  tbl.innerHTML = thead + tbody;
  pnlTable.appendChild(tbl);
  pnlSection.appendChild(pnlTable);
  container.appendChild(pnlSection);

  // 3. Cash Flows
  const cf = document.createElement("div");
  cf.className = "results-section";
  cf.style.marginTop = "2rem";
  cf.innerHTML = `<h3>التدفقات النقدية (Cash Flows)</h3>`;

  const cfWrapper = document.createElement("div");
  cfWrapper.className = "table-responsive";
  const cfTbl = document.createElement("table");
  cfTbl.className = "table w-full";

  let cfHead = "<thead><tr><th>البند</th><th>سنة التأسيس (0)</th>";
  for (let i = 1; i <= years; i++) cfHead += `<th>السنة ${i}</th>`;
  cfHead += "</tr></thead>";

  // Reconstruct rows for T0..T5
  const t0_cash = (base.cashFlow && base.cashFlow[0]) ? base.cashFlow[0].cashFlow : 0;
  // Assumption: t0_cash is mostly Capex + Working Capital (negative).
  // We'll display it as "Capex" for simplicity, or "Initial Investment".
  const rowCapex = [-t0_cash, ...Array(years).fill(0)]; // Display as positive cost? Usually cash flow table shows negative for outflows.
  // Let's stick to standard CF sign convention: Outflow is negative.

  const rowNetIncome = [0, ...netIncome];
  const rowDep = [0, ...dep];
  const rowInvestment = [t0_cash, ...Array(years).fill(0)]; // t0_cash is already negative
  const rowFCF_Full = (base.cashFlow || []).map(c => c.cashFlow);

  const cfRows = [
    { label: "صافي الربح", data: rowNetIncome },
    { label: "يضاف: الإهلاك", data: rowDep },
    { label: "الاستثمار (Capex + WC)", data: rowInvestment },
    { label: "صافي التدفق النقدي الحر", data: rowFCF_Full, isBold: true, bg: "#eff6ff" }
  ];

  let cfBody = "<tbody>";
  cfRows.forEach(r => {
    cfBody += `<tr style="${r.bg ? 'background:' + r.bg : ''}; ${r.isBold ? 'font-weight:bold' : ''}">`;
    cfBody += `<td>${r.label}</td>`;
    r.data.forEach(val => {
      const s = formatNum.format(val);
      // Ensure LTR for numbers
      cfBody += `<td dir="ltr" style="${val < 0 ? 'color:red' : ''}">${s}</td>`;
    });
    cfBody += "</tr>";
  });
  cfBody += "</tbody>";

  cfTbl.innerHTML = cfHead + cfBody;
  cfWrapper.appendChild(cfTbl);
  cf.appendChild(cfWrapper);
  container.appendChild(cf);
}

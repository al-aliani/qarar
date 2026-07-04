/**
 * Excel export (browser) — يملأ القالب المعياري الفعلي (assets/templates/excel/قالب_دراسة_الجدوى_المعياري.xlsx)
 * ببيانات محسوبة من web/js/core/engine.js (calculateStudy) — نفس مصدر البيانات الذي يستخدمه
 * التقرير وبقية أدوات التصدير، فلا يوجد نموذج بيانات موازٍ منفصل.
 *
 * ملاحظة تاريخية: النسخة السابقة من هذا الملف كانت تفترض قالباً قديماً بأوراق إنجليزية مرمّزة
 * (01_Assumptions, 03_RevenueDrivers...) لنموذج قنوات مطعمية مفصّل. القالب الفعلي المُوزَّع اليوم
 * هو نموذج جدوى عام بثماني أوراق عربية (الافتراضات، الاستثمار_الأولي، ...) — أُعيدت كتابة هذا
 * الملف بالكامل ليطابق القالب الفعلي فعلياً بدل قالب افتراضي لم يعد موجوداً.
 *
 * ورقتا «تحليل_الحساسية» و«قائمة_المراجعة» تُترَكان بلا تعديل عمداً:
 * الأولى مصمَّمة صراحة (نص داخل القالب) لتُملأ يدوياً عبر ميزة Data Table في إكسل،
 * والثانية قائمة مراجعة بشرية (خانات اختيار) لا تُملأ برمجياً.
 *
 * تُستورد ExcelJS ديناميكياً عند الحاجة فقط (مُجمَّعة/bundled عبر npm — لا تعتمد على CDN)
 * حتى لا تُحمَّل هذه المكتبة الثقيلة إلا عند تصدير Excel فعلياً.
 *
 * API:
 *   exportExcel(study, results)
 * حيث results = calculateStudy(study) (engine.js) — يجب أن يحتوي incomeStatement/indicators على الأقل.
 */

import { DISCLAIMER_TEXT } from "../report/constants.js";
import { sanitizeFilename, exportDateISO, downloadBlob } from "./utils.js";

async function loadTemplateArrayBuffer() {
  const candidates = [
    "/assets/templates/excel/قالب_دراسة_الجدوى_المعياري.xlsx",
    "/قالب_دراسة_الجدوى_المعياري.xlsx",
  ];
  let lastErr = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.arrayBuffer();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`تعذر تحميل قالب الإكسل. آخر خطأ: ${String(lastErr?.message || lastErr)}`);
}

function wbGetSheet(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`ورقة غير موجودة في القالب: ${name}`);
  return ws;
}

/** كتابة قيمة رقمية آمنة (0 بدل NaN/undefined) دون كسر خلايا فارغة عمداً عند null صريحة. */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {object} study - حالة الدراسة (state)
 * @param {object} results - ناتج calculateStudy(study) من web/js/core/engine.js
 * @returns {Promise<string>} اسم الملف المُصدَّر
 */
export async function exportExcel(study, results) {
  if (!study?.id && !study?.projectInfo?.id) throw new Error("لا توجد Study حالية.");
  if (!results?.incomeStatement?.length) throw new Error("لا توجد نتائج كافية من النموذج المالي للتصدير.");

  let ExcelJS;
  try {
    ExcelJS = (await import('exceljs')).default;
  } catch (e) {
    throw new Error("تعذّر تحميل مكتبة ExcelJS. تحقّق من نجاح بناء المشروع: " + (e?.message || e));
  }

  const buf = await loadTemplateArrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const assumptions = study.assumptions || {};
  const is = results.incomeStatement; // 5 سنوات
  const ind = results.indicators || {};
  const capex = results.capex || {};
  const cs = capex.capitalStructure || {};

  // ═══ 1) الافتراضات ═══
  // القيم الفعلية المُستخدَمة في الحساب (تطابق نفس الافتراضات الضمنية في engine.js عند غياب قيمة المستخدم)
  const wsAss = wbGetSheet(wb, "الافتراضات");
  wsAss.getCell("B5").value = assumptions.inflationRate ?? 0.02;
  wsAss.getCell("B6").value = assumptions.taxRate ?? 0.15;
  wsAss.getCell("B7").value = assumptions.discountRate ?? 0.10;
  wsAss.getCell("B8").value = assumptions.projectionYears || is.length || 5;
  for (let i = 0; i < 5; i++) {
    const row = 11 + i;
    const prevRev = i > 0 ? is[i - 1]?.revenue : null;
    const growth = i === 0 || !prevRev ? 0 : (is[i].revenue - prevRev) / prevRev;
    wsAss.getCell(`B${row}`).value = Number.isFinite(growth) ? growth : 0;
  }
  const y1 = is[0] || {};
  wsAss.getCell("B18").value = y1.revenue > 0 ? num(y1.variableCosts) / y1.revenue : 0;
  wsAss.getCell("B19").value = y1.revenue > 0 ? num(y1.fixedCosts) / y1.revenue : 0;
  if (capex.total > 0) wsAss.getCell("B20").value = num(results.depreciation) / capex.total;
  // نسبة الصيانة (B21): لا مصدر بيانات موثوق — تُترك القيمة الافتراضية في القالب كما هي.

  // ═══ 2) الاستثمار الأولي (CAPEX) ═══
  const wsInv = wbGetSheet(wb, "الاستثمار_الأولي");
  const invBd = cs.investment?.breakdown || {};
  const estBd = cs.establishment?.breakdown || {};
  wsInv.getCell("D5").value = num(invBd.buildings);   // المبنى/الإنشاءات
  wsInv.getCell("D6").value = num(invBd.equipment);   // المعدات والأجهزة
  wsInv.getCell("D7").value = num(invBd.furniture);   // الأثاث والتجهيزات
  wsInv.getCell("D8").value = num(invBd.tech);        // أجهزة الحاسوب/تقنية
  wsInv.getCell("D9").value = num(invBd.services);    // برمجيات وتراخيص
  wsInv.getCell("D12").value = num(estBd.legal);      // مصاريف التأسيس القانونية
  wsInv.getCell("D13").value = num(estBd.marketing);  // مصاريف التسويق الأولية
  wsInv.getCell("D14").value = 0;                     // مصاريف التدريب — لا بيانات، تُصفَّر بدل رقم توضيحي وهمي
  wsInv.getCell("D17").value = num(cs.operating?.total ?? capex.workingCapital); // رأس المال العامل
  wsInv.getCell("D19").value = num(capex.total);       // إجمالي الاستثمار

  // ═══ 3) تقدير الإيرادات ═══
  const wsRev = wbGetSheet(wb, "تقدير_الإيرادات");
  const streams = (study.revenue?.streams || []).slice().sort((a, b) =>
    (num(b.customersPerMonth) * num(b.avgPrice)) - (num(a.customersPerMonth) * num(a.avgPrice))
  );
  const revRows = [4, 5, 6];
  revRows.forEach((row, idx) => {
    const s = streams[idx];
    if (s) {
      wsRev.getCell(`A${row}`).value = s.name || s.service || `مصدر إيراد ${idx + 1}`;
      wsRev.getCell(`B${row}`).value = num(s.customersPerMonth) * 12 * num(s.avgPrice);
    } else {
      wsRev.getCell(`A${row}`).value = "";
      wsRev.getCell(`B${row}`).value = 0;
    }
    for (const col of ["C", "D", "E", "F"]) wsRev.getCell(`${col}${row}`).value = ""; // سنوات 2-5 غير موثوقة على مستوى المصدر الفردي
  });
  ["B", "C", "D", "E", "F"].forEach((col, i) => { wsRev.getCell(`${col}8`).value = num(is[i]?.revenue); });

  // ═══ 4) قائمة الدخل (5 سنوات) ═══
  const wsIS = wbGetSheet(wb, "قائمة_الدخل");
  const cols = ["B", "C", "D", "E", "F"];
  cols.forEach((col, i) => {
    const r = is[i] || {};
    wsIS.getCell(`${col}4`).value = num(r.revenue);
    wsIS.getCell(`${col}6`).value = num(r.variableCosts);
    wsIS.getCell(`${col}7`).value = num(r.grossProfit);
    // رواتب/إيجار/مرافق/تسويق (صفوف 10-13): لا تفصيل سنوي موثوق داخل المحرك — تُصفَّر بدل أرقام توضيحية.
    ["10", "11", "12", "13"].forEach((row) => { wsIS.getCell(`${col}${row}`).value = 0; });
    wsIS.getCell(`${col}14`).value = num(r.depreciation);
    wsIS.getCell(`${col}15`).value = 0; // الصيانة: لا بيانات
    wsIS.getCell(`${col}16`).value = num(r.fixedCosts);
    wsIS.getCell(`${col}18`).value = num(r.ebt);
    wsIS.getCell(`${col}19`).value = num(r.tax) + num(r.zakat);
    wsIS.getCell(`${col}20`).value = num(r.netIncome);
  });

  // ═══ 5) مؤشرات التقييم (تدفقات نقدية + مؤشرات + قرار) ═══
  const wsK = wbGetSheet(wb, "مؤشرات_التقييم");
  const cf = results.cashFlow || [];
  for (let year = 0; year <= 5; year++) {
    const row = 5 + year;
    const c = cf.find((x) => x.year === year);
    if (!c) continue;
    wsK.getCell(`B${row}`).value = num(c.netIncome);
    wsK.getCell(`C${row}`).value = num(c.depreciation);
    wsK.getCell(`D${row}`).value = num(c.cashFlow);
    wsK.getCell(`E${row}`).value = num(c.cumulative);
  }
  wsK.getCell("B15").value = num(ind.npv);
  wsK.getCell("B16").value = num(ind.irr);
  wsK.getCell("B17").value = num(ind.profitabilityIndex);
  wsK.getCell("B18").value = num(ind.paybackPeriod);
  const decisionAr = results.decision === 'GO' ? 'المضي قدماً (GO)'
    : (results.decision === 'NO-GO' || results.decision === 'NOGO') ? 'عدم المضي (NO-GO)'
    : results.decision === 'REVISE' ? 'مراجعة مطلوبة (REVISE)' : (results.decision || '—');
  wsK.getCell("B22").value = decisionAr;

  // ═══ 6) السيناريوهات ═══
  const wsSc = wbGetSheet(wb, "السيناريوهات");
  const sc = results.scenarios || {};
  if (sc.pessimistic && sc.base && sc.optimistic) {
    wsSc.getCell("B4").value = "-15%"; wsSc.getCell("C4").value = "0%"; wsSc.getCell("D4").value = "+10%";
    wsSc.getCell("B5").value = "+10%"; wsSc.getCell("C5").value = "0%"; wsSc.getCell("D5").value = "-5%";
    wsSc.getCell("B8").value = num(sc.pessimistic.kpis?.npv);
    wsSc.getCell("C8").value = num(sc.base.kpis?.npv);
    wsSc.getCell("D8").value = num(sc.optimistic.kpis?.npv);
    wsSc.getCell("B9").value = num(sc.pessimistic.kpis?.irr);
    wsSc.getCell("C9").value = num(sc.base.kpis?.irr);
    wsSc.getCell("D9").value = num(sc.optimistic.kpis?.irr);
    const label = (s) => (s.kpis?.npv > 0 && s.kpis?.irr > 0) ? 'GO' : (s.kpis?.npv > 0 ? 'مشروط' : 'NO-GO');
    wsSc.getCell("B10").value = label(sc.pessimistic);
    wsSc.getCell("C10").value = label(sc.base);
    wsSc.getCell("D10").value = label(sc.optimistic);
  }

  // ═══ أوراق إضافية (لا تتطلب وجودها في القالب — تُضاف عند توفر بياناتها) ═══

  // تنبيه (إخلاء مسؤولية)
  try {
    const wsD = wb.getWorksheet("تنبيه") || wb.addWorksheet("تنبيه");
    wsD.views = [{ rightToLeft: true }];
    wsD.getCell("A1").value = "تنبيه (Disclaimer)";
    wsD.getCell("A1").font = { bold: true };
    wsD.getCell("A2").value = DISCLAIMER_TEXT;
    wsD.getCell("A2").alignment = { wrapText: true, vertical: "top", horizontal: "right" };
    wsD.getColumn(1).width = 120;
    wsD.getRow(2).height = 90;
  } catch (_) { /* غير حرج */ }

  // جدول سداد القرض (فقط عند وجود قرض)
  const loan = results.loanSchedule;
  if (loan && loan.annualSummary?.length) {
    try {
      const wsLoan = wb.getWorksheet("جدول_سداد_القرض") || wb.addWorksheet("جدول_سداد_القرض");
      wsLoan.views = [{ rightToLeft: true }];
      wsLoan.getCell("A1").value = "جدول سداد القرض";
      wsLoan.getCell("A1").font = { bold: true, size: 14 };
      wsLoan.getCell("A3").value = "مبلغ القرض"; wsLoan.getCell("B3").value = num(loan.loanAmount);
      wsLoan.getCell("A4").value = "معدل الفائدة"; wsLoan.getCell("B4").value = num(loan.annualRate);
      wsLoan.getCell("A5").value = "مدة السداد (سنوات)"; wsLoan.getCell("B5").value = num(loan.termYears);
      wsLoan.getCell("A6").value = "القسط الشهري"; wsLoan.getCell("B6").value = num(loan.monthlyPayment);
      const headers = ["السنة", "إجمالي الأقساط", "الأصل", "الفوائد", "الرصيد المتبقي"];
      headers.forEach((h, i) => { const c = wsLoan.getCell(8, i + 1); c.value = h; c.font = { bold: true }; });
      loan.annualSummary.forEach((y, ri) => {
        const row = 9 + ri;
        wsLoan.getCell(`A${row}`).value = `السنة ${y.year}`;
        wsLoan.getCell(`B${row}`).value = num(y.totalPayment);
        wsLoan.getCell(`C${row}`).value = num(y.totalPrincipal);
        wsLoan.getCell(`D${row}`).value = num(y.totalInterest);
        wsLoan.getCell(`E${row}`).value = num(y.endingBalance);
      });
      wsLoan.getColumn(1).width = 22;
    } catch (e) { console.warn("تعذّرت إضافة ورقة جدول سداد القرض", e); }
  }

  // الميزانية العمومية التقديرية (فقط عند توفر بياناتها)
  if (results.balanceSheets?.length) {
    try {
      const wsBs = wb.getWorksheet("الميزانية_العمومية") || wb.addWorksheet("الميزانية_العمومية");
      wsBs.views = [{ rightToLeft: true }];
      wsBs.getCell("A1").value = "الميزانية العمومية التقديرية";
      wsBs.getCell("A1").font = { bold: true, size: 14 };
      const bsYears = results.balanceSheets.slice(0, 5);
      wsBs.getCell("A3").value = "البند";
      bsYears.forEach((b, i) => { wsBs.getCell(3, i + 2).value = `السنة ${b.year}`; wsBs.getCell(3, i + 2).font = { bold: true }; });
      const bsRow = (row, label, get) => {
        wsBs.getCell(`A${row}`).value = label;
        bsYears.forEach((b, i) => { wsBs.getCell(row, i + 2).value = num(get(b)); });
      };
      bsRow(4, "النقدية", (b) => b.assets.current.cash);
      bsRow(5, "صافي الأصول الثابتة", (b) => b.assets.fixed.net);
      bsRow(6, "إجمالي الأصول", (b) => b.assets.total);
      bsRow(8, "إجمالي الخصوم", (b) => b.liabilities.total);
      bsRow(9, "رأس المال المدفوع", (b) => b.equity.paidInCapital);
      bsRow(10, "الأرباح المحتجزة", (b) => b.equity.retainedEarnings);
      bsRow(11, "إجمالي حقوق الملكية", (b) => b.equity.total);
      wsBs.getColumn(1).width = 24;
    } catch (e) { console.warn("تعذّرت إضافة ورقة الميزانية العمومية", e); }
  }

  const outBuf = await wb.xlsx.writeBuffer();
  const blob = new Blob([outBuf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const baseName = sanitizeFilename(study.projectInfo?.name || study.id || study.projectInfo?.id || "export");
  const outFilename = `${baseName}_${exportDateISO()}.xlsx`;
  downloadBlob(blob, outFilename);
  return outFilename;
}

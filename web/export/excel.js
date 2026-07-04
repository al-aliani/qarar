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
import { calculateStudy } from "../js/core/engine.js";

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

/** كتابة قيمة رقمية آمنة (0 بدل NaN/undefined) مع قصّ ضجيج الفاصلة العائمة
 *  (كان 2826920.2500000005 و0.050000000000000176 يصلان للعميل كما هما). */
function num(v, decimals = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/** كسر نسبة نظيف (4 منازل) — يُعرض كنسبة مئوية عبر numFmt. */
function frac(v) {
  return num(v, 4);
}

const PCT_FMT = '0.0%';

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
  // القيم الفعلية المُستخدَمة في الحساب. النِسب تُكتب ككسور مع تنسيق مئوي (numFmt)
  // كي تُقرأ «2.0%» — كانت تُكتب خاماً (0.02) بجانب عمود وحدة «%» فتُقرأ 0.02%.
  const wsAss = wbGetSheet(wb, "الافتراضات");
  const setPct = (ws, addr, v, fmt = PCT_FMT) => { const c = ws.getCell(addr); c.value = frac(v); c.numFmt = fmt; };
  setPct(wsAss, "B5", assumptions.inflationRate ?? 0.02);
  // الزكاة/الضريبة الفعلية: زكاة 2.5% على الحصة السعودية + ضريبة الدخل على حصة الأجانب فقط
  const aa = results.assumptionsApplied || {};
  const fs = Number(aa.foreignOwnershipRate ?? assumptions.foreignOwnershipRate ?? 0);
  const effectiveLevy = 0.025 * (1 - fs) + Number(aa.taxRate ?? assumptions.taxRate ?? 0.20) * fs;
  wsAss.getCell("A6").value = "معدل الزكاة/الضريبة الفعلي";
  setPct(wsAss, "B6", effectiveLevy, '0.00%');
  wsAss.getCell("D6").value = fs > 0
    ? `زكاة 2.5% على ${Math.round((1 - fs) * 100)}% + ضريبة دخل على ${Math.round(fs * 100)}%`
    : "زكاة 2.5% (مشروع سعودي 100%)";
  setPct(wsAss, "B7", assumptions.discountRate ?? 0.10);
  wsAss.getCell("B8").value = assumptions.projectionYears || is.length || 5;
  for (let i = 0; i < 5; i++) {
    const row = 11 + i;
    const prevRev = i > 0 ? is[i - 1]?.revenue : null;
    const growth = i === 0 || !prevRev ? 0 : (is[i].revenue - prevRev) / prevRev;
    setPct(wsAss, `B${row}`, Number.isFinite(growth) ? growth : 0);
    // إزالة ادعاءات القالب الجاهزة («30-50% للناشئة») — النمو محسوب من مدخلات المستخدم
    wsAss.getCell(`D${row}`).value = i === 0 ? "السنة الأولى" : "محسوب من نمو مصادر الإيراد المُدخلة";
  }
  const y1 = is[0] || {};
  setPct(wsAss, "B18", y1.revenue > 0 ? num(y1.variableCosts) / y1.revenue : 0);
  setPct(wsAss, "B19", y1.revenue > 0 ? num(y1.fixedCosts) / y1.revenue : 0);
  if (capex.total > 0) {
    setPct(wsAss, "B20", num(results.depreciation) / capex.total, '0.00%');
    wsAss.getCell("D20").value = "محسوب من أعمار الأصول المُدخلة";
  }
  // نسبة الصيانة (B21): لا مصدر بيانات موثوق — تُترك القيمة الافتراضية في القالب كما هي.

  // ═══ 2) الاستثمار الأولي (CAPEX) ═══
  // القالب يحمل كمية/سعر توضيحيين (1×500000) ومعادلة D=B×C — الكود القديم كان يدوس D
  // بقيمة المحرك ويترك B×C كما هما، فيظهر للعميل «1 × 500,000 = 380,000» (تناقض فاضح).
  // الآن: B=1 وC=قيمة المحرك وD=القيمة نفسها → كمية×سعر=الإجمالي دائماً،
  // وكل بنود المحرك (مركبات، تأسيس، امتياز…) تدخل صفاً مناسباً فمجموع الصفوف = الإجمالي.
  const wsInv = wbGetSheet(wb, "الاستثمار_الأولي");
  const invBd = cs.investment?.breakdown || {};
  const estBd = cs.establishment?.breakdown || {};
  const setInvRow = (row, value, label = null, source = "من مدخلات الدراسة") => {
    const v = num(value);
    if (label) wsInv.getCell(`A${row}`).value = label;
    wsInv.getCell(`B${row}`).value = v > 0 ? 1 : 0;
    wsInv.getCell(`C${row}`).value = v;
    wsInv.getCell(`D${row}`).value = v;
    // مصادر القالب الوهمية («عرض سعر مقاول»، «3 عروض أسعار») لا تصل للعميل كادّعاء
    wsInv.getCell(`E${row}`).value = v > 0 ? source : "";
  };
  setInvRow(5, invBd.buildings);                                     // المبنى/الإنشاءات
  setInvRow(6, num(invBd.equipment) + num(invBd.vehicles),
    "المعدات والأجهزة والمركبات");
  setInvRow(7, invBd.furniture);                                     // الأثاث والتجهيزات
  setInvRow(8, invBd.tech, "الأجهزة والموارد التقنية");
  setInvRow(9, invBd.services);                                      // برمجيات وتراخيص (خدمات)
  setInvRow(12, num(estBd.legal) + num(estBd.foundation),
    "مصاريف التأسيس والتراخيص");
  setInvRow(13, estBd.marketing);                                    // مصاريف التسويق الأولية
  const otherEst = num(estBd.franchise) + num(estBd.ventureBuilder) + num(estBd.envMitigation);
  setInvRow(14, otherEst, otherEst > 0 ? "رسوم امتياز/شراكة ومعالجات أخرى" : null);
  setInvRow(17, cs.operating?.total ?? capex.workingCapital);        // رأس المال العامل
  wsInv.getCell("D19").value = num(capex.total);                     // إجمالي الاستثمار

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
  // كل صف يُكتب من تفصيل المحرك الفعلي بحيث «تُجمَع» الأعمدة:
  // (كانت بنود الثابتة تُصفَّر بينما الإجمالي 425 ألفاً — تناقض يلتقطه أي محلل)
  const wsIS = wbGetSheet(wb, "قائمة_الدخل");
  wsIS.getCell("A15").value = "الطوارئ التشغيلية (احتياطي)";
  wsIS.getCell("A17").value = "(-) الفوائد ورسوم الامتياز/الشراكة";
  wsIS.getCell("A19").value = "الزكاة والضريبة";
  const cols = ["B", "C", "D", "E", "F"];
  cols.forEach((col, i) => {
    const r = is[i] || {};
    const bd = r.fixedCostsBreakdown || {};
    wsIS.getCell(`${col}4`).value = num(r.revenue);
    wsIS.getCell(`${col}6`).value = num(r.variableCosts);
    wsIS.getCell(`${col}7`).value = num(r.grossProfit);
    wsIS.getCell(`${col}10`).value = num(bd.payroll);            // الرواتب والأجور
    wsIS.getCell(`${col}11`).value = num(bd.rentAndAdmin);       // الإيجار والمصاريف الإدارية
    wsIS.getCell(`${col}12`).value = num(bd.servicesFixed);      // المرافق والخدمات
    wsIS.getCell(`${col}13`).value = num(bd.marketing);          // التسويق
    wsIS.getCell(`${col}14`).value = num(r.depreciation);        // الاستهلاك
    wsIS.getCell(`${col}15`).value = num(bd.hiddenOverheads);    // الطوارئ التشغيلية
    // الإجمالي = ثابتة المحرك + الاستهلاك (بنية القالب تضم الاستهلاك داخل كتلة الثابتة)
    wsIS.getCell(`${col}16`).value = num(num(r.fixedCosts) + num(r.depreciation));
    // فوائد التمويل + رسوم الامتياز/الشراكة — كانت غائبة فلا يستقيم EBT مع الأعمدة
    wsIS.getCell(`${col}17`).value = num(num(r.interest) + num(r.franchiseFees) + num(r.builderSuccessFee));
    wsIS.getCell(`${col}18`).value = num(r.ebt);
    wsIS.getCell(`${col}19`).value = num(num(r.tax) + num(r.zakat));
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
  // IRR كسر + تنسيق مئوي: 1.02 يُعرض «102.0%» — كان يُكتب خاماً فيُقرأ «1.02%»
  wsK.getCell("B16").value = frac(ind.irr);
  wsK.getCell("B16").numFmt = PCT_FMT;
  wsK.getCell("B17").value = num(ind.profitabilityIndex);
  wsK.getCell("B17").numFmt = '0.00';
  // فترة استرداد غير محققة لا تُكتب 0 أبداً
  if (ind.paybackPeriod != null && Number.isFinite(ind.paybackPeriod) && ind.paybackPeriod > 0) {
    wsK.getCell("B18").value = num(ind.paybackPeriod);
    wsK.getCell("C18").value = "سنة";
  } else {
    wsK.getCell("B18").value = "غير قابل للاسترداد خلال فترة الدراسة";
    wsK.getCell("C18").value = "";
  }
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
    [["B9", sc.pessimistic], ["C9", sc.base], ["D9", sc.optimistic]].forEach(([addr, s]) => {
      const c = wsSc.getCell(addr);
      c.value = frac(s.kpis?.irr);
      c.numFmt = PCT_FMT;
    });
    const label = (s) => (s.kpis?.npv > 0 && s.kpis?.irr > 0) ? 'GO' : (s.kpis?.npv > 0 ? 'مشروط' : 'NO-GO');
    wsSc.getCell("B10").value = label(sc.pessimistic);
    wsSc.getCell("C10").value = label(sc.base);
    wsSc.getCell("D10").value = label(sc.optimistic);
  }

  // ═══ 7) تحليل الحساسية — يُملأ آلياً بإعادة تشغيل المحرك لكل حالة ═══
  // (كانت الورقة تصل للعميل فارغة مع ملاحظة «يجب ملء هذا الجدول يدوياً»)
  try {
    const wsSens = wbGetSheet(wb, "تحليل_الحساسية");
    const revChanges = [-0.20, -0.10, 0, 0.10, 0.20];   // أعمدة B..F
    const costChanges = [-0.20, -0.10, 0, 0.10, 0.20];  // صفوف 6..10
    costChanges.forEach((costChange, ri) => {
      revChanges.forEach((revenueChange, ci) => {
        let npvCase = null;
        if (revenueChange === 0 && costChange === 0) {
          npvCase = ind.npv;
        } else {
          try {
            const r = calculateStudy(study, { revenueChange, costChange });
            npvCase = r?.indicators?.npv;
          } catch (_) { npvCase = null; }
        }
        const cell = wsSens.getCell(6 + ri, 2 + ci);
        cell.value = npvCase != null && Number.isFinite(npvCase) ? Math.round(npvCase) : "—";
      });
    });
    wsSens.getCell("A13").value = "محسوبة آلياً بإعادة تشغيل النموذج المالي لكل حالة (إيرادات × تكاليف).";
  } catch (e) { console.warn("تعذّر ملء تحليل الحساسية", e); }

  // ورقة «قائمة_المراجعة» أداة مراجعة داخلية بخانات غير مؤشَّرة —
  // لا تُسلَّم للعميل (توحي بأن الملف غير مُراجَع)
  try {
    const wsCheck = wb.getWorksheet("قائمة_المراجعة");
    if (wsCheck) wb.removeWorksheet(wsCheck.id);
  } catch (_) { /* غير حرج */ }

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

  // أي معادلات متبقية من القالب تُعاد حسابتها عند الفتح (لا قيم مخبّأة قديمة)
  wb.calcProperties = { ...(wb.calcProperties || {}), fullCalcOnLoad: true };

  const outBuf = await wb.xlsx.writeBuffer();
  const blob = new Blob([outBuf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const baseName = sanitizeFilename(study.projectInfo?.name || study.id || study.projectInfo?.id || "export");
  const outFilename = `${baseName}_${exportDateISO()}.xlsx`;
  downloadBlob(blob, outFilename);
  return outFilename;
}

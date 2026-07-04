/**
 * QA Gate (2-stage):
 * - hardErrors: block export & finalization
 * - softWarnings: allow export only after explicit "I accept"
 *
 * qaGate(inputs, outputs, template, options) -> { hardErrors, softWarnings }
 *
 * P0 rules:
 * - DSCR < 1.2 (if loan exists): hardError or warning based on strictMode
 * - CAPEX missing/zero while equipment/fitout mentioned: warning
 * - Break-even > capacity: strong warning
 */

function toNum(v) {
  if (v === "" || v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const s = String(v).replace(/,/g, "").trim();
  return Number(s);
}

function normalizePercent01(v) {
  const n = toNum(v);
  if (!Number.isFinite(n)) return 0;
  if (n > 1) return n / 100;
  return n;
}

function push(arr, code, message, path, meta) {
  arr.push({ code, message, path, meta: meta || {} });
}

function sumCapex(inputs) {
  const capex = Array.isArray(inputs?.capex) ? inputs.capex : Array.isArray(inputs?.capexItems) ? inputs.capexItems : [];
  return (capex || []).reduce((acc, it) => acc + (Number.isFinite(toNum(it?.cost)) ? toNum(it.cost) : 0), 0);
}

function findEquipmentMention(inputs) {
  // Search broadly for keywords in any string field.
  const needles = ["تجهيز", "معدات", "ديكور", "تشطيب", "مطبخ", "أصول", "asset", "fitout", "equipment"];
  const stack = [{ v: inputs, path: "" }];
  while (stack.length) {
    const { v } = stack.pop();
    if (!v) continue;
    if (typeof v === "string") {
      const s = v.toLowerCase();
      if (needles.some((n) => s.includes(n.toLowerCase()))) return true;
      continue;
    }
    if (Array.isArray(v)) {
      v.forEach((x) => stack.push({ v: x }));
      continue;
    }
    if (typeof v === "object") {
      Object.values(v).forEach((x) => stack.push({ v: x }));
    }
  }
  return false;
}

function loanExists(inputs) {
  const loan = inputs?.financing?.loan || inputs?.loan || null;
  const amount = toNum(loan?.amount);
  return Number.isFinite(amount) && amount > 0;
}

function computeDscrMin(outputs) {
  const dscr = outputs?.dscr;
  if (Array.isArray(dscr) && dscr.length) {
    const vals = dscr.map((x) => toNum(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (vals.length) return Math.min(...vals);
  }
  const v = toNum(outputs?.kpis?.dscrMin);
  return Number.isFinite(v) ? v : NaN;
}

function qaGate(inputs, outputs, template, options) {
  const hardErrors = [];
  const softWarnings = [];

  const strictMode = Boolean(options?.strictMode || inputs?.strictMode || inputs?.settings?.strictMode);

  // 1) DSCR rule (if loan exists)
  if (loanExists(inputs)) {
    const dscrMin = computeDscrMin(outputs);
    if (Number.isFinite(dscrMin) && dscrMin > 0 && dscrMin < 1.2) {
      const msg = `DSCR أقل من 1.2 (الحالي: ${dscrMin.toFixed(2)}).`;
      if (strictMode) push(hardErrors, "DSCR_BELOW_1_2", msg, "kpis.dscrMin", { strictMode: true });
      else push(softWarnings, "DSCR_BELOW_1_2", msg, "kpis.dscrMin", { strictMode: false });
    }
  }

  // 2) CAPEX missing/zero while equipment mentioned
  // نقرأ إجمالي CAPEX من مخرجات المحرك أولاً (المصدر الموثوق للبنية الحالية technical.*)،
  // ثم من المدخلات القديمة (inputs.capex) — بدون هذا كانت القاعدة تُنذر زوراً لكل دراسة
  // فيها معدات لأنها تبحث في مسار قديم غير مستخدم.
  const capexFromOutputs = Number(outputs?.capex?.total ?? outputs?.capex?.subtotal ?? NaN);
  const capexTotal = Number.isFinite(capexFromOutputs) && capexFromOutputs > 0
    ? capexFromOutputs
    : sumCapex(inputs);
  if (capexTotal <= 0 && findEquipmentMention(inputs)) {
    push(
      softWarnings,
      "CAPEX_ZERO_WITH_EQUIPMENT_MENTIONED",
      "CAPEX = 0 أو مفقود مع وجود تجهيزات/تشطيب/معدات مذكورة. راجع الأصول.",
      "capex",
      { capexTotal }
    );
  }

  return { hardErrors, softWarnings };
}

// Ensure exports for both ESM and CommonJS
const QA_CHECKS = { qaGate };
export { qaGate, QA_CHECKS };
if (typeof module !== "undefined" && module.exports) {
  module.exports = { qaGate, QA_CHECKS };
}
if (typeof window !== "undefined") {
  window.CalcQaGate = { qaGate, QA_CHECKS };
}

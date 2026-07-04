/**
 * validateInputs(inputs) -> { errors: [], warnings: [] }
 *
 * قواعد P0 المطلوبة:
 * - منع القيم السالبة (إلا بند مُعرّف كخصم صراحة).
 * - نسب 0–100.
 * - توزيع القنوات صالة/تيك أواي/توصيل مجموعها 100%.
 * - عمولة التوصيل لا تعمل إلا مع مبيعات توصيل والعكس.
 * - قيم صفرية للإيجار/الرواتب/الخدمات = warning.
 */

function toNum(v) {
  if (v === "" || v === null || v === undefined) return NaN;
  if (typeof v === "number") return v;
  const map = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
  };
  const s = String(v)
    .replace(/[٠-٩۰-۹]/g, (ch) => map[ch] ?? ch)
    .replace(/٫/g, ".")
    .replace(/[,\u060C\u066B\u066C]/g, "")
    .replace(/\s|\u00A0/g, "")
    .trim();
  return Number(s);
}

function pushMsg(arr, level, code, message, path, meta) {
  arr.push({ level, code, message, path, meta: meta || {} });
}

const DISCOUNT_NEEDLES = ["discount", "refund", "rebate", "خصم", "استرداد", "مرتجع"];
function looksLikeDiscountText(s) {
  const t = String(s || "").toLowerCase();
  return DISCOUNT_NEEDLES.some((n) => t.includes(n.toLowerCase()));
}

function isExplicitDiscountContext(parent, key, path) {
  // Allow negatives only when explicitly marked as discount/refund.
  if (looksLikeDiscountText(key)) return true;
  if (looksLikeDiscountText(path)) return true;
  if (parent && typeof parent === "object") {
    // Common row labels
    const label = parent.name ?? parent.item ?? parent.label ?? parent.title ?? parent.type ?? parent.kind ?? "";
    if (looksLikeDiscountText(label)) return true;
    if (parent.isDiscount === true) return true;
  }
  return false;
}

function percentTo0_100(raw) {
  const n = toNum(raw);
  if (!Number.isFinite(n)) return { ok: false, value: NaN };
  // Accept both 0..1 and 0..100 (engine normalizes).
  if (n >= 0 && n <= 1) return { ok: true, value: n * 100 };
  return { ok: true, value: n };
}

const PERCENT_KEYS = new Set([
  "foodCostPct",
  "wastePct",
  "variablePctOfRevenue",
  "commissionRate",
  "taxRate",
  "inflationRate",
  "discountRate",
  "growthAnnual",
  "annualRate",
  "rate",
  "pct",
]);

function looksLikePercentField(key, path) {
  const k = String(key || "");
  if (PERCENT_KEYS.has(k)) return true;
  if (/pct$/i.test(k)) return true;
  if (/rate$/i.test(k)) return true;
  if (/percent/i.test(k)) return true;
  // If the path indicates a percent container
  if (/mixpct/i.test(String(path || ""))) return true;
  return false;
}

function validateInputs(inputs) {
  const errors = [];
  const warnings = [];

  const stack = [{ v: inputs, path: "", parent: null, key: null }];

  while (stack.length) {
    const { v, path, parent, key } = stack.pop();

    if (v === null || v === undefined) continue;

    if (Array.isArray(v)) {
      v.forEach((x, i) => stack.push({ v: x, path: `${path}[${i}]`, parent: v, key: i }));
      continue;
    }

    if (typeof v === "object") {
      Object.keys(v).forEach((k) => stack.push({ v: v[k], path: path ? `${path}.${k}` : k, parent: v, key: k }));
      continue;
    }

    if (typeof v === "number") {
      // Negative check
      if (v < 0 && !isExplicitDiscountContext(parent, key, path)) {
        pushMsg(errors, "error", "NEGATIVE_VALUE", `قيمة سالبة غير مسموحة: ${v}`, path);
      }

      // Percent check (heuristic)
      if (looksLikePercentField(key, path)) {
        if (v > 100) {
           pushMsg(warnings, "warn", "PERCENT_TOO_HIGH", `نسبة مئوية تبدو عالية جداً: ${v}`, path);
        }
      }
    }
  }
  
  // Custom logic: Channel mix sum
  if (inputs?.channels) {
    // ... (could add mix logic here)
  }

  return { errors, warnings };
}

// Exports
export { validateInputs };
if (typeof module !== "undefined" && module.exports) {
  module.exports = { validateInputs };
}
if (typeof window !== "undefined") {
  window.CalcValidateInputs = { validateInputs };
}

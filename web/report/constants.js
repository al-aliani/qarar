
export const DISCLAIMER_TEXT =
  "هذه المخرجات تقديرية مبنية على افتراضات المستخدم والبيانات المُدخلة، وقد تختلف النتائج الفعلية. " +
  "لا تُعد هذه المخرجات نصيحة مالية/قانونية/ضريبية أو ضمانًا للأداء. " +
  "يُنصح بمراجعة مختص قبل اتخاذ قرار استثماري.";

export const REPORT_TITLES = {
  EXECUTIVE_SUMMARY: "الملخص التنفيذي",
  MARKET: "وصف المشروع والسوق",
  OPERATIONS: "الخطة التشغيلية",
  FINANCIALS: "التحليل المالي",
  RISKS: "المخاطر والتحقق",
  RECOMMENDATIONS: "التوصيات وخطة العمل"
};

export const formatSAR = new Intl.NumberFormat("ar-SA", {
  style: "currency",
  currency: "SAR",
  maximumFractionDigits: 0
});

export const formatPct = new Intl.NumberFormat("ar-SA", {
  style: "percent",
  maximumFractionDigits: 1
});

export const formatNum = new Intl.NumberFormat("ar-SA", {
  maximumFractionDigits: 2
});

export function n0(x) {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

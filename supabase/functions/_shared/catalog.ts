export const ADDONS = {
  priority_support: { id: 'priority_support', name: 'دعم أولوية', price: 99 },
  extra_review: { id: 'extra_review', name: 'مراجعة إضافية', price: 299 },
  result_session: { id: 'result_session', name: 'جلسة شرح النتائج', price: 399 },
} as const;

export function selectedAddons(ids: unknown) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(String))].map((id) => ADDONS[id as keyof typeof ADDONS]).filter(Boolean);
}

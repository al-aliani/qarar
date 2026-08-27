export const ADDONS = {
  priority_support: { id: 'priority_support', name: 'دعم أولوية', price: 99 },
  extra_review: { id: 'extra_review', name: 'مراجعة إضافية', price: 299 },
  // includedIn: باقة «خدمة كاملة» تتضمن جلسة الشرح أصلاً — selectedAddons أدناه تستبعدها
  // من الإجمالي حتى لو أرسلها العميل، فلا يُحاسَب أحد على شيء يملكه ضمن باقته بالفعل.
  result_session: { id: 'result_session', name: 'جلسة شرح النتائج', price: 399, includedIn: ['full'] },
} as const;

export function selectedAddons(ids: unknown, packageId?: string) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(String))]
    .map((id) => ADDONS[id as keyof typeof ADDONS])
    .filter(Boolean)
    .filter((addon) => !('includedIn' in addon) || !(addon.includedIn as readonly string[]).includes(packageId ?? ''));
}

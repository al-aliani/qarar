/**
 * نسخة خادمية من web/js/core/pricing.js — مصدر الحقيقة الوحيد للسعر المسموح به
 * عند إنشاء جلسة دفع. لا نثق أبداً بسعر يرسله العميل (تلاعب DevTools/طلب مباشر
 * لواجهة الـEdge Function يتجاوز الواجهة تماماً) — السعر الفعلي المُرسَل لمزوّد
 * الدفع يُشتقّ من هذا الجدول حصراً بمطابقة tier، لا من أي قيمة واردة في الطلب.
 *
 * يجب أن يبقى متطابقاً حرفياً مع web/js/core/pricing.js — حارسه
 * web/js/services/__tests__/pricingSync.guard.test.js يفشل تلقائياً عند أي
 * تباعد بين الملفين (نفس نمط الحرّاس المستخدم عبر هذه الحملة).
 */

export type Tier = 'free' | 'self' | 'reviewed' | 'full';

export interface PricingPackage {
  id: Tier;
  name: string;
  price: number;
  unit: string;
  channel: 'app';
}

export const PRICING_PACKAGES: PricingPackage[] = [
  { id: 'free', name: 'مجانية', price: 0, unit: '﷼', channel: 'app' },
  { id: 'self', name: 'ذاتي', price: 299, unit: '﷼ / دراسة', channel: 'app' },
  { id: 'reviewed', name: 'مراجَع بخبير', price: 1999, unit: '﷼ / دراسة', channel: 'app' },
  { id: 'full', name: 'خدمة كاملة', price: 4999, unit: '﷼ / دراسة', channel: 'app' },
];

export function getPackage(tier: string): PricingPackage | null {
  return PRICING_PACKAGES.find((p) => p.id === tier) || null;
}

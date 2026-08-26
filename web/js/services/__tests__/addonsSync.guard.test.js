/**
 * الخدمات الإضافية (دعم أولوية / مراجعة إضافية / جلسة شرح النتائج) مُعرَّفة مرتين:
 * web/js/core/pricing.js (ما يعرضه العميل ويجمعه في «المطلوب دفعه») و
 * supabase/functions/_shared/catalog.ts (ما يُحسب منه المبلغ الفعلي في
 * create-checkout ثم يظهر في لوحة التحويل البنكي). أسعار الباقات محروسة بـ
 * pricingSync.guard.test.js، والإضافات لم تكن — فرفع سعر إضافة في الخادم وحده
 * يعرض على العميل مبلغاً ويطالبه بغيره خلال نقرة واحدة داخل مسار دفع.
 * هذا الحارس بنفس نمط حارس الباقات: يستورد نسخة العميل ويقرأ نسخة الخادم نصياً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ADDONS } from '../../core/pricing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseServerAddons() {
  const src = readFileSync(
    join(__dirname, '../../../../supabase/functions/_shared/catalog.ts'),
    'utf8'
  );
  const match = src.match(/ADDONS[^=]*=\s*(\{[\s\S]*?\})\s*as const;/);
  if (!match) throw new Error('تعذّر استخراج ADDONS من catalog.ts');
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return ${match[1]};`)();
}

describe('تزامن أسعار الخدمات الإضافية بين العميل (pricing.js) والخادم (catalog.ts)', () => {
  it('نفس عدد الإضافات، ونفس id/name/price لكل إضافة بالضبط', () => {
    const serverAddons = parseServerAddons();
    expect(Object.keys(serverAddons).length).toBe(ADDONS.length);
    ADDONS.forEach((clientAddon) => {
      const serverAddon = serverAddons[clientAddon.id];
      expect(serverAddon, `إضافة ${clientAddon.id} غائبة عن النسخة الخادمية`).toBeTruthy();
      expect(serverAddon.id).toBe(clientAddon.id);
      expect(serverAddon.price).toBe(clientAddon.price);
      expect(serverAddon.name).toBe(clientAddon.name);
    });
  });
});

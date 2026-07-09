/**
 * تدقيق 2026-07-09 (أتمتة الدفع): supabase/functions/_shared/pricing.ts نسخة
 * خادمية مستقلة عن web/js/core/pricing.js (مصدر السعر الوحيد المسموح عند
 * التحقق من الدفع — لا نثق بسعر واردٍ من العميل). حارس يفشل تلقائياً إن
 * تباعد الملفان (نفس نمط "حارس تزامن" المستخدم عبر هذه الحملة).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PRICING_PACKAGES } from '../../core/pricing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseServerPackages() {
  const src = readFileSync(
    join(__dirname, '../../../../supabase/functions/_shared/pricing.ts'),
    'utf8'
  );
  const match = src.match(/PRICING_PACKAGES[^=]*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('تعذّر استخراج PRICING_PACKAGES من pricing.ts');
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return ${match[1]};`)();
}

describe('تزامن أسعار الباقات بين العميل (pricing.js) والخادم (pricing.ts)', () => {
  it('نفس عدد الباقات، ونفس id/price/channel لكل باقة بالضبط', () => {
    const serverPackages = parseServerPackages();
    expect(serverPackages.length).toBe(PRICING_PACKAGES.length);
    PRICING_PACKAGES.forEach((clientPkg) => {
      const serverPkg = serverPackages.find((p) => p.id === clientPkg.id);
      expect(serverPkg, `باقة ${clientPkg.id} غائبة عن النسخة الخادمية`).toBeTruthy();
      expect(serverPkg.price).toBe(clientPkg.price);
      expect(serverPkg.channel).toBe(clientPkg.channel);
      expect(serverPkg.unit).toBe(clientPkg.unit);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { buildRevenueModel } from '../financial/revenue.js';
import { SECTIONS } from '../schema.js';

/**
 * تدقيق 2026-07-18: يثبّت الحارس في revenue.js (`if (type === 'operating' && hasServices)
 * return;`) — أُزيل سهواً في جلسة موازية ليلة 2026-07-17 فضاعف الإيراد الفعلي (revenue.streams
 * + services.items يُجمعان معاً لنفس الدخل الحقيقي بدل استبعاد أحدهما)، ثم أُعيد. هذا الاختبار
 * يستهدف buildRevenueModel مباشرة (لا المحرك الكامل) لتفادي أي تذبذب من افتراضات طاقة/نمو غير
 * متعلقة بالحارس نفسه.
 */
describe('Financial Integrity Lock: Revenue & Services Merge', () => {
    it('does not double-count operating revenue.streams when services.items are also populated', () => {
        const study = {
            [SECTIONS.REVENUE]: {
                // لولا الحارس: 50 عميل/شهر × 100 ريال × 12 = 60,000 سنوياً إضافية
                streams: [{ customersPerMonth: 50, avgPrice: 100, type: 'operating' }],
            },
        };
        // 30 عميل/شهر × 200 ريال × 12 = 72,000 سنوياً
        const serviceItems = [{ customersPerMonth: 30, pricePerUnit: 200 }];

        const { sourcesAtYear } = buildRevenueModel({
            study, SECTIONS, serviceItems, getSaving: () => 0,
        });

        const year1Revenue = sourcesAtYear(true, 'rev1', 0);

        // بلا الحارس: 60,000 + 72,000 = 132,000 (تراكب صامت). بالحارس: 72,000 فقط
        // (تيار revenue.streams التشغيلي يُستبعد لصالح services.items الأغنى تفصيلاً).
        expect(year1Revenue).toBe(72000);
    });
});

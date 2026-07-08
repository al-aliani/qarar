/**
 * تدقيق 2026-07-08 (ملاحظة عالية #23): كتالوج المنتجات/الخدمات الوصفي
 * (projectInfo.products/introServices — مقدمة الجدوى) كان معزولاً تماماً عن الكتالوج
 * المالي (services.items/revenue.streams — ما يقرأه المحرك فعلياً) بلا أي تنبيه —
 * يصف المستخدم منتجاً في مقدمة الجدوى ثم لا يُسعِّره مالياً أبداً دون أن يلاحظ.
 */
import { describe, it, expect } from 'vitest';
import { productCatalogWarning } from '../dataQuality.js';

describe('productCatalogWarning — عزلة كتالوج المنتجات الوصفي عن المالي (#23)', () => {
    it('لا تحذير عند عدم وجود أي منتجات/خدمات وصفية (لا شيء لمطابقته)', () => {
        expect(productCatalogWarning({ projectInfo: {} })).toBeNull();
        expect(productCatalogWarning({})).toBeNull();
    });

    it('تحذير حين تُوصف منتجات لكن لا يوجد أي تسعير مالي إطلاقاً', () => {
        const state = {
            projectInfo: { products: [{ name: 'برجر مشوي' }], introServices: [] },
            services: { items: [] },
            revenue: { streams: [] }
        };
        const warn = productCatalogWarning(state);
        expect(warn).not.toBeNull();
        expect(warn.level).toBe('warning');
        expect(warn.message).toContain('برجر مشوي');
        expect(warn.message).toContain('لم تُسعِّر');
    });

    it('لا تحذير حين يتطابق اسم منتج وصفي واحد على الأقل مع اسم مالي (تجاهل اختلاف المسافات/حالة الأحرف)', () => {
        const state = {
            projectInfo: { products: [{ name: '  برجر مشوي  ' }] },
            services: { items: [{ name: 'برجر مشوي', pricePerUnit: 35, customersPerMonth: 500 }] }
        };
        expect(productCatalogWarning(state)).toBeNull();
    });

    it('يطابق أيضاً عبر revenue.streams (باستخدام حقل service أو name)', () => {
        const state = {
            projectInfo: { introServices: [{ name: 'توصيل سريع' }] },
            revenue: { streams: [{ service: 'توصيل سريع', avgPrice: 10, customersPerMonth: 200 }] }
        };
        expect(productCatalogWarning(state)).toBeNull();
    });

    it('تحذير حين توجد أسماء وصفية ومالية معاً لكن بلا أي تطابق بينها', () => {
        const state = {
            projectInfo: { products: [{ name: 'برجر مشوي' }] },
            services: { items: [{ name: 'اشتراك شهري', pricePerUnit: 99, customersPerMonth: 50 }] }
        };
        const warn = productCatalogWarning(state);
        expect(warn).not.toBeNull();
        expect(warn.message).toContain('لا تطابق');
    });
});

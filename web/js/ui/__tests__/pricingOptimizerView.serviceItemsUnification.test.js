/**
 * @vitest-environment jsdom
 *
 * توحيد سعر الوحدة (2026-08-24): PricingOptimizerView كان يقرأ ويكتب حصراً على
 * revenue.streams — بلا أثر عند وجود خدمات في services.items لأن revenue.js يتجاهلها
 * كلياً حينها (revenue.js:38). هذه الاختبارات تثبّت إعادة توجيه القراءة/الكتابة إلى
 * services.items عند وجودها، مع إبقاء صفوف revenue.streams غير التشغيلية (type
 * !== 'operating') ظاهرة ومكتوبة في مصفوفتها الصحيحة دون تسرّب بين المصدرين.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PricingOptimizerView } from '../PricingOptimizerView.js';

function fakeStore(state) {
    return {
        getState: () => state,
        get: () => state,
        update: (section, value) => { state[section] = value; },
        updatePath: (section, key, value) => { state[section] = { ...state[section], [key]: value }; }
    };
}

describe('PricingOptimizerView — توحيد مصدر السعر مع services.items', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
    });

    it('خدمة واحدة في services.items + revenue.streams فارغة: يظهر صف واحد، وتطبيق السعر يكتب في services.items فقط', () => {
        const state = {
            marketing: { pricingOptimization: {} },
            services: { items: [{ name: 'استشارة', customersPerMonth: 20, pricePerUnit: 100, variableCostPerUnit: 30 }] },
            revenue: { streams: [] }
        };
        const store = fakeStore(state);
        const view = new PricingOptimizerView('root', store, null);
        view.render(0);

        const rows = document.querySelectorAll('.service-comparison-table tbody tr');
        expect(rows.length).toBe(1);
        expect(document.body.textContent).toContain('استشارة');
        expect(document.body.textContent).toContain('تحليل الخدمات');

        const applyBtn = document.querySelector('.btn-apply-price');
        expect(applyBtn).toBeTruthy();
        applyBtn.click();

        expect(state.services.items[0].pricePerUnit).toBeTypeOf('number');
        expect(state.services.items[0].pricePerUnit).toBeGreaterThan(0);
        // لا مساس بـ revenue.streams إطلاقاً
        expect(state.revenue.streams).toEqual([]);
    });

    it('خدمة في services.items + صف type:"non-operating" في revenue.streams معاً: صفان، وتطبيق السعر يكتب في المصفوفة الصحيحة فقط', () => {
        const state = {
            marketing: { pricingOptimization: {} },
            services: { items: [{ name: 'استشارة', customersPerMonth: 20, pricePerUnit: 100, variableCostPerUnit: 30 }] },
            revenue: { streams: [{ service: 'إيجار عقار', type: 'non-operating', customersPerMonth: 1, avgPrice: 5000, variableCostRate: 0.2 }] }
        };
        const store = fakeStore(state);
        const view = new PricingOptimizerView('root', store, null);
        view.render(0);

        const rows = document.querySelectorAll('.service-comparison-table tbody tr');
        expect(rows.length).toBe(2);
        expect(document.body.textContent).toContain('استشارة');
        expect(document.body.textContent).toContain('إيجار عقار');

        const applyButtons = document.querySelectorAll('.btn-apply-price');
        expect(applyButtons.length).toBe(2);

        // تطبيق السعر على صف الخدمة (أول صف) يكتب في services.items فقط
        applyButtons[0].click();
        expect(state.services.items[0].pricePerUnit).toBeGreaterThan(0);
        expect(state.revenue.streams[0].avgPrice).toBe(5000); // غير مُمسوس

        // إعادة تهيئة الحالة لاختبار الصف الثاني بمعزل عن أثر الصف الأول
        const state2 = {
            marketing: { pricingOptimization: {} },
            services: { items: [{ name: 'استشارة', customersPerMonth: 20, pricePerUnit: 100, variableCostPerUnit: 30 }] },
            revenue: { streams: [{ service: 'إيجار عقار', type: 'non-operating', customersPerMonth: 1, avgPrice: 5000, variableCostRate: 0.2 }] }
        };
        const store2 = fakeStore(state2);
        const view2 = new PricingOptimizerView('root', store2, null);
        view2.render(0);
        const applyButtons2 = document.querySelectorAll('.btn-apply-price');
        applyButtons2[1].click();
        expect(state2.services.items[0].pricePerUnit).toBe(100); // غير مُمسوس
        expect(state2.revenue.streams[0].avgPrice).toBeGreaterThan(0);
    });

    it('بلا services.items (المسار القديم): يقرأ ويكتب على revenue.streams تماماً كالسابق', () => {
        const state = {
            marketing: { pricingOptimization: {} },
            revenue: { streams: [{ name: 'قهوة', avgPrice: 20, unitCost: 8, customersPerMonth: 100 }] }
        };
        const store = fakeStore(state);
        const view = new PricingOptimizerView('root', store, null);
        view.render(0);

        const rows = document.querySelectorAll('.service-comparison-table tbody tr');
        expect(rows.length).toBe(1);
        expect(document.body.textContent).not.toContain('تحليل الخدمات');

        document.querySelector('.btn-apply-price').click();
        expect(state.revenue.streams[0].avgPrice).toBeGreaterThan(0);
        expect(state.services).toBeUndefined();
    });
});

/**
 * @vitest-environment jsdom
 *
 * دفعة 4: ServiceAnalysis.js لم يكن يستورد escapeHtml إطلاقاً — اسم الخدمة (نص حر من
 * #inpServiceName) كان يُعاد رسمه بلا تهريب في 4 مواضع على الأقل: قائمة الشارات
 * (badge list)، بطاقة الخدمة، جدول المقارنة، وقائمة الترتيب. هذا يثبّت أن حقن HTML
 * عبر اسم الخدمة لم يعد يظهر خاماً في أيٍّ من هذه المواضع الأربعة، وأن زر حذف الخدمة
 * صار يحمل aria-label غير فارغ لقارئات الشاشة.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServiceAnalysis } from '../ServiceAnalysis.js';

const XSS_NAME = '<img src=x onerror=alert(1)>';

function fakeStore(initialState) {
    let state = initialState;
    return {
        get: () => state,
        update: (section, value) => { state = { ...state, [section]: value }; }
    };
}

describe('ServiceAnalysis — تهريب اسم الخدمة + aria-label لزر الحذف', () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        container = document.getElementById('c');
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('لا يظهر وسم <img> الخام في أي من مواضع عرض اسم الخدمة الأربعة', () => {
        const store = fakeStore({
            services: {
                items: [
                    { name: XSS_NAME, pricePerUnit: 10, customersPerMonth: 5, icon: '📦', capex: 0, fixedCosts: 0, variableCostPerUnit: 0, growthRate: 0.07 }
                ]
            },
            revenue: { streams: [] },
            assumptions: {}
        });

        const view = new ServiceAnalysis('c', store, () => {});
        view.render(0);

        const html = container.innerHTML;

        // السلسلة الخام لا يجب أن تظهر أبداً في innerHTML بعد الإصلاح
        expect(html).not.toContain(XSS_NAME);
        expect(html).not.toContain('<img src=x onerror=alert(1)>');

        // تأكيد أن المكوّنات الأربعة فعلاً رُسمت (وإلا فالاختبار غير ذي معنى)
        // 1) قائمة الشارات (badge list) — من نموذج "تفاصيل المنتجات/الخدمات"
        const badge = container.querySelector('.badge');
        expect(badge).toBeTruthy();
        expect(badge.innerHTML).not.toContain(XSS_NAME);
        expect(badge.innerHTML).toContain('&lt;img');

        // 2) بطاقة الخدمة (service card)
        const serviceNameEl = container.querySelector('.service-name');
        expect(serviceNameEl).toBeTruthy();
        expect(serviceNameEl.innerHTML).not.toContain(XSS_NAME);
        expect(serviceNameEl.innerHTML).toContain('&lt;img');

        // 3) جدول المقارنة (comparison table)
        const table = container.querySelector('.service-comparison-table');
        expect(table).toBeTruthy();
        expect(table.innerHTML).not.toContain(XSS_NAME);
        expect(table.innerHTML).toContain('&lt;img');

        // 4) قائمة الترتيب (ranking list)
        const rankingName = container.querySelector('.ranking-name');
        expect(rankingName).toBeTruthy();
        expect(rankingName.innerHTML).not.toContain(XSS_NAME);
        expect(rankingName.innerHTML).toContain('&lt;img');

        // لا يوجد فعلياً عنصر <img> تم حقنه في الشجرة الفعلية (وليس فقط كنص خام)
        expect(container.querySelectorAll('img').length).toBe(0);
    });

    it('زر حذف الخدمة يحمل aria-label غير فارغ', () => {
        const store = fakeStore({
            services: {
                items: [
                    { name: 'خدمة عادية', pricePerUnit: 10, customersPerMonth: 5, icon: '📦', capex: 0, fixedCosts: 0, variableCostPerUnit: 0, growthRate: 0.07 }
                ]
            },
            revenue: { streams: [] },
            assumptions: {}
        });

        const view = new ServiceAnalysis('c', store, () => {});
        view.render(0);

        const removeBtn = container.querySelector('.btn-remove-service');
        expect(removeBtn).toBeTruthy();
        const ariaLabel = removeBtn.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel.trim().length).toBeGreaterThan(0);
    });
});

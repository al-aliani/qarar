/**
 * @vitest-environment jsdom
 *
 * findOfferingsWithoutCustomerValue: تنبيه استشاري (لا يمنع التنقل) عند غياب
 * قيمة عميل مطابقة نصياً لمنتج/خدمة — انظر تعليق التصميم أعلى الدالة في
 * OfferingView.js لحدود المطابقة (تداخل كلمة واحدة ≥ حرفين، استرشادي لا صارم).
 *
 * اختبار render() أيضاً: تعطّل كامل خطوات "التحقق والتعريف" (KEY_PEOPLE،
 * فرضية المشروع، الأهداف الذكية) حدث فعلياً في هذه الجلسة بسبب استدعاء
 * this._wireImageStubList/this._bindNameIdeas قبل تعريفهما — StudyCategoryView
 * لا يغلّف كل خطوة بـtry/catch، فأي رمي هنا يُسقط رسم كل الخطوات اللاحقة بصمت.
 * هذا الاختبار حارس ضد تكرار ذلك تحديداً.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OfferingView, findOfferingsWithoutCustomerValue } from '../OfferingView.js';

describe('findOfferingsWithoutCustomerValue', () => {
    it('يُرجع أسماء المنتجات/الخدمات بلا قيمة عميل مطابقة نصياً', () => {
        const state = {
            projectInfo: {
                products: [{ name: 'قهوة مختصة' }],
                introServices: [{ name: 'صيانة أجهزة' }],
                customerValues: [{ customerType: 'موظف مكتبي', customerNeed: 'مشروب سريع', valueWeProvide: 'قهوة عالية الجودة' }]
            }
        };
        const gaps = findOfferingsWithoutCustomerValue(state);
        expect(gaps).toContain('صيانة أجهزة');
        expect(gaps).not.toContain('قهوة مختصة');
    });

    it('لا يُرجع شيئاً عند مطابقة كل العروض', () => {
        const state = {
            projectInfo: {
                products: [{ name: 'خبز طازج' }],
                introServices: [],
                customerValues: [{ customerType: 'أسرة', customerNeed: 'خبز طازج يومياً', valueWeProvide: 'إنتاج يومي' }]
            }
        };
        expect(findOfferingsWithoutCustomerValue(state)).toEqual([]);
    });

    it('لا يرمي عند غياب البيانات كلياً', () => {
        expect(() => findOfferingsWithoutCustomerValue({})).not.toThrow();
        expect(findOfferingsWithoutCustomerValue({})).toEqual([]);
    });
});

function fakeWizard(tables = {}) {
    return {
        tables,
        renderTable: () => {}
    };
}

function fakeStore(state) {
    return { get: () => state, update: () => {}, updatePath: () => {} };
}

describe('OfferingView.render — لا يرمي (حارس ضد تعطّل الخطوات اللاحقة)', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="c"></div>'; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('يُنشئ ويرسم بلا استثناء مع جداول/عروض فارغة', () => {
        const state = { projectInfo: {}, revenue: { streams: [] }, assumptions: {} };
        const store = fakeStore(state);
        const view = new OfferingView('c', store, null, fakeWizard());
        expect(() => view.render(0)).not.toThrow();
        expect(document.querySelector('#btnSuggestNames')).toBeTruthy();
    });

    it('يرسم أزرار «توليد صورة أولية» لكل صف منتج دون رمي', () => {
        const state = {
            projectInfo: { products: [{ name: 'منتج 1' }], introServices: [], customerValues: [] },
            revenue: { streams: [] },
            assumptions: {}
        };
        const store = fakeStore(state);
        const view = new OfferingView('c', store, null, fakeWizard());
        view.render(0);
        const stubBtn = document.querySelector('#image-stub-products .btn-image-stub');
        expect(stubBtn).toBeTruthy();
        stubBtn.click();
        expect(document.querySelector('#image-stub-products .image-stub-result').textContent)
            .toContain('غير متاح الآن');
    });
});

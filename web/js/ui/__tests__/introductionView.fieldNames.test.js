/**
 * @vitest-environment jsdom
 *
 * فرضية المشروع خطوة تشغيلية: لا تعيد تحرير المنتجات أو الخدمات أو الموقع،
 * ولا تعرض مصادر أو قاموساً نظرياً داخل مسار إدخال البيانات.
 */
import { describe, it, expect, vi } from 'vitest';
import { IntroductionView } from '../IntroductionView.js';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return {
        getState: () => state,
        get: () => state,
        update: vi.fn((section, value) => { state[section] = value; })
    };
}

describe('IntroductionView — فرضية تشغيلية بلا حشو أو إدخال مكرر', () => {
    it('يعرض المشكلة والحل وسبب اختيار العميل فقط', () => {
        document.body.innerHTML = '<div id="c"></div>';
        const state = createEmptyStudy();
        const view = new IntroductionView('c', fakeStore(state), () => {});
        view.render(5);

        expect(document.querySelector('h2').textContent).toBe('فرضية المشروع');
        expect(document.querySelector('#hypothesis-problem')).toBeTruthy();
        expect(document.querySelector('#hypothesis-solution')).toBeTruthy();
        expect(document.querySelector('#hypothesis-insight')).toBeTruthy();
        expect(document.querySelectorAll('.introduction-view textarea')).toHaveLength(3);
    });

    it('لا يعرض المصادر والقاموس والمنتجات والموقع المكررة في هذه الخطوة', () => {
        document.body.innerHTML = '<div id="c"></div>';
        const state = createEmptyStudy();
        state.projectInfo.products = [{ name: 'قهوة مختصة' }];
        const view = new IntroductionView('c', fakeStore(state), () => {});
        view.render(5);

        const text = document.getElementById('c').textContent;
        expect(text).not.toContain('مصادر البيانات الرسمية');
        expect(text).not.toContain('تعريف المصطلحات');
        expect(document.querySelector('.product-card')).toBeNull();
        expect(document.querySelector('.location-alternatives-section')).toBeNull();
    });

    it('الانتقال للخطوة التالية لا يمسح كتالوج المنتجات والخدمات الموجود', () => {
        document.body.innerHTML = '<div id="c"></div>';
        const state = createEmptyStudy();
        state.projectInfo.products = [{ name: 'قهوة مختصة' }];
        state.projectInfo.introServices = [{ name: 'توصيل' }];
        const store = fakeStore(state);
        const view = new IntroductionView('c', store, () => {});
        view.render(5);

        document.querySelector('.btn-next-step').click();
        expect(state.projectInfo.products).toEqual([{ name: 'قهوة مختصة' }]);
        expect(state.projectInfo.introServices).toEqual([{ name: 'توصيل' }]);
    });
});

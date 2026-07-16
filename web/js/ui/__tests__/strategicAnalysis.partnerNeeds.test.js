/**
 * @vitest-environment jsdom
 *
 * البطاقة الخامسة «نوع الشريك الاستراتيجي المطلوب» في StrategicAnalysis — قيمة
 * مشتقة حياً عبر calculateStudy(state).partnerNeeds، بلا زر توليد (خلافاً لبقية
 * البطاقات). راجع partnerNeeds.test.js لاختبارات قواعد التصنيف نفسها.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategicAnalysis } from '../StrategicAnalysis.js';
import { createEmptyStudy } from '../../core/schema.js';

function fakeStore(initialState) {
    let state = initialState;
    return {
        getState: () => state,
        update: (section, value) => { state = { ...state, [section]: value }; }
    };
}

describe('StrategicAnalysis — بطاقة نوع الشريك الاستراتيجي المطلوب', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
    });

    it('بند market_entry يظهر في البطاقة برقم النسبة الفعلي عند ملكية أجنبية 30%', () => {
        const state = createEmptyStudy();
        state.assumptions = { ...state.assumptions, foreignOwnershipRate: 0.3 };
        const store = fakeStore(state);
        const view = new StrategicAnalysis('c', store, () => {});
        view.render(0);

        const items = document.querySelectorAll('.partner-need-item');
        expect(items.length).toBeGreaterThan(0);
        const text = Array.from(items).map(el => el.textContent).join(' ');
        expect(text).toContain('30%');
        expect(text).toContain('شريك دخول للسوق المحلي');
    });

    it('لا إشارات: تظهر رسالة الحالة الفارغة بدل أي بند', () => {
        const store = fakeStore(createEmptyStudy());
        const view = new StrategicAnalysis('c', store, () => {});
        view.render(0);

        expect(document.querySelectorAll('.partner-need-item').length).toBe(0);
        expect(document.body.textContent).toContain('لا توجد إشارات كافية حالياً');
    });
});

describe('StrategicAnalysis — حارس انحداري: فشل المحرك لا يُسقط الصفحة', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        vi.resetModules();
    });

    it('calculateStudy يرمي استثناءً: render لا يرمي، ويتراجع لحالة فارغة', async () => {
        vi.doMock('../../core/engine.js', () => ({
            calculateStudy: () => { throw new Error('محاكاة عطل في المحرك'); }
        }));
        const { StrategicAnalysis: MockedStrategicAnalysis } = await import('../StrategicAnalysis.js');
        const store = fakeStore(createEmptyStudy());
        const view = new MockedStrategicAnalysis('c', store, () => {});

        expect(() => view.render(0)).not.toThrow();
        expect(document.body.textContent).toContain('لا توجد إشارات كافية حالياً');

        vi.doUnmock('../../core/engine.js');
        vi.resetModules();
    });
});

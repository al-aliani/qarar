/**
 * @vitest-environment jsdom
 *
 * اختبارات إضافتَي التسويق (batch 5): سعر ساعة الذروة الاختياري (peakMultiplier)
 * وتقدير حساسية الطلب للسعر (elasticity) في PricingOptimizerView.js.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PricingOptimizerView, computePeakPrice, computeElasticityVolumeChange } from '../PricingOptimizerView.js';

function fakeStore(state) {
    return {
        getState: () => state,
        get: () => state,
        update: (section, value) => { state[section] = value; },
        updatePath: (section, key, value) => { state[section] = { ...state[section], [key]: value }; }
    };
}

describe('computePeakPrice', () => {
    it('يضرب السعر المقترح في معامل الذروة', () => {
        expect(computePeakPrice(100, 1.2)).toBeCloseTo(120);
    });

    it('معامل غير صالح/صفري يُعامل كـ 1 (بلا تغيير)', () => {
        expect(computePeakPrice(100, 0)).toBeCloseTo(100);
        expect(computePeakPrice(100, NaN)).toBeCloseTo(100);
    });

    it('سعر مقترح صفري يعيد صفراً بغضّ النظر عن المعامل', () => {
        expect(computePeakPrice(0, 1.5)).toBe(0);
    });
});

describe('computeElasticityVolumeChange', () => {
    it('حاصل ضرب معامل المرونة في نسبة تغيّر السعر (مثال شائع: -1.2 × 10 = -12)', () => {
        expect(computeElasticityVolumeChange(-1.2, 10)).toBeCloseTo(-12);
    });

    it('نسبة تغيّر سعر سالبة تعكس الإشارة', () => {
        expect(computeElasticityVolumeChange(-1.2, -10)).toBeCloseTo(12);
    });

    it('مدخلات غير رقمية تُعامل كصفر دون رمي', () => {
        expect(computeElasticityVolumeChange(undefined, 10)).toBe(0);
        expect(computeElasticityVolumeChange(-1.2, undefined)).toBeCloseTo(0);
    });
});

describe('PricingOptimizerView — عرض سعر الذروة الاختياري', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
    });

    it('لا يعرض سطر سعر الذروة حين peakMultiplier=1 (الحالة المحايدة)', () => {
        const state = {
            marketing: { pricingOptimization: { peakMultiplier: 1 } },
            revenue: { streams: [{ name: 'قهوة', avgPrice: 20, unitCost: 8, customersPerMonth: 100 }] }
        };
        const view = new PricingOptimizerView('root', fakeStore(state), null);
        view.render(0);
        expect(document.body.textContent).not.toContain('وقت الذروة');
    });

    it('يعرض سعر ساعة الذروة كاستراتيجية اختيارية حين peakMultiplier>1', () => {
        const state = {
            marketing: { pricingOptimization: { peakMultiplier: 1.5, targetGrossMargin: 0.5 } },
            revenue: { streams: [{ name: 'قهوة', avgPrice: 20, unitCost: 10, customersPerMonth: 100 }] }
        };
        const view = new PricingOptimizerView('root', fakeStore(state), null);
        view.render(0);
        expect(document.body.textContent).toContain('وقت الذروة (اختياري)');
        expect(document.getElementById('pricingPeakMultiplierVal').textContent).toBe('1.5');
    });

    it('تحريك سلايدر الذروة يُحدّث التسمية المعروضة حياً بلا إعادة رسم كاملة', () => {
        const state = {
            marketing: { pricingOptimization: {} },
            revenue: { streams: [] }
        };
        const view = new PricingOptimizerView('root', fakeStore(state), null);
        view.render(0);
        const slider = document.getElementById('pricingPeakMultiplier');
        slider.value = '1.8';
        slider.dispatchEvent(new Event('input'));
        expect(document.getElementById('pricingPeakMultiplierVal').textContent).toBe('1.8');
    });

    it('حفظ الإعدادات (change) يُخزّن peakMultiplier/elasticity/illustrativePriceChangePercent في marketing.pricingOptimization', () => {
        const state = {
            marketing: { pricingOptimization: {} },
            revenue: { streams: [] }
        };
        const store = fakeStore(state);
        const view = new PricingOptimizerView('root', store, null);
        view.render(0);

        document.getElementById('pricingPeakMultiplier').value = '1.6';
        document.getElementById('pricingPeakMultiplier').dispatchEvent(new Event('change'));

        expect(state.marketing.pricingOptimization.peakMultiplier).toBeCloseTo(1.6);
        expect(state.marketing.pricingOptimization.elasticity).toBeCloseTo(-1.2);
        expect(state.marketing.pricingOptimization.illustrativePriceChangePercent).toBeCloseTo(10);
    });

    it('يعرض تغيّر الكمية التقديري بناءً على معامل المرونة ونسبة تغيّر السعر الافتراضية', () => {
        const state = {
            marketing: { pricingOptimization: { elasticity: -1.2, illustrativePriceChangePercent: 10 } },
            revenue: { streams: [] }
        };
        const view = new PricingOptimizerView('root', fakeStore(state), null);
        view.render(0);
        expect(document.body.textContent).toContain('-12%');
    });
});

/**
 * اختبارات مصححات المخرجات وفلاتر الجودة (تدقيق 2026-07-04)
 * تحمي من عودة: IRR «1.3%» بدل 130%، استرداد «0.0 سنة» للمشروع الخاسر،
 * انحراف شروحات الخطوات، ومسح الإيرادات اليدوية.
 */
import { describe, it, expect } from 'vitest';
import { safePct, safePayback } from '../../../export/utils.js';
import { formatPayback, formatFractionAsPercent, roundClean } from '../formatters.js';
import { STEPS, STEP_HELP, PHASE_LABELS } from '../../core/wizardSteps.js';
import { bridgeServicesToRevenueStreams } from '../../core/bridge.js';
import { calculateZakatAndTax } from '../../core/zakatTax.js';

describe('safePct — لا تخمين ذكي يفسد IRR المرتفع', () => {
    it('كسر 1.3 (أي 130%) يصبح 130 وليس 1.3', () => {
        expect(safePct(1.3)).toBeCloseTo(130, 6);
    });
    it('كسر 0.155 يصبح 15.5', () => {
        expect(safePct(0.155)).toBeCloseTo(15.5, 6);
    });
});

describe('فترة الاسترداد — لا «0.0 سنة» أبداً', () => {
    it('null/0/Infinity = غير قابل للاسترداد', () => {
        [null, undefined, 0, Infinity, NaN].forEach(v => {
            expect(safePayback(v)).toContain('غير قابل للاسترداد');
            expect(formatPayback(v)).toContain('غير قابل للاسترداد');
        });
    });
    it('قيمة سليمة تُعرض بسنة واحدة عشرية', () => {
        expect(safePayback(2.34)).toBe('2.3 سنة');
    });
});

describe('تنسيق الكسور — لا ضجيج فاصلة عائمة', () => {
    it('0.050000000000000176 → «5.0%»', () => {
        expect(formatFractionAsPercent(0.050000000000000176)).toBe('5.0%');
    });
    it('roundClean يقص الضجيج', () => {
        expect(roundClean(2826920.2500000005)).toBe(2826920.25);
    });
});

describe('wizardSteps — لا انحراف بين الخطوات والشروحات', () => {
    it('STEP_HELP يطابق عدد STEPS واحداً بواحد', () => {
        expect(STEP_HELP.length).toBe(STEPS.length);
    });
    it('PHASE_LABELS مشتقة لكل خطوة', () => {
        expect(PHASE_LABELS.length).toBe(STEPS.length);
        PHASE_LABELS.forEach(p => expect(p.label).toBeTruthy());
    });
});

describe('جسر الخدمات — لا مسح للإيرادات اليدوية', () => {
    const manual = [{ service: 'إيجار ركن', type: 'non-operating', customersPerMonth: 1, avgPrice: 5000 }];

    it('قسم خدمات فارغ يعيد المصادر اليدوية كما هي', () => {
        expect(bridgeServicesToRevenueStreams([], manual)).toEqual(manual);
        expect(bridgeServicesToRevenueStreams(null, manual)).toEqual(manual);
    });

    it('خدمة مطابقة بالاسم تحافظ على نوع المصدر اليدوي', () => {
        const out = bridgeServicesToRevenueStreams(
            [{ name: 'إيجار ركن', customersPerMonth: 1, pricePerUnit: 5000 }],
            manual
        );
        expect(out[0].type).toBe('non-operating');
    });
});

describe('zakatTax — متسق مع المحرك', () => {
    it('سعودي 100%: زكاة 2.5% وضريبة صفر', () => {
        const { zakat, tax } = calculateZakatAndTax(100000, null, {});
        expect(zakat).toBeCloseTo(2500, 6);
        expect(tax).toBe(0);
    });
    it('أجنبي 40%: زكاة على 60% وضريبة 20% على 40%', () => {
        const { zakat, tax } = calculateZakatAndTax(100000, null, { foreignOwnershipRate: 0.4, taxRate: 0.20 });
        expect(zakat).toBeCloseTo(100000 * 0.025 * 0.6, 6);
        expect(tax).toBeCloseTo(100000 * 0.20 * 0.4, 6);
    });
});

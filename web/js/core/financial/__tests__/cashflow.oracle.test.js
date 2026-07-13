/**
 * تحقق مرجعي (oracle verification) — نقارن NPV/IRR المحسوبة يدوياً في cashflow.js
 * وPMT المحسوب في loanSchedule.js بمكتبة مستقلة (financial، npm) لا علاقة لها بكودنا،
 * لضمان أن الصيغ المالية صحيحة رياضياً لا مجرد "تعمل بدون خطأ". إضافة تبعية اختبار فقط
 * (devDependency) — لا تُستخدم في كود الإنتاج ولا تُشحن للمستخدم.
 */
import { describe, it, expect } from 'vitest';
import * as financial from 'financial';
import { calculateNPV, calculateIRR } from '../cashflow.js';
import { computeLoanSchedule } from '../../../../../lib/calc/loanSchedule.js';

describe('calculateNPV — يطابق مكتبة financial المستقلة (#oracle-verification)', () => {
    const cases = [
        { rate: 0.1, cf: [-1000, 300, 400, 500, 600] },
        { rate: 0.05, cf: [-50000, 15000, 15000, 15000, 15000, 15000] },
        { rate: 0.15, cf: [-200000, 0, 50000, 80000, 120000] },
        { rate: 0.2, cf: [-1000000, 300000, 300000, 300000, 300000, 300000] },
        { rate: 0.08, cf: [-433320, 90000, 95000, 100000, 105000, 110000, 115000, 120000] },
        { rate: 0, cf: [-10000, 2000, 3000, 5000] },
    ];

    for (const { rate, cf } of cases) {
        it(`rate=${rate}, cf=[${cf.join(',')}]`, () => {
            const ours = calculateNPV(rate, cf);
            const oracle = financial.npv(rate, cf);
            expect(ours).toBeCloseTo(oracle, 6);
        });
    }
});

describe('calculateIRR — يطابق مكتبة financial المستقلة (#oracle-verification)', () => {
    const cases = [
        [-1000, 300, 400, 500, 600],
        [-50000, 15000, 15000, 15000, 15000, 15000],
        [-200000, 0, 50000, 80000, 120000],
        [-1000000, 300000, 300000, 300000, 300000, 300000],
        [-433320, 90000, 95000, 100000, 105000, 110000, 115000, 120000],
        [-100000, -20000, 60000, 60000, 60000],
    ];

    for (const cf of cases) {
        it(`cf=[${cf.join(',')}]`, () => {
            const ours = calculateIRR(cf);
            const oracle = financial.irr(cf);
            expect(Number.isFinite(oracle)).toBe(true);
            expect(ours).not.toBeNull();
            // فرق مسموح 0.01% (1e-4) في معدل العائد — يتحمّل اختلاف طريقة Newton-Raphson
            // بين التطبيقين مع رفض أي انحراف حقيقي في المنطق المالي.
            expect(Math.abs(ours - oracle)).toBeLessThan(1e-4);
        });
    }
});

describe('computeLoanSchedule PMT — يطابق مكتبة financial المستقلة (#oracle-verification)', () => {
    const cases = [
        { amount: 100000, rate: 0.08, years: 5 },
        { amount: 500000, rate: 0.05, years: 10 },
        { amount: 1500000, rate: 0.12, years: 3 },
        { amount: 250000, rate: 0.065, years: 7 },
        { amount: 5000000, rate: 0.09, years: 15 },
    ];

    for (const { amount, rate, years } of cases) {
        it(`amount=${amount}, rate=${rate}, years=${years}`, () => {
            const ours = computeLoanSchedule(amount, rate, years, 0, 'equal').monthlyPayment;
            const oracle = financial.pmt(rate / 12, years * 12, -amount);
            expect(ours).toBeCloseTo(oracle, 0); // مقربة لأقرب ريال في كودنا
        });
    }
});

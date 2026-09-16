/**
 * تدقيق 2026-09-16: بصمة مدخلات مونت كارلو تُبطل نتيجة محفوظة إن تغيّرت مدخلات
 * الدراسة الجوهرية بعد التشغيل (انظر decisionGate.stressMonteCarloRisk.test.js
 * وscoring.test.js لأمثلة الاستخدام الفعلي في بوابة القرار والدرجة).
 */
import { describe, it, expect } from 'vitest';
import { computeInputsFingerprint } from '../monteCarloFingerprint.js';

describe('computeInputsFingerprint', () => {
    it('نفس المدخلات، بصرف النظر عن محتوى monteCarlo: تُعيد نفس البصمة', () => {
        const a = { revenue: { streams: [{ customersPerMonth: 100 }] }, monteCarlo: { lastRun: { successProbability: 0.5 } } };
        const b = { revenue: { streams: [{ customersPerMonth: 100 }] }, monteCarlo: { lastRun: { successProbability: 0.9, inputsFingerprint: 'x' } } };
        expect(computeInputsFingerprint(a)).toBe(computeInputsFingerprint(b));
    });

    it('تغيّر مُدخل حقيقي (مثل عدد العملاء) يُنتج بصمة مختلفة', () => {
        const a = { revenue: { streams: [{ customersPerMonth: 100 }] } };
        const b = { revenue: { streams: [{ customersPerMonth: 200 }] } };
        expect(computeInputsFingerprint(a)).not.toBe(computeInputsFingerprint(b));
    });

    it('تغيّر results وحده (مخرَج مشتق يُعاد كتابته عند كل زيارة) لا يُغيّر البصمة', () => {
        const a = { revenue: { streams: [{ customersPerMonth: 100 }] }, results: { indicators: { npv: 1 } } };
        const b = { revenue: { streams: [{ customersPerMonth: 100 }] }, results: { indicators: { npv: 999999 } } };
        expect(computeInputsFingerprint(a)).toBe(computeInputsFingerprint(b));
    });

    it('state فارغ أو غائب لا يرمي خطأ', () => {
        expect(() => computeInputsFingerprint(null)).not.toThrow();
        expect(() => computeInputsFingerprint(undefined)).not.toThrow();
        expect(() => computeInputsFingerprint({})).not.toThrow();
    });
});

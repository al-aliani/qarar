/**
 * تدقيق 2026-09-16: state.monteCarlo.lastRun هو مخرَج محاكاة محسوب (NPV/percentiles
 * مرجّحة) لا مُدخل مستخدم — نتيجة سالبة حقيقية (مشروع خاسر مرجَّحاً) طبيعية ومتوقعة
 * تماماً، بالضبط كـstate.results (المُستثنى أصلاً منذ 2026-07-17). كانت تُفحص بنفس
 * قاعدة "لا قيم سالبة في المدخلات" فتُحجب دراسات خاسرة فعلياً عند تشغيل المحاكاة.
 */
import { describe, it, expect } from 'vitest';
import { validateInputs } from '../validateInputs.js';

describe('validateInputs — استثناء state.monteCarlo', () => {
    it('نتيجة مونت كارلو سالبة (avgNPV/p10/p50 سالبة) لا تُصنَّف قيمة سالبة غير مسموحة', () => {
        const inputs = {
            monteCarlo: {
                lastRun: {
                    successProbability: 0.2,
                    avgNPV: -170293.876,
                    p10: -830641.704,
                    p50: -188618.406,
                    p90: -50000,
                }
            }
        };
        const { errors } = validateInputs(inputs);
        expect(errors.some(e => e.code === 'NEGATIVE_VALUE')).toBe(false);
    });

    it('لا يزال يرفض قيمة سالبة حقيقية في مُدخل عادي خارج monteCarlo/results', () => {
        const inputs = { revenue: { streams: [{ customersPerMonth: -5 }] } };
        const { errors } = validateInputs(inputs);
        expect(errors.some(e => e.code === 'NEGATIVE_VALUE')).toBe(true);
    });
});

/**
 * تدقيق 2026-08-26 — كان DecisionExplainer.js يبني عتباته الاحتياطية بنفسه
 * (minIRR 0.15 وmaxPayback **7**) بينما computeDecision في engine.js يقرأ
 * resolveDecisionThresholds حيث سقف الاسترداد الفعلي **3.5**. فدراسة استردادها بين
 * العتبتين يرفضها المحرك ولا يذكر المُفسِّر سببها إطلاقاً — يرى المستخدم قراراً بلا
 * سببه الحقيقي. هذا الاختبار يثبّت **الاتفاق** بين القرار والمُفسِّر لا الأرقام،
 * فيبقى صالحاً لو غيّر المالك العتبات.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { explainDecisionBreakers } from '../DecisionExplainer.js';
import { SECTIONS } from '../schema.js';

// دراسة مُعايَرة لتقع فترة استردادها داخل النافذة الحرجة (بين 3.5 الفعلية و7 القديمة).
function createBorderlinePaybackStudy() {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, taxRate: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [{ price: 250000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 18000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ type: 'operating', customersPerMonth: 400, avgPrice: 100, variableCostRate: 0.30, growthRate: 0 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('explainDecisionBreakers — عتبات موحّدة مع computeDecision', () => {
    it('دراسة استردادها بين العتبتين: سبب الاسترداد يظهر في قائمة المُفسِّر لأن المحرك رفضه', () => {
        const study = createBorderlinePaybackStudy();
        const result = calculateStudy(study);
        const th = result.assumptionsApplied.thresholds;
        const payback = result.indicators.paybackPeriod;

        // حارس المعايرة: لو خرجت الدراسة من النافذة لم يعد الاختبار يختبر المقصود.
        expect(payback).toBeGreaterThan(th.maxPayback);
        expect(payback).toBeLessThanOrEqual(7);

        const { issues } = result.decisionExplanation;
        expect(issues.some(i => i.metric === 'paybackPeriod')).toBe(true);
        // نفس السقف المُطبَّق في القرار، لا رقم محلي آخر
        expect(issues.find(i => i.metric === 'paybackPeriod').threshold).toBe(th.maxPayback);
        expect(result.decisionReasons.some(r => r.includes('فترة الاسترداد'))).toBe(true);
    });

    it('اتفاق تام: كل مؤشر يرفضه القرار له سبب في المُفسِّر، وكل مؤشر يقبله ليس له سبب', () => {
        const result = calculateStudy(createBorderlinePaybackStudy());
        const th = result.assumptionsApplied.thresholds;
        const ind = result.indicators;
        const has = (metric) => result.decisionExplanation.issues.some(i => i.metric === metric);

        expect(has('npv')).toBe(!((ind.npv ?? 0) > th.minNPV));
        expect(has('irr')).toBe(!((ind.irr ?? 0) >= th.minIRR));
        expect(has('paybackPeriod')).toBe(!(ind.paybackPeriod != null && ind.paybackPeriod > 0 && ind.paybackPeriod <= th.maxPayback));
        expect(has('roi')).toBe(!((ind.roi ?? 0) >= th.minROI));
    });

    it('تجاوز المستخدم للعتبات يُحترَم في المُفسِّر كما في القرار (لا أرقام مثبّتة)', () => {
        const study = createBorderlinePaybackStudy();
        study.assumptions.thresholds = { maxPayback: 7 };
        const result = calculateStudy(study);

        expect(result.assumptionsApplied.thresholds.maxPayback).toBe(7);
        expect(result.indicators.paybackPeriod).toBeLessThanOrEqual(7);
        expect(result.decisionExplanation.issues.some(i => i.metric === 'paybackPeriod')).toBe(false);
        expect(result.decisionReasons.some(r => r.includes('فترة الاسترداد'))).toBe(false);
    });
});

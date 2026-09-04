/**
 * تدقيق 2026-09-04 — رحلة عميل حقيقية (صالون حلاقة): ضغطت «اقتراح بنود» في أول
 * جدول إيرادات، فظهر توست فوراً: «🟡 ملاحظة استراتيجية: القرار يوصي بمراجعة الدراسة
 * قبل المضي قدماً. أبرز الأسباب: …» — قبل أن أُدخل ريالاً واحداً من الإيراد.
 *
 * المصدر: SmartAdvisor.analyze() في فرع `!hasFull` (لا year1 أو لا إيراد) كان يدفع
 * حكم results.decision كـinsight من نوع critical، ويعرضه app.js:2890 توستاً.
 *
 * وهذا يناقض سياسة المنتج المعلنة في نفس الشاشة: DecisionDashboard ترفض إظهار أي
 * حكم بلا بيانات إيرادات، ويحرس ذلك اختبار صريح في ui.test.js. سياستان متضادتان
 * على نفس الحالة داخل المنتج نفسه — والمستخدم يرى الأسوأ منهما.
 */
import { describe, it, expect } from 'vitest';
import { SmartAdvisor } from '../SmartAdvisor.js';

const EMPTY_STATE = { projectInfo: { name: 'دراسة بلا بيانات' }, assumptions: {} };

describe('المستشار الذكي: لا حكم قرار على دراسة بلا إيرادات', () => {
    it('لا يُصدر insight من فئة «قرار» حين لا توجد قائمة دخل ولا إيراد', () => {
        const results = { decision: 'REVISE', decisionReasons: ['سبب تجريبي'], incomeStatement: [] };
        const { insights } = SmartAdvisor.analyze(results, EMPTY_STATE);
        expect(insights.some(i => i.category === 'قرار')).toBe(false);
    });

    it('ولا حتى عند NO-GO — الحكم من اختصاص لوحة القرار وبوابة الجودة', () => {
        const results = { decision: 'NO-GO', decisionReasons: ['سبب تجريبي'], incomeStatement: [] };
        const { insights } = SmartAdvisor.analyze(results, EMPTY_STATE);
        expect(insights.some(i => i.category === 'قرار')).toBe(false);
        const texts = insights.map(i => String(i.message || '')).join(' | ');
        expect(texts).not.toContain('عدم جدوى');
        expect(texts).not.toContain('يوصي بمراجعة الدراسة');
    });

    it('لا انحدار: الحكم يبقى ظاهراً لدراسة لها إيراد فعلي', () => {
        const results = {
            decision: 'REVISE',
            decisionReasons: ['هامش منخفض'],
            incomeStatement: [{ revenue: 1000000, netIncome: 50000 }],
            indicators: { npv: 100000, irr: 0.2, paybackPeriod: 3 },
        };
        const state = { ...EMPTY_STATE, projectInfo: { name: 'دراسة كاملة', concept: 'مطعم' } };
        const { insights } = SmartAdvisor.analyze(results, state);
        expect(insights.some(i => i.category === 'قرار')).toBe(true);
    });

    it('يبقى مفيداً بلا بيانات: مؤشرات سالبة ما زالت تُنبَّه', () => {
        const results = { decision: 'REVISE', incomeStatement: [], indicators: { npv: -50000 } };
        const { insights } = SmartAdvisor.analyze(results, EMPTY_STATE);
        expect(insights.some(i => i.category === 'جدوى')).toBe(true);
    });
});

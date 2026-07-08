import { describe, it, expect } from 'vitest';
import { validateExpertTemplateCertification } from '../ExpertTemplateGovernance.js';

/**
 * تدقيق 2026-07-08 (ملاحظة عالية #40): بوابة اعتماد القوالب كانت تتحقق من طول
 * النصوص فقط (specialty/scope) بلا أي ربط بالقطاعات الستة المعتمدة في
 * PRODUCT_CONSTITUTION.md (نفس قائمة sectorBenchmarks.js) — فقالب بتخصص خارج
 * أي قطاع مدعوم كان يمر بلا اعتراض ما دام النص طويلاً بما يكفي.
 */

function buildMeta(overrides = {}) {
    return {
        title: 'قالب مطعم شرقي',
        expertName: 'أحمد المالكي',
        specialty: 'مطاعم ومقاهي',
        scope: 'مطاعم متوسطة الحجم في مدن المملكة الرئيسية، لا يغطي المطاعم السحابية',
        reviewNotes: 'راجعتُ الأرقام مقابل بيانات GASTAT ومقارنات سوقية محلية فعلية',
        yearsExperience: 5,
        ...overrides
    };
}

function buildStudyData() {
    return {
        revenue: { streams: [{ service: 'وجبات', avgPrice: 40, customersPerMonth: 1000 }] },
        technical: { equipment: [{ name: 'فرن', cost: 20000 }] },
        hr: { positions: [{ title: 'طباخ', count: 2, salary: 4000 }] }
    };
}

describe('بوابة اعتماد القوالب: التحقق من نطاق القطاع (#40)', () => {
    it('قالب بتخصص مطاعم يطابق sectorBenchmarks يمر دون اعتراض القطاع', () => {
        const result = validateExpertTemplateCertification(buildMeta(), buildStudyData());
        expect(result.blockers.some(b => b.includes('القطاعات المعتمدة'))).toBe(false);
    });

    it('قالب بتخصص لا يقع ضمن أي من القطاعات الستة المعتمدة يُحظر صراحة', () => {
        const meta = buildMeta({
            specialty: 'فن الخط العربي والزخرفة اليدوية',
            scope: 'خدمات فنية للخط العربي والزخرفة اليدوية لعملاء الأفراد في المناسبات الخاصة'
        });
        const result = validateExpertTemplateCertification(meta, buildStudyData());
        expect(result.status).toBe('blocked');
        expect(result.blockers.some(b => b.includes('القطاعات المعتمدة'))).toBe(true);
    });

    it('يطابق عبر نص scope حتى لو specialty وحده غامضاً', () => {
        const meta = buildMeta({
            specialty: 'أعمال عامة',
            scope: 'مصنع إنتاج وتصنيع مواد غذائية معلّبة للتوزيع بالجملة داخل المملكة'
        });
        const result = validateExpertTemplateCertification(meta, buildStudyData());
        expect(result.blockers.some(b => b.includes('القطاعات المعتمدة'))).toBe(false);
    });

    it('لا يُطلق فحص القطاع نفسه إن كانت حقول title/specialty الأساسية ناقصة أصلاً (تتكفل بها اعتراضات أخرى)', () => {
        const meta = buildMeta({ title: '', specialty: '' });
        const result = validateExpertTemplateCertification(meta, buildStudyData());
        expect(result.blockers.some(b => b.includes('القطاعات المعتمدة'))).toBe(false);
        expect(result.blockers.length).toBeGreaterThan(0);
    });
});

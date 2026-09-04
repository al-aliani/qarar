/**
 * تدقيق 2026-09-04 — رحلة عميل حقيقية (صالون حلاقة رجالي، الرياض):
 * المنصة صنّفت الصالون «تجزئة عالية الهامش (عطور/تجميل/إكسسوارات/أزياء)» ورأيت ذلك
 * حياً في تقدير استهلاك المرافق. السبب: retailHighMargin.test كان يحوي /تجميل/
 * ويُعرَّف قبل service في نفس الكائن، و detectSectorBenchmark يعيد أول مطابقة —
 * رغم أن service.test كان يحوي /صالون/ صراحةً أصلاً، أي أن النية كانت صحيحة والترتيب
 * خطفها. و«مغسلة ملابس» كانت تُخطف عبر /ملابس/.
 *
 * أثر الخطأ على عميل دافع: نطاق العمالة 10–22% بدل 30–50%، فيُطلق المستشار الذكي
 * وبوابة QA تحذير «تكلفة الرواتب أعلى من النطاق» + إجراء «قلّل عدد الموظفين في السنة
 * الأولى» على نشاط هو عمالته بالكامل؛ ومعيار استهلاك مياه أدنى؛ ونطاقات Nitaqat
 * 'balanced' بدل 'laborHeavy'.
 *
 * هذا الاختبار يثبّت الاتجاهين معاً: الخدمات لا تُخطف، والتجزئة عالية الهامش لا تنكسر.
 */
import { describe, it, expect } from 'vitest';
import { detectSectorBenchmark, SECTOR_BENCHMARKS } from '../sectorBenchmarks.js';
import { FIELD_OPTIONS } from '../fieldOptions.js';

describe('كشف القطاع: الأنشطة الخدمية لها أسبقية على التجزئة عالية الهامش', () => {
    it.each([
        ['صالون / مركز تجميل', 'خدمي'],
        ['مغسلة ملابس', 'خدمي'],
        ['صيانة وتنظيف', 'خدمي'],
        ['رعاية صحية / عيادة', 'خدمي'],
        ['تعليم وتدريب', 'خدمي'],
        ['رياضة ولياقة / صالة رياضية', 'خدمي'],
        ['مشغل نسائي', 'خدمي'],
        ['محل حلاقة', 'خدمي'],
    ])('«%s» ⟶ %s', (concept, expectedLabel) => {
        expect(detectSectorBenchmark(concept)?.label).toBe(expectedLabel);
    });

    it('لا انحدار: التجزئة عالية الهامش ما زالت تلتقط العطور والمستحضرات والأزياء', () => {
        for (const concept of ['عطور ومستحضرات تجميل', 'متجر ملابس', 'بوتيك أزياء', 'محل عود وبخور', 'مجوهرات وذهب']) {
            expect(detectSectorBenchmark(concept)?.label, concept).toBe(SECTOR_BENCHMARKS.retailHighMargin.label);
        }
    });

    it('لا انحدار: بقية القطاعات كما هي', () => {
        expect(detectSectorBenchmark('مطعم')?.label).toBe(SECTOR_BENCHMARKS.fnb.label);
        expect(detectSectorBenchmark('بقالة')?.label).toBe(SECTOR_BENCHMARKS.retail.label);
        expect(detectSectorBenchmark('مصنع')?.label).toBe(SECTOR_BENCHMARKS.industrial.label);
        expect(detectSectorBenchmark('منصة SaaS')?.label).toBe(SECTOR_BENCHMARKS.saas.label);
    });

    it('الصالون يحصل على نطاق عمالة الخدمات كثيفة العمالة لا نطاق التجزئة', () => {
        const bench = detectSectorBenchmark('صالون / مركز تجميل');
        expect(bench.laborToRevenue).toEqual(SECTOR_BENCHMARKS.service.laborToRevenue);
        // النطاق الخدمي أوسع صعوداً — صالون برواتب 35% من المبيعات طبيعي لا شاذ
        expect(bench.laborToRevenue[1]).toBeGreaterThanOrEqual(0.5);
    });

    it('كل نشاط خدمي في قائمة الأنشطة المعروضة للمستخدم يُكتشف خدمياً', () => {
        const allConcepts = (FIELD_OPTIONS.concept?.options || []).map(o => o.value);
        const serviceConcepts = allConcepts.filter(c =>
            /صالون|عيادة|رعاية صحية|تعليم|تدريب|صيانة|تنظيف|رياضة|لياقة|استشارات/.test(String(c))
        );
        expect(serviceConcepts.length).toBeGreaterThan(0);
        for (const c of serviceConcepts) {
            expect(detectSectorBenchmark(String(c))?.label, String(c)).toBe(SECTOR_BENCHMARKS.service.label);
        }
    });
});

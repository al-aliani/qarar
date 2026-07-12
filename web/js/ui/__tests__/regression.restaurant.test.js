/**
 * اختبارات تراجعية (regression) لأعطال «اختبار المطعم بعد التحديث» — يوليو 2026.
 * تحرس أخطر خطأ (×100 في التكلفة المتغيرة) وتفعيل أزرار الاقتراح للمنتجات/الخدمات/القيمة.
 */
import { describe, it, expect } from 'vitest';
import { DynamicTable } from '../DynamicTable.js';
import { InternalAIGenerator } from '../../services/InternalAIGenerator.js';
import { calculateStudy } from '../../core/engine.js';
import { SECTIONS } from '../../core/schema.js';

function restaurantStudy(vcr) {
    return {
        [SECTIONS.PROJECT_INFO]: { name: 'مطعم', sector: 'مطاعم', businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
        [SECTIONS.TECHNICAL]: { equipment: [{ name: 'معدات', price: 100000, quantity: 1 }], buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [] },
        [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 6000, months: 12, nationality: 'saudi' }] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 10000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: { streams: [{ service: 'وجبات', type: 'operating', customersPerMonth: 1000, avgPrice: 30, variableCostRate: vcr, growthRate: 0.05 }] },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('DynamicTable.estimateCellValue — حارس خطأ ×100 (أخطر عطل)', () => {
    it('variableCostRate يُعاد ككسر ≤ 1 (ليس 55 ولا 5500)', () => {
        const v = DynamicTable.estimateCellValue('variableCostRate', 'وجبات بخاري');
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(1);   // كسر لا نسبة مئوية خام — هذا هو جوهر الإصلاح
        expect(v).toBeCloseTo(0.38, 2);     // منتصف 0.30–0.45
    });

    it('variableCostRate للتوصيل أعلى (عمولة منصة) لكنه يبقى كسراً', () => {
        const v = DynamicTable.estimateCellValue('variableCostRate', 'طلبات توصيل');
        expect(v).toBeLessThanOrEqual(1);
        expect(v).toBeCloseTo(0.45, 2);     // منتصف 0.35–0.55
    });

    it('growthRate و amortizationRate يبقيان كسوراً ≤ 1', () => {
        expect(DynamicTable.estimateCellValue('growthRate', 'مشروبات')).toBeLessThanOrEqual(1);
        expect(DynamicTable.estimateCellValue('amortizationRate', 'دراسة جدوى')).toBeLessThanOrEqual(1);
    });

    it('turnsPerDay دورات جلوس واقعية (2–4) وليس 55', () => {
        const t = DynamicTable.estimateCellValue('turnsPerDay', '');
        expect(t).toBeGreaterThanOrEqual(2);
        expect(t).toBeLessThanOrEqual(4);
        expect(t).not.toBe(55);
    });

    it('أعمدة غير كسرية تبقى بقيمها الطبيعية (راتب مدير بالآلاف)', () => {
        expect(DynamicTable.estimateCellValue('salary', 'مدير')).toBeGreaterThan(1000);
    });

    it('حارس عام: أي عمود كسري لا يتجاوز 1 مهما كان البند', () => {
        for (const key of ['growthRate', 'variableCostRate', 'amortizationRate']) {
            expect(DynamicTable.estimateCellValue(key, 'أي بند عشوائي')).toBeLessThanOrEqual(1);
        }
    });
});

describe('InternalAIGenerator — أزرار اقتراح المنتجات/الخدمات/القيمة (كانت لا تضيف صفوفاً)', () => {
    const restaurant = { projectInfo: { concept: 'مطعم بخاري', sector: 'مطاعم' } };
    const generic = { projectInfo: { concept: 'مغسلة سيارات', sector: 'خدمات' } };

    it('generateProducts يعيد صفوفاً بمفاتيح جدول المنتجات الصحيحة', () => {
        const rows = InternalAIGenerator.generateProducts(restaurant);
        expect(Array.isArray(rows)).toBe(true);
        expect(rows.length).toBeGreaterThan(0);
        // تدقيق دفعة 3 (2026-07-12): valueAdded دُمج داخل uniqueFeatures في schema.js
        // (products.uniqueFeatures) — لم يعد عمود schema مستقلاً، فحُذف من قائمة
        // المفاتيح المتوقعة هنا كي يبقى هذا الحارس متوافقاً مع مخطط الجدول الفعلي.
        for (const k of ['type', 'name', 'description', 'uniqueFeatures', 'customerBenefit']) {
            expect(Object.keys(rows[0])).toContain(k);
        }
        expect(['primary', 'semi', 'final']).toContain(rows[0].type);
    });

    it('generateIntroServices يعيد صفوفاً بمفاتيح صحيحة', () => {
        const rows = InternalAIGenerator.generateIntroServices(restaurant);
        expect(rows.length).toBeGreaterThan(0);
        expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['type', 'name', 'description']));
        expect(['essential', 'supporting', 'secondary']).toContain(rows[0].type);
    });

    it('generateCustomerValues يعيد صفوفاً بمفاتيح صحيحة', () => {
        const rows = InternalAIGenerator.generateCustomerValues(restaurant);
        expect(rows.length).toBeGreaterThan(0);
        expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['customerType', 'customerNeed', 'valueWeProvide']));
    });

    it('نشاط عام (غير مطعم) يعيد بدائل عامة غير فارغة', () => {
        expect(InternalAIGenerator.generateProducts(generic).length).toBeGreaterThan(0);
        expect(InternalAIGenerator.generateIntroServices(generic).length).toBeGreaterThan(0);
        expect(InternalAIGenerator.generateCustomerValues(generic).length).toBeGreaterThan(0);
    });
});

describe('حارس المحرك — variableCostRate بنسبة مئوية خام لا يدمّر الدراسة (دفاع عن الدراسات المحفوظة)', () => {
    it('55 يُعامَل ككسر 0.55 فينتج نفس نتيجة 0.55', () => {
        const r55 = calculateStudy(restaurantStudy(55));
        const r055 = calculateStudy(restaurantStudy(0.55));
        expect(r55.indicators.npv).toBeCloseTo(r055.indicators.npv, 0);
    });

    it('55 لا ينتج NPV كارثياً بمئات الملايين السالبة (كان -293 مليون في التقرير)', () => {
        const r = calculateStudy(restaurantStudy(55));
        expect(r.indicators.npv).toBeGreaterThan(-5000000);
    });
});

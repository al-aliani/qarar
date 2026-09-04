/**
 * تدقيق 2026-09-04 — رحلة عميل صالون حلاقة:
 *
 * زر التقدير ✨ كان يستدعي estimateCellValue(colKey, itemName) بلا أي وصول لحالة
 * الدراسة — فالقاعدة الاحتياطية (catch-all) هي «تكلفة الطعام/المتغيرة النموذجية
 * للمطاعم» وتُحقن في أي جدول لأي قطاع.
 *
 * ماذا يعني للعميل: صاحب صالون يضغط ✨ على «نسبة التكلفة المتغيرة» فيحصل على ~38%
 * بينما تكلفة مواد الصالون الفعلية 10–15%. الفارق ~25 نقطة مئوية من الإيراد تذهب
 * مباشرةً إلى قائمة الدخل وNPV — كافٍ لقلب القرار إلى REVISE/NO-GO بلا سبب حقيقي.
 * ثم يُحاكَم نفس الرقم أمام معيار القطاع فيبدو «ضمن النطاق» — فالعيبان يخفي
 * أحدهما الآخر.
 *
 * ومثيله في نموذج الطاقة: عيادة أو صالون يضغط ✨ على «دورات الاستخدام/اليوم»
 * فيحصل على 3 (دورات جلوس مطعم) بينما كرسي الحلاقة يخدم 8–12 عميلاً — فتُقصّ
 * الطاقة القصوى إلى الثُلث ويُطلق تحذير «مبيعات مستحيلة مادياً» بلا سبب.
 */
import { describe, it, expect } from 'vitest';
import { DynamicTable } from '../DynamicTable.js';
import { SECTOR_BENCHMARKS } from '../../core/sectorBenchmarks.js';

// المُقدِّر يعيد منتصف النطاق مقرَّباً (سلوك قائم) — نتحقق من وقوع القيمة داخل
// النطاق لا من مساواة عددية تامة، كي لا يتكسّر الاختبار بتغيير تقريب.

describe('زر التقدير ✨ يحترم قطاع المشروع', () => {
    it('التكلفة المتغيرة للصالون تأتي من النطاق الخدمي لا نطاق المطاعم', () => {
        const value = DynamicTable.estimateCellValue('variableCostRate', 'قص شعر رجالي', 'صالون / مركز تجميل');
        const [lo, hi] = SECTOR_BENCHMARKS.service.variableCostRate;
        expect(value).toBeGreaterThanOrEqual(lo);
        expect(value).toBeLessThanOrEqual(hi);
        // النطاق المطعمي القديم كان 0.30–0.45 — يجب ألا نقع فيه
        expect(value).toBeLessThan(0.30);
    });

    it('لا انحدار: المطعم ما زال يحصل على نطاق تكلفة الطعام', () => {
        const value = DynamicTable.estimateCellValue('variableCostRate', 'وجبة رئيسية', 'مطعم');
        const [lo, hi] = SECTOR_BENCHMARKS.fnb.variableCostRate;
        expect(value).toBeGreaterThanOrEqual(lo);
        expect(value).toBeLessThanOrEqual(hi);
    });

    it('بلا نشاط محدَّد يبقى السلوك السابق كما هو — لا تغيير صامت', () => {
        const value = DynamicTable.estimateCellValue('variableCostRate', 'بند عام');
        expect(value).toBeGreaterThanOrEqual(0.30);
        expect(value).toBeLessThanOrEqual(0.45);
    });

    it('الكلمات المفتاحية أقوى من القطاع (التوصيل يحمل عمولة منصة فعلاً)', () => {
        const value = DynamicTable.estimateCellValue('variableCostRate', 'طلبات التوصيل', 'صالون / مركز تجميل');
        expect(value).toBeGreaterThanOrEqual(0.35);
        expect(value).toBeLessThanOrEqual(0.55);
    });

    it('دورات الاستخدام للصالون أعلى من دورات جلوس المطعم', () => {
        const salon = DynamicTable.estimateCellValue('turnsPerDay', 'كرسي حلاقة', 'صالون / مركز تجميل');
        const restaurant = DynamicTable.estimateCellValue('turnsPerDay', 'طاولة', 'مطعم');
        expect(salon).toBeGreaterThan(restaurant);
        expect(restaurant).toBeGreaterThanOrEqual(2);
        expect(restaurant).toBeLessThanOrEqual(4);
    });

    it('عدد الوحدات للصالون بحجم صالون لا بحجم صالة مطعم', () => {
        const salon = DynamicTable.estimateCellValue('seats', 'كراسي', 'صالون / مركز تجميل');
        const restaurant = DynamicTable.estimateCellValue('seats', 'مقاعد', 'مطعم');
        expect(salon).toBeLessThan(restaurant);
    });

    it('الأعمدة الكسرية تبقى كسراً (0–1) لا نسبة خام — الفخ التاريخي ×100', () => {
        for (const sector of ['صالون / مركز تجميل', 'مطعم', '']) {
            const v = DynamicTable.estimateCellValue('variableCostRate', 'بند', sector);
            expect(v, sector).toBeGreaterThan(0);
            expect(v, sector).toBeLessThanOrEqual(1);
        }
    });
});

/**
 * تصحيح 2026-08-25: `breakEvenUnits` كان يُقرَّب بـ`Math.round`.
 *
 * العيب: التقريب لأقرب عدد صحيح يُنقص عدد الوحدات متى كان الكسر < 0.5، فيُعلن المحرك
 * «تعادلاً» عند حجم مبيعات لا يغطي التكاليف الثابتة فعلاً — أخطر اتجاه للخطأ (مُطمئِن
 * زوراً). المشاريع عالية سعر الوحدة تُضخّم الأثر لأن كل جزء وحدة يساوي آلاف الريالات:
 * سعر 100,000 وثوابت 78,000 بهامش 65% ⟹ 1.2 وحدة ⟹ round = 1 ⟹ 100,000 ريال معروضة
 * كنقطة تعادل بينما القيمة الصحيحة 120,000 (نقص 20,000).
 *
 * الإصلاح: `Math.ceil` — لا يتعادل مشروع ببيع جزء وحدة، فالعدد الصحيح هو أول عدد وحدات
 * يبلغ التعادل أو يتجاوزه. النتيجة اللازمة: حاصل «الوحدات × السعر الضمني» لم يعد يطابق
 * `breakEvenPointValue` بالضبط، لكن العلاقة صارت **محدَّدة الاتجاه ومحدودة**:
 *
 *      0 ≤ (breakEvenUnits × السعر الضمني) − breakEvenPointValue < السعر الضمني
 *
 * أي: لا يقلّ أبداً عن القيمة الصحيحة (متحفّظ)، ولا يتجاوزها بأكثر من سعر وحدة واحدة.
 * هذا فارق تقريب مقصود لا تناقض بين الشاشتين — `breakEvenPointValue` يبقى دقيقاً بلا
 * تقريب، ولا سبيل لإزالة الفارق دون كسر إحدى الخاصيتين (دقة الريال أو صحة عدد الوحدات).
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

const VC_RATE = 0.35;
const CM_RATIO = 1 - VC_RATE; // 0.65

/**
 * دراسة بمصدر إيراد تشغيلي واحد وسعر وحدة عالٍ، وبلا أي مصدر غير تشغيلي.
 * customersPerMonth = 1 ⟹ 12 وحدة سنوياً، فالسعر الضمني (الإيراد ÷ الوحدات) = unitPrice.
 */
function makeStudy({ unitPrice, adminMonthly, equipmentPrice = 0 }) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment: equipmentPrice > 0 ? [{ price: equipmentPrice, quantity: 1 }] : [],
            buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: adminMonthly }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 1, avgPrice: unitPrice, variableCostRate: VC_RATE, growthRate: 0 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources: [] },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

describe('المحرك — تقريب نقطة التعادل بالوحدات (Math.ceil لا Math.round)', () => {
    it('الأساس التحليلي: 12 وحدة/سنة بسعر 100,000 وثوابت 78,000 (يوثّق مصدر كل رقم أدناه)', () => {
        const r = calculateStudy(makeStudy({ unitPrice: 100000, adminMonthly: 6500 }));
        const y1 = r.incomeStatement[0];
        //   الإيراد التشغيلي = 1 × 12 × 100,000                = 1,200,000
        //   الوحدات التشغيلية = 1 × 12                          =        12
        //   التكاليف المتغيرة = 1,200,000 × 0.35               =   420,000
        //   ⇒ هامش المساهمة للوحدة = 780,000 ÷ 12              =    65,000
        //   الثوابت = 6,500 × 12 (بلا معدات ⟹ إهلاك صفر)       =    78,000
        expect(y1.operatingRevenue).toBeCloseTo(1200000, 6);
        expect(y1.operatingUnits).toBe(12);
        expect(y1.variableCosts).toBeCloseTo(420000, 6);
        expect(y1.fixedCosts + y1.depreciation).toBeCloseTo(78000, 6);
    });

    it('كسر < 0.5: التقريب لأعلى لا لأقرب — العدد لا يُنقص أبداً عن التعادل الفعلي', () => {
        const i = calculateStudy(makeStudy({ unitPrice: 100000, adminMonthly: 6500 })).indicators;
        // 78,000 ÷ 0.65 = 120,000 ريال ⟵ 78,000 ÷ 65,000 = 1.2 وحدة بالضبط
        expect(i.breakEvenPointValue).toBeCloseTo(120000, 6);
        expect(i.breakEvenUnits).toBe(2);                    // ceil(1.2) — والعيب كان round(1.2) = 1
        expect(i.breakEvenUnits * 100000).toBeGreaterThanOrEqual(i.breakEvenPointValue);
        // العيب القديم بالأرقام: وحدة واحدة = 100,000 ريال، أي نقص 20,000 عن التعادل الحقيقي
        expect(1 * 100000).toBeLessThan(i.breakEvenPointValue);
    });

    it('القياس المُبلَّغ (ثوابت 112,500 بسعر 100,000): الفارق 26,923 فارق تقريب محدود لا تناقض', () => {
        // معدات 100,000 × 1.10 (طوارئ) × 15% (إهلاك معدات) = 16,500 + إيجار 96,000 = 112,500
        const i = calculateStudy(makeStudy({ unitPrice: 100000, adminMonthly: 8000, equipmentPrice: 100000 })).indicators;
        expect(i.breakEvenPointValue).toBeCloseTo(112500 / CM_RATIO, 6);   // 173,076.923…
        expect(i.breakEvenUnits).toBe(2);                                  // ceil(112,500 ÷ 65,000 = 1.7307…)
        const overshoot = i.breakEvenUnits * 100000 - i.breakEvenPointValue;
        expect(overshoot).toBeCloseTo(26923.0769, 3);
        // الفارق = جزء الوحدة غير القابل للبيع (0.2692…) × سعر الوحدة — أقل من سعر وحدة واحدة
        expect(overshoot).toBeLessThan(100000);
    });

    it('حدّ التقريب دقيق ومحدود بسعر وحدة واحدة على مدى سعري واسع (لا تسامح يتمدّد بلا حدّ)', () => {
        // الحدّ ثابت بحكم البناء: 0 ≤ الفارق < السعر الضمني — يُختبر على أسعار تفصل بينها
        // خمس مراتب عشرية، ومع كسور تعادل فوق 0.5 وتحتها معاً (قيم الإيجار مختارة كي لا
        // يكون عدد الوحدات الدقيق عدداً صحيحاً في أي تركيبة — حالة حدّية للتقريب لا للفارق).
        for (const unitPrice of [10, 100, 2500, 100000, 1000000]) {
            for (const adminMonthly of [6100, 8000, 13300]) {
                const i = calculateStudy(makeStudy({ unitPrice, adminMonthly })).indicators;
                expect(Number.isInteger(i.breakEvenUnits)).toBe(true);
                const diff = i.breakEvenUnits * unitPrice - i.breakEvenPointValue;
                expect(diff).toBeGreaterThanOrEqual(0);      // لا يُنقص أبداً (متحفّظ)
                expect(diff).toBeLessThan(unitPrice);        // ولا يتجاوز سعر وحدة واحدة
            }
        }
    });
});

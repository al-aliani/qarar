/**
 * فجوة الإهلاك الزكوي/الضريبي — أُجّلت عمداً في دفعة إصلاح الإهلاك (P0) ثم أُغلقت
 * في الجبهة الرابعة (2026-08-25).
 *
 * مجموعات ZATCA بالقسط المتناقص كانت تُرصَّد **مرة واحدة** من capexBreakdown عند
 * التأسيس، فلا تُضاف إليها أصول الإحلال المشتراة في السنوات اللاحقة — بينما الإهلاك
 * الدفتري صار يشملها بعد إصلاح P0. فيُبخَّس الإهلاك النظامي في السنوات المتأخرة
 * ويرتفع «الربح المعدل» الذي يدخل الوعاء الزكوي بلا سند.
 *
 * القياس على معدة 300,000 بعمر 3 سنوات وأفق 10 (رسملة إجمالية 1,200,000):
 *   قبل: 75,000 · 56,250 · 42,188 · 31,641 · … · 5,631   ⟹ المجموع 283,106
 *   بعد: 75,000 · 56,250 · 42,188 · 106,641 · … · 125,620 ⟹ المجموع 823,139
 * أي تبخيس 540,033 ريالاً في الإهلاك النظامي وحده.
 *
 * والتفصيل بالفئة ليس تجميلاً: افتراض مجموعة واحدة لكل الإحلال كان سيُهلك الأثاث
 * بـ25% بدل 10% النظامية.
 */
import { describe, it, expect } from 'vitest';
import { calculateStudy } from '../engine.js';
import { SECTIONS } from '../schema.js';

function makeStudy({ years = 10, equipment = [], furniture = [], techResources = [] } = {}) {
    return {
        [SECTIONS.PROJECT_INFO]: { businessModel: 'Independent' },
        // contingencyRate = 0 كي تكون أرقام capex نظيفة وقابلة للاشتقاق يدوياً
        assumptions: { projectionYears: years, discountRate: 0.10, inflationRate: 0, contingencyRate: 0 },
        [SECTIONS.TECHNICAL]: {
            equipment, furniture, buildings: [], establishmentCosts: [], capacityUtilization: []
        },
        [SECTIONS.HR]: { positions: [] },
        [SECTIONS.LOGISTICS]: { logistics: [] },
        [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 5000 }] },
        [SECTIONS.MARKETING]: { campaigns: [] },
        [SECTIONS.REVENUE]: {
            streams: [{ type: 'operating', customersPerMonth: 300, avgPrice: 100, variableCostRate: 0.3, growthRate: 0 }]
        },
        [SECTIONS.SERVICES]: { items: [] },
        [SECTIONS.FINANCING]: { sources: {} },
        [SECTIONS.TECH_RESOURCES]: { techResources },
        [SECTIONS.LEGAL]: { licenses: [] }
    };
}

const round = (arr) => arr.map((v) => Math.round(v));

describe('الإهلاك الزكوي/الضريبي يستقبل أصول الإحلال', () => {
    it('معدات (مجموعة 25%): الإهلاك النظامي يقفز في سنة الشراء بدل التلاشي الأُسّي', () => {
        const r = calculateStudy(makeStudy({
            equipment: [{ price: 300000, quantity: 1, depreciationRate: 1 / 3 }]
        }));
        const tax = round(r.depreciationSchedules.tax);

        // شرط السيناريو: إحلال فعلي في السنوات 4 و7 و10 (وإلا فالاختبار بلا معنى)
        expect(round(r.incomeStatement.map((s) => s.replacementCost)))
            .toEqual([0, 0, 0, 300000, 0, 0, 300000, 0, 0, 300000]);

        // الاشتقاق: الرصيد يبدأ 300,000 وينخفض 25% سنوياً، ثم يُضاف 300,000 في سنة
        // الشراء **قبل** احتساب إهلاكها (مطابقةً للإهلاك الدفتري الذي يبدأ في سنة الشراء).
        // س1..س3: 75,000 · 56,250 · 42,188   (الرصيد بعدها 126,562)
        // س4: (126,562 + 300,000) × 25% = 106,641
        expect(tax.slice(0, 4)).toEqual([75000, 56250, 42188, 106641]);

        // العيب القديم: التلاشي الأُسّي بلا إضافة ⟹ س4 كانت 31,641 لا 106,641
        expect(tax[3]).not.toBe(31641);
        // وكان الإهلاك النظامي يواصل الهبوط بينما الأصول تُشترى — الآن يرتفع
        expect(tax[9]).toBeGreaterThan(tax[2]);

        // الثابت الحاكم: المُهلَك نظامياً لا يتجاوز المُرسمَل أبداً
        const capitalized = r.capex.subtotal
            + r.incomeStatement.reduce((sum, s) => sum + (Number(s.replacementCost) || 0), 0);
        const totalTax = r.depreciationSchedules.tax.reduce((a, b) => a + b, 0);
        expect(totalTax).toBeLessThanOrEqual(capitalized + 1);
    });

    it('أثاث يدخل مجموعة 10% لا 25% — التفصيل بالفئة يعمل فعلاً', () => {
        const r = calculateStudy(makeStudy({
            years: 6,
            furniture: [{ price: 200000, quantity: 1, depreciationRate: 0.5 }]
        }));
        const tax = round(r.depreciationSchedules.tax);

        expect(round(r.incomeStatement.map((s) => s.replacementCost)))
            .toEqual([0, 0, 200000, 0, 200000, 0]);

        // الاشتقاق بمجموعة الأثاث النظامية 10%:
        // س1: 200,000×10% = 20,000 (الرصيد 180,000) · س2: 18,000 (الرصيد 162,000)
        // س3: (162,000 + 200,000) × 10% = 36,200
        expect(tax.slice(0, 3)).toEqual([20000, 18000, 36200]);

        // لو أُضيف الأثاث لمجموعة المعدات (25%) لكانت س3 = (162,000+200,000)×25% = 90,500
        expect(tax[2]).not.toBe(90500);
    });

    it('موارد تقنية تدخل مجموعة 25% مع المعدات', () => {
        const r = calculateStudy(makeStudy({
            years: 6,
            techResources: [{ price: 120000, quantity: 1, depreciationRate: 0.5 }]
        }));
        const tax = round(r.depreciationSchedules.tax);

        expect(round(r.incomeStatement.map((s) => s.replacementCost)))
            .toEqual([0, 0, 120000, 0, 120000, 0]);

        // س1: 120,000×25% = 30,000 (الرصيد 90,000) · س2: 22,500 (الرصيد 67,500)
        // س3: (67,500 + 120,000) × 25% = 46,875
        expect(tax.slice(0, 3)).toEqual([30000, 22500, 46875]);
    });

    it('دراسة بلا أي إحلال: الجدول النظامي لم يتغيّر إطلاقاً (لا انحدار)', () => {
        // نسبة إهلاك دفتري 5% ⟹ عمر 20 سنة > الأفق ⟹ صفر إحلال.
        const r = calculateStudy(makeStudy({
            years: 5,
            equipment: [{ price: 400000, quantity: 1, depreciationRate: 0.05 }]
        }));
        expect(r.incomeStatement.every((s) => !s.replacementCost)).toBe(true);
        // تلاشٍ أُسّي نقي 25% على 400,000 — نفس ما كان قبل التغيير بالضبط
        expect(round(r.depreciationSchedules.tax))
            .toEqual([100000, 75000, 56250, 42188, 31641]);
    });
});

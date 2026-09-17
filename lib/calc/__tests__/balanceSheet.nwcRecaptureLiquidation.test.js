/**
 * فجوة تسوية بين قائمة التدفقات والميزانية في آخر سنة — استرداد رأس المال العامل غير مرئي.
 *
 * العلة (تدقيق 2026-09-16، قرار مالك المنتج الصريح: "تعديل الميزانية"): قائمة التدفقات
 * (nwcRecapture في web/js/core/engine.js، سطر ~980) تفترض بالفعل تحصيل الذمم المدينة
 * وتصفية المخزون وسداد الذمم الدائنة بالكامل في آخر سنة من أفق الدراسة (قرار مالك المنتج
 * 2026-08-24، رقم 1) — لكن computeBalanceSheet كانت تستمر بعرض الثلاثة في آخر سنة تماماً
 * كأي سنة أخرى، وكأن المشروع مستمر للأبد. مستخدم يقارن القائمتين لنفس السنة الأخيرة يجد
 * فجوة تسوية لا تفسير لها: التدفقات تعلن استرداداً حقيقياً، والميزانية لا تُظهر أثره إطلاقاً.
 *
 * الإصلاح: computeBalanceSheet تُصفِّر AR/المخزون/الذمم الدائنة في آخر سنة فقط (وفقط حين
 * تكون غير صفرية أصلاً)، فيدخل الفرق (AR + المخزون − الذمم الدائنة) إلى النقدية تلقائياً
 * عبر نفس صيغة rawCash الحالية بلا أي تعديل عليها. الهوية المحاسبية تبقى صحيحة بنيوياً
 * لأن AR وAP كانا أصلاً يُلغيان أثرهما على إجمالي الأصول (AR يُطرح من النقد ويُضاف كسطر
 * أصول مستقل؛ AP يُضاف للنقد ويظهر أيضاً كخصم متداول مستقل) — تصفيرهما معاً لا يكسر ذلك
 * الإلغاء، فقط يحوّل قيمتهما الصافية إلى نقدية صريحة.
 */
import { describe, it, expect } from 'vitest';
import { computeBalanceSheet, generateBalanceSheets } from '../balanceSheet.js';

/** دراسة بسيطة: رأس مال عامل ممول بحقوق ملكية، صفر أصول ثابتة، سياسة دورة نقدية معلومة. */
function fixture(overrides = {}) {
    return {
        capex: { subtotal: 0, total: 0 },
        workingCapital: 500000,
        openingInventory: 0,
        equityAmount: 500000,
        fundingGap: 0,
        incomeStatements: [{ netIncome: 0, depreciation: 0, replacementCost: 0 }],
        cashCycle: { receivables: 40000, inventory: 25000, payables: 15000 },
        ...overrides
    };
}

describe('computeBalanceSheet — تصفية رأس المال العامل في آخر سنة فقط', () => {
    it('سنة عادية (isLastYear غائب): AR/المخزون/الذمم الدائنة كما هي، ولا استرداد مُعلَن', () => {
        const sheet = computeBalanceSheet(fixture(), 1);

        expect(sheet.assets.current.accountsReceivable).toBe(40000);
        expect(sheet.assets.current.inventory).toBe(25000);
        expect(sheet.liabilities.current.accountsPayable).toBe(15000);
        expect(sheet.nwcRecaptured).toBe(0);
        expect(sheet.assets.current.cash).toBe(450000); // 500000 - 40000 - 25000 + 15000
        expect(sheet.isBalanced).toBe(true);
    });

    it('آخر سنة (isLastYear=true): الثلاثة تُصفَّر، والفرق يدخل النقدية كاملاً، والميزانية تبقى متوازنة', () => {
        const sheet = computeBalanceSheet(fixture({ isLastYear: true }), 1);

        expect(sheet.assets.current.accountsReceivable).toBe(0);
        expect(sheet.assets.current.inventory).toBe(0);
        expect(sheet.liabilities.current.accountsPayable).toBe(0);
        expect(sheet.nwcRecaptured).toBe(50000); // 40000 + 25000 - 15000
        expect(sheet.assets.current.cash).toBe(500000); // 450000 + 50000 المسترَد
        expect(sheet.isBalanced).toBe(true);
    });

    it('لا شيء ليُصفَّى (AR/مخزون/ذمم دائنة كلها صفر أصلاً): isLastYear=true لا يغيّر شيئاً', () => {
        const sheet = computeBalanceSheet(
            fixture({ isLastYear: true, cashCycle: { receivables: 0, inventory: 0, payables: 0 } }),
            1
        );

        expect(sheet.nwcRecaptured).toBe(0);
        expect(sheet.assets.current.cash).toBe(500000);
        expect(sheet.isBalanced).toBe(true);
    });

    it('توافق خلفي: استدعاء بلا isLastYear إطلاقاً (كالاختبارات القديمة) سلوكه غير مُصفّى كسابق عهده', () => {
        const sheet = computeBalanceSheet(fixture(), 1);
        expect(sheet.nwcRecaptured).toBe(0);
        expect(sheet.assets.current.accountsReceivable).toBe(40000);
    });
});

describe('generateBalanceSheets — التصفية تصيب آخر سنة من الأفق حصراً', () => {
    it('3 سنوات: السنة 3 فقط تُصفِّي AR/المخزون/الذمم الدائنة؛ السنتان 1 و2 بلا أي تغيير', () => {
        const data = {
            capex: { subtotal: 0, total: 0 },
            workingCapital: 500000,
            openingInventory: 0,
            equityAmount: 500000,
            fundingGap: 0,
            incomeStatements: [
                { netIncome: 0, depreciation: 0, replacementCost: 0 },
                { netIncome: 0, depreciation: 0, replacementCost: 0 },
                { netIncome: 0, depreciation: 0, replacementCost: 0 }
            ],
            cashCycleByYear: [
                { receivables: 30000, inventory: 10000, payables: 5000 },
                { receivables: 35000, inventory: 12000, payables: 6000 },
                { receivables: 40000, inventory: 15000, payables: 7000 }
            ]
        };

        const sheets = generateBalanceSheets(data, 3);

        expect(sheets[0].assets.current.accountsReceivable).toBe(30000);
        expect(sheets[0].nwcRecaptured).toBe(0);
        expect(sheets[1].assets.current.accountsReceivable).toBe(35000);
        expect(sheets[1].nwcRecaptured).toBe(0);

        expect(sheets[2].assets.current.accountsReceivable).toBe(0);
        expect(sheets[2].assets.current.inventory).toBe(0);
        expect(sheets[2].liabilities.current.accountsPayable).toBe(0);
        expect(sheets[2].nwcRecaptured).toBe(40000 + 15000 - 7000);

        sheets.forEach(s => expect(s.isBalanced).toBe(true));
    });
});

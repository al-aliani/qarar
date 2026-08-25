/**
 * تدقيق ٢٠٢٦-٠٨-٢٥ — دراسة خفيفة الأصول تُبلِّغ «الميزانية غير متوازنة» بلا سبب حقيقي.
 *
 * العلة: `fixedAssetsGross = (capex.subtotal || capex.total || 0) + cumulativeReplacement`.
 * الصفر قيمة falsy، فأي دراسة صفر أصولٍ ثابتة فعلاً (استشارات/خدمات/وكالة — لا معدات ولا
 * مبانٍ ولا أثاث) و`subtotal = 0` **مشروع** كانت تسقط إلى الفرع الثاني `capex.total`.
 * والمحرك يمرّر (engine.js) `{ subtotal: totalCapex, total: totalInvestment }` حيث
 * `totalInvestment = totalCapex + رأس المال العامل + بضاعة أول المدة` — فيظهر رأس المال
 * العامل «أصلاً ثابتاً» وهمياً، وهو محتسَب أصلاً ضمن النقدية في rawCash ⟹ ازدواج يضخّم
 * الأصول باختلال ثابت = رأس المال العامل في كل سنة، فتُرسم شارة حمراء «غير متوازنة»
 * للمستخدم في BalanceSheetView.
 *
 * الهاوية كانت اختبار الـfalsy وحده لا أي منطق اقتصادي: إضافة أصل بريال واحد
 * (subtotal = 1) كانت تُعيد التوازن فوراً. الإصلاح: التمييز بوجود الحقل
 * (`Number.isFinite`) لا بكونه غير صفري.
 */
import { describe, it, expect } from 'vitest';
import { computeBalanceSheet } from '../balanceSheet.js';

/** دراسة خدمية: صفر أصول ثابتة، رأس مال عامل مموَّل بحقوق ملكية. */
function assetLightInput(overrides = {}) {
    return {
        capex: { subtotal: 0, total: 500000 }, // total = 0 capex + 500,000 رأس مال عامل
        workingCapital: 500000,
        openingInventory: 0,
        equityAmount: 500000,
        fundingGap: 0,
        incomeStatements: [{ netIncome: 0, depreciation: 0, replacementCost: 0 }],
        ...overrides
    };
}

describe('balanceSheet — subtotal=0 مشروع لا يسقط إلى capex.total (دراسة خفيفة الأصول)', () => {
    it('صفر أصول ثابتة: gross = 0 ولا يتسرّب رأس المال العامل كأصل ثابت', () => {
        const sheet = computeBalanceSheet(assetLightInput(), 1);

        // قبل الإصلاح: 500,000 (رأس المال العامل مُقنَّعاً كأصل ثابت)
        expect(sheet.assets.fixed.gross).toBe(0);
        expect(sheet.assets.fixed.net).toBe(0);
    });

    it('نفس الدراسة تبقى متوازنة — الاختلال كان يساوي رأس المال العامل بالضبط', () => {
        const sheet = computeBalanceSheet(assetLightInput(), 1);

        expect(sheet.hasNoData).toBe(false); // بيانات حقيقية، لا حالة «لا بيانات بعد»
        expect(Math.abs(sheet.imbalance)).toBeLessThanOrEqual(5);
        expect(sheet.isBalanced).toBe(true);
    });

    it('الهاوية القديمة: أصل بريال واحد كان يقلب النتيجة — الآن السلوك متصل', () => {
        // قبل الإصلاح: subtotal=0 ⟹ غير متوازنة، وsubtotal=1 ⟹ متوازنة. قفزة من العدم.
        const zero = computeBalanceSheet(assetLightInput(), 1);
        const one = computeBalanceSheet(assetLightInput({ capex: { subtotal: 1, total: 500001 } }), 1);

        expect(zero.isBalanced).toBe(true);
        expect(one.isBalanced).toBe(true);
        expect(one.assets.fixed.gross - zero.assets.fixed.gross).toBe(1); // فرق ريال واحد لا 500,000
    });

    it('الاحتياط إلى capex.total يبقى عاملاً حين يغيب subtotal فعلاً (توافق خلفي)', () => {
        // مستدعون قدامى/اختبارات تمرّر total وحده — يجب ألا يتغيّر سلوكهم.
        const sheet = computeBalanceSheet(assetLightInput({ capex: { total: 300000 } }), 1);
        expect(sheet.assets.fixed.gross).toBe(300000);
    });
});

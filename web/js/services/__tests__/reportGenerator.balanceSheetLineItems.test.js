/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-22 (تقرير go/no-go)، مُتحقَّق منه 2026-08-21: جدول الميزانية في
 * PDF (ReportGenerator.renderBalanceSheets) كان يعرض فقط النقدية والأصول الثابتة
 * الصافية كبنود أصول ظاهرة، بينما «إجمالي الأصول» المعروض يشمل ذمم العملاء والمخزون
 * أيضاً — فمجموع البنود الظاهرة لا يساوي الإجمالي الظاهر. كذلك لم يكن هناك أي صفّ
 * لفجوة التمويل رغم أنها مُضمَّنة صمتاً في «الخصوم + حقوق الملكية» (lib/calc/balanceSheet.js).
 */
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../ReportGenerator.js';

function fakeSheet(year) {
    return {
        year,
        assets: {
            current: { cash: 100000, accountsReceivable: 25000, inventory: 15000, total: 140000 },
            fixed: { gross: 300000, accumulatedDepreciation: 60000, net: 240000 },
            total: 380000
        },
        liabilities: {
            current: { accountsPayable: 0, currentPortionOfDebt: 20000, cashShortfall: 0, total: 20000 },
            longTerm: { bankLoan: 100000, total: 100000 },
            total: 120000
        },
        equity: { paidInCapital: 200000, retainedEarnings: 30000, total: 230000 },
        fundingGap: 30000,
        totalLiabilitiesAndEquity: 380000,
        isBalanced: true
    };
}

describe('ReportGenerator.renderBalanceSheets — بنود الأصول والفجوة التمويلية ظاهرة', () => {
    it('يعرض ذمم العملاء والمخزون كبندين صريحين', () => {
        const html = ReportGenerator.renderBalanceSheets([fakeSheet(1)], 'ar');
        expect(html).toContain('ذمم العملاء');
        expect(html).toContain('المخزون');
    });

    it('يعرض فجوة التمويل كبند صريح قبل الإجمالي النهائي', () => {
        const html = ReportGenerator.renderBalanceSheets([fakeSheet(1)], 'ar');
        expect(html).toContain('فجوة تمويل غير مغطاة');
        const gapIdx = html.indexOf('فجوة تمويل غير مغطاة');
        const totalIdx = html.indexOf('إجمالي الخصوم وحقوق الملكية');
        expect(gapIdx).toBeGreaterThan(-1);
        expect(totalIdx).toBeGreaterThan(gapIdx);
    });

    it('بنود الأصول الظاهرة الآن تجمع فعلياً لإجمالي الأصول الظاهر (لا يعتمد على بند مخفي)', () => {
        const sheet = fakeSheet(1);
        const visibleAssetsSum = sheet.assets.current.cash + sheet.assets.current.accountsReceivable
            + sheet.assets.current.inventory + sheet.assets.fixed.net;
        expect(visibleAssetsSum).toBe(sheet.assets.total);
    });
});

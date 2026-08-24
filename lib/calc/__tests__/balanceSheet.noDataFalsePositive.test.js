/**
 * تدقيق ٢٠٢٦-٠٨-٢٤ — «الميزانية متوازنة» مزيّفة قبل إدخال أي بيانات.
 *
 * العلة: imbalance = totalAssets - (totalLiabilities + totalEquity + fundingGap)، وisBalanced
 * = |imbalance| <= 5. حين لا يُدخل المستخدم أي بيانات بعد (رأس مال، تمويل، أصول ثابتة...) تكون
 * كل الأطراف الثلاثة صفراً معاً، فالفرق = 0 صدفة فقط (لأن الطرفين صفر) لا لأن الميزانية متوازنة
 * فعلياً — وكانت computeBalanceSheet تُبلِّغ isBalanced=true، فتعرض BalanceSheetView رسالة نجاح
 * خضراء «الميزانية متوازنة» رغم عدم وجود أي بيانات. الإصلاح: hasNoData يميّز هذه الحالة تحديداً
 * فتصبح isBalanced=false، وBalanceSheetView تعرض بدلها حالة محايدة «لا توجد بيانات كافية بعد».
 */
import { describe, it, expect } from 'vitest';
import { computeBalanceSheet } from '../balanceSheet.js';

describe('balanceSheet — لا توازن مزيّف حين تكون كل الأطراف صفراً (لا بيانات بعد)', () => {
    it('بيانات فارغة تماماً: hasNoData=true وisBalanced=false رغم أن الفرق=0', () => {
        const sheet = computeBalanceSheet({}, 1);

        expect(sheet.assets.total).toBe(0);
        expect(sheet.liabilities.total).toBe(0);
        expect(sheet.equity.total).toBe(0);
        expect(sheet.imbalance).toBe(0);

        expect(sheet.hasNoData).toBe(true);
        expect(sheet.isBalanced).toBe(false);
    });

    it('حقول صفرية صريحة (equityAmount=0، لا CAPEX، لا تمويل) تُعطي نفس النتيجة', () => {
        const sheet = computeBalanceSheet({
            capex: { total: 0, items: [] },
            equityAmount: 0,
            workingCapital: 0,
            fundingGap: 0
        }, 1);

        expect(sheet.hasNoData).toBe(true);
        expect(sheet.isBalanced).toBe(false);
    });

    it('لا يمسّ السلوك القائم: فرق حقيقي صغير جداً (تدوير) بين أرقام غير صفرية يبقى متوازناً', () => {
        // رأس مال 100,000 مقابل أصول ثابتة 100,003 — فرق تدوير 3 ريال بين أرقام غير صفرية،
        // وليس حالة «لا بيانات» (totalAssets != 0)، فيجب أن يبقى isBalanced=true كما كان.
        const sheet = computeBalanceSheet({
            capex: { total: 100003, items: [] },
            equityAmount: 100000
        }, 1);

        expect(sheet.assets.total).toBe(100003);
        expect(sheet.imbalance).toBe(3);
        expect(sheet.hasNoData).toBe(false);
        expect(sheet.isBalanced).toBe(true);
    });
});

function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
}

function div(a, b) {
    return b > 0 ? a / b : null;
}

// أصول ثابتة صافية شبه صفرية (مُهلَكة بالكامل) تُنتج معدل دوران متفجراً مضللاً —
// أثر رأيناه حرفياً في تقرير منافس (معدل دوران أصول ثابتة يقفز من 20x إلى 127x
// لمجرد وصول القيمة الدفترية للصفر قرب نهاية فترة الإهلاك، لا تحسّن حقيقي في الكفاءة).
// نفس منطق «فترة استرداد غير محقق» المستخدم أصلاً في engine.js: null بدل رقم مضلِّل.
const FIXED_ASSET_FLOOR = 1;

/**
 * يبني مكتبة النسب المالية (سيولة/مديونية-ملاءة/نشاط/ربحية لكل سنة) من قائمة الدخل
 * والميزانية العمومية المحسوبتين أصلاً في المحرك — لا يعيد حساب أي شيء، إضافي بالكامل.
 * @param {Array<object>} incomeStatement - نتيجة calculateStudy().incomeStatement
 * @param {Array<object>} balanceSheets - نتيجة calculateStudy().balanceSheets
 * @returns {Array<object>} صف نسب واحد لكل سنة، بنفس طول incomeStatement
 */
export function buildFinancialRatios(incomeStatement, balanceSheets) {
    const rows = toArray(incomeStatement);
    const sheets = toArray(balanceSheets);

    return rows.map((is, i) => {
        const year = is?.year ?? i + 1;
        const bs = sheets.find(s => s?.year === year) || sheets[i];
        if (!bs) {
            return {
                year, currentRatio: null, quickRatio: null, cashRatio: null,
                debtRatio: null, debtToEquity: null, assetTurnover: null,
                fixedAssetTurnover: null, roa: null, roe: null
            };
        }

        const currentAssets = Number(bs.assets?.current?.total) || 0;
        const currentLiabilities = Number(bs.liabilities?.current?.total) || 0;
        const cash = Number(bs.assets?.current?.cash) || 0;
        const inventory = Number(bs.assets?.current?.inventory) || 0;
        const totalAssets = Number(bs.assets?.total) || 0;
        const totalLiabilities = Number(bs.liabilities?.total) || 0;
        const totalEquity = Number(bs.equity?.total) || 0;
        const netFixedAssets = Number(bs.assets?.fixed?.net) || 0;
        const revenue = Number(is?.revenue) || 0;
        const netIncome = Number(is?.netIncome) || 0;

        return {
            year,
            currentRatio: div(currentAssets, currentLiabilities),
            quickRatio: div(currentAssets - inventory, currentLiabilities),
            cashRatio: div(cash, currentLiabilities),
            debtRatio: div(totalLiabilities, totalAssets),
            debtToEquity: div(totalLiabilities, totalEquity),
            assetTurnover: div(revenue, totalAssets),
            fixedAssetTurnover: netFixedAssets > FIXED_ASSET_FLOOR ? div(revenue, netFixedAssets) : null,
            roa: div(netIncome, totalAssets),
            roe: div(netIncome, totalEquity)
        };
    });
}

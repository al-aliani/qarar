/**
 * ═══ الزكاة والضريبة ═══
 * حساب الزكاة بناءً على الوعاء النظامي الحقيقي (منهجية ZATCA — طريقة مصادر الأموال)
 * وضريبة الدخل على حصة الأجانب بناءً على الربح المعدل.
 */
export function calculateZakatAndTax({
    paidCapital,
    retainedEarningsStart,
    loanBalanceStart,
    netFixedStart,
    taxDepY,
    ebt,
    depreciation,
    zakatRate,
    foreignShare,
    taxRate
}) {
    // الوعاء = حقوق الملكية أول السنة + القروض طويلة الأجل أول السنة − صافي الأصول الثابتة أول السنة
    const fundingSourcesBase = paidCapital + retainedEarningsStart + loanBalanceStart - netFixedStart;
    
    // الربح المعدل = الربح الدفتري + إهلاك دفتري − إهلاك نظامي متناقص (ZATCA)
    const adjustedProfit = ebt + depreciation - taxDepY;
    
    // وعاء الزكاة لا يقل نظاماً عن الربح المعدل
    const zakatBase = Math.max(0, Math.max(adjustedProfit, fundingSourcesBase));
    
    // الزكاة 2.5% على حصة السعوديين/الخليجيين
    const zakat = zakatBase * zakatRate * (1 - foreignShare);
    
    // ضريبة الدخل 20% على حصة الأجانب (تحسب على الربح المعدل)
    const tax = foreignShare > 0 ? Math.max(0, adjustedProfit) * taxRate * foreignShare : 0;
    
    return {
        zakatBase,
        zakat,
        tax,
        adjustedProfit
    };
}

/**
 * Zakat and Tax Calculator — النظام السعودي
 * الزكاة 2.5% على حصة الملكية السعودية/الخليجية،
 * وضريبة الدخل (20%) على حصة الملكية الأجنبية فقط.
 * متسق واحداً بواحد مع engine.js (مصدر الحقيقة) — لا تعدّل هنا دون تعديل المحرك.
 */

export function calculateZakatAndTax(netProfit, zakatBase, options = {}) {
    const zakatRate = 0.025;
    const foreignShare = Math.min(1, Math.max(0, Number(options.foreignOwnershipRate ?? 0)));
    const taxRate = Number(options.taxRate ?? 0.20);

    // وعاء مبسّط لأغراض الجدوى: صافي الربح قبل الزكاة إن لم يُمرر وعاء فعلي
    const base = Math.max(0, Number(zakatBase ?? netProfit) || 0);

    const zakat = base * zakatRate * (1 - foreignShare);
    const tax = foreignShare > 0 ? Math.max(0, Number(netProfit) || 0) * taxRate * foreignShare : 0;

    return { zakat, tax };
}

/**
 * إسقاط الزكاة والضريبة لسنوات الدراسة.
 * يُفضَّل دائماً القراءة من مخرجات المحرك مباشرة (year.zakat / year.tax)
 * — الحساب المحلي هنا احتياط فقط لبيانات قديمة لا تحملها.
 */
export function projectZakatAndTax(financials, assumptions = {}) {
    if (!financials || !financials.incomeStatement) return [];

    return financials.incomeStatement.map(year => {
        // أرقام المحرك إن وُجدت — نفس ما يظهر في قائمة الدخل والتقارير
        if (year.zakat !== undefined || year.tax !== undefined) {
            return { year: year.year, zakat: year.zakat || 0, tax: year.tax || 0 };
        }
        const { zakat, tax } = calculateZakatAndTax(
            year.netProfitBeforeZakat ?? year.ebt,
            year.zakatBase,
            {
                foreignOwnershipRate: assumptions.foreignOwnershipRate,
                taxRate: assumptions.taxRate
            }
        );
        return { year: year.year, zakat, tax };
    });
}

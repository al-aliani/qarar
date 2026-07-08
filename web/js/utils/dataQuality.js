/**
 * dataQuality.js — كواشف جودة المدخلات المشتركة بين شاشات النتائج.
 *
 * المشكلة الجذرية التي يعالجها: المحرّك يشتقّ «إجمالي الاستثمار» من الأصول المُدرجة في
 * «الدراسة الفنية» (معدات/مبانٍ/أثاث…) لا من مصادر التمويل التي يكتبها المستخدم. فمبتدئ
 * يكتب «رأس مالي 500,000 وقرض 300,000» في خطوة التمويل لكنه لا يُدرج أصولاً بهذه القيمة،
 * فيحسب المحرّك الاستثمار على رأس المال العامل فقط (≈ بضعة آلاف) وتخرج مؤشرات لا معنى لها
 * (NPV مبالغ، IRR 850% أو 0%). لا يجب أن نفبرك أصولاً؛ بل ننبّه المستخدم بوضوح ليُدرجها.
 */

function sumFinancingSources(state) {
    const s = state?.financing?.sources || {};
    return (Number(s.equity?.amount) || 0)
        + (Number(s.bankLoan?.amount) || 0)
        + (Number(s.investors?.amount) || 0)
        + (Number(s.governmentSupport?.amount) || 0);
}

/**
 * يُرجع رسالة تحذير (نص) إن كانت بيانات الاستثمار ناقصة/غير متسقة، وإلا null.
 * @param {object} state - حالة الدراسة
 * @param {object} results - ناتج calculateStudy
 * @returns {{ level: 'critical'|'warning', message: string, action: string } | null}
 */
export function investmentDataWarning(state, results) {
    if (!results || !results.capex) return null;
    const capexSubtotal = Number(results.capex.subtotal) || 0;   // الأصول المُدرجة فقط (بلا رأس مال عامل)
    const totalInvestment = Number(results.capex.total) || 0;
    const enteredFinancing = sumFinancingSources(state);
    const fmt = (n) => Math.round(n).toLocaleString('ar-SA') + ' ريال';

    // (أ) لم تُدرج أي أصول رأسمالية إطلاقاً، لكن يوجد تمويل أو إيراد — النتائج غير موثوقة
    const hasRevenue = (results.incomeStatement?.[0]?.revenue || 0) > 0;
    if (capexSubtotal <= 0 && (enteredFinancing > 0 || hasRevenue)) {
        return {
            level: 'critical',
            message: enteredFinancing > 0
                ? `أدخلتَ تمويلاً بقيمة ${fmt(enteredFinancing)} لكن لم تُدرج أي أصول (معدات/مبانٍ/أثاث) في «الدراسة الفنية». يحسب النموذج الاستثمار من الأصول المُدرجة لا من مبلغ التمويل، لذا يستخدم حالياً ${fmt(totalInvestment)} فقط — والمؤشرات أدناه غير موثوقة.`
                : `لم تُدرج أي أصول (معدات/مبانٍ/أثاث) في «الدراسة الفنية»، فالاستثمار المحسوب ${fmt(totalInvestment)} فقط والمؤشرات أدناه غير موثوقة.`,
            action: 'انتقل إلى خطوة «الدراسة الفنية (الأصول)» وأدرج تكاليف المعدات والمباني والأثاث لتعكس استثمارك الفعلي.'
        };
    }

    // (ب) الأصول مُدرجة لكن مصادر التمويل المُدخلة تختلف جوهرياً عن الاستثمار المطلوب
    if (enteredFinancing > 0 && totalInvestment > 0
        && Math.abs(enteredFinancing - totalInvestment) > 0.25 * totalInvestment) {
        return {
            level: 'warning',
            message: `مصادر التمويل المُدخلة (${fmt(enteredFinancing)}) تختلف جوهرياً عن إجمالي الاستثمار المطلوب المحسوب من الأصول (${fmt(totalInvestment)}). طابِق المصدرين كي تعكس المؤشرات مشروعك الفعلي.`,
            action: 'راجع «الدراسة الفنية» (قيمة الأصول) أو «مصادر وهيكلة التمويل» حتى يتطابق الرقمان.'
        };
    }

    return null;
}

/**
 * يبني HTML لبطاقة تنبيه من ناتج investmentDataWarning (أو '' إن لم يوجد تحذير).
 * آمن للحقن: يهرّب النص.
 */
export function investmentDataWarningHtml(warn) {
    if (!warn) return '';
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cls = warn.level === 'critical' ? 'alert--danger' : 'alert--warning';
    const icon = warn.level === 'critical' ? '⛔' : '⚠️';
    return `
        <div class="alert ${cls} mb-3" role="alert" style="border-right:4px solid currentColor;">
            <p><strong>${icon} ${esc(warn.message)}</strong></p>
            <p class="text-sm mt-2">${esc(warn.action)}</p>
        </div>
    `;
}

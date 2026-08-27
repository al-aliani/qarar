/**
 * منطق عرض عدّادات الاستخدام في هيرو الصفحة الرئيسية (landing.html) — مُستخرَج
 * إلى وحدة قابلة للاختبار بدل البقاء حصراً داخل <script type="module"> مضمَّن.
 *
 * تدقيق 2026-08-27 (لجنة استشارية 3 خبراء: نمو/ثقة/منتج): «0 دراسة مدفوعة
 * فعلياً» بجانب أزرار شراء بسعر 299-4999 ريالاً دليل اجتماعي سلبي — لا علاقة
 * له بدقة تحليل دراسة عميل (الصدق المُلزَم هناك بتعليق منفصل موثّق منذ
 * 2026-07-14)، بل هو مؤشر تسويقي عن نضج المنصة نفسها. القرار: لا تُخفَ القيم
 * الحقيقية خلف شرط "هل ترضينا؟" (توصية الخبير الأول)، ولا تُستبدل بأرقام
 * مصطنعة (رفضه الخبيران الثاني والثالث بإجماع) — بل يظهر كل حقل تلقائياً
 * بمجرد أن يصبح رقمه الحقيقي غير صفري، بلا أي قرار بشري لاحق أو "مهمة مؤجلة"
 * قابلة للنسيان (توصية الخبير الثالث، الأكثر تحديداً وقابلية للتنفيذ الفوري).
 */

/**
 * @param {{total_studies?: unknown, paid_studies?: unknown, certified_studies?: unknown}} data استجابة get_public_usage_stats
 * @returns {{ anyVisible: boolean, facts: Array<{ id: string, value: number, visible: boolean }> }}
 */
export function computeHeroUsageFacts(data) {
    const facts = [
        { id: 'statTotalStudies', value: Number(data?.total_studies) || 0 },
        { id: 'statPaidStudies', value: Number(data?.paid_studies) || 0 },
        { id: 'statCertifiedStudies', value: Number(data?.certified_studies) || 0 },
    ].map((f) => ({ ...f, visible: f.value > 0 }));

    return { anyVisible: facts.some((f) => f.visible), facts };
}

/**
 * يطبّق نتيجة computeHeroUsageFacts على DOM فعلي (landing.html الحي).
 * @param {Document} doc
 * @param {{total_studies?: unknown, paid_studies?: unknown, certified_studies?: unknown}} data
 */
export function applyHeroUsageFacts(doc, data) {
    const { anyVisible, facts } = computeHeroUsageFacts(data);
    facts.forEach(({ id, value, visible }) => {
        const el = doc.getElementById(id);
        if (!el) return;
        el.textContent = value.toLocaleString('ar-SA');
        const factRow = el.closest('.hero-fact');
        if (factRow) factRow.hidden = !visible;
    });
    const container = doc.getElementById('heroUsageStats');
    if (container) container.hidden = !anyVisible;
}

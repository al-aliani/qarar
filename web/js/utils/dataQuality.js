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

function normalizeName(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}

/**
 * تدقيق 2026-07-08 (ملاحظة عالية #23): كتالوج المنتجات/الخدمات الوصفي
 * (projectInfo.products/introServices — مقدمة الجدوى) معزول تماماً عن الكتالوج
 * المالي (services.items/revenue.streams — ما يقرأه المحرك فعلياً). يصف المستخدم
 * منتجاً في مقدمة الجدوى ثم لا يُسعِّره مالياً أبداً (أو العكس)، فتخرج الدراسة بقصة
 * سردية لا تطابق أرقامها. لا نربط البيانات تلقائياً (قرار الأسماء للمستخدم) بل ننبّه.
 * @param {object} state - حالة الدراسة
 * @returns {{ level: 'critical'|'warning', message: string, action: string } | null}
 */
export function productCatalogWarning(state) {
    const pi = state?.projectInfo || {};
    const descriptiveNames = [
        ...(Array.isArray(pi.products) ? pi.products : []).map(p => (p.name || '').trim()),
        ...(Array.isArray(pi.introServices) ? pi.introServices : []).map(s => (s.name || '').trim())
    ].filter(Boolean);
    if (descriptiveNames.length === 0) return null;

    const financialNames = [
        ...(Array.isArray(state?.services?.items) ? state.services.items : []).map(s => (s.name || '').trim()),
        ...(Array.isArray(state?.revenue?.streams) ? state.revenue.streams : []).map(s => (s.service || s.name || '').trim())
    ].filter(Boolean);

    if (financialNames.length === 0) {
        const preview = descriptiveNames.slice(0, 3).join('، ') + (descriptiveNames.length > 3 ? '...' : '');
        return {
            level: 'warning',
            message: `وصفتَ ${descriptiveNames.length} منتج/خدمة في «مقدمة الجدوى» (${preview}) لكن لم تُسعِّر أياً منها هنا — النموذج المالي لا يعرف عنها شيئاً.`,
            action: 'أضف نفس الأسماء بالسعر وعدد العملاء المتوقع أدناه كي تعكس مؤشرات الدراسة قصتك الفعلية.'
        };
    }

    const financialSet = new Set(financialNames.map(normalizeName));
    const overlap = descriptiveNames.some(n => financialSet.has(normalizeName(n)));
    if (!overlap) {
        return {
            level: 'warning',
            message: 'أسماء المنتجات/الخدمات في «مقدمة الجدوى» لا تطابق أياً من الأسماء المُسعَّرة هنا مالياً — قد تكون قصة الدراسة الوصفية وأرقامها المالية عن بنود مختلفة فعلياً.',
            action: 'وحِّد الأسماء بين الشاشتين (نفس اسم المنتج/الخدمة) حتى تتّسق الدراسة.'
        };
    }
    return null;
}

/**
 * تدقيق تكرار مدخلات التسعير (2026-08-24): revenue.js يتجاهل كل صفوف revenue.streams
 * التشغيلية (كل الصفوف عملياً — لا عمود «النوع» في جدول مصادر الإيرادات أصلاً، فتُعامَل
 * جميعها كـ'operating' ضمناً) إن وُجدت أي خدمة في services.items («تحليل الخدمات»)، لتفادي
 * احتساب الإيراد مرتين (انظر تعليق revenue.js:30-35). لا تنبيه لهذا حالياً في شاشة الإدخال
 * نفسها، فيملأ المستخدم جدول «مصادر الإيرادات» ظاناً أنه محتسب بينما المحرك يتجاهله كلياً.
 * @param {object} state - حالة الدراسة
 * @returns {{ level: 'warning', message: string, action: string } | null}
 */
export function operatingRevenueStreamsShadowedWarning(state) {
    const hasServiceItems = Array.isArray(state?.services?.items) && state.services.items.length > 0;
    if (!hasServiceItems) return null;
    const streams = Array.isArray(state?.revenue?.streams) ? state.revenue.streams : [];
    const hasFilledStream = streams.some(s => (Number(s?.customersPerMonth) || 0) > 0 || (Number(s?.avgPrice) || 0) > 0);
    if (!hasFilledStream) return null;
    return {
        level: 'warning',
        message: 'لديك خدمات مُدخلة في «تحليل الخدمات» وأيضاً بيانات في جدول «مصادر الإيرادات» أدناه. بما أن لديك خدمات مفصّلة، يعتمد النموذج المالي على أرقام «تحليل الخدمات» فقط ويتجاهل صفوف هذا الجدول بالكامل تفادياً لاحتساب نفس الإيراد مرتين.',
        action: 'لا تُدخل نفس الخدمة في الشاشتين معاً. إن كانت هذه الصفوف تمثّل خدماتك الفعلية فانقلها إلى «تحليل الخدمات» بدل هذا الجدول، وإلا فلن تُحتسب ضمن مؤشرات دراستك.'
    };
}

/**
 * تدقيق تكرار مدخلات التسعير (2026-08-24): أداة «التسعير المثالي» تقرأ وتكتب حصراً على
 * revenue.streams، بينما «تحليل الخدمات» مسار إدخال أسعار مستقل يكتب على services.items
 * بمخطط مختلف (variableCostPerUnit مطلق لا نسبة). لا تطّلع هذه الأداة على أسعار الخدمات
 * تلك ولا تعدّلها.
 * @param {object} state - حالة الدراسة
 * @returns {{ level: 'warning', message: string, action: string } | null}
 */
export function pricingOptimizerCoverageWarning(state) {
    const items = Array.isArray(state?.services?.items) ? state.services.items : [];
    if (items.length === 0) return null;
    return {
        level: 'warning',
        message: `لديك ${items.length} خدمة مُسعَّرة في خطوة «تحليل الخدمات» — هذه الأداة تُسعِّر فقط مصادر الإيرادات ولا تطّلع على أسعار تلك الخدمات ولا تُعدّلها.`,
        action: 'لتسعير خدمة من «تحليل الخدمات» بهذه الأداة أضفها أيضاً كمصدر إيراد بنفس الاسم في خطوة «مصادر الإيرادات»، أو عدّل سعرها مباشرة من «تحليل الخدمات».'
    };
}

/**
 * مثل investmentDataWarningHtml أدناه لكن بلا أيقونة إيموجي — للتنبيهات الجديدة التي لا
 * تريد إدخال إيموجي في نصوصها. آمن للحقن: يهرّب النص.
 */
export function warningHtml(warn) {
    if (!warn) return '';
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const cls = warn.level === 'critical' ? 'alert--danger' : 'alert--warning';
    return `
        <div class="alert ${cls} mb-3" role="alert" style="border-right:4px solid currentColor;">
            <p><strong>${esc(warn.message)}</strong></p>
            <p class="text-sm mt-2">${esc(warn.action)}</p>
        </div>
    `;
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

/**
 * إعادة التركيز بعد إعادة رسم تُتلف الشجرة (استبدال innerHTML).
 *
 * المعيار ليس «هل هذا أول رسم؟» — النسخ في مسار الإنتاج تُبنى من جديد كل رسم
 * (stepComponentRegistry.js ⟵ wizardFactory)، فأي حالة مخزَّنة على النسخة تولد
 * فارغة كل مرة ولا تصلح معياراً. المعيار الصحيح هو حالة المستند نفسه:
 * «هل أتلفتُ للتوّ العنصر الذي كان المستخدم مركّزاً عليه؟».
 *
 * الاستعمال: التقاط قبل الاستبدال، ثم استعادة بعده.
 */

/**
 * العنصر المُركَّز عليه حالياً إن كان داخل الحاوية التي على وشك الاستبدال، وإلا null.
 * null تعني: لا شيء سيُتلف ⟹ لا يحق لنا خطف التركيز بعد الرسم (إقلاع الصفحة،
 * أو تركيز المستخدم في مكان آخر من الصفحة خارج هذه الحاوية).
 */
export function captureFocusOwner(container) {
    if (!container || typeof document === 'undefined') return null;
    const active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) return null;
    return container.contains(active) ? active : null;
}

/**
 * ينقل التركيز إلى `target` إن كان الرسم قد أتلف فعلاً العنصر الملتقَط.
 * يرجع true إن نُقل التركيز فعلاً (مفيد للاختبارات والمنادين).
 */
export function restoreFocusAfterRerender(capturedOwner, target) {
    if (!capturedOwner || !target || typeof target.focus !== 'function') return false;
    // لم يُتلف شيء: العنصر ما زال متصلاً والتركيز لم يسقط إلى <body>.
    if (capturedOwner.isConnected && document.activeElement !== document.body) return false;

    // preventScroll ثم scrollIntoView يدوياً: focus() وحده يقفز فوراً بلا تمرير ناعم.
    target.focus({ preventScroll: true });
    if (typeof target.scrollIntoView === 'function') {
        const prefersReduced = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    }
    return true;
}

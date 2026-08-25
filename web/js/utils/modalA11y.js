/**
 * modalA11y — سلوك الوصول المشترك لكل النوافذ المنبثقة في «قرار».
 *
 * سبب وجوده: كان منطق «حبس التركيز + استعادته + Escape» مكرَّراً يدوياً في كل
 * نافذة، فاختلفت النسخ وسقطت بنود منها (8 من 14 نافذة لم تُعِد التركيز للزر
 * الفاتح، و6 بلا حبس تركيز إطلاقاً). التكرار هو العلة، لا النوافذ — فالمكان
 * الوحيد الذي يجب أن يعرف هذه القواعد هو هذا الملف.
 *
 * ما يوفّره:
 *  - ضبط role="dialog" / aria-modal / aria-labelledby (إن لم تكن في التوصيف).
 *  - تركيز أولي داخل النافذة عند الفتح.
 *  - حبس Tab / Shift+Tab داخلها.
 *  - Escape يُغلق (فقط إن مرّر المستدعي onEscape — بعض النوافذ غير قابلة للتخطي عمداً).
 *  - إعادة التركيز للعنصر الذي فتح النافذة عند الإغلاق، مع بديل معقول إن أُزيل من DOM.
 *
 * SweetAlert2: نوافذ Swal.fire تتولّى كل ما سبق بنفسها (حبس تركيز، Escape،
 * returnFocus). لذلك يتنحّى هذا المساعد كلياً ما دام هناك .swal2-container
 * مفتوح — وإلا تنازعت الطبقتان على التركيز ولأغلق Escape الاثنتين معاً.
 */

/** النوافذ المفتوحة حالياً، الأخيرة هي العليا. المفاتيح تُوجَّه للعليا فقط. */
const openStack = [];

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * هل العنصر مرئي فعلياً؟
 *
 * لا نعتمد على offsetParent وحده (كما كانت النسخ اليدوية): في jsdom لا يوجد
 * تخطيط إطلاقاً فيصير offsetParent === null لكل عنصر، فيصبح حبس التركيز صامتاً
 * ولا يُختبَر. نستخدم القياس الحقيقي حين يتوفّر، ونرجع لفحص display/visibility
 * الصريح حين لا يتوفّر.
 */
function isVisible(el) {
    if (!el || el.disabled || el.hidden) return false;
    if (el.getAttribute?.('aria-hidden') === 'true') return false;
    if (typeof el.getClientRects === 'function' && el.getClientRects().length > 0) return true;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        if (node.hidden) return false;
        const inline = node.style;
        if (inline && (inline.display === 'none' || inline.visibility === 'hidden')) return false;
    }
    return true;
}

function getFocusable(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
}

/** يقبل عنصراً أو محدِّد CSS أو دالة تُرجع أياً منهما. */
function resolveElement(target, root) {
    if (!target) return null;
    if (typeof target === 'function') return resolveElement(target(), root);
    if (typeof target === 'string') return (root || document).querySelector(target);
    return target.nodeType === 1 ? target : null;
}

function swalIsOpen() {
    return !!document.querySelector('.swal2-container');
}

function canReceiveFocus(el) {
    return !!el && el.nodeType === 1 && typeof el.focus === 'function' && el.isConnected
        && el !== document.body && !el.disabled;
}

/**
 * عنصر معقول نعيد التركيز إليه حين يكون الفاتح قد اختفى من DOM (أُزيل بإعادة
 * رسم، أو كان داخل نافذة أدنى أُغلقت قبل هذه). نجعل منطقة المحتوى الرئيسية
 * قابلة للتركيز برمجياً فقط، ثم نُزيل tabindex بعد أول blur كي لا تدخل ترتيب Tab.
 */
function fallbackFocusTarget() {
    const region = document.querySelector('main, [role="main"], #app, .app-shell');
    if (!region || !region.isConnected) return null;
    if (!region.hasAttribute('tabindex')) {
        region.setAttribute('tabindex', '-1');
        region.addEventListener('blur', () => region.removeAttribute('tabindex'), { once: true });
    }
    return region;
}

/**
 * فعّل سلوك الوصول على نافذة مفتوحة.
 *
 * @param {object} config
 * @param {Element} config.container   العنصر الثابت الذي لا يُعاد إنشاؤه عند إعادة الرسم (عادةً الـoverlay).
 * @param {Element|string|Function} [config.dialog]  بطاقة الحوار داخله. الافتراضي: [role="dialog"] أو الحاوية نفسها.
 * @param {boolean} [config.modal=true]  false لِلوحات غير حاجبة (لا aria-modal ولا حبس تركيز).
 * @param {string}  [config.labelledBy]  id العنوان.
 * @param {string}  [config.label]       بديل نصي حين لا يوجد عنوان مرئي.
 * @param {Element|string|Function} [config.initialFocus]  ما يُركَّز عند الفتح.
 * @param {number}  [config.focusDelay=0]  تأخير التركيز الأولي (ms) حين تحتاجه حركة الظهور.
 * @param {Function|null} [config.onEscape=null]  استدعاء الإغلاق. null = النافذة غير قابلة للإغلاق بـEscape عمداً.
 * @param {Element|string|Function} [config.restoreFocusTo]  بديل صريح إن اختفى الفاتح.
 * @returns {{ getDialog: Function, focusInitial: Function, release: Function }}
 */
export function attachModalA11y({
    container,
    dialog = null,
    modal = true,
    labelledBy = null,
    label = null,
    initialFocus = null,
    focusDelay = 0,
    onEscape = null,
    restoreFocusTo = null
} = {}) {
    const noop = { getDialog: () => null, focusInitial: () => {}, release: () => {} };
    if (!container || container.nodeType !== 1) return noop;

    const getDialog = () => {
        const resolved = resolveElement(dialog, container);
        if (resolved) return resolved;
        if (container.matches?.('[role="dialog"]')) return container;
        return container.querySelector('[role="dialog"]') || container;
    };

    const applyAria = () => {
        const el = getDialog();
        if (!el) return;
        if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
        if (modal) el.setAttribute('aria-modal', 'true');
        if (labelledBy && document.getElementById(labelledBy)) {
            el.setAttribute('aria-labelledby', labelledBy);
        } else if (label && !el.getAttribute('aria-labelledby')) {
            el.setAttribute('aria-label', label);
        }
    };

    const focusInitial = () => {
        const el = getDialog();
        if (!el) return;
        applyAria();
        const explicit = resolveElement(initialFocus, el);
        const target = (explicit && isVisible(explicit)) ? explicit : getFocusable(el)[0];
        if (!target) return;
        try { target.focus(); } catch (_) { /* عنصر غير قابل للتركيز — نتجاهل */ }
    };

    // العنصر الفاتح. document.body يعني «لا شيء مركَّز» فلا نحفظه كفاتح.
    const opener = document.activeElement && document.activeElement !== document.body
        ? document.activeElement
        : null;

    let released = false;

    const handle = {
        getDialog,
        focusInitial,
        release(options = {}) {
            if (released) return;
            released = true;
            document.removeEventListener('keydown', onKeyDown, true);
            const index = openStack.indexOf(handle);
            if (index !== -1) openStack.splice(index, 1);
            if (options.restoreFocus === false) return;

            let target = canReceiveFocus(opener) ? opener : null;
            if (!target) {
                const explicitFallback = resolveElement(restoreFocusTo, document);
                if (canReceiveFocus(explicitFallback)) target = explicitFallback;
            }
            if (!target) target = fallbackFocusTarget();
            if (!target) return;
            try { target.focus(); } catch (_) { /* لا شيء نفعله */ }
        }
    };

    function onKeyDown(event) {
        // النافذة العليا فقط تستجيب — يمنع إغلاق نافذتين معاً بـEscape واحد.
        if (openStack[openStack.length - 1] !== handle) return;
        // Swal مفتوح فوقنا: هو يملك التركيز و Escape الآن.
        if (swalIsOpen()) return;

        if (event.key === 'Escape') {
            if (typeof onEscape !== 'function') return;
            onEscape();
            return;
        }
        if (event.key !== 'Tab' || !modal) return;

        const el = getDialog();
        if (!el || !el.isConnected) return;
        const items = getFocusable(el);
        if (!items.length) {
            event.preventDefault();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;

        // خرج التركيز عن النافذة أصلاً (نقر على الخلفية مثلاً) — أعده للداخل.
        if (!el.contains(active)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
            return;
        }
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }

    applyAria();
    openStack.push(handle);
    // الالتقاط (capture) كي نرى المفتاح أياً كان موضع التركيز، حتى لو خرج عن الحاوية.
    document.addEventListener('keydown', onKeyDown, true);

    if (focusDelay > 0) setTimeout(focusInitial, focusDelay);
    else focusInitial();

    return handle;
}

/** للاختبارات فقط: عدد النوافذ المفعَّلة حالياً. */
export function __openModalCount() {
    return openStack.length;
}

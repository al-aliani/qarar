/**
 * Keep keyboard focus inside an open modal/dialog.
 * Returns a cleanup function so each view can release listeners on close.
 */
export function trapFocus(container, { initial = null } = {}) {
    if (!container) return () => {};

    const focusableSelector = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled])',
        'select:not([disabled])', 'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const getFocusable = () => Array.from(container.querySelectorAll(focusableSelector))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);

    const onKeyDown = (event) => {
        if (event.key !== 'Tab') return;
        const items = getFocusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    container.addEventListener('keydown', onKeyDown);
    const initialElement = typeof initial === 'string' ? container.querySelector(initial) : initial;
    (initialElement || getFocusable()[0])?.focus?.();

    return () => container.removeEventListener('keydown', onKeyDown);
}

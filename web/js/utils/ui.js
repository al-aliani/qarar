/**
 * UI Utilities for premium interactions
 */

/* ══════════════════════════════════════════════════════════════════════════
   إعلان النتائج المحسوبة لقارئ الشاشة (تدقيق a11y 2026-08-25)
   ──────────────────────────────────────────────────────────────────────────
   لوحة القرار ولوحة المؤشرات المالية تُعيدان الرسم بـ container.innerHTML = …
   كاملاً بعد كل تغيير افتراض. وضع aria-live داخل تلك الشجرة لا يُجدي: منطقة
   حيّة تُحقَن مع محتواها دفعةً واحدة لا تُعلَن — قارئ الشاشة يجب أن يكون مراقباً
   للمنطقة قبل أن يتغيّر محتواها. لذلك منطقتان ثابتتان في index.html منذ الإقلاع
   نكتب فيهما ملخّصاً مقتضباً بدل ترك القارئ يعيد قراءة اللوحة كلها.
   ══════════════════════════════════════════════════════════════════════════ */

const LIVE_REGIONS = { polite: 'a11yStatusRegion', assertive: 'a11yAlertRegion' };

function getLiveRegion(kind) {
    const id = LIVE_REGIONS[kind];
    const existing = document.getElementById(id);
    if (existing) return existing;
    // احتياط للصفحات التي لا تحمل الشِّل الكامل (والاختبارات) — تبقى index.html المصدر.
    const el = document.createElement('div');
    el.id = id;
    el.className = 'sr-only';
    el.setAttribute('role', kind === 'assertive' ? 'alert' : 'status');
    el.setAttribute('aria-live', kind);
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
    return el;
}

/**
 * يُعلن نصاً مقتضباً في المنطقة الحيّة الثابتة.
 * @param {string} message النص المقروء (ملخّص لا لوحة كاملة).
 * @param {{assertive?: boolean}} [options] assertive للأخطاء التي تمنع الحساب فقط.
 */
export function announce(message, options = {}) {
    if (typeof document === 'undefined' || !document.body || !message) return;
    const el = getLiveRegion(options.assertive ? 'assertive' : 'polite');
    // تفريغ ثم كتابة بعد فاصل زمني: إعادة كتابة نفس النص بلا تفريغ لا تُنتج تغييراً
    // في DOM فلا يُعلَن شيء (نفس القرار لافتراضين مختلفين حالة واردة جداً هنا).
    el.textContent = '';
    setTimeout(() => { el.textContent = String(message); }, 50);
}

/**
 * Animate a numeric value from start to end
 * @param {HTMLElement} element - The target element
 * @param {number} end - The final value
 * @param {Object} options - Formatting options
 */
export function animateCounter(element, end, options = {}) {
    const start = parseFloat(element.getAttribute('data-value')) || 0;
    const duration = options.duration || 1000;
    const startTime = performance.now();
    const isCurrency = options.isCurrency || false;
    const isPercent = options.isPercent || false;

    const schedule = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback) => setTimeout(() => callback(performance.now()), 16);

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Cubic ease-out
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const current = start + (end - start) * easedProgress;

        let formatted = current;
        if (isCurrency) {
            formatted = new Intl.NumberFormat('ar-SA', {
                style: 'currency',
                currency: 'SAR',
                maximumFractionDigits: 0
            }).format(current);
        } else if (isPercent) {
            formatted = `${(current * 100).toFixed(1)}%`;
        } else {
            formatted = Math.floor(current).toLocaleString();
        }

        element.textContent = formatted;
        element.setAttribute('data-value', current);

        if (progress < 1) {
            schedule(update);
        }
    }

    schedule(update);
}

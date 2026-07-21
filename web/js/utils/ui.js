/**
 * UI Utilities for premium interactions
 */

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

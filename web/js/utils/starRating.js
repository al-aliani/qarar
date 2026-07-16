/**
 * starRating — عرض نجوم تقييم موحّد (2026-07-16). مصدر وحيد للحقيقة يستخدمه
 * كل من تبويب "آراء العملاء" بلوحة الأدمن وصفحة الهبوط، كي لا يتطوّر عرضان
 * مختلفان لنفس الرقم لاحقاً (قاعدة "مصدر وحيد للحقيقة" في مهارة qarar-ui).
 *
 * SVG عبر رمز الـsprite i-star بدل يونيكود ★/☆ — يتّسق مع نظام الأيقونات
 * الموجود، ويتفادى أي خطر (نظري لكن غير معدوم) من إعادة كتابة arabize
 * DOM-rewriter لنص عقدة جديدة تحوي رمزاً غير عربي.
 */

/**
 * @param {number} rating - 1 إلى 5 (يُقرَّب ويُقصّ ضمن هذا النطاق)
 * @param {{size?: number}} [opts]
 * @returns {string} HTML — صف من 5 أيقونات نجمة، الممتلئ منها بلون --gold-deep
 */
export function renderStarsHtml(rating, { size = 16 } = {}) {
    const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    let icons = '';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= r;
        icons += `<svg class="ic star-ic${filled ? ' is-filled' : ''}" style="width:${size}px;height:${size}px;stroke:none;fill:currentColor;opacity:${filled ? 1 : 0.3}" aria-hidden="true"><use href="#i-star"/></svg>`;
    }
    return `<div class="star-row" role="img" aria-label="التقييم: ${r} من 5">${icons}</div>`;
}

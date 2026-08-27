/**
 * تدقيق 2026-08-27 (فحص شامل للموقع الحي) — تباين زر الشراء داخل بطاقات الأسعار.
 *
 * العلة: `.lp-card a { color: var(--lp-primary) }` (تخصيص 0-1-1) كانت تهزم
 * `.btn--primary { color: var(--c-p-contrast) }` (0-1-0)، فيُرسم نص أزرار CTA
 * الأساسية داخل `.lp-card` — منها «اشترِ باقة المراجعة بخبير» في pricing.html —
 * بلون `--lp-primary` (#0e5b44) بدل الأبيض المقصود. هذا اللون مطابق حرفياً لقمة
 * متدرج خلفية `.btn--primary` نفسها (--c-p-500)، فالتباين ~1.00:1 — النص شبه
 * مخفٍ افتراضياً على كل الأجهزة التي لا يوجد فيها hover (كل أجهزة اللمس).
 *
 * axe-core لا يرصد هذا الصنف من الأعطال: يصنّف الخلفيات المتدرجة "incomplete"
 * لا "violation"، فبوابة e2e/a11y.spec.js القائمة على axe لن تلتقطه أبداً —
 * هذا الاختبار مصدري رقمي (يحسب WCAG فعلياً) لا وجودي، بنفس منهجية
 * a11y.focusIndicatorContrast.test.js.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const CSS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(CSS_DIR, name), 'utf-8');

function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function channel(c) {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance([r, g, b]) {
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a, b) {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const LP_PRIMARY = hexToRgb('#0e5b44'); // --lp-primary و --c-p-500 (نفس القيمة حرفياً)
const BTN_GRADIENT_TOP = hexToRgb('#0e5b44'); // --c-p-500
const BTN_GRADIENT_BOTTOM = hexToRgb('#0a4634'); // --c-p-600
const BTN_CONTRAST = hexToRgb('#ffffff'); // --c-p-contrast

describe('legal-pages.css — .lp-card لا تسرق لون نص أزرار .btn (تباين CTA داخل البطاقات)', () => {
    it('الحاسبة نفسها صحيحة: تعيد ~1.00:1 لـ--lp-primary فوق قمة متدرج زر .btn--primary', () => {
        // إعادة إنتاج العيب عددياً — اللونان متطابقان حرفياً فالتباين أدنى قيمة ممكنة.
        expect(contrast(LP_PRIMARY, BTN_GRADIENT_TOP)).toBeCloseTo(1.0, 1);
    });

    it('قاعدة .lp-card a تستثني عناصر .btn صراحة (لا تسطو على لون أزرار CTA)', () => {
        const css = read('legal-pages.css').replace(/\/\*[\s\S]*?\*\//g, '');
        const rule = css.match(/\.lp-card a[^{]*\{[^}]*color:\s*var\(--lp-primary\)[^}]*\}/);
        expect(rule, 'قاعدة .lp-card a بلون --lp-primary غير موجودة').toBeTruthy();
        expect(rule[0]).toMatch(/\.lp-card a:not\(\.btn\)/);
    });

    it('نتيجة الاستثناء: لون نص .btn--primary الفعلي (--c-p-contrast الأبيض) يجتاز 4.5:1 على كامل المتدرج', () => {
        expect(contrast(BTN_CONTRAST, BTN_GRADIENT_TOP)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(BTN_CONTRAST, BTN_GRADIENT_BOTTOM)).toBeGreaterThanOrEqual(4.5);
    });

    it('[إثبات الحارس] إزالة :not(.btn) تُعيد نص الأزرار إلى --lp-primary غير المقروء', () => {
        const css = read('legal-pages.css').replace(/\/\*[\s\S]*?\*\//g, '');
        const broken = css.replace(/\.lp-card a:not\(\.btn\)/g, '.lp-card a');
        const rule = broken.match(/\.lp-card a\s*\{[^}]*color:\s*var\(--lp-primary\)[^}]*\}/);
        expect(rule, 'إعادة إدخال العيب فشلت — النمط تغيّر').toBeTruthy();
        // القاعدة المعطوبة تطبّق --lp-primary على كل <a> داخل .lp-card بلا استثناء،
        // فتتفوق (0-1-1) على قاعدة .btn--primary (0-1-0) وتُلغي الأبيض المقصود —
        // وهذا بالضبط ما كان يحدث فعلياً قبل هذا الإصلاح.
        expect(contrast(LP_PRIMARY, BTN_GRADIENT_TOP)).toBeLessThan(1.5);
    });
});

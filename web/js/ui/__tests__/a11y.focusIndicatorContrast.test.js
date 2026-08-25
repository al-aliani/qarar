/**
 * تدقيق a11y 2026-08-25 — مؤشر التركيز (WCAG 2.2 §1.4.11، الحد 3:1).
 *
 * العلة الأصلية: `web/css/accessibility.css` هو آخر @import في bundle.css، وقاعدته
 * `.btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(14,91,68,0.3) }`
 * بنفس خصوصية (0,2,0) قاعدة components.css — فتغلبها وتُلغي outline الصلب تماماً.
 * الحلقة شبه الشفافة المتبقية تُركَّب على --c-bg-app الأبيض إلى rgb(183,206,199)
 * بتباين 1.658:1 — أقل من نصف الحد. أي أن ملف علاج الوصول هو من كسر الوصول.
 *
 * هذا الاختبار يثبّت الإصلاح على مستوى المصدر (لا على مستوى المتصفح): يقرأ ملفات
 * CSS الفعلية، يستخرج ألوان الحلقة، ويحسب نسبة WCAG برمجياً. اختبار «يوجد
 * aria-live/outline» وحده كان سيمرّ على القيمة المعطوبة القديمة أيضاً — لذلك
 * القياس هنا رقمي لا وجودي.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const CSS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../css');
const read = (name) => readFileSync(resolve(CSS_DIR, name), 'utf-8');

// ── حاسبة تباين WCAG 2.x ──
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
/** تركيب لون شبه شفاف فوق خلفية صلبة (source-over) — هذا ما يراه المستخدم فعلاً. */
function composite(fg, alpha, bg) {
    return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
}

const SURFACES = {
    'bg-app': hexToRgb('#ffffff'),
    'bg-card': hexToRgb('#fdfcf9'),
    'bg-panel': hexToRgb('#eeece4'),
    'btn--primary p-500': hexToRgb('#0e5b44'),
    'btn--primary p-600': hexToRgb('#0a4634'),
};

describe('مؤشر التركيز — تباين 3:1 على كل الأسطح (WCAG 2.2 §1.4.11)', () => {
    it('الحاسبة نفسها صحيحة: تعيد 1.658:1 للحلقة المعطوبة القديمة على الأبيض', () => {
        // إعادة إنتاج العيب عددياً — لو انحرفت الحاسبة لصار كل ما تحتها بلا معنى.
        const broken = composite(hexToRgb('#0e5b44'), 0.3, SURFACES['bg-app']);
        expect(broken).toEqual([183, 206, 199]);
        expect(contrast(broken, SURFACES['bg-app'])).toBeCloseTo(1.658, 2);
    });

    it('--focus-ring لم يعد حلقة شبه شفافة واحدة، بل حلقتان صلبتان من رموز الهوية', () => {
        const vars = read('variables.css');
        const decl = vars.match(/^\s*--focus-ring:\s*([^;]+);/m);
        expect(decl, 'التوكن --focus-ring مفقود من variables.css').toBeTruthy();
        const value = decl[1];
        // العيب الأصلي بالضبط: لون شبه شفاف هو كامل المؤشر.
        expect(value).not.toMatch(/rgba\(/);
        expect(value).toContain('var(--c-focus-ring-inner)');
        expect(value).toContain('var(--c-focus-ring-color)');
        expect(vars).toMatch(/--c-focus-ring-color:\s*var\(--c-p-500\)/);
        expect(vars).toMatch(/--c-focus-ring-inner:\s*#ffffff/i);
    });

    it('الحلقة المزدوجة (#ffffff داخلية + #0e5b44 خارجية) تجتاز 3:1 على كل سطح', () => {
        const inner = hexToRgb('#ffffff');
        const outer = hexToRgb('#0e5b44');
        // حدّ الحلقتين ببعضهما: الضمانة التي تُبقي المؤشر مرئياً فوق أي سطح مهما كان،
        // بما فيه سطح داكن لا تتباين معه الحلقة الخارجية.
        expect(contrast(outer, inner)).toBeGreaterThanOrEqual(3);

        for (const [name, surface] of Object.entries(SURFACES)) {
            // يكفي أن يتباين جزء واحد من المؤشر مع السطح المجاور له.
            const best = Math.max(
                contrast(inner, surface),
                contrast(outer, surface),
                contrast(outer, inner)
            );
            expect(best, `مؤشر التركيز فوق ${name}`).toBeGreaterThanOrEqual(3);
        }
    });

    it('accessibility.css لم يعد يُلغي outline بحلقة شبه شفافة تغلب components.css', () => {
        // نجرّد التعليقات: نص التوثيق يقتبس العيب القديم حرفياً فيُطابق التعبير.
        const css = read('accessibility.css').replace(/\/\*[\s\S]*?\*\//g, '');
        // العيب: `outline: none` + box-shadow شفاف في قاعدة الأزرار.
        expect(css).not.toMatch(/outline:\s*none/);
        expect(css).not.toMatch(/box-shadow:\s*0 0 0 \d+px rgba\(/);
        expect(css).toMatch(/box-shadow:\s*var\(--focus-ring\)/);
    });

    it('الصفحات العامة (main.css وحده، بلا accessibility.css) تحصل على نفس الحلقة', () => {
        // about/pricing/contact/legal… تحمّل main.css فقط، فقاعدة components.css هي
        // مؤشر التركيز الفعلي لأزرارها — كانت نحاسية #b07d2c (2.24:1 فوق زر أخضر داكن).
        const components = read('components.css');
        const btnRule = components.match(/^\.btn:focus-visible\s*\{[^}]*\}/m);
        expect(btnRule, 'قاعدة .btn:focus-visible مفقودة من components.css').toBeTruthy();
        expect(btnRule[0]).not.toContain('--c-gold-deco');
        expect(btnRule[0]).toContain('var(--focus-ring)');

        // النحاسي الزخرفي يفشل فعلاً فوق الأزرار الخضراء — سبب استبعاده هنا.
        expect(contrast(hexToRgb('#b07d2c'), SURFACES['btn--primary p-500'])).toBeLessThan(3);
    });

    it('لا قاعدة :focus-visible باقية تعتمد على --c-gold-deco فوق سطح أخضر داكن', () => {
        // wizard-forms(.btn/.yesno__btn النشط أخضر)، chrome-declutter(.btn-mode-sidebar
        // النشط أخضر)، ai.css(.ai-chat-fab خلفيته --grad-emerald) — كلها كانت نحاسية.
        for (const file of ['wizard-forms.css', 'chrome-declutter.css', 'ai.css']) {
            const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
            const rules = css.match(/[^}]*:focus-visible[^{]*\{[^}]*\}/g) || [];
            for (const rule of rules) {
                expect(rule, `${file}: قاعدة تركيز ما زالت نحاسية`).not.toMatch(/--c-gold-(deco|500)/);
            }
        }
    });
});

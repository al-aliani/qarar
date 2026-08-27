/**
 * تدقيق عدائي 2026-08-27 على كوميت b65d03d: إصلاح تباين `.lp-card a:not(.btn)`
 * (تصحيح صحيح ومؤكَّد) كشف أثراً جانبياً حقيقياً — `.btn--outline` (تُبنى في
 * web/pricing.html:123 لأزرار الباقات غير الموصى بها: `plan.recommended ? 'btn
 * btn--primary' : 'btn btn--outline'`) لم يكن لها أي تعريف CSS في المشروع كله؛
 * كانت تستعير لونها الأخضر عرَضياً من قاعدة `.lp-card a` الواسعة القديمة. بعد
 * تضييق تلك القاعدة، سقطت هذه الأزرار للون الرابط الافتراضي للمتصفح بلا حدود
 * ولا خلفية — وهذا ما اكتشفه المدقق العدائي وليس مطالباً بإصلاحه فقط بالإبلاغ،
 * فأُصلح هنا مباشرة قبل أن يصل الانحدار البصري لأي نشر.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const CSS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(CSS_DIR, name), 'utf-8');

describe('components.css — .btn--outline معرَّف فعلياً (لا يعتمد على قواعد صفحات أخرى)', () => {
    it('قاعدة .btn--outline موجودة وتستخدم رموز التصميم القياسية (--c-p-500/--c-p-contrast)', () => {
        const css = read('components.css').replace(/\/\*[\s\S]*?\*\//g, '');
        const rule = css.match(/\.btn--outline\s*\{[^}]*\}/);
        expect(rule, 'لا تعريف لـ.btn--outline في components.css').toBeTruthy();
        expect(rule[0]).toMatch(/color:\s*var\(--c-p-500\)/);
        expect(rule[0]).toMatch(/border-color:\s*var\(--c-p-500\)/);
        expect(rule[0]).not.toMatch(/transparent.*border|border.*none/);
    });

    it('حالة hover تعكس الألوان (خلفية ممتلئة بلون أساسي، نص متباين) بنفس نمط .btn--primary', () => {
        const css = read('components.css').replace(/\/\*[\s\S]*?\*\//g, '');
        const rule = css.match(/\.btn--outline:hover\s*\{[^}]*\}/);
        expect(rule, 'لا تعريف لـ.btn--outline:hover').toBeTruthy();
        expect(rule[0]).toMatch(/background:\s*var\(--c-p-500\)/);
        expect(rule[0]).toMatch(/color:\s*var\(--c-p-contrast\)/);
    });

    it('components.css مستورَد فعلياً في main.css (السلسلة التي تصل لـpricing.html)', () => {
        const main = read('main.css');
        expect(main).toMatch(/@import\s+['"]\.\/components\.css['"]/);
    });

    it('web/pricing.html يستهلك هذا الاسم بالضبط لأزرار الباقات غير الموصى بها', () => {
        const pricingHtml = readFileSync(resolve(CSS_DIR, '../pricing.html'), 'utf-8');
        expect(pricingHtml).toMatch(/btn--outline/);
    });

    it('[إثبات الحارس] حذف قاعدة .btn--outline يُعيد الأزرار لانعدام أي تصميم', () => {
        const css = read('components.css').replace(/\/\*[\s\S]*?\*\//g, '');
        const broken = css.replace(/\.btn--outline\s*\{[^}]*\}\s*\n?\s*\.btn--outline:hover\s*\{[^}]*\}\s*\n?/, '');
        expect(broken.match(/\.btn--outline\s*\{/)).toBeNull();
    });
});

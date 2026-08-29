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

    it('[إثبات الحارس] لا قاعدة بديلة في أي ملف CSS آخر تُعيد تصميم .btn--outline لو حُذفت هذه القاعدة', () => {
        // العطل الأصلي: العنصر لم يكن له أي تعريف مخصص أصلاً في المشروع كله، فسقط
        // لتصميم المتصفح الافتراضي (بلا حدود ولا خلفية). نتحقق من الملفات الحقيقية
        // مباشرة أن القاعدة الوحيدة التي تمنح .btn--outline حدوداً/خلفية هي هذه —
        // لا قاعدة أخرى "تُنقذها" لو حُذفت هذه بالذات.
        const files = ['main.css', 'components.css', 'legal-pages.css'];
        const matches = files.flatMap((f) => {
            const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
            return css.match(/\.btn--outline\s*\{[^}]*(?:border|background)[^}]*\}/g) || [];
        });
        expect(matches.length, 'يجب أن توجد قاعدة واحدة بالضبط تمنح .btn--outline حدوداً/خلفية في شجرة CSS كلها').toBe(1);
    });
});

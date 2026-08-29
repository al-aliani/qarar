/**
 * تدقيق 2026-08-27: كلاسان يُستخدمان فعلياً في JS بلا أي تعريف CSS مطابق —
 * كلاهما يرجع افتراضياً لسلوك المتصفح الخام:
 * 1) .comparison-table-wrapper (ScenarioSwitcher.js:76) — لا overflow-x، فعمود
 *    السيناريو الأفضل يفيض خارج الشاشة على الجوال بلا تمرير ممكن.
 * 2) .btn-magic-cell (DynamicTable.js:413) — زر تقدير تلقائي داخل خلية جدول
 *    يظهر بشكل زر المتصفح الافتراضي (مربع رمادي بحدود) بدل أيقونة مصمَّمة.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const CSS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(CSS_DIR, name), 'utf-8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('scenario-switcher.css — .comparison-table-wrapper قابل للتمرير أفقياً', () => {
    it('قاعدة .comparison-table-wrapper موجودة وتتيح overflow-x:auto', () => {
        const css = stripComments(read('scenario-switcher.css'));
        const rule = css.match(/\.comparison-table-wrapper\s*\{[^}]*\}/);
        expect(rule, 'لا تعريف لـ.comparison-table-wrapper').toBeTruthy();
        expect(rule[0]).toMatch(/overflow-x:\s*auto/);
    });

    it('ScenarioSwitcher.js يستخدم هذا الاسم بالضبط', () => {
        const js = readFileSync(resolve(CSS_DIR, '../js/ui/ScenarioSwitcher.js'), 'utf-8');
        expect(js).toMatch(/comparison-table-wrapper/);
    });

    it('[إثبات الحارس] overflow-x:auto موجود فعلياً داخل قاعدة .comparison-table-wrapper الحقيقية (لا في أي مكان آخر)', () => {
        const css = stripComments(read('scenario-switcher.css'));
        const matches = css.match(/\.comparison-table-wrapper\s*\{[^}]*overflow-x:\s*auto[^}]*\}/g) || [];
        expect(matches.length, 'حذف overflow-x من القاعدة الحقيقية يعني عودة الفيض بلا تمرير ممكن على الجوال').toBe(1);
    });
});

describe('components.css — .btn-magic-cell مصمَّم لا زر متصفح افتراضي', () => {
    it('قاعدة .btn-magic-cell موجودة بخلفية وحدود ونصف قطر متسقين مع النظام', () => {
        const css = stripComments(read('components.css'));
        const rule = css.match(/\.btn-magic-cell\s*\{[^}]*\}/);
        expect(rule, 'لا تعريف لـ.btn-magic-cell').toBeTruthy();
        expect(rule[0]).toMatch(/border:\s*none/);
        expect(rule[0]).toMatch(/background:\s*var\(--c-p-subtle\)/);
    });

    it('حالة hover معرَّفة (تناسق مع .btn-magic-wand)', () => {
        const css = stripComments(read('components.css'));
        expect(css).toMatch(/\.btn-magic-cell:hover\s*\{[^}]*background:\s*var\(--c-gold-subtle\)/);
    });

    it('DynamicTable.js يستخدم هذا الاسم بالضبط', () => {
        const js = readFileSync(resolve(CSS_DIR, '../js/ui/DynamicTable.js'), 'utf-8');
        expect(js).toMatch(/btn-magic-cell/);
    });

    it('[إثبات الحارس] القاعدة الأساسية وhover لـ.btn-magic-cell موجودتان فعلياً في الملف الحقيقي', () => {
        const css = stripComments(read('components.css'));
        const base = css.match(/\.btn-magic-cell\s*\{[^}]*border:\s*none[^}]*background:\s*var\(--c-p-subtle\)[^}]*\}/);
        const hover = css.match(/\.btn-magic-cell:hover\s*\{[^}]*background:\s*var\(--c-gold-subtle\)[^}]*\}/);
        expect(base, 'حذف القاعدة الأساسية يعيد الزر لتصميم المتصفح الافتراضي (مربع رمادي بحدود)').toBeTruthy();
        expect(hover, 'حذف حالة hover تكسر التناسق مع .btn-magic-wand').toBeTruthy();
    });
});

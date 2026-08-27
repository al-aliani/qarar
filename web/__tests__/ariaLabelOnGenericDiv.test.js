/**
 * تدقيق 2026-08-27 (فحص شامل للموقع الحي): axe الحي على landing.html أظهر 3
 * نتائج "INCOMPLETE [aria-prohibited-attr]" — aria-label على عناصر <div> بدور
 * generic ضمني، وهو دور لا يسمح بتسمية عبر aria-label رسمياً؛ قارئات الشاشة
 * قد تتجاهل التسمية كلياً. إضافة role="group" صريح يجعل aria-label مسموحاً
 * ومضموناً في شجرة إمكانية الوصول.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const landingPath = resolve(dirname(fileURLToPath(import.meta.url)), '../landing.html');
const html = () => readFileSync(landingPath, 'utf-8');

const FLAGGED_LABELS = ['اختر طريقة البدء', 'نموذج توضيحي لمخرجات الدراسة', 'معاينة تقرير نموذجي'];

describe('landing.html — aria-label على div عام يرافقه role صريح', () => {
    it.each(FLAGGED_LABELS)('العنصر بالتسمية "%s" يحمل role="group"', (label) => {
        const src = html();
        const idx = src.indexOf(`aria-label="${label}"`);
        expect(idx, `لم يُعثر على aria-label="${label}"`).toBeGreaterThan(-1);

        const tagStart = src.lastIndexOf('<div', idx);
        const tagEnd = src.indexOf('>', idx);
        const tag = src.slice(tagStart, tagEnd + 1);
        expect(tag).toMatch(/role="group"/);
    });

    it('[إثبات الحارس] إزالة role من أحد العناصر تُفشل الاختبار', () => {
        const withoutRole = html().replace('<div class="hero-links" role="group" aria-label="اختر طريقة البدء">', '<div class="hero-links" aria-label="اختر طريقة البدء">');
        const idx = withoutRole.indexOf('aria-label="اختر طريقة البدء"');
        const tagStart = withoutRole.lastIndexOf('<div', idx);
        const tagEnd = withoutRole.indexOf('>', idx);
        expect(withoutRole.slice(tagStart, tagEnd + 1)).not.toMatch(/role="group"/);
    });
});

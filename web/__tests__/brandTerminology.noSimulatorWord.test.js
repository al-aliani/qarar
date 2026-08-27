/**
 * تدقيق 2026-08-27 (فحص شامل للموقع الحي): عنوان تبويب index.html (التطبيق
 * الفعلي) كان «قرار | محاكي دراسة الجدوى الذكية» بينما بقية الموقع (landing.html
 * والوصف التعريفي) يستخدم «منصة». كلمة «محاكي» تقلل الجدية أمام عميل يدفع
 * 299-4999 ريالاً لمنتج يقدَّم كأداة احترافية لا لعبة/محاكاة. بقايا تسمية
 * قديمة — لا قرار مقصود يستدعي التمييز.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(WEB_DIR, name), 'utf-8');

describe('لا كلمة "محاكي" متبقية في هوية المنتج — "منصة" في كل مكان', () => {
    it('index.html: عنوان التبويب والوصف ووسوم OG/Twitter كلها "منصة"', () => {
        const html = read('index.html');
        expect(html).not.toMatch(/محاكي/);
        expect(html).toContain('<title>قرار | منصة دراسة الجدوى الذكية</title>');
    });

    it('index.html: تطابق حرفي مع عنوان landing.html', () => {
        const indexTitle = read('index.html').match(/<title>(.*?)<\/title>/)[1];
        const landingTitle = read('landing.html').match(/<title>(.*?)<\/title>/)[1];
        expect(indexTitle).toBe(landingTitle);
    });

    it('ToolReport.js: عنوان التقرير المطبوع "منصة" لا "محاكي"', () => {
        const src = read('js/ui/components/ToolReport.js');
        expect(src).not.toMatch(/محاكي/);
        expect(src).toContain('قرار — منصة دراسة الجدوى');
    });

    it('[إثبات الحارس] إعادة إدخال الكلمة القديمة في index.html تُفشل الاختبار الأول', () => {
        const withOldWord = read('index.html').replace(/منصة دراسة الجدوى الذكية/g, 'محاكي دراسة الجدوى الذكية');
        expect(withOldWord).toMatch(/محاكي/);
    });
});

/**
 * @vitest-environment node
 *
 * كل صفحة web/*.html غير مسجَّلة في vite.config.js (rollupOptions.input) لا تُبنى إطلاقاً
 * وتُرجع 404 حقيقياً في الإنتاج بدل الظهور — تكرّرت هذه العلة مرتين (تعليق 2026-07-19 في
 * vite.config.js يوثّق المرة الأولى؛ 28 صفحة حاسبة/مقالة أُضيفت لاحقاً بلا تسجيلها كانت
 * المرة الثانية، اكتُشفت 2026-09-18 بفتح الصفحات فعلياً على sahib.sa الحي). هذا الاختبار
 * يمنع تكرارها الثالث: أي web/*.html جديد يجب أن يُسجَّل هنا صراحة أو يُستثنى بسبب موثّق.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import viteConfig from '../../../../vite.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../../../');
const webDir = resolve(repoRoot, 'web');

// صفحات مستبعَدة عمداً من البناء — كل استبعاد موثَّق بسبب في vite.config.js نفسه.
const EXCLUDED = new Set([
    'dashboard.html', // نموذج React تجريبي مستقل عن المحرك الحقيقي — أُوقف بناؤه عمداً 2026-07-16
    'smoke_test.html', // ملف اختبار محلي، ليس صفحة منتج
]);

describe('كل صفحة web/*.html مسجَّلة في vite.config.js', () => {
    const htmlFiles = readdirSync(webDir)
        .filter(f => f.endsWith('.html'))
        .filter(f => !EXCLUDED.has(f));

    const registeredPaths = new Set(
        Object.values(viteConfig.build.rollupOptions.input).map(p => p.replaceAll('\\', '/'))
    );

    it('تجد صفحات web/*.html فعلياً (الاختبار نفسه ليس فارغاً بصمت)', () => {
        expect(htmlFiles.length).toBeGreaterThan(20);
    });

    it.each(htmlFiles)('%s مسجَّلة كمدخل بناء', (file) => {
        const fullPath = resolve(webDir, file).replaceAll('\\', '/');
        expect(registeredPaths.has(fullPath)).toBe(true);
    });
});

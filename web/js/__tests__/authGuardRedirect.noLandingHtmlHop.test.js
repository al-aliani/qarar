/**
 * تدقيق 2026-08-27: إعادة توجيه AuthGuard لغير المسجَّل (app.js) وزر الرجوع في
 * PhoneAuthModal.js وزر واتساب الاحتياطي في partners.html كانت تشير إلى
 * './landing.html' رغم أن landing.html نفسها تعيد توجيهاً 308 دائماً إلى '/'
 * (vercel.json) — قفزة شبكية إضافية بلا داع لكل زائر غير مسجَّل يفتح رابطاً
 * محمياً. المدقق العدائي أكد أن app.js:2021 هو الموضع الفعّال الوحيد حياً
 * (الآخران كود ميت/فرع لا يُنفَّذ)، لكن تنظيف الثلاثة يمنع عودة العيب لو
 * أُحيي الكود الميت مستقبلاً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (name) => readFileSync(resolve(WEB_DIR, name), 'utf-8');

describe('لا إعادة توجيه إلى ./landing.html — المسار المباشر / يكفي', () => {
    it('app.js: إعادة توجيه AuthGuard تشير إلى "./" لا "./landing.html"', () => {
        const src = read('app.js');
        expect(src).not.toContain("window.location.href = './landing.html'");
        expect(src).toContain("window.location.href = './'");
    });

    it('PhoneAuthModal.js: رابط "الرجوع إلى الصفحة الرئيسية" يشير إلى "./"', () => {
        const src = read('js/ui/PhoneAuthModal.js');
        expect(src).not.toContain('href="./landing.html"');
        expect(src).toContain('href="./"');
    });

    it('partners.html: زر واتساب الاحتياطي يشير إلى "./"', () => {
        const src = read('partners.html');
        expect(src).not.toContain("btn.href = './landing.html'");
        expect(src).toContain("btn.href = './'");
    });

    it('لا أثر متبقٍ لـ"./landing.html" في الثلاثة معاً', () => {
        for (const file of ['app.js', 'js/ui/PhoneAuthModal.js', 'partners.html']) {
            expect(read(file), file).not.toContain('./landing.html');
        }
    });
});

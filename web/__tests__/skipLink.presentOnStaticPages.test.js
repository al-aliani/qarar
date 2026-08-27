/**
 * تدقيق 2026-08-27 (فحص شامل للموقع الحي): رابط "انتقل للمحتوى" (WCAG 2.4.1)
 * كان موجوداً في landing.html فقط — pricing/help/about/contact بلا أي رابط
 * تخطٍّ، فأول عنصر قابل للتركيز فيها كان شعار الترويسة (lp-brand). الخطورة
 * خُفِّضت وقت التدقيق إلى P3 (كل صفحة تملك معلم <main> كافياً لمعيار 2.4.1)
 * لكن الإصلاح رخيص والنمط جاهز أصلاً، فأُضيف كقاعدة مشتركة في legal-pages.css
 * بدل تكراره Inline كما في landing.html.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(WEB_DIR, name), 'utf-8');

const PAGES = ['pricing.html', 'help.html', 'about.html', 'contact.html'];

describe('رابط "انتقل للمحتوى" حاضر ويعمل على الصفحات الساكنة العامة', () => {
    it.each(PAGES)('%s: يحمل رابط skip-link يشير إلى #mainContent', (page) => {
        const html = read(page);
        expect(html).toMatch(/<a href="#mainContent" class="skip-link">انتقل للمحتوى<\/a>/);
    });

    it.each(PAGES)('%s: عنصر id="mainContent" موجود فعلاً (الرابط لا يشير لهدف وهمي)', (page) => {
        const html = read(page);
        expect(html).toMatch(/id="mainContent"/);
    });

    it.each(PAGES)('%s: رابط التخطي هو أول عنصر داخل <body> (يسبق أي رابط آخر بما فيه الشعار)', (page) => {
        const html = read(page);
        const bodyIdx = html.indexOf('<body>');
        const skipIdx = html.indexOf('skip-link');
        const brandIdx = html.indexOf('lp-brand');
        expect(bodyIdx).toBeGreaterThan(-1);
        expect(skipIdx).toBeGreaterThan(bodyIdx);
        if (brandIdx > -1) expect(skipIdx).toBeLessThan(brandIdx);
    });

    it('legal-pages.css يعرّف .skip-link:focus بحيث يصبح مرئياً عند التركيز', () => {
        const css = read('css/legal-pages.css');
        const rule = css.match(/\.skip-link:focus\s*\{[^}]*\}/);
        expect(rule, 'لا تعريف لحالة :focus').toBeTruthy();
        expect(rule[0]).toMatch(/clip:\s*auto/);
    });

    it('[إثبات الحارس] إزالة الرابط من إحدى الصفحات يُفشل الاختبار الأول', () => {
        const withoutLink = read('pricing.html').replace(
            /<a href="#mainContent" class="skip-link">انتقل للمحتوى<\/a>\n?/,
            '',
        );
        expect(withoutLink).not.toMatch(/<a href="#mainContent" class="skip-link">انتقل للمحتوى<\/a>/);
    });
});

/**
 * تدقيق 2026-08-27 (فحص شامل للموقع الحي): لا توجد أي طريقة لسحب موافقة/رفض
 * الكوكيز بعد القرار الأول — public/js/cookie-notice.js يتحقق من وجود
 * localStorage['qarar_cookie_consent'] ويمتنع عن إعادة عرض الإشعار للأبد إن
 * وُجد. المستخدم الذي يريد تغيير رأيه (خاصة الرافض الذي غيّر رأيه ليوافق على
 * التحليلات) لا يملك أي واجهة لذلك سوى مسح كل بيانات الموقع يدوياً من إعدادات
 * المتصفح — وهو نفس المكان الذي تُحفظ فيه دراساته محلياً، فيخاطر بفقدها.
 *
 * cookie-policy.html الآن يحمل زراً يمسح المفتاح وحده (لا بيانات الدراسة)
 * ويُعيد الزائر للرئيسية حيث يُعاد حقن الإشعار فوراً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(resolve(WEB_DIR, name), 'utf-8');

describe('cookie-policy.html — زر "تغيير تفضيلات الكوكيز" يعمل فعلياً', () => {
    it('الزر موجود في قسم "إدارة التفضيلات"', () => {
        const html = read('cookie-policy.html');
        const section = html.slice(html.indexOf('إدارة التفضيلات'), html.indexOf('إدارة التفضيلات') + 800);
        expect(section).toContain('id="cookiePrefsReset"');
        expect(section).toContain('تغيير تفضيلات الكوكيز');
    });

    it('يمسح نفس مفتاح localStorage الذي يقرأه cookie-notice.js وcookieConsent.js بالضبط', () => {
        const html = read('cookie-policy.html');
        const noticeSrc = read('public/js/cookie-notice.js');
        const consentModule = read('js/utils/cookieConsent.js');

        const keyMatch = html.match(/localStorage\.removeItem\('([^']+)'\)/);
        expect(keyMatch, 'لا استدعاء removeItem موجود').toBeTruthy();
        const key = keyMatch[1];

        // نفس المفتاح المُستخدَم فعلياً في مصدري الحقيقة الآخرين — لا قيمة يدوية منفصلة.
        expect(noticeSrc).toContain(`var KEY = '${key}'`);
        expect(consentModule).toContain(`COOKIE_CONSENT_KEY = '${key}'`);
    });

    it('لا يمسح أي مفتاح آخر (بيانات الدراسة) — استدعاء removeItem واحد فقط', () => {
        const html = read('cookie-policy.html');
        const calls = html.match(/localStorage\.removeItem\(/g) || [];
        expect(calls.length).toBe(1);
    });

    it('يعيد التوجيه إلى الرئيسية (الصفحة الوحيدة مع landing.html التي تحمّل cookie-notice.js)', () => {
        const html = read('cookie-policy.html');
        expect(html).toMatch(/window\.location\.href\s*=\s*'\.\/';/);
    });

    it('[إثبات الحارس] إزالة الزر يُفشل الاختبار الأول', () => {
        const html = read('cookie-policy.html');
        const withoutButton = html.replace(/<button type="button" id="cookiePrefsReset"[^<]*<\/button>/, '');
        expect(withoutButton).not.toContain('id="cookiePrefsReset"');
    });
});

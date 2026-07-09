/**
 * تدقيق 2026-07-09: حارس يثبّت أن index.html وlanding.html كلاهما يحمّل
 * public/whatsapp-config.js (الملف المركزي الوحيد الذي يحتاج المالك تعديله) —
 * كان الرقم مكرَّراً حرفياً في ملفين منفصلين قبل هذا الإصلاح؛ هذا الحارس يمنع
 * عودة التكرار الصامت مستقبلاً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, '..', '..');

describe('توحيد إعداد رقم واتساب المركزي', () => {
    it('web/public/whatsapp-config.js موجود فعلياً', () => {
        expect(existsSync(join(webRoot, 'public/whatsapp-config.js'))).toBe(true);
    });

    it('index.html يحمّل /whatsapp-config.js', () => {
        const html = readFileSync(join(webRoot, 'index.html'), 'utf8');
        expect(html).toContain('src="/whatsapp-config.js"');
    });

    it('landing.html يحمّل /whatsapp-config.js', () => {
        const html = readFileSync(join(webRoot, 'landing.html'), 'utf8');
        expect(html).toContain('src="/whatsapp-config.js"');
    });

    it('landing.html يقرأ window.WHATSAPP_NUMBER (لا رقماً ثابتاً منفصلاً عن الملف المركزي)', () => {
        const html = readFileSync(join(webRoot, 'landing.html'), 'utf8');
        expect(html).toContain('window.WHATSAPP_NUMBER');
    });
});

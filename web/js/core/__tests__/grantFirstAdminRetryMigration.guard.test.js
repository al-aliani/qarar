/**
 * حارس إعادة تنفيذ منح الأدمن الأول — الترحيل الأول (20260831000000) نُفِّذ
 * بنجاح لكن بلا صفوف فعلية لأن حساب المالك لم يكن موجوداً بعد بـauth.users
 * وقت التنفيذ. هذا يثبّت أن ملف المتابعة موجود، يستهدف نفس البريد، ويبقى
 * idempotent (لن يفشل إن أُعيد تشغيله، ولا إن كان الصف مُدرَجاً يدوياً أصلاً
 * عبر SQL Editor كما حصل فعلياً).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATION_PATH = resolve(REPO_ROOT, 'supabase/migrations/20260831060000_grant_first_admin_retry.sql');

describe('إعادة تنفيذ منح صلاحية الأدمن الأولى (متابعة بعد فشل صامت)', () => {
    it('ملف الترحيل موجود فعلياً ويستهدف بريد المالك الصحيح', () => {
        expect(existsSync(MIGRATION_PATH)).toBe(true);
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/insert into public\.admins/i);
        expect(sql).toContain('bin.sahib.est@gmail.com');
    });

    it('يستخدم subquery على auth.users.email لا UUID حرفياً — يتجنّب خطأ نسخ يدوي', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql.toLowerCase()).toMatch(/select id, email\s*\n\s*from auth\.users/);
        expect(sql).not.toMatch(/values\s*\(\s*'[0-9a-f]{8}-[0-9a-f]{4}-/i);
    });

    it('idempotent فعلياً: on conflict do nothing يمنع فشل إعادة التشغيل أو التكرار', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql.toLowerCase()).toMatch(/on conflict\s*\(id\)\s*do nothing/);
    });
});

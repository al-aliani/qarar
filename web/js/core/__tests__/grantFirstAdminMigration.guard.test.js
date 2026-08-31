/**
 * حارس ترحيل منح الأدمن الأول (طلب مباشر من المالك، 2026-08-31): يثبّت أن
 * ملف الترحيل موجود فعلياً، يستهدف بريد المالك الصحيح، ويبقى آمناً لإعادة
 * التشغيل (idempotent) — لا يفشل لو طُبِّق مرتين، ولا يفشل لو لم يكن حساب
 * المالك موجوداً بعد على auth.users وقت أول تطبيق.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATION_PATH = resolve(REPO_ROOT, 'supabase/migrations/20260831000000_grant_first_admin.sql');

describe('منح صلاحية الأدمن الأولى لمالك المنصة', () => {
    it('ملف الترحيل موجود فعلياً ويستهدف بريد المالك الصحيح', () => {
        expect(existsSync(MIGRATION_PATH)).toBe(true);
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/insert into public\.admins/i);
        expect(sql).toContain('bin.sahib.est@gmail.com');
    });

    it('يستخدم subquery على auth.users.email لا UUID حرفياً — يتجنّب خطأ نسخ يدوي', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql.toLowerCase()).toMatch(/select id, email\s*\n\s*from auth\.users/);
        // لا UUID حرفي مكتوب مباشرة كقيمة id
        expect(sql).not.toMatch(/values\s*\(\s*'[0-9a-f]{8}-[0-9a-f]{4}-/i);
    });

    it('idempotent فعلياً: on conflict do nothing يمنع فشل إعادة التشغيل', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql.toLowerCase()).toMatch(/on conflict\s*\(id\)\s*do nothing/);
    });
});

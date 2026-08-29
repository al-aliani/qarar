/**
 * دفعة 3 من خطة إغلاق فجوات الطبقات الـ16 (2026-08-27، Rate limiting):
 * يثبّت أن migration 20260827030000 فعلياً (أ) تفعّل RLS على الجدول الجديد
 * anon_endpoint_hits بصيغة قابلة لإعادة التشغيل بأمان، و(ب) تُسقِط سياسة
 * الإدراج المباشر public_applications_insert — بدون هذا، الـEdge Function
 * الجديدة (submit-application) عديمة الجدوى (أي طلب مباشر للجدول يتجاوزها).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const migrationPath = resolve(REPO_ROOT, 'supabase/migrations/20260827030000_anon_endpoint_hits_and_public_applications_lockdown.sql');

describe('migration 20260827030000 — anon_endpoint_hits + إغلاق إدراج public_applications المباشر', () => {
    it('الملف موجود فعلياً', () => {
        expect(existsSync(migrationPath)).toBe(true);
    });

    it('ينشئ anon_endpoint_hits بصيغة idempotent (create table if not exists)', () => {
        const sql = readFileSync(migrationPath, 'utf8');
        expect(sql).toMatch(/create table if not exists public\.anon_endpoint_hits/i);
    });

    it('يفعّل RLS على anon_endpoint_hits ولا يضيف أي سياسة insert/select لـanon أو authenticated (service_role فقط)', () => {
        const sql = readFileSync(migrationPath, 'utf8');
        expect(sql).toMatch(/alter table public\.anon_endpoint_hits enable row level security/i);
        expect(sql).not.toMatch(/create policy[\s\S]*?anon_endpoint_hits[\s\S]*?to anon/i);
    });

    it('يُسقِط صراحة سياسة public_applications_insert (كانت تسمح لـanon,authenticated بالإدراج المباشر)', () => {
        const sql = readFileSync(migrationPath, 'utf8');
        expect(sql).toMatch(/drop policy if exists "public_applications_insert" on public\.public_applications/i);
        // لا يعيد إنشاء سياسة إدراج بديلة لـanon/authenticated — الإدراج الآن حصراً
        // عبر service_role داخل submit-application (يتجاوز RLS بنيوياً، لا يحتاج سياسة).
        expect(sql).not.toMatch(/create policy[\s\S]*?public_applications[\s\S]*?insert[\s\S]*?to anon/i);
    });

    it('[إثبات الحارس] السياسة الخطرة حقيقية (من migration 20260718010000 الفعلية، لا نص مصطنع) — والوحيدة التي تُسقطها هي 20260827030000', () => {
        // العطل الأصلي حقيقي وموجود فعلاً في migration سابقة على القرص (لم تُعدَّل، تبقى للتاريخ):
        // سياسة كانت تسمح لـanon بالإدراج المباشر بلا أي حدّ معدّل، متجاوزةً submit-application كلياً.
        const oldMigrationPath = resolve(REPO_ROOT, 'supabase/migrations/20260718010000_public_applications.sql');
        const oldSql = readFileSync(oldMigrationPath, 'utf8');
        expect(oldSql).toMatch(/create policy "public_applications_insert" on public\.public_applications for insert to anon, authenticated/i);

        // ولولا أن migration 20260827030000 (الملف الحقيقي المفحوص أعلاه) تُسقِط هذه السياسة
        // تحديداً بالاسم، لبقيت فعّالة فوق أي حماية service_role لاحقة.
        const newSql = readFileSync(migrationPath, 'utf8');
        expect(newSql).toMatch(/drop policy if exists "public_applications_insert" on public\.public_applications/i);
    });
});

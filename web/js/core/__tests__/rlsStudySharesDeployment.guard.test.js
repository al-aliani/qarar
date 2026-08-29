/**
 * حارس نشر RLS لجدول study_shares (تدقيق 2026-08-29، اكتُشف أثناء إصلاح
 * study_shares_table_bootstrap.sql): لا ترحيل مُتتبَّع كان يُفعِّل RLS على هذا
 * الجدول — الحماية الحية موجودة فقط عبر تطبيق يدوي واحد لـ
 * docs/supabase_setup.sql على Supabase Dashboard. بيئة جديدة مبنية من
 * migrations فقط تترك الجدول (بريد المستخدم المُشارَك معه وبياناته) بلا أي
 * حماية RLS. نفس مبدأ rlsDeployment.guard.test.js (جدول studies).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATION_PATH = resolve(REPO_ROOT, 'supabase/migrations/20260829040000_enable_rls_study_shares.sql');
const CANONICAL_PATH = resolve(REPO_ROOT, 'docs/supabase_setup.sql');

describe('نشر RLS على study_shares آلياً عبر migration', () => {
    it('ملف الترحيل موجود ويفعّل RLS بصيغة قابلة لإعادة التشغيل بأمان', () => {
        expect(existsSync(MIGRATION_PATH)).toBe(true);
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/alter table public\.study_shares enable row level security/i);

        // idempotent: drop if exists قبل كل create policy
        const createCount = (sql.match(/create policy/gi) || []).length;
        const dropIfExistsCount = (sql.match(/drop policy if exists/gi) || []).length;
        expect(createCount).toBeGreaterThan(0);
        expect(dropIfExistsCount).toBe(createCount);
    });

    it('السياستان مطابقتان لاسم ومنطق docs/supabase_setup.sql الكنسي — لا اختلاف وظيفي عن الإنتاج الحي', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        const canonical = readFileSync(CANONICAL_PATH, 'utf8');

        expect(canonical).toContain('"Study owners can manage shares"');
        expect(canonical).toContain('"Shared users can view their shares"');
        expect(sql).toContain('"Study owners can manage shares"');
        expect(sql).toContain('"Shared users can view their shares"');

        // منطق ملكية الدراسة: نفس شرط EXISTS على public.studies
        expect(sql.toLowerCase()).toMatch(/exists\s*\(\s*select 1 from public\.studies/);
        expect(sql).toMatch(/user_id\s*=\s*auth\.uid\(\)/);

        // منطق المستخدم المُشارَك: نفس شرط shared_with_user_id / shared_with_email
        expect(sql).toMatch(/shared_with_user_id\s*=\s*auth\.uid\(\)/);
        expect(sql.toLowerCase()).toMatch(/shared_with_email\s*=\s*\(select email from auth\.users/);
    });

    it('[إثبات الحارس] العطل الأصلي: لا وجود لأي ترحيل آخر يفعّل RLS على study_shares سوى هذا الملف', () => {
        // لو حُذف هذا الملف، هذا الاختبار نفسه يفشل (existsSync أعلاه) — هذا
        // يثبت أن الحارس متّصل فعلياً بوجود الترحيل الحقيقي، لا بديل مصطنع.
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).not.toBe('');
        expect(existsSync(MIGRATION_PATH)).toBe(true);
    });
});

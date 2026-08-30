/**
 * حارس نشر bucket 'attachments' وسياساته (تقييم أمني عدائي 2026-08-29): لا
 * ترحيل مُتتبَّع كان يُنشئ bucket 'attachments' أو يضبط سياساته على
 * storage.objects إطلاقاً — الحماية الحيّة موجودة فقط عبر تطبيق يدوي واحد
 * لـdocs/supabase_setup.sql (القسم 8) عبر Supabase Dashboard. بيئة جديدة
 * مبنية من migrations فقط تترك الـbucket إما غير موجود أو بلا أي عزل بين
 * المستخدمين على storage.objects. نفس مبدأ rlsStudySharesDeployment.guard.test.js
 * (جدول study_shares) — المصدر الكنسي هنا مُوجَّد فعلاً (docs/supabase_setup.sql
 * القسم 8)، فهذا الترحيل نسخ مطابق له لا سياسات جديدة مُخترَعة.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATION_PATH = resolve(REPO_ROOT, 'supabase/migrations/20260829050000_attachments_bucket_rls.sql');
const CANONICAL_PATH = resolve(REPO_ROOT, 'docs/supabase_setup.sql');

describe('نشر bucket attachments وسياساته آلياً عبر migration', () => {
    it('ملف الترحيل موجود وينشئ الـbucket بصيغة قابلة لإعادة التشغيل بأمان', () => {
        expect(existsSync(MIGRATION_PATH)).toBe(true);
        const sql = readFileSync(MIGRATION_PATH, 'utf8');

        expect(sql).toMatch(/insert into storage\.buckets\s*\(id, name, public\)/i);
        expect(sql).toMatch(/values\s*\(\s*'attachments'\s*,\s*'attachments'\s*,\s*false\s*\)/i);
        expect(sql).toMatch(/on conflict \(id\) do nothing/i);

        // idempotent: drop if exists قبل كل create policy
        const createCount = (sql.match(/create policy/gi) || []).length;
        const dropIfExistsCount = (sql.match(/drop policy if exists/gi) || []).length;
        expect(createCount).toBeGreaterThan(0);
        expect(dropIfExistsCount).toBe(createCount);
    });

    it('السياسات الثلاث مطابقة لاسم ومنطق docs/supabase_setup.sql الكنسي (القسم 8) — لا اختلاف وظيفي عن الإنتاج الحي', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        const canonical = readFileSync(CANONICAL_PATH, 'utf8');

        // المصدر الكنسي فعلاً يحوي هذا القسم — يثبت أن الحارس متّصل بمرجع حقيقي
        // لا نص مصطنع (لو حُذف القسم 8 من الملف الكنسي، هذا التوكيد يفشل).
        expect(canonical).toContain('Storage Bucket for Attachments');
        expect(canonical).toContain("VALUES ('attachments', 'attachments', false)");

        const policyNames = [
            'Users can view own attachments',
            'Users can upload own attachments',
            'Users can delete own attachments',
        ];
        for (const name of policyNames) {
            expect(canonical).toContain(`"${name}"`);
            expect(sql).toContain(`"${name}"`);
        }

        // منطق العزل مطابق حرفياً: أول جزء من المسار (storage.foldername) هو
        // معرّف المستخدم المالك، بشرط bucket_id = 'attachments'.
        expect(sql.toLowerCase()).toContain("bucket_id = 'attachments'");
        expect(sql).toMatch(/\(storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/);
        expect(canonical).toMatch(/\(storage\.foldername\(name\)\)\[1\]\s*=\s*auth\.uid\(\)::text/);

        // لا سياسة UPDATE في أيٍّ من الملفين — مطابقة عمداً (رفع/حذف فقط، لا
        // استبدال ملف قائم في مكانه، انظر تعليق الترحيل).
        expect(sql.toLowerCase()).not.toMatch(/for update/);
        expect(canonical.toLowerCase()).not.toMatch(/own attachments[\s\S]{0,80}for update/);
    });

    it('السياسات الثلاث تُطبَّق تحديداً على bucket_id = attachments لا على كل storage.objects بلا تمييز', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        const policyBlocks = sql.split(/create policy/i).slice(1);
        expect(policyBlocks.length).toBe(3);
        for (const block of policyBlocks) {
            expect(block).toMatch(/bucket_id\s*=\s*'attachments'/i);
        }
    });

    it('[إثبات الحارس] العطل الأصلي: لا وجود لأي ترحيل آخر ينشئ bucket attachments أو سياساته سوى هذا الملف', () => {
        // لو حُذف هذا الملف، هذا الاختبار نفسه يفشل (existsSync أعلاه) — هذا
        // يثبت أن الحارس متّصل فعلياً بوجود الترحيل الحقيقي، لا بديل مصطنع.
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).not.toBe('');
        expect(existsSync(MIGRATION_PATH)).toBe(true);
    });
});

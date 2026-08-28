/**
 * دفعة 7 (2026-08-27، نظافة قاعدة البيانات): سياسة notifications_update_own
 * (20260716000002_dashboard_experience.sql) يرافقها تعليق يدّعي أن read_at هو
 * العمود الوحيد القابل للتعديل — لكن RLS تُقيِّد الصفوف لا الأعمدة، فالسياسة
 * الفعلية (using/with check على user_id فقط) تسمح بتعديل أي عمود آخر لأي صف
 * يملكه المستخدم نفسه. تحقّق: NotificationService.js.markRead()/markAllRead()
 * هما المستدعيان الوحيدان من كود التطبيق، وكلاهما .update({ read_at }) حصراً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATION_PATH = resolve(REPO_ROOT, 'supabase/migrations/20260828000000_notifications_restrict_update_to_read_at.sql');
const ORIGINAL_POLICY_PATH = resolve(REPO_ROOT, 'supabase/migrations/20260716000002_dashboard_experience.sql');

/** يستخرج أسماء أعمدة public.notifications من تعريف CREATE TABLE الحقيقي — لا قائمة
 * مكتوبة يدوياً يمكن أن تنحرف صامتة عن الجدول الفعلي لو أُضيف عمود مستقبلاً. */
function extractNotificationsColumns(originalMigrationSql) {
    const tableBlock = originalMigrationSql.match(/create table if not exists public\.notifications\s*\(([\s\S]*?)\n\);/i);
    if (!tableBlock) throw new Error('تعذّر إيجاد تعريف CREATE TABLE public.notifications في الملف الأصلي');
    return tableBlock[1]
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(/\s+/)[0].replace(/,$/, ''));
}

describe('ترحيل تقييد تعديل public.notifications إلى read_at فعلياً', () => {
    it('كل عمود حقيقي في الجدول (عدا id وread_at) يظهر فعلياً ضمن شرط الرفض في الـtrigger', () => {
        const originalSql = readFileSync(ORIGINAL_POLICY_PATH, 'utf8');
        const triggerSql = readFileSync(MIGRATION_PATH, 'utf8');

        const realColumns = extractNotificationsColumns(originalSql);
        expect(realColumns).toContain('user_id'); // تحقّق سلامة الاستخراج نفسه
        expect(realColumns.length).toBeGreaterThan(3);

        const columnsThatMustBeGuarded = realColumns.filter((c) => c !== 'id' && c !== 'read_at');
        columnsThatMustBeGuarded.forEach((col) => {
            expect(triggerSql).toMatch(new RegExp(`new\\.${col}\\s+is\\s+distinct\\s+from\\s+old\\.${col}`, 'i'));
        });
        // read_at نفسه يجب ألا يظهر ضمن شروط الرفض (هو العمود المسموح تعديله وحده)
        expect(triggerSql).not.toMatch(/new\.read_at\s+is\s+distinct\s+from\s+old\.read_at/i);
    });

    it('الملف موجود ويُعرِّف trigger فعلي (BEFORE UPDATE + RAISE EXCEPTION)', () => {
        expect(existsSync(MIGRATION_PATH)).toBe(true);
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/before update on public\.notifications/i);
        expect(sql).toMatch(/raise exception/i);
    });

    it('idempotent: drop trigger if exists قبل create trigger، بلا فشل عند إعادة التشغيل', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/drop trigger if exists notifications_restrict_update_columns on public\.notifications/i);
        expect(sql).toMatch(/create or replace function public\.notifications_restrict_update_columns/i);
    });

    it('[إثبات الحارس] العطل الأصلي: السياسة الحقيقية في 20260716000002_dashboard_experience.sql لا تحوي أي شرط على الأعمدة — فقط على user_id', () => {
        const originalSql = readFileSync(ORIGINAL_POLICY_PATH, 'utf8');
        const policyBlock = originalSql.match(/create policy "notifications_update_own"[\s\S]*?;/i);
        expect(policyBlock).not.toBeNull(); // السياسة الأصلية موجودة فعلاً بهذا الاسم

        const policyText = policyBlock[0];
        // العطل الحقيقي: USING/WITH CHECK يفحصان user_id فقط — لا أي عمود آخر (title/body/
        // type/study_id/created_at)، رغم تعليق الملف المرافق الذي يدّعي عكس ذلك تماماً.
        expect(policyText).toMatch(/using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
        expect(policyText).toMatch(/with check\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/i);
        expect(policyText).not.toMatch(/title|body|study_id|created_at|\btype\b/i); // لا قيد على أي عمود آخر
    });
});

/**
 * حارس نشر RLS (تدقيق 2026-07-08، ملاحظة حرجة، المدقّق الأمني): كانت سياسات RLS
 * لجدول studies (كل الدراسات المالية لكل المستخدمين) موجودة فقط كملف SQL يدوي
 * التطبيق — خطأ تشغيلي واحد (نسيان لصقه) = بيانات كل العملاء مكشوفة عبر anon.
 * هذا يثبّت وجود وظيفة CI فعلية (لا مجرد نية موثّقة) تُشغّل النشر تلقائياً، مع
 * تخطٍّ آمن (لا فشل بناء) حين تغيب أسرار Supabase من إعدادات المستودع.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as loadYaml } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');

describe('نشر RLS آلياً عبر CI', () => {
    it('ملف الترحيل الحقيقي يفعّل RLS على public.studies بصيغة قابلة لإعادة التشغيل بأمان', () => {
        const migrationPath = resolve(REPO_ROOT, 'supabase/migrations/20260708090000_enable_rls_studies.sql');
        expect(existsSync(migrationPath)).toBe(true);
        const sql = readFileSync(migrationPath, 'utf8');
        expect(sql).toMatch(/alter table public\.studies enable row level security/i);
        // idempotent: drop if exists قبل كل create policy، لا يفشل عند إعادة التشغيل
        const createCount = (sql.match(/create policy/gi) || []).length;
        const dropIfExistsCount = (sql.match(/drop policy if exists/gi) || []).length;
        expect(dropIfExistsCount).toBe(createCount);
    });

    it('وظيفة CI فعلية (YAML صالح) تُشغّل supabase db push مع تخطٍّ آمن حين تغيب الأسرار', () => {
        const workflowPath = resolve(REPO_ROOT, '.github/workflows/supabase-migrations.yml');
        expect(existsSync(workflowPath)).toBe(true);
        const doc = loadYaml(readFileSync(workflowPath, 'utf8'));
        const job = doc.jobs['db-migrations'];
        expect(job).toBeTruthy();

        const steps = job.steps;
        const pushStep = steps.find(s => typeof s.run === 'string' && s.run.includes('supabase db push'));
        expect(pushStep).toBeTruthy();
        // مشروط بتحقق الأسرار — لا يُشغَّل النشر بلا تأكد من توفرها (لا فشل صامت لاحقاً)
        expect(pushStep.if).toMatch(/configured/);

        const checkStep = steps.find(s => s.id === 'check_secrets');
        expect(checkStep).toBeTruthy();
        ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD'].forEach(secretName => {
            expect(checkStep.run).toContain(`secrets.${secretName}`);
        });
    });
});

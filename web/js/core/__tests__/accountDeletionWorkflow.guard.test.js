/**
 * حارس فشل صريح لورشة حذف الحساب (تصحيح 2026-08-30، مراجعة عدائية بعد الدمج
 * لـ#57، بقرار مالك صريح). #57 بنى معالجة فعلية لطلبات حذف الحساب (فترة سماح
 * 7 أيام) واستدعاءً يومياً مجدولاً (process-account-deletions.yml) يتطلب
 * سرَّين (SUPABASE_URL، ACCOUNT_DELETION_CRON_SECRET). تحقّق مباشر عبر
 * `gh secret list --repo al-aliani/qarar` أثبت غياب كليهما فعلياً — أي أن
 * التشغيلة اليومية تتخطّى نفسها صمتاً كل يوم منذ الدمج (نمط "تخطٍّ آمن +
 * ::warning::" المنسوخ من supabase-migrations.yml).
 *
 * هذا النمط صحيح لِـsupabase-migrations.yml/supabase-functions-deploy.yml
 * (مزوّد/نشر لم يُضبط بعد لا يكسر وعداً لعميل). لكنه خاطئ هنا تحديداً: نص
 * privacy.html/data-retention.html كان (قبل هذا التصحيح) يَعِد عملاء حقيقيين
 * بمهلة تنفيذ محددة — فتخطٍّ صامت هنا وعد قانوني مكسور بلا أي تنبيه يراه أحد.
 * لذلك خطوة check_secrets في هذه الورشة تحديداً يجب أن **تُفشل الوظيفة**
 * (exit 1) بدل التخطي حين تغيب الأسرار، على عكس الورشتين الأخريين المذكورتين
 * أعلاه اللتين يجب أن تبقيا على تخطّيهما الآمن كما هو (لا تغيير هناك).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as loadYaml } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');

describe('ورشة process-account-deletions: تفشل صراحة حين تغيب الأسرار (لا تخطٍّ صامت)', () => {
    const workflowPath = resolve(REPO_ROOT, '.github/workflows/process-account-deletions.yml');

    it('الملف موجود وYAML صالح البنية', () => {
        expect(existsSync(workflowPath)).toBe(true);
        const doc = loadYaml(readFileSync(workflowPath, 'utf8'));
        expect(doc.jobs['process-deletions']).toBeTruthy();
    });

    it('خطوة check_secrets تفشل الوظيفة (exit 1) حين يغيب أي من السرّين، لا مجرد ::warning:: مع تخطٍّ آمن', () => {
        const doc = loadYaml(readFileSync(workflowPath, 'utf8'));
        const steps = doc.jobs['process-deletions'].steps;
        const checkStep = steps.find(s => s.id === 'check_secrets');
        expect(checkStep).toBeTruthy();

        // يتحقق من كلا السرّين
        expect(checkStep.run).toContain('secrets.SUPABASE_URL');
        expect(checkStep.run).toContain('secrets.ACCOUNT_DELETION_CRON_SECRET');

        // الفرق الجوهري عن supabase-migrations.yml/supabase-functions-deploy.yml:
        // exit 1 فعلي في مسار الفشل، لا مجرد output=configured=false يُقرأ لاحقاً.
        expect(checkStep.run).toMatch(/exit 1/);
        // رسالة خطأ واضحة (::error:: يوقف الوظيفة فعلياً، بخلاف ::warning:: الذي لا يفعل)
        expect(checkStep.run).toMatch(/::error::/);
        expect(checkStep.run).not.toMatch(/::warning::/);
    });

    it('خطوة استدعاء الدالة لا تُشترَط بأي "if: configured==true" — فشل الخطوة السابقة (exit 1) هو ما يوقفها فعلياً', () => {
        // قبل هذا التصحيح كانت هذه الخطوة مشروطة بـ`steps.check_secrets.outputs.configured`
        // (تخطٍّ آمن). التصحيح يزيل هذا الشرط لأن check_secrets تفشل الوظيفة كاملة
        // الآن قبل الوصول لهذه الخطوة أصلاً — لا حاجة لشرط، ووجوده كان سيوحي خطأً
        // بأن التخطي الصامت ما يزال مسار تشغيل مقصود.
        const doc = loadYaml(readFileSync(workflowPath, 'utf8'));
        const steps = doc.jobs['process-deletions'].steps;
        const callStep = steps.find(s => typeof s.run === 'string' && s.run.includes('process-account-deletions'));
        expect(callStep).toBeTruthy();
        expect(callStep.if).toBeUndefined();
    });

    it('[إثبات الحارس] صياغة "تخطٍّ آمن" القديمة (لو أُعيدت حرفياً) كانت ستجتاز فحصاً أضعف لا يشترط exit 1 — يثبت أن الفحص أعلاه يكتشف هذا النمط فعلاً', () => {
        const oldSkipPattern = 'echo "configured=false" >> "$GITHUB_OUTPUT"\n            echo "::warning::SUPABASE_URL أو ACCOUNT_DELETION_CRON_SECRET غير مضبوطين — تخطّي تشغيل معالجة طلبات حذف الحساب."';
        expect(oldSkipPattern).toMatch(/::warning::/);
        expect(oldSkipPattern).not.toMatch(/exit 1/);

        const doc = loadYaml(readFileSync(workflowPath, 'utf8'));
        const checkStep = doc.jobs['process-deletions'].steps.find(s => s.id === 'check_secrets');
        expect(checkStep.run).not.toEqual(oldSkipPattern);
    });

    it('يبقي نمط "تخطٍّ آمن + ::warning::" كما هو في supabase-migrations.yml (لا تغيير هناك — مزوّد/نشر لم يُضبط بعد لا يكسر وعداً لعميل)', () => {
        const otherPath = resolve(REPO_ROOT, '.github/workflows/supabase-migrations.yml');
        const otherDoc = loadYaml(readFileSync(otherPath, 'utf8'));
        const otherCheck = otherDoc.jobs['db-migrations'].steps.find(s => s.id === 'check_secrets');
        expect(otherCheck.run).toMatch(/::warning::/);
        expect(otherCheck.run).not.toMatch(/exit 1/);
    });

    it('يبقي نمط "تخطٍّ آمن + ::warning::" كما هو في supabase-functions-deploy.yml (لا تغيير هناك)', () => {
        const otherPath = resolve(REPO_ROOT, '.github/workflows/supabase-functions-deploy.yml');
        const otherDoc = loadYaml(readFileSync(otherPath, 'utf8'));
        const jobNames = Object.keys(otherDoc.jobs);
        const stepsWithWarning = jobNames
            .flatMap(name => otherDoc.jobs[name].steps || [])
            .filter(s => typeof s.run === 'string' && s.run.includes('::warning::'));
        expect(stepsWithWarning.length).toBeGreaterThan(0);
        stepsWithWarning.forEach(s => expect(s.run).not.toMatch(/exit 1/));
    });
});

/**
 * حارس ثغرة "Pwn Request" (تدقيق 2026-08-29، إعادة تقييم عدائية — نفس اليوم الذي
 * أدخلت فيه PR #43 التبديل إلى workflow_run): .github/workflows/supabase-migrations.yml
 * وsupabase-functions-deploy.yml يُطلقان النشر الحيّ (بأسرار الإنتاج الكاملة —
 * Stripe/Moyasar/SUPABASE_SERVICE_ROLE_KEY) عبر `workflow_run` بعد نجاح
 * "E2E Tests"، مفلترَين بـ`branches: [main, master]` فقط — مطابقة بالاسم لا
 * بالمصدر. المستودع عام بلا حماية فروع وبتفريع غير مقيّد: مهاجم يُفرّع
 * المستودع، يسمّي فرعه "main"، يفتح PR بتعديل خبيث في دالة غير مغطاة باختبار
 * مدخل حقيقي، وحين تُبلغ "E2E Tests" نجاحاً يُطلَق workflow_run فيسحب النشر
 * `head_sha` — التزام فرع المهاجم نفسه — وينشره حياً.
 *
 * هذا الحارس يتحقق من شرط الوظيفة (job-level `if:`) في كلا الملفين عبر تحليل
 * YAML فعلي (لا نص خام) للتأكد من وجود تحقق "نفس المصدر"
 * (`head_repository.full_name == github.repository`) خاص بمسار workflow_run.
 * ويثبت أن التحقق غير وهمي (non-vacuous) بإعادة إنشاء الشرط القديم الضعيف
 * (بلا تحقق مصدر) وإظهار أنه كان سيجتاز نفس التأكيد الساذج خطأً — أي أن
 * الاختبار الحالي فعلاً يفحص محتوى التحقق لا مجرد وجود كلمة ما في الملف.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as loadYaml } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');

// يطابق شرط الوظيفة الحقيقي: يتحقق فقط أن مسار workflow_run محروس بتحقق مصدر
// صريح (head_repository) بجانب اشتراط نجاح الاختبارات، ولا يُفشل مسار
// workflow_dispatch (الذي لا يملك سياق head_repository إطلاقاً).
function workflowRunPathIsSameOriginGuarded(ifExpr) {
    if (typeof ifExpr !== 'string') return false;
    // لازم أن يذكر التحقق البنيوي الصحيح (لا يكفي ذكر head_repository في أي مكان —
    // يجب أن يقارن full_name (أو id) بـgithub.repository).
    const hasSameOriginCheck =
        /head_repository\.full_name\s*==\s*github\.repository/.test(ifExpr) ||
        /head_repository\.id\s*==\s*github\.repository_id/.test(ifExpr);
    if (!hasSameOriginCheck) return false;
    // ويجب أن يكون هذا التحقق مرتبطاً فعلياً (عبر &&) بفرع workflow_run نفسه —
    // لا مجرد موجوداً في مكان آخر من التعبير بلا أثر عملي.
    const conclusionAndOrigin =
        /conclusion\s*==\s*'success'\s*&&[^|]*head_repository\.(full_name|id)/.test(ifExpr);
    return conclusionAndOrigin;
}

function getJobIf(relativeWorkflowPath, jobName) {
    const workflowPath = resolve(REPO_ROOT, relativeWorkflowPath);
    expect(existsSync(workflowPath)).toBe(true);
    const doc = loadYaml(readFileSync(workflowPath, 'utf8'));
    const job = doc.jobs[jobName];
    expect(job).toBeTruthy();
    return job.if;
}

describe('حارس ثغرة Pwn Request في نشر Supabase (workflow_run بلا تحقق مصدر)', () => {
    it('supabase-migrations.yml: شرط الوظيفة يتحقق من نفس مصدر workflow_run (head_repository)', () => {
        const ifExpr = getJobIf('.github/workflows/supabase-migrations.yml', 'db-migrations');
        expect(workflowRunPathIsSameOriginGuarded(ifExpr)).toBe(true);
    });

    it('supabase-functions-deploy.yml: شرط الوظيفة يتحقق من نفس مصدر workflow_run (head_repository)', () => {
        const ifExpr = getJobIf('.github/workflows/supabase-functions-deploy.yml', 'deploy-functions');
        expect(workflowRunPathIsSameOriginGuarded(ifExpr)).toBe(true);
    });

    it('workflow_dispatch يبقى مسموحاً صراحة (لا يُعطَّل التشغيل اليدوي بإضافة تحقق المصدر)', () => {
        const migIf = getJobIf('.github/workflows/supabase-migrations.yml', 'db-migrations');
        const deployIf = getJobIf('.github/workflows/supabase-functions-deploy.yml', 'deploy-functions');
        [migIf, deployIf].forEach((ifExpr) => {
            expect(ifExpr).toMatch(/github\.event_name == 'workflow_dispatch'/);
        });
    });

    it('[إثبات الحارس] الشرط القديم الثغرة (بلا تحقق مصدر) كان سيفشل نفس التأكيد — الحارس غير وهمي', () => {
        // هذا هو الشرط الفعلي الذي كان في كلا الملفين قبل هذا الإصلاح (PR #43،
        // 2026-08-29) — يسمح بأي workflow_run ناجح لفرع اسمه main/master بغض
        // النظر عن المستودع الذي أطلقه فعلياً.
        const OLD_VULNERABLE_CONDITION =
            "github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'";

        expect(workflowRunPathIsSameOriginGuarded(OLD_VULNERABLE_CONDITION)).toBe(false);

        // وبالمقابل: الشرط الجديد (المُطبَّق فعلياً في الملفين) يجتاز التحقق —
        // يثبت أن الدالة تميّز فعلياً بين النسختين لا أنها ترفض كل شيء دوماً.
        const NEW_FIXED_CONDITION =
            "github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_repository.full_name == github.repository)";
        expect(workflowRunPathIsSameOriginGuarded(NEW_FIXED_CONDITION)).toBe(true);
    });
});

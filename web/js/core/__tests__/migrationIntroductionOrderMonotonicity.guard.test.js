/**
 * قفل 1.4 (خطة 2026-08-28، tender-floating-thompson.md): محاولة سابقة لحارس على
 * ترحيلات قاعدة البيانات فحصت "تفرّد الختم الزمني" فقط عبر أسماء الملفات — فحص
 * عديم القيمة هنا فعلياً: كل الـ49 ملفاً الحاليين فريدو الختم فعلاً، وكان هذا
 * الحارس سيمر أخضر يوم أُدخِل supabase/migrations/20260708080000_studies_table_
 * bootstrap.sql (2026-08-27، commit aaa52b5) رغم أن ختمه الزمني (2026-07-08)
 * أقدم من كل ترحيل آخر كان مُطبَّقاً على الإنتاج الحي وقتها. العطل الحقيقي لم
 * يكن تكراراً بل **عدم رتابة**: ملف أُدخِل للمستودع متأخراً يحمل ختماً أقدم من
 * ملفات أُدخِلت قبله — بالضبط ما يرفضه `supabase db push` بالخطأ:
 *   "Found local migration files to be inserted before the last migration on
 *   remote database"
 * (أو الأسوأ: يُطبَّق خارج الترتيب على بيئة لا تملك --include-all). استثناء هذا
 * الملف تحديداً موثَّق ومقصود: ترحيل تأسيس جدول public.studies يجب أن يُطبَّق
 * أولاً على أي بيئة جديدة رغم إدخاله للمستودع متأخراً — انظر
 * studiesTableBootstrapMigration.guard.test.js.
 *
 * لماذا لا يكفي ترتيب اسم الملف وحده لاكتشاف هذا الصنف من العطل: ترتيب الأسماء
 * أبجدياً *هو* الختم الزمني نفسه — مقارنة ملف بالملفات التي "تسبقه بترتيب الاسم"
 * حلقة مفرغة لا يمكنها الفشل أبداً (نفس المدخل يُستخدَم للفرز وللمقارنة).
 * الإشارة الحقيقية الوحيدة المستقلة عن اسم الملف هي **ترتيب إدخاله الفعلي
 * لتاريخ Git** (أول commit أضافه، عبر `git log --diff-filter=A --follow`) —
 * تُقارَن بترتيب ختمه الزمني المُضمَّن في الاسم. الاثنان يجب أن يتفقا (رتابة
 * غير تنازلية) إلا للاستثناء الموثَّق أدناه.
 *
 * مزلق تشغيلي حرج تم التحقق منه وإصلاحه: `git log --follow` يحتاج تاريخاً
 * كاملاً. `actions/checkout@v4` الافتراضي في GitHub Actions ضحل (fetch-depth: 1
 * ضمنياً) — كان هذا سيجعل الحارس يمر أخضر صامتاً في CI (لا تاريخ = كل ملف يبدو
 * "أُدخِل الآن" فتزول أي إشارة ترتيب حقيقية) رغم عمله محلياً بنسخة كاملة. أُضيف
 * فحص `git rev-parse --is-shallow-repository` أدناه ليفشل بوضوح بدل المرور
 * الصامت، وأُضيف `fetch-depth: 0` لخطوتَي checkout ذواتَي الصلة في e2e.yml
 * (الوظيفتان اللتان تُشغِّلان `vitest run` فعلياً: test-frontend وunit — منذ
 * PR #43 صارتا معاً داخل e2e.yml بعد توحيد ci.yml فيها؛ ci.yml لم يعد موجوداً).
 *
 * ملاحظة صريحة (اكتُشِفت أثناء بناء هذا الحارس، وليست جزءاً من الحادثة الأصلية):
 * تطبيق الفحص على تاريخ Git الكامل منذ نشأة المستودع كشف مخالفتين قديمتين
 * إضافيتين غير bootstrap — كلتاهما commit مباشر (parent وحيد، لا دمج/rebase)
 * يلي commit الدفعة السابقة له بثانية إلى 47 دقيقة فقط (نفس الجلسة عملياً)،
 * ولا يوجد أي commit إصلاح لاحق يشير لعطل نشر حقيقي بسببهما (بعكس bootstrap
 * الذي احتاج فعلياً `--include-all` في PR #39). الأرجح: كلتاهما دُفعتا لـ
 * GitHub ضمن نفس `git push` الذي يحوي الملف اللاحق أيضاً، فرآهما `db push` معاً
 * دفعة واحدة مُرتَّبة بالاسم — لا تعارض تسلسلي فعلي حدث. أُضيفتا لـallowlist
 * كبيانات تاريخية متوارَثة (grandfathered) بعد هذا التحقق، لا كاستثناء تصميمي
 * ثانٍ من نفس نوع bootstrap — القائمة تبقى صريحة ومغلقة، وأي ملف جديد غير
 * مُدرَج فيها يبقى يُكتشَف فوراً (مُثبَت بحارسَي الإثبات أدناه).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'supabase/migrations');

const DOCUMENTED_BACKDATED_ALLOWLIST = new Set([
    // الاستثناء الوحيد المقصود تصميمياً: ترحيل تأسيسي يجب أن يُطبَّق أولاً على أي
    // بيئة جديدة رغم إدخاله للمستودع متأخراً عمداً (انظر تعليق أعلى الملف والحارس
    // المرافق له: studiesTableBootstrapMigration.guard.test.js).
    '20260708080000_studies_table_bootstrap.sql',
    // تاريخي متوارَث (grandfathered)، اكتُشِف أثناء بناء هذا الحارس لا في الحادثة
    // الأصلية: commit مباشر (9b710e5) يلي بـ47 دقيقة commit الدفعة (3bacae86) التي
    // تحوي ملفاً بختم أعلى — بلا أي عطل نشر موثَّق لاحقاً. انظر تعليق أعلى الملف.
    '20260718010001_share_growth_and_tracking.sql',
    // تاريخي متوارَث (grandfathered)، نفس الفئة: commit مباشر (c909492) يلي بثانية
    // واحدة commit (13c21ff) يحوي ملفاً بختم أعلى — نفس جلسة العمل عملياً.
    '20260721000001_share_feedback.sql',
]);

function embeddedTimestamp(filename) {
    const match = filename.match(/^(\d{14})_/);
    if (!match) throw new Error(`اسم ترحيل بلا ختم زمني بادئ (yyyymmddhhmmss_): ${filename}`);
    return Number(match[1]);
}

/**
 * يمشي عبر الإدخالات بترتيب إدخالها الفعلي لتاريخ Git (introEpoch تصاعدياً)،
 * ويتحقق أن الختم الزمني المُضمَّن في اسم الملف لا يتراجع أبداً — إلا لملف على
 * allowlist. الاغتفار لا يخفض السقف لما بعده أبداً (maxTsSoFar يُحدَّث دون
 * شرط). يُرجع قائمة المخالفات (فارغة = رتابة سليمة).
 */
function findMonotonicityViolations(entriesSortedByIntroduction, allowlist) {
    const violations = [];
    let maxTsSoFar = -Infinity;
    for (const entry of entriesSortedByIntroduction) {
        if (entry.ts < maxTsSoFar && !allowlist.has(entry.file)) {
            violations.push({ ...entry, maxTsSoFar });
        }
        maxTsSoFar = Math.max(maxTsSoFar, entry.ts);
    }
    return violations;
}

function gitIntroductionEpoch(relativePath) {
    const log = execFileSync(
        'git',
        ['log', '--follow', '--diff-filter=A', '--format=%at', '--', relativePath],
        { cwd: REPO_ROOT, encoding: 'utf8' },
    ).trim();
    const lines = log.split('\n').filter(Boolean);
    if (lines.length === 0) return Infinity; // بلا التزام بعد → يُعامَل كأنه أُدخِل الآن (أحدث نقطة)
    return Number(lines[lines.length - 1]); // git log الأحدث أولاً؛ آخر سطر = أقدم commit = لحظة الإدخال
}

describe('رتابة ترتيب ترحيلات قاعدة البيانات (إدخال Git مقابل الختم الزمني)', () => {
    it('المستودع المحلي ليس ضحلاً — بلا هذا، git log --follow يرجع فارغاً ويُخفي أي مخالفة صامتاً (مزلق CI الموثَّق أعلاه)', () => {
        const isShallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }).trim();
        expect(isShallow).toBe('false');
    });

    it('كل ملف أُدخِل لتاريخ Git لاحقاً يحمل ختماً زمنياً ≥ كل ملف أُدخِل قبله (عدا الاستثناء الموثَّق)', () => {
        const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
        expect(files.length).toBeGreaterThan(0);

        const entries = files.map((file) => ({
            file,
            introEpoch: gitIntroductionEpoch(`supabase/migrations/${file}`),
            ts: embeddedTimestamp(file),
        }));

        entries.sort((a, b) => {
            if (a.introEpoch !== b.introEpoch) return a.introEpoch - b.introEpoch;
            // تعادل الإدخال (نفس commit/دفعة): لا إشارة ترتيب Git حقيقية بينها، الختم
            // الزمني نفسه هو الحكم الوحيد المتاح — يضمن ألا تُقارَن ببعضها زوراً.
            return a.ts - b.ts;
        });

        const violations = findMonotonicityViolations(entries, DOCUMENTED_BACKDATED_ALLOWLIST);
        expect(violations).toEqual([]);
    }, 30000);

    it('[إثبات الحارس] العطل الأصلي مُعاد إنتاجه من بيانات اصطناعية: ملف أُدخِل أخيراً بختم أقدم من الكل — يُكتشَف بلا allowlist، ويُغتفَر معه', () => {
        // الشكل الفعلي المقيس أعلاه من تاريخ Git الحقيقي (انظر رسالة PR لتفاصيل
        // introEpoch الفعلية): bootstrap أُدخِل بعد كل الملفات الأخرى (introEpoch أعلى)
        // لكن ختمه (2026-07-08) أقدم من ختم كل ملف آخر.
        const syntheticEntries = [
            { file: '20260708090000_enable_rls_studies.sql', introEpoch: 1000, ts: 20260708090000 },
            { file: '20260827030000_anon_endpoint_hits_and_public_applications_lockdown.sql', introEpoch: 2000, ts: 20260827030000 },
            { file: '20260708080000_studies_table_bootstrap.sql', introEpoch: 3000, ts: 20260708080000 },
        ];

        const withoutAllowlist = findMonotonicityViolations(syntheticEntries, new Set());
        expect(withoutAllowlist).toHaveLength(1);
        expect(withoutAllowlist[0].file).toBe('20260708080000_studies_table_bootstrap.sql');

        const withAllowlist = findMonotonicityViolations(syntheticEntries, DOCUMENTED_BACKDATED_ALLOWLIST);
        expect(withAllowlist).toEqual([]);
    });

    it('[إثبات الحارس] مخالفة غير موثَّقة (ليست bootstrap) تُكتشَف ولا تُغتفَر عبر allowlist الحالي، ولا تخفض السقف لما بعدها', () => {
        const syntheticEntries = [
            { file: '20260708090000_enable_rls_studies.sql', introEpoch: 1000, ts: 20260708090000 },
            { file: '20260827030000_anon_endpoint_hits_and_public_applications_lockdown.sql', introEpoch: 2000, ts: 20260827030000 },
            { file: '20260101000000_some_new_file_backdated_by_mistake.sql', introEpoch: 3000, ts: 20260101000000 },
            { file: '20260829000000_next_real_migration.sql', introEpoch: 4000, ts: 20260829000000 },
        ];
        const violations = findMonotonicityViolations(syntheticEntries, DOCUMENTED_BACKDATED_ALLOWLIST);
        expect(violations).toHaveLength(1);
        expect(violations[0].file).toBe('20260101000000_some_new_file_backdated_by_mistake.sql');
    });
});

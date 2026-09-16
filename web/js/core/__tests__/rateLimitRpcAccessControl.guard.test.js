/**
 * حارس نموذج الوصول لدالتَي حدّ المعدّل — مُصحَّح (تدقيق شامل 2026-09-16).
 *
 * الافتراض الأصلي هنا (تقييم أمني عدائي 2026-08-29) كان خاطئاً فعلياً: أن غياب
 * أي عبارة GRANT EXECUTE صريحة في ملفات الترحيل كافٍ لمنع anon/authenticated من
 * التنفيذ. تحقّق حي مباشر (get_advisors + استعلام pg_proc.proacl على قاعدة
 * الإنتاج) أثبت العكس: كلا الدالتين كانتا فعلاً قابلتين للتنفيذ من anon
 * وauthenticated (ACL: `anon=X/postgres`, `authenticated=X/postgres` صريحان)
 * رغم صفر GRANT EXECUTE في أي ترحيل — على الأرجح عبر ALTER DEFAULT PRIVILEGES
 * الذي يضبطه Supabase افتراضياً على مستوى المشروع نفسه (خارج أي ملف نتتبّعه
 * هنا)، لا PUBLIC وحدها. الإصلاح الفعلي: migration
 * 20260916010000_rate_limit_rpc_revoke_public_execute.sql يسحب الصلاحية صراحة
 * (REVOKE)، وهذا الحارس يتحقق الآن من وجودها لا من غياب GRANT فقط.
 *
 * ملاحظة تصحيحية إضافية: "الطبقة الثانية" (RLS رفض-افتراضي على
 * rate_limit_events/anon_endpoint_hits) الموثَّقة أدناه **لا تحمي من الاستدعاء
 * المباشر لهاتين الدالتين تحديداً** — كلتاهما SECURITY DEFINER فتُنفَّذان
 * بصلاحية المالك (تتجاوزان RLS بنيوياً بصرف النظر عمّن استدعاها)؛ RLS يحمي فقط
 * من وصول مباشر للجدولين خارج الدالتين، وهو ليس مسار الاستغلال الذي وُثِّق هنا.
 * تبقى الاختبارات الخاصة بها أدناه لأنها توثّق خاصية حقيقية ومفيدة (تصميم آمن
 * افتراضياً للجدولين لو استُهدفا مباشرة لسبب آخر)، لا لأنها الدفاع الفعلي ضد
 * هذا العطل تحديداً — الدفاع الفعلي الوحيد هو صلاحية EXECUTE نفسها.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'supabase/migrations');
const RPC_MIGRATION_PATH = resolve(MIGRATIONS_DIR, '20260829030000_atomic_rate_limit_functions.sql');
const RATE_LIMIT_EVENTS_MIGRATION_PATH = resolve(MIGRATIONS_DIR, '20260821010000_rate_limit_events.sql');
const ANON_ENDPOINT_HITS_MIGRATION_PATH = resolve(
    MIGRATIONS_DIR,
    '20260827030000_anon_endpoint_hits_and_public_applications_lockdown.sql',
);
const REVOKE_MIGRATION_PATH = resolve(MIGRATIONS_DIR, '20260916010000_rate_limit_rpc_revoke_public_execute.sql');

/** يستبعد أسطر التعليق (-- ...) قبل البحث عن عبارات SQL فعلية — التعليقات
 * التفسيرية تذكر عمداً كلمات مثل "GRANT EXECUTE" و"create policy" كنصّ توثيقي
 * لا كأوامر SQL حقيقية، فلا يجوز أن تُطابقها فحوصات "لا يوجد أمر فعلي". */
function stripSqlComments(sql) {
    return sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
}

function readAllMigrationsConcatenated() {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    return files.map((f) => stripSqlComments(readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8'))).join('\n');
}

describe('نموذج وصول RPC حدّ المعدّل: بلا GRANT EXECUTE لعميل غير موثوق، مقصود لا سهو', () => {
    it('لا يوجد أمر GRANT EXECUTE فعلي (خارج التعليقات) لأي من الدالتين لأي دور في أي ترحيل', () => {
        const codeOnly = readAllMigrationsConcatenated();
        expect(codeOnly).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.check_and_record_rate_limit/i);
        expect(codeOnly).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.check_and_record_anon_rate_limit/i);
        // وتحديداً: لا وجود إطلاقاً لأي GRANT EXECUTE يمنح anon أو authenticated
        // تنفيذ أي من الدالتين (الفحص أعلاه أشمل، وهذا تأكيد صريح للأدوار المعنيّة).
        expect(codeOnly).not.toMatch(/check_and_record_(anon_)?rate_limit[\s\S]{0,40}\bto\s+(anon|authenticated)\b/i);
    });

    it('التعليق التفسيري لسبب غياب GRANT EXECUTE موجود فعلاً في ملف الترحيل (لا سهو ناتج عن حذف مستقبلي)', () => {
        const sql = readFileSync(RPC_MIGRATION_PATH, 'utf8');
        expect(sql).toContain('لا grant execute هنا عمداً');
        expect(sql).toContain('p_user_id');
        expect(sql).toContain('p_identifier_hash');
        // يذكر صراحة تفاوته عن نمط الـ19 دالة الأخرى ذات GRANT EXECUTE الصريح،
        // ويحذّر من "توحيد" مستقبلي يعيد فتح الثغرة.
        expect(sql).toContain('19 دالة');
        expect(sql).toContain('لا تُضِف');
    });

    it('التوثيق يربط صراحة بين غياب GRANT EXECUTE والطبقة الثانية (RLS رفض-افتراضي) كدفاعين مستقلين', () => {
        const sql = readFileSync(RPC_MIGRATION_PATH, 'utf8');
        expect(sql).toContain('الطبقة الثانية');
        expect(sql).toContain('rate_limit_events');
        expect(sql).toContain('anon_endpoint_hits');
    });

    it('[إثبات الحارس] العطل الأصلي: لو أُضيف GRANT EXECUTE لـauthenticated مستقبلاً، هذا الفحص يفشل', () => {
        const maliciousAddition =
            'grant execute on function public.check_and_record_rate_limit(uuid, text, integer, integer) to authenticated;';
        expect(maliciousAddition).toMatch(/grant\s+execute\s+on\s+function\s+public\.check_and_record_rate_limit/i);
        // نفس الفحص المُستخدَم أعلاه على الترحيلات الحقيقية، مطبَّق هنا على نص
        // اصطناعي يمثّل بالضبط ما يُفترض أن يمنعه الحارس — يثبت أن التوكيد متّصل
        // فعلياً بمحتوى حقيقي قابل للفشل، لا بديل مصطنع دائم النجاح.
        expect(maliciousAddition).toMatch(/check_and_record_(anon_)?rate_limit[\s\S]{0,40}\bto\s+(anon|authenticated)\b/i);
    });

    it('rate_limit_events: RLS مُفعَّلة وبصفر سياسات لأي دور في كامل الترحيلات (الطبقة الثانية فعلية لا موثَّقة فقط)', () => {
        const ownMigration = readFileSync(RATE_LIMIT_EVENTS_MIGRATION_PATH, 'utf8');
        expect(ownMigration).toMatch(/alter table public\.rate_limit_events enable row level security/i);
        expect(ownMigration).toContain('عمداً');

        const codeOnly = readAllMigrationsConcatenated();
        expect(codeOnly).not.toMatch(/create policy[\s\S]{0,80}\bon\s+public\.rate_limit_events\b/i);
    });

    it('anon_endpoint_hits: RLS مُفعَّلة وبصفر سياسات لأي دور في كامل الترحيلات (الطبقة الثانية فعلية لا موثَّقة فقط)', () => {
        const ownMigration = readFileSync(ANON_ENDPOINT_HITS_MIGRATION_PATH, 'utf8');
        expect(ownMigration).toMatch(/alter table public\.anon_endpoint_hits enable row level security/i);
        expect(ownMigration).toContain('عمداً');

        const codeOnly = readAllMigrationsConcatenated();
        expect(codeOnly).not.toMatch(/create policy[\s\S]{0,80}\bon\s+public\.anon_endpoint_hits\b/i);
    });

    it('[إثبات الحارس] العطل الأصلي: لو أُضيفت سياسة RLS لأحد الجدولين مستقبلاً بلا مراجعة، هذا الفحص يفشل', () => {
        const accidentalPolicy = 'create policy "allow_all" on public.rate_limit_events for select using (true);';
        expect(accidentalPolicy).toMatch(/create policy[\s\S]{0,80}\bon\s+public\.rate_limit_events\b/i);
    });

    it('الإصلاح الفعلي (2026-09-16): REVOKE صريح من PUBLIC/anon/authenticated لكلتا الدالتين، بلا مسّ service_role', () => {
        const sql = readFileSync(REVOKE_MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/revoke\s+execute\s+on\s+function\s+public\.check_and_record_rate_limit\([\s\S]{0,60}\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i);
        expect(sql).toMatch(/revoke\s+execute\s+on\s+function\s+public\.check_and_record_anon_rate_limit\([\s\S]{0,60}\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i);
        // لا يسحب من service_role — المستدعي الفعلي الوحيد (عبر adminClient في
        // create-checkout/mfa-recovery-*/places-nearby/check-name-availability/submit-application)
        expect(sql).not.toMatch(/revoke[\s\S]{0,120}service_role/i);
    });

    it('[إثبات الحارس] لو حُذف ترحيل REVOKE هذا مستقبلاً، هذا الفحص نفسه يفشل (لا نص مصطنع دائم النجاح)', () => {
        expect(existsSync(REVOKE_MIGRATION_PATH)).toBe(true);
    });
});

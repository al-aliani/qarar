/**
 * حارس نموذج الوصول لدالتَي حدّ المعدّل (تقييم أمني عدائي 2026-08-29):
 * check_and_record_rate_limit وcheck_and_record_anon_rate_limit (migration
 * 20260829030000) هما الاستثناء الوحيد بهذا المشروع من نمط "كل RPC عام له
 * GRANT EXECUTE صريح" (19 دالة أخرى تملكه — get_study_by_share_token،
 * track_event، add_share_feedback، admin_*_stats...). الغياب مقصود لا سهو:
 * معاملات الدالتين (p_user_id/p_identifier_hash) تصل كوسيطة خام بلا أي ربط
 * بـauth.uid()، فمنح تنفيذها لـanon/authenticated كان يسمح لأي عميل بتسميم
 * عدّاد حدّ أي مستخدم آخر (حجب خدمة مستهدف، DoS). هذا الحارس يمنع "إصلاح"
 * مستقبلي حَسَن النية يوحّد النمط بإضافة GRANT EXECUTE ويعيد فتح الثغرة، ويثبت
 * أن الطبقة الثانية (RLS رفض-افتراضي بصفر سياسات على الجدولين تحتهما) موجودة
 * فعلاً كما هي موثَّقة. نفس فلسفة rlsStudySharesDeployment.guard.test.js.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
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
});

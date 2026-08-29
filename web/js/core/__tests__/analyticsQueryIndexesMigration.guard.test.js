/**
 * فهارس ناقصة على مسارَي استعلام ساخنَين (2026-08-29): track_event()
 * (20260722091000_track_event_ratelimit_fix.sql) يفحص events بـ
 * session_id+created_at بلا أي فهرس عليهما، وget_public_usage_stats()
 * (20260714000000_public_usage_stats.sql) يفحص orders بـstatus/review_status
 * حيث فهرس review_status القائم (orders_review_status_reviewed_idx) **جزئي**
 * (where tier = 'reviewed') ولا يغطي استعلاماً بلا شرط على tier. هذا الحارس
 * يثبّت شكل الفهارس الجديدة فعلياً، ويثبّت (بإثبات حارس) أن الفهرس الجزئي
 * القديم لا يزال جزئياً كما وُصف — أي تعديل لاحق عليه يُفشل هذا الاختبار
 * فيُعاد فتح النقاش بدل بقاء الافتراض صامتاً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATION_PATH = resolve(REPO_ROOT, 'supabase/migrations/20260829010000_analytics_query_indexes.sql');

describe('ترحيل فهارس استعلامات التحليلات (events.session_id + orders.status/review_status)', () => {
    it('الملف موجود فعلياً', () => {
        expect(existsSync(MIGRATION_PATH)).toBe(true);
    });

    it('يضيف فهرساً مركّباً على events(session_id, created_at) بترتيب يطابق شكل استعلام track_event (مساواة ثم مدى)', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(
            /create index if not exists events_session_id_idx\s+on public\.events \(session_id, created_at\)/i,
        );
    });

    it('يضيف فهرساً عادياً (غير جزئي) على orders(status)', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/create index if not exists orders_status_idx\s+on public\.orders \(status\)/i);
        // غير جزئي: لا شرط where يتبع تعريف هذا الفهرس تحديداً
        const statusIdxMatch = sql.match(/create index if not exists orders_status_idx[\s\S]*?;/i)[0];
        expect(statusIdxMatch).not.toMatch(/where/i);
    });

    it('يضيف فهرساً عادياً (غير جزئي) على orders(review_status) — الفهرس الجزئي القائم لا يغطي استعلاماً بلا شرط tier', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/create index if not exists orders_review_status_idx\s+on public\.orders \(review_status\)/i);
        const reviewStatusIdxMatch = sql.match(/create index if not exists orders_review_status_idx[\s\S]*?;/i)[0];
        expect(reviewStatusIdxMatch).not.toMatch(/where/i);
    });

    it('كل الفهارس الثلاثة idempotent (if not exists)، مطابقةً لاتفاقية الترحيلات في هذا المستودع', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        // يستبعد سطور التعليق (تبدأ بـ--) — الشرح أعلى الملف يقتبس تعريف فهرس آخر كمثال
        const createIndexLines = sql
            .split('\n')
            .filter((line) => !line.trim().startsWith('--') && /create index/i.test(line));
        expect(createIndexLines.length).toBe(3);
        for (const line of createIndexLines) {
            expect(line).toMatch(/create index if not exists/i);
        }
    });

    it('[إثبات الحارس] الفهرس الجزئي القديم على orders.review_status لا يزال جزئياً فعلاً (where tier = reviewed) — لا نص مصطنع', () => {
        const oldMigrationPath = resolve(REPO_ROOT, 'supabase/migrations/20260713000000_reviewer_portal.sql');
        const oldSql = readFileSync(oldMigrationPath, 'utf8');
        expect(oldSql).toMatch(
            /create index if not exists orders_review_status_reviewed_idx\s*\n\s*on public\.orders \(review_status\)\s*\n\s*where tier = 'reviewed'/i,
        );

        // ولولا أن هذا الترحيل الجديد يضيف فهرساً عادياً موازياً، لبقي استعلام
        // get_public_usage_stats (بلا شرط tier) يفحص الجدول كاملاً كل استدعاء.
        const newSql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(newSql).toMatch(/create index if not exists orders_review_status_idx/i);
    });

    it('[إثبات الحارس] استعلام get_public_usage_stats الفعلي لا يتضمّن شرط tier — يؤكد عدم قابلية الفهرس الجزئي للاستخدام هنا', () => {
        const usageStatsPath = resolve(REPO_ROOT, 'supabase/migrations/20260714000000_public_usage_stats.sql');
        const usageSql = readFileSync(usageStatsPath, 'utf8');
        const reviewStatusQueryLine = usageSql
            .split('\n')
            .find((line) => /review_status\s*=\s*'certified'/i.test(line));
        expect(reviewStatusQueryLine).toBeTruthy();
        expect(reviewStatusQueryLine).not.toMatch(/tier/i);
    });
});

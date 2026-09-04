/**
 * تدقيق 2026-09-04: حدّ معدّل track_event كان محسوباً لكل session_id فقط —
 * وsession_id يرسله العميل. مهاجم بلا حساب، بمفتاح anon المستخرج من حزمة الواجهة،
 * يدوّر session_id مع كل نداء فيبقى العدّ صفراً ⟶ إدراج غير محدود في public.events
 * (حتى 4KB للصف). عند 100 طلب/ثانية ≈ 34 GB يومياً على نفس القاعدة التي تخدم
 * العملاء الدافعين.
 *
 * الإصلاح السابق (20260722091000) عالج session_id = null فقط، لا التدوير.
 *
 * هذا الحارس يثبّت وجود بُعد ثانٍ **لا يتحكم فيه العميل**، ويمنع بشكل خاص
 * الانتكاس إلى تخزين عنوان IP (أو بصمته) داخل events — الجدول بلا عمود IP عمداً،
 * وهي خاصية خصوصية أثبتها التدقيق الأمني.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATION_PATH = resolve(
    REPO_ROOT,
    'supabase/migrations/20260904010000_track_event_second_dimension.sql'
);

function sqlCode() {
    return readFileSync(MIGRATION_PATH, 'utf8')
        .split('\n')
        .filter(line => !/^\s*--/.test(line))
        .join('\n');
}

describe('track_event: حدّ المعدّل له بُعد لا يتحكم فيه العميل', () => {
    it('الترحيل موجود ويعيد تعريف الدالة بأمان', () => {
        expect(existsSync(MIGRATION_PATH)).toBe(true);
        const sql = sqlCode();
        expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.track_event/i);
        expect(sql).toMatch(/security\s+definer/i);
        expect(sql).toMatch(/set\s+search_path\s*=\s*public/i);
    });

    it('يشتقّ هوية المستخدم من auth.uid() لا من وسيطة يرسلها العميل', () => {
        const sql = sqlCode();
        expect(sql).toMatch(/auth\.uid\(\)/);
        // العدّ لكل user_id — تدوير session_id لا يفيد المستخدم المسجَّل
        expect(sql).toMatch(/where\s+user_id\s*=\s*v_uid/i);
    });

    it('يضع سقفاً للزوّار المجهولين لا يعتمد على أي قيمة من العميل', () => {
        const sql = sqlCode();
        expect(sql).toMatch(/where\s+user_id\s+is\s+null/i);
    });

    it('يُبقي حدّ الجلسة الأصلي — البُعد الجديد إضافة لا استبدال', () => {
        const sql = sqlCode();
        expect(sql).toMatch(/where\s+session_id\s*=\s*p_session_id/i);
        expect(sql).toMatch(/>=\s*500/);
    });

    it('يبقى الحارس القديم: بلا session_id لا إدراج', () => {
        const sql = sqlCode();
        expect(sql).toMatch(/p_session_id\s+is\s+null/i);
    });

    it('لا يخزّن عنوان IP ولا بصمته داخل events — خاصية خصوصية متعمَّدة', () => {
        const sql = sqlCode();
        expect(sql).not.toMatch(/x-forwarded-for/i);
        expect(sql).not.toMatch(/request\.headers/i);
        expect(sql).not.toMatch(/_ip/);
        expect(sql).not.toMatch(/inet_client_addr/i);
    });

    it('يضيف الفهارس التي يحتاجها العدّ — بدونها كل حدث يمسح الجدول', () => {
        const sql = sqlCode();
        expect(sql).toMatch(/create\s+index\s+if\s+not\s+exists[\s\S]*?on\s+public\.events\s*\(user_id,\s*created_at\)/i);
        expect(sql).toMatch(/create\s+index\s+if\s+not\s+exists[\s\S]*?on\s+public\.events\s*\(created_at\)/i);
    });
});

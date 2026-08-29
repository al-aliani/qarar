/**
 * دفعة 0.2 (2026-08-28، حجب سرّ Moyasar عن orders.metadata بعد إعادة تقييم
 * الطبقات الـ16): إلى جانب إصلاح الكود (webhook-moyasar/stripe/tamara تخزّن
 * الآن قائمة بيضاء صريحة لا الحمولة الخام)، هذا يثبّت وجود ترحيل احترازي
 * يُفرِّغ metadata لأي صف orders سابق مصدره Moyasar فعلاً — احتياطاً لاحتمال
 * وصول حدث paid واحد فعلي قبل هذا الإصلاح.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATION_PATH = resolve(REPO_ROOT, 'supabase/migrations/20260828010000_orders_metadata_secret_cleanup.sql');

describe('ترحيل تنظيف orders.metadata من أي secret_token مخزَّن سابقاً', () => {
    it('الملف موجود، يقيّد التنظيف على provider=moyasar فقط، ولا يمسّ أي عمود آخر', () => {
        expect(existsSync(MIGRATION_PATH)).toBe(true);
        const sql = readFileSync(MIGRATION_PATH, 'utf8');

        expect(sql).toMatch(/update\s+public\.orders/i);
        expect(sql).toMatch(/set\s+metadata\s*=\s*'\{\}'::jsonb/i);
        expect(sql).toMatch(/where\s+provider\s*=\s*'moyasar'/i);
        // لا يجوز أن يمسّ status/paid_at/أي عمود محاسبي آخر — تنظيف metadata فقط
        expect(sql).not.toMatch(/set\s+[^;]*\bstatus\s*=/i);
        expect(sql).not.toMatch(/set\s+[^;]*\bpaid_at\s*=/i);
    });

    it('idempotent فعلياً: شرط "is distinct from" يمنع كتابة لا لزوم لها على صفوف نظيفة أصلاً', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/metadata\s+is\s+distinct\s+from\s+'\{\}'::jsonb/i);
    });
});

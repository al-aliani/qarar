/**
 * حارس عكس تحويل بنكي مدفوع إلى «مسترَد» (تدقيق شامل 2026-09-16): قبل هذا
 * الترحيل لم توجد أي دالة تعكس status='paid'→'refunded' لطلب bank_transfer —
 * وهي وسيلة الدفع الوحيدة المفعّلة حالياً بالواجهة. عميل يُسترَد له مبلغه
 * يدوياً خارج المنصة كان يبقى hasActivePayment=true إلى ما لا نهاية (تعتمد
 * فقط على status='paid')، فيستمر وصوله للتصدير المدفوع رغم استرجاعه المبلغ.
 * نفس مبدأ attachmentsBucketRlsDeployment.guard.test.js: لو حُذف الترحيل هذا
 * الاختبار نفسه يفشل — يثبت اتصالاً حقيقياً بوجوده لا نصاً مصطنعاً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATION_PATH = resolve(REPO_ROOT, 'supabase/migrations/20260916000000_bank_transfer_refund_reversal.sql');

describe('عكس التحويل البنكي المدفوع إلى مسترَد (admin_refund_bank_transfer)', () => {
    it('ملف الترحيل موجود ويعرّف الدالة بأمان (SECURITY DEFINER + search_path ثابت)', () => {
        expect(existsSync(MIGRATION_PATH)).toBe(true);
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/create or replace function public\.admin_refund_bank_transfer\(target_order_id uuid\)/i);
        expect(sql).toMatch(/security definer/i);
        expect(sql).toMatch(/set search_path = public/i);
    });

    it('تتحقق من صلاحية الأدمن قبل أي تعديل — لا مسار تصعيد صلاحية', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        const refundFn = sql.split('admin_refund_bank_transfer(target_order_id uuid)')[1].split('$$;')[0];
        expect(refundFn).toMatch(/if not public\.is_admin\(auth\.uid\(\)\) then\s*raise exception 'not authorized';/i);
    });

    it('تعكس paid→refunded فقط لطلبات bank_transfer — لا تلمس أي مزوّد آخر ولا أي حالة أخرى', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        const refundFn = sql.split('admin_refund_bank_transfer(target_order_id uuid)')[1].split('$$;')[0];
        expect(refundFn).toMatch(/set status = 'refunded'/i);
        expect(refundFn).toMatch(/and provider = 'bank_transfer'/i);
        expect(refundFn).toMatch(/and status = 'paid'/i);
        // لا يعيد فتح الوصول أو يمس paid_at بالخطأ عكسياً
        expect(refundFn).not.toMatch(/set status = 'paid'/i);
    });

    it('ترفض استدعاءً على طلب لا يطابق الشرط (raise exception عند not found)', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        const refundFn = sql.split('admin_refund_bank_transfer(target_order_id uuid)')[1].split('$$;')[0];
        expect(refundFn).toMatch(/if not found then\s*raise exception 'no matching paid bank_transfer order';/i);
    });

    it('تُدرج إشعاراً للعميل مُغلَّفاً بمعالج استثناء لا يُسقط عكس الحالة نفسه عند فشله', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        const refundFn = sql.split('admin_refund_bank_transfer(target_order_id uuid)')[1].split('$$;')[0];
        expect(refundFn).toMatch(/insert into public\.notifications/i);
        expect(refundFn).toMatch(/exception when others then\s*raise warning/i);
    });

    it('تمنح التنفيذ لـauthenticated فقط (الحماية الفعلية داخلية عبر is_admin، نفس نمط admin_confirm_bank_transfer)', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        expect(sql).toMatch(/grant execute on function public\.admin_refund_bank_transfer\(uuid\) to authenticated;/i);
        expect(sql).not.toMatch(/grant execute on function public\.admin_refund_bank_transfer.*to (anon|public)/i);
    });

    it('admin_list_paid_bank_transfers تسرد فقط bank_transfer/paid وتتحقق من is_admin', () => {
        const sql = readFileSync(MIGRATION_PATH, 'utf8');
        const listFn = sql.split('function public.admin_list_paid_bank_transfers()')[1].split('$$;')[0];
        expect(listFn).toMatch(/if not public\.is_admin\(auth\.uid\(\)\) then/i);
        expect(listFn).toMatch(/where o\.provider = 'bank_transfer' and o\.status = 'paid'/i);
        expect(sql).toMatch(/grant execute on function public\.admin_list_paid_bank_transfers\(\) to authenticated;/i);
    });
});

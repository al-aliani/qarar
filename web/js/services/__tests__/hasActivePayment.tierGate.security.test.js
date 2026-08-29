import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * تدقيق أمني 2026-08-29: hasActivePayment (وبالتبعية بوابات التصدير في ExportMenu.js/
 * ShareStudyView.js — انظر hasActivePayment(studyId) في PaymentService.js) كانت تتحقق
 * فقط من status='paid' بلا أي فلترة على tier. أي صف orders بحالة paid — بصرف النظر
 * عن tier، بما فيه 'free' (لا سعر لها في pricing.ts/pricing.js، موجودة فقط لعرض
 * صفحة الأسعار/المقارنة، وليست منتجاً يُشترى) — كان يفتح كل بوابات التصدير المدفوعة
 * (PDF/Word/Excel/التقرير البنكي).
 *
 * هذا الملف يختبر PaymentService.js بمعزل تام عن create-checkout: يحاكي وجود صف
 * orders.status='paid' بtier غير مدفوع مباشرة داخل قاعدة بيانات مموَّهة (بصرف النظر
 * عن كيف وصل الصف لتلك الحالة فعلياً — دفاع متعمق مستقل عن ثغرة create-checkout
 * تحديداً، انظر supabase/functions/create-checkout/__tests__/index.integration.test.js
 * لاختبار تلك الثغرة عند مصدرها).
 *
 * القاعدة المموَّهة أدناه تُطبِّق فلترة .eq()/.in() فعلية على مصفوفة صفوف حقيقية
 * (لا قيمة .limit() معلَّبة بلا علاقة بوسائط الاستدعاء) — يثبت الاختبار سلوك
 * الاستعلام الفعلي المُرسَل، لا مجرد أن دالة استُدعيت بوسائط معيّنة.
 */

let dbRows = [];

function buildOrdersQuery() {
    let rows = dbRows;
    const builder = {
        select: () => builder,
        eq: (col, val) => {
            rows = rows.filter((r) => r[col] === val);
            return builder;
        },
        in: (col, vals) => {
            rows = rows.filter((r) => vals.includes(r[col]));
            return builder;
        },
        limit: async (n) => ({ data: rows.slice(0, n), error: null }),
    };
    return builder;
}

const getAuthUserMock = vi.fn(async () => ({ user: { id: 'u1' } }));
const fromMock = vi.fn(() => buildOrdersQuery());

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: { from: fromMock } })),
    getAuthUser: (...a) => getAuthUserMock(...a),
}));

beforeEach(() => {
    getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' } });
    dbRows = [];
});

describe('hasActivePayment — دفاع متعمّق: صف orders.status=paid بtier غير مدفوع لا يفتح البوابة', () => {
    it("صف paid بtier='free' (محاكاة مباشرة لحالة قاعدة بيانات، بمعزل تام عن create-checkout) ⇒ false", async () => {
        dbRows = [{ id: 'order-1', study_id: 'study-1', status: 'paid', tier: 'free' }];
        const { hasActivePayment } = await import('../PaymentService.js');
        expect(await hasActivePayment('study-1')).toBe(false);
    });

    it("صف paid بtier='self' (الباقة الحقيقية الأرخص، 299 ريال) ⇒ true — الفلتر لا يحجب دفعاً شرعياً", async () => {
        dbRows = [{ id: 'order-1', study_id: 'study-1', status: 'paid', tier: 'self' }];
        const { hasActivePayment } = await import('../PaymentService.js');
        expect(await hasActivePayment('study-1')).toBe(true);
    });

    it("صف paid بtier='reviewed' لدراسة أخرى لا يفتح بوابة دراسة الضحية (study_id مختلف) ⇒ false", async () => {
        dbRows = [{ id: 'order-1', study_id: 'study-OTHER', status: 'paid', tier: 'reviewed' }];
        const { hasActivePayment } = await import('../PaymentService.js');
        expect(await hasActivePayment('study-1')).toBe(false);
    });

    it("[إثبات الحارس] المنطق الأصلي — .eq('status','paid') بلا أي .in('tier', ...) — كان سيمنح وصولاً لنفس صف tier='free'", () => {
        const rows = [{ id: 'order-1', study_id: 'study-1', status: 'paid', tier: 'free' }];
        // إعادة إنتاج حرفية لاستعلام hasActivePayment كما كان قبل هذا الإصلاح:
        // .from('orders').select('id').eq('study_id', studyId).eq('status', 'paid').limit(1)
        const matchedByOldLogic = rows
            .filter((r) => r.study_id === 'study-1')
            .filter((r) => r.status === 'paid')
            .slice(0, 1);
        // العطل: صف بtier='free' غير حقيقي كان يُعتبر "دفعاً فعلياً" — بالضبط ما يمنعه
        // .in('tier', PAID_TIERS) في الكود المُصلَح أعلاه.
        expect(matchedByOldLogic.length).toBe(1);
    });
});

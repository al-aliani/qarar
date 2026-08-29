/**
 * تدقيق 2026-08-27: reviewer_notes يُكتب فعلياً في reviewer-submit (Edge Function)
 * عند رفض المراجع للدراسة، لكن getReviewStatus لم يكن يستعلم عنه إطلاقاً —
 * فالعميل الذي دفع 1,999 ريال لباقة "مراجَع بخبير" ورأى شارة "أعاد المراجع
 * الدراسة مع ملاحظات" لا يرى الملاحظات نفسها في أي مكان بالموقع.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// PaymentService.js استوردت monitoring.js حديثاً (بلوكر مراقبة 2026-08-29) — بلا هذا
// التمويه، سطر _init() في monitoring.js يقرأ window.location مباشرة ويكسر أي اختبار
// يعمل ببيئة node الافتراضية (لا jsdom) بمجرد استيراد PaymentService.js.
vi.mock('../../utils/monitoring.js', () => ({
    monitoring: { captureException: vi.fn() },
}));

const getAuthUserMock = vi.fn(async () => ({ user: { id: 'u1' } }));
const maybeSingleMock = vi.fn();
const chain = {
    select: vi.fn(function () { return this; }),
    eq: vi.fn(function () { return this; }),
    order: vi.fn(function () { return this; }),
    limit: vi.fn(function () { return this; }),
    maybeSingle: (...a) => maybeSingleMock(...a),
};
const fromMock = vi.fn(() => chain);

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: { from: fromMock } })),
    getAuthUser: (...a) => getAuthUserMock(...a),
}));

describe('getReviewStatus — reviewer_notes يصل للعميل', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAuthUserMock.mockResolvedValue({ user: { id: 'u1' } });
    });

    it('select() يطلب reviewer_notes صراحة', async () => {
        maybeSingleMock.mockResolvedValue({ data: null, error: null });
        const { getReviewStatus } = await import('../PaymentService.js');
        await getReviewStatus('study-1');
        expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('reviewer_notes'));
    });

    it('طلب rejected بملاحظات حقيقية ⇒ reviewerNotes تُعاد للمستدعي', async () => {
        maybeSingleMock.mockResolvedValue({
            data: { review_status: 'rejected', certificate_id: null, reviewed_at: '2026-08-20', reviewer_notes: 'الافتراضات المالية غير واقعية — راجع تكلفة الإيجار.' },
            error: null,
        });
        const { getReviewStatus } = await import('../PaymentService.js');
        const result = await getReviewStatus('study-1');
        expect(result.reviewerNotes).toBe('الافتراضات المالية غير واقعية — راجع تكلفة الإيجار.');
    });

    it('طلب certified بلا ملاحظات ⇒ reviewerNotes تبقى null بلا كسر', async () => {
        maybeSingleMock.mockResolvedValue({
            data: { review_status: 'certified', certificate_id: 'CERT-1', reviewed_at: '2026-08-20', reviewer_notes: null },
            error: null,
        });
        const { getReviewStatus } = await import('../PaymentService.js');
        const result = await getReviewStatus('study-1');
        expect(result.reviewerNotes).toBeNull();
        expect(result.certificateId).toBe('CERT-1');
    });
});

/**
 * تدقيق 2026-08-27: reviewer_notes الآن تصل من PaymentService.getReviewStatus
 * (انظر paymentService.reviewerNotes.test.js) — هذا الحارس يثبّت أن الواجهة
 * تعرضها فعلياً بدل أن تكتفي بجلبها ولا تستهلكها.
 */
import { describe, it, expect, vi } from 'vitest';

const getReviewStatusMock = vi.fn();
vi.mock('../../../services/PaymentService.js', () => ({
    getReviewStatus: (...a) => getReviewStatusMock(...a),
}));

describe('renderReviewStatusBadge — يعرض ملاحظات المراجع عند الرفض', () => {
    it('rejected + ملاحظات موجودة ⇒ الملاحظات تظهر حرفياً في HTML الشارة', async () => {
        getReviewStatusMock.mockResolvedValue({
            reviewStatus: 'rejected',
            certificateId: null,
            reviewedAt: '2026-08-20',
            reviewerNotes: 'الافتراضات المالية غير واقعية — راجع تكلفة الإيجار.',
        });
        const { renderReviewStatusBadge } = await import('../ReviewStatusBadge.js');
        const html = await renderReviewStatusBadge('study-1');
        expect(html).toContain('الافتراضات المالية غير واقعية');
        expect(html).toContain('review-badge__notes');
        expect(html).toContain('أعاد المراجع الدراسة مع ملاحظات');
    });

    it('rejected بلا ملاحظات (null) ⇒ الشارة وحدها بلا فقرة ملاحظات فارغة', async () => {
        getReviewStatusMock.mockResolvedValue({
            reviewStatus: 'rejected',
            certificateId: null,
            reviewedAt: '2026-08-20',
            reviewerNotes: null,
        });
        const { renderReviewStatusBadge } = await import('../ReviewStatusBadge.js');
        const html = await renderReviewStatusBadge('study-1');
        expect(html).not.toContain('review-badge__notes');
    });

    it('certified ⇒ لا فقرة ملاحظات حتى لو وُجد نص reviewer_notes قديم', async () => {
        getReviewStatusMock.mockResolvedValue({
            reviewStatus: 'certified',
            certificateId: 'CERT-9',
            reviewedAt: '2026-08-20',
            reviewerNotes: 'ملاحظة داخلية سابقة لا تخص القرار النهائي',
        });
        const { renderReviewStatusBadge } = await import('../ReviewStatusBadge.js');
        const html = await renderReviewStatusBadge('study-1');
        expect(html).not.toContain('review-badge__notes');
        expect(html).toContain('CERT-9');
    });

    it('نص الملاحظات يمر عبر escapeHtml (لا حقن HTML من مدخلات المراجع)', async () => {
        getReviewStatusMock.mockResolvedValue({
            reviewStatus: 'rejected',
            certificateId: null,
            reviewedAt: '2026-08-20',
            reviewerNotes: '<img src=x onerror=alert(1)>',
        });
        const { renderReviewStatusBadge } = await import('../ReviewStatusBadge.js');
        const html = await renderReviewStatusBadge('study-1');
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
    });

    it('لا طلب مراجعة أصلاً (null) ⇒ سلسلة فارغة كما كان', async () => {
        getReviewStatusMock.mockResolvedValue(null);
        const { renderReviewStatusBadge } = await import('../ReviewStatusBadge.js');
        expect(await renderReviewStatusBadge('study-1')).toBe('');
    });
});

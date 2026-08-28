/**
 * ReviewStatusBadge — مؤشّر صغير للعميل بحالة مراجعة الخبير لدراسته الحالية
 * (2026-07-13). قبل هذه الميزة، بعد دفع 990 ريال لباقة "مراجَع بخبير" لا
 * يرى العميل أي أثر داخل الموقع — فقط رسالة واتساب. هذه دالة عرض بسيطة
 * (لا كلاس) تُستهلَك من أي واجهة تعرض حالة تصدير الدراسة (مثل ExportMenu.js
 * أو بطاقة الدراسة في DashboardView.js).
 */
import { getReviewStatus } from '../../services/PaymentService.js';
import { escapeHtml } from '../../utils/escape.js';

const STATUS_LABELS = {
    none: null, // لا يوجد طلب "مراجَع بخبير" لهذه الدراسة أصلاً — لا نعرض شيئاً
    queued: { text: 'قيد الانتظار في طابور المراجعين', cls: 'review-badge review-badge--queued' },
    in_review: { text: 'قيد المراجعة من خبير', cls: 'review-badge review-badge--in-review' },
    certified: { text: 'معتمدة من مراجع خبير ✓', cls: 'review-badge review-badge--certified' },
    rejected: { text: 'أعاد المراجع الدراسة مع ملاحظات', cls: 'review-badge review-badge--rejected' },
};

/**
 * يبني HTML الشارة لدراسة معيّنة، أو سلسلة فارغة إن لم يوجد طلب مراجعة أصلاً.
 * @param {string} studyId
 * @returns {Promise<string>}
 */
export async function renderReviewStatusBadge(studyId) {
    const status = await getReviewStatus(studyId);
    if (!status) return '';

    const meta = STATUS_LABELS[status.reviewStatus];
    if (!meta) return '';

    const certText = status.certificateId ? ` — رقم الشهادة ${escapeHtml(status.certificateId)}` : '';
    const badge = `<span class="${meta.cls}" title="${escapeHtml(meta.text)}${certText}">${escapeHtml(meta.text)}${status.reviewStatus === 'certified' ? certText : ''}</span>`;

    // تدقيق 2026-08-27: النص أعلاه يَعِد العميل بـ«ملاحظات» عند rejected، لكن
    // reviewer_notes (تُكتب فعلياً في reviewer-submit) لم تكن تصل لأي واجهة قط —
    // العميل يدفع 1,999 ريال ولا يرى سبب إعادة دراسته. تُعرض هنا فقط لهذه الحالة.
    if (status.reviewStatus === 'rejected' && status.reviewerNotes) {
        return `<div class="review-badge-wrap">${badge}<p class="review-badge__notes">${escapeHtml(status.reviewerNotes)}</p></div>`;
    }
    return badge;
}

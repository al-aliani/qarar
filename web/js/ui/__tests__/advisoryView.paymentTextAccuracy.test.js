/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-09-16 (قرار مالك المنتج: "تصحيح" أولاً، ثم دفع فعلي لاحقاً): نص تعريف صفحة
 * طلب الاستشارة كان يقول "سيتحول الطلب إلى سجل يمكنك متابعته والدفع عليه داخل المنصة" —
 * وهذا غير صحيح. submitConsultationRequest (ConsultationService.js) لا يستدعي أي بوابة
 * دفع إطلاقاً؛ الطلب يُدرَج في consultation_requests بحالة "submitted"/"unpaid" فقط،
 * ولا يوجد أي مسار دفع داخل المنصة لطلبات الاستشارة حالياً (بخلاف الاشتراكات) — التسعير
 * والدفع الفعلي يتمّان يدوياً خارج التطبيق بعد تواصل الفريق مع العميل. النص القديم يَعِد
 * المستخدم بتجربة دفع ذاتية داخل المنصة غير موجودة أصلاً.
 *
 * الإصلاح: النص الآن يصف الواقع فقط — سجل قابل للمتابعة، ومراجعة وتواصل من الفريق لتأكيد
 * التفاصيل وطريقة الدفع — بلا أي وعد بمسار دفع ذاتي داخل المنصة لم يُبنَ بعد.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/ConsultationService.js', () => ({
    submitConsultationRequest: vi.fn(),
    listMyConsultations: vi.fn(async () => [])
}));

const { AdvisoryView } = await import('../AdvisoryView.js');

function fakeStore(state = {}) {
    return { getState: () => state };
}

describe('AdvisoryView — نص المقدمة لا يَعِد بدفع داخل المنصة غير موجود', () => {
    it('لا يحتوي على العبارة المضلِّلة القديمة "والدفع عليه داخل المنصة"', async () => {
        document.body.innerHTML = '<div id="advisoryContainer"></div>';
        const view = new AdvisoryView('advisoryContainer', fakeStore());
        await view.render();

        const intro = document.querySelector('.advisory-view p.text-muted');
        expect(intro.textContent).not.toContain('والدفع عليه داخل المنصة');
    });

    it('يصف بدقة أن الفريق سيراجع الطلب ويتواصل لتأكيد التفاصيل وطريقة الدفع', async () => {
        document.body.innerHTML = '<div id="advisoryContainer"></div>';
        const view = new AdvisoryView('advisoryContainer', fakeStore());
        await view.render();

        const intro = document.querySelector('.advisory-view p.text-muted');
        expect(intro.textContent).toContain('سجل يمكنك متابعته');
        expect(intro.textContent).toContain('يتواصل معك لتأكيد التفاصيل وطريقة الدفع');
    });
});

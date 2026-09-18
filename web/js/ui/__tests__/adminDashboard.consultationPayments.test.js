/**
 * @vitest-environment jsdom
 *
 * دفع فعلي لطلبات الاستشارة (2026-09-16) — تبويب إداري جديد "دفعات الاستشارات"
 * يسرد طلبات الاستشارة غير المدفوعة بانتظار تأكيد وصول حوالة بنكية، ويؤكّدها الأدمن
 * (نفس نمط تبويب "التحويلات البنكية" الحالي لكن على consultation_requests بدل orders).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../middleware/AuthGuard.js', () => ({ AuthGuard: { isAdmin: vi.fn() } }));
vi.mock('../../utils/toast.js', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../services/ReviewsService.js', () => ({}));
vi.mock('../../services/TicketService.js', () => ({ getOpenTicketsCount: vi.fn(async () => 0) }));
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('../../services/AdminService.js', () => ({
    getPendingConsultationBankTransfers: vi.fn(),
    confirmConsultationBankTransfer: vi.fn(),
}));

const { AdminDashboardView } = await import('../AdminDashboardView.js');
const AdminService = await import('../../services/AdminService.js');
const { toast } = await import('../../utils/toast.js');

function pendingRow(overrides = {}) {
    return {
        request_id: 'req-uuid-1234',
        consultant_level: 'advisor',
        specialty: 'مالي',
        sector: 'تجارة',
        amount_sar: 990,
        study_id: null,
        created_at: '2026-09-16T10:00:00.000Z',
        ...overrides
    };
}

describe('AdminDashboardView — تبويب دفعات الاستشارات', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="admin"></div>';
        vi.clearAllMocks();
    });

    it('لا طلبات معلّقة: حالة فارغة واضحة', async () => {
        AdminService.getPendingConsultationBankTransfers.mockResolvedValue({ ok: true, data: [] });
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderConsultationPaymentsTab(content);

        expect(content.textContent).toContain('لا توجد طلبات استشارة غير مدفوعة حالياً');
        expect(content.querySelector('.consult-bank-confirm-btn')).toBeNull();
    });

    it('طلب معلّق: يعرض المستوى/المجال/القطاع/المبلغ وزر تأكيد', async () => {
        AdminService.getPendingConsultationBankTransfers.mockResolvedValue({ ok: true, data: [pendingRow()] });
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderConsultationPaymentsTab(content);

        expect(content.textContent).toContain('استشاري');
        expect(content.textContent).toContain('مالي');
        expect(content.textContent).toContain('تجارة');
        expect(content.textContent).toContain('990');
        const btn = content.querySelector('.consult-bank-confirm-btn');
        expect(btn).not.toBeNull();
        expect(btn.dataset.request).toBe('req-uuid-1234');
    });

    it('تأكيد ناجح: يستدعي confirmConsultationBankTransfer بالمعرّف الصحيح ويعيد تحميل القائمة', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        AdminService.getPendingConsultationBankTransfers
            .mockResolvedValueOnce({ ok: true, data: [pendingRow()] })
            .mockResolvedValueOnce({ ok: true, data: [] });
        AdminService.confirmConsultationBankTransfer.mockResolvedValue({ ok: true });

        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderConsultationPaymentsTab(content);

        content.querySelector('.consult-bank-confirm-btn').click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(AdminService.confirmConsultationBankTransfer).toHaveBeenCalledWith('req-uuid-1234');
        expect(toast.success).toHaveBeenCalled();
        expect(content.textContent).toContain('لا توجد طلبات استشارة غير مدفوعة حالياً');

        window.confirm.mockRestore();
    });

    it('رفض التأكيد في نافذة window.confirm: لا يستدعي confirmConsultationBankTransfer إطلاقاً', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        AdminService.getPendingConsultationBankTransfers.mockResolvedValue({ ok: true, data: [pendingRow()] });

        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderConsultationPaymentsTab(content);

        content.querySelector('.consult-bank-confirm-btn').click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(AdminService.confirmConsultationBankTransfer).not.toHaveBeenCalled();
        window.confirm.mockRestore();
    });

    it('فشل التأكيد: رسالة خطأ، والزر يعود قابلاً للنقر من جديد', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        AdminService.getPendingConsultationBankTransfers.mockResolvedValue({ ok: true, data: [pendingRow()] });
        AdminService.confirmConsultationBankTransfer.mockResolvedValue({ ok: false, error: 'فشل التأكيد' });

        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderConsultationPaymentsTab(content);

        const btn = content.querySelector('.consult-bank-confirm-btn');
        btn.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(toast.error).toHaveBeenCalledWith('فشل التأكيد');
        expect(btn.disabled).toBe(false);
        window.confirm.mockRestore();
    });
});

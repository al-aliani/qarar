/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-09-17: تبويب "التحويلات البنكية" (تأكيد وصول حوالة بنكية يدوياً — يفتح
 * التصدير للعميل فوراً) كان بلا أي اختبار على أي مستوى رغم أنه الإجراء الوحيد في لوحة
 * الأدمن بأثر مالي حقيقي ولا رجعة فيه عملياً. هذا الملف يغطي: العرض الطبيعي، الحالة
 * الفارغة، حالة الخطأ، ومسار التأكيد الكامل (نافذة تأكيد Swal ← نجاح ← إعادة رسم،
 * وإلغاء ← لا نداء خدمة، وفشل الخدمة ← رسالة خطأ وإعادة تفعيل الزر).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../middleware/AuthGuard.js', () => ({ AuthGuard: { isAdmin: vi.fn() } }));
vi.mock('../../utils/toast.js', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../services/ReviewsService.js', () => ({}));
vi.mock('../../services/TicketService.js', () => ({
    getOpenTicketsCount: vi.fn(async () => 0),
    listAllTickets: vi.fn(async () => []),
}));
vi.mock('apexcharts', () => ({ default: class { destroy() {} render() { return Promise.resolve(); } } }));

const swalFireMock = vi.fn();
vi.mock('sweetalert2', () => ({ default: { fire: (...args) => swalFireMock(...args) } }));

vi.mock('../../services/AdminService.js', () => ({
    getPendingBankTransfers: vi.fn(),
    confirmBankTransfer: vi.fn(),
}));

const { AdminDashboardView } = await import('../AdminDashboardView.js');
const AdminService = await import('../../services/AdminService.js');
const { toast } = await import('../../utils/toast.js');

const TRANSFER = {
    order_id: 'order-abcdef123456',
    study_title: 'دراسة جدوى مطعم',
    tier: 'reviewed',
    amount_sar: 1999,
    created_at: '2026-09-10T00:00:00Z',
};

describe('AdminDashboardView — التحويلات البنكية', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="admin"></div>';
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('يعرض التحويلات المعلّقة بالباقة والمبلغ المنسّقين', async () => {
        AdminService.getPendingBankTransfers.mockResolvedValue({ ok: true, data: [TRANSFER] });
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderBankTransfersTab(content);

        expect(content.textContent).toContain('دراسة جدوى مطعم');
        expect(content.textContent).toContain('مراجَع بخبير');
        expect(content.textContent).toContain('1,999');
        expect(content.querySelector('.bank-confirm-btn')).not.toBeNull();
    });

    it('لا توجد تحويلات معلّقة ⇒ رسالة حالة فارغة بلا جدول', async () => {
        AdminService.getPendingBankTransfers.mockResolvedValue({ ok: true, data: [] });
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderBankTransfersTab(content);

        expect(content.textContent).toContain('لا توجد تحويلات بنكية معلّقة حالياً');
        expect(content.querySelector('.bank-confirm-btn')).toBeNull();
    });

    it('فشل الجلب ⇒ رسالة خطأ واضحة', async () => {
        AdminService.getPendingBankTransfers.mockResolvedValue({ ok: false, error: 'not authorized' });
        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderBankTransfersTab(content);

        expect(content.textContent).toContain('تعذّر تحميل التحويلات البنكية');
        expect(content.textContent).toContain('not authorized');
    });

    it('تأكيد وصول الحوالة (بعد موافقة نافذة Swal) يستدعي confirmBankTransfer برقم الطلب الصحيح ويعيد الرسم', async () => {
        AdminService.getPendingBankTransfers.mockResolvedValue({ ok: true, data: [TRANSFER] });
        AdminService.confirmBankTransfer.mockResolvedValue({ ok: true });
        swalFireMock.mockResolvedValue({ isConfirmed: true });

        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderBankTransfersTab(content);

        content.querySelector('.bank-confirm-btn').click();
        await vi.waitFor(() => expect(AdminService.confirmBankTransfer).toHaveBeenCalledWith('order-abcdef123456'));

        expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning' }));
        expect(toast.success).toHaveBeenCalled();
        // إعادة الرسم بعد النجاح: getPendingBankTransfers استُدعيت مرتين (العرض الأول + بعد التأكيد)
        expect(AdminService.getPendingBankTransfers).toHaveBeenCalledTimes(2);
    });

    it('إلغاء نافذة التأكيد ⇒ لا يُستدعى confirmBankTransfer إطلاقاً', async () => {
        AdminService.getPendingBankTransfers.mockResolvedValue({ ok: true, data: [TRANSFER] });
        swalFireMock.mockResolvedValue({ isConfirmed: false });

        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderBankTransfersTab(content);

        const btn = content.querySelector('.bank-confirm-btn');
        btn.click();
        await vi.waitFor(() => expect(swalFireMock).toHaveBeenCalled());

        expect(AdminService.confirmBankTransfer).not.toHaveBeenCalled();
        expect(btn.disabled).toBe(false);
    });

    it('فشل confirmBankTransfer ⇒ toast خطأ وإعادة تفعيل الزر بنصه الأصلي', async () => {
        AdminService.getPendingBankTransfers.mockResolvedValue({ ok: true, data: [TRANSFER] });
        AdminService.confirmBankTransfer.mockResolvedValue({ ok: false, error: 'انتهت صلاحية الطلب' });
        swalFireMock.mockResolvedValue({ isConfirmed: true });

        const view = new AdminDashboardView('admin');
        const content = document.getElementById('admin');
        await view._renderBankTransfersTab(content);

        const btn = content.querySelector('.bank-confirm-btn');
        btn.click();
        await vi.waitFor(() => expect(AdminService.confirmBankTransfer).toHaveBeenCalled());

        expect(toast.error).toHaveBeenCalledWith('انتهت صلاحية الطلب');
        expect(btn.disabled).toBe(false);
        expect(btn.textContent).toBe('تأكيد وصول الحوالة');
    });
});

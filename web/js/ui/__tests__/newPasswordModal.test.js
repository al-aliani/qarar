/**
 * @vitest-environment jsdom
 *
 * NewPasswordModal — نافذة تعيين كلمة مرور جديدة عند اكتشاف حدث PASSWORD_RECOVERY
 * (انظر authGuard.passwordRecoveryAndAudit.test.js). تثبت هذه الاختبارات أن الواجهة
 * فعلياً تتحقق من تطابق كلمتي المرور، وتستدعي updatePassword() الحقيقية عند النجاح.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const updatePasswordMock = vi.fn(async () => ({ ok: true }));
vi.mock('../../../supabaseClient.js', () => ({
    updatePassword: (...args) => updatePasswordMock(...args)
}));
vi.mock('../../utils/toast.js', () => ({
    toast: { success: vi.fn(), error: vi.fn() }
}));

describe('NewPasswordModal', () => {
    beforeEach(() => {
        updatePasswordMock.mockClear();
        document.body.innerHTML = '';
    });

    it('يعرض النموذج فعلياً في الـ DOM عند open()', async () => {
        const { NewPasswordModal } = await import('../NewPasswordModal.js');
        const modal = new NewPasswordModal();
        modal.open();
        expect(document.getElementById('newPasswordModalOverlay')).not.toBeNull();
        expect(document.getElementById('newPassword1')).not.toBeNull();
        expect(document.getElementById('newPassword2')).not.toBeNull();
    });

    it('كلمتا مرور غير متطابقتين: يعرض خطأ ولا يستدعي updatePassword', async () => {
        const { NewPasswordModal } = await import('../NewPasswordModal.js');
        const modal = new NewPasswordModal();
        modal.open();
        document.getElementById('newPassword1').value = 'Str0ng!Pass';
        document.getElementById('newPassword2').value = 'Different1!';
        document.getElementById('newPasswordForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 0));

        expect(updatePasswordMock).not.toHaveBeenCalled();
        const err = document.getElementById('newPasswordError');
        expect(err.style.display).toBe('block');
        expect(err.textContent).toContain('غير متطابقتين');
    });

    it('كلمة مرور ضعيفة (بلا رمز): يعرض خطأ تحقق ولا يستدعي updatePassword', async () => {
        const { NewPasswordModal } = await import('../NewPasswordModal.js');
        const modal = new NewPasswordModal();
        modal.open();
        document.getElementById('newPassword1').value = 'password1';
        document.getElementById('newPassword2').value = 'password1';
        document.getElementById('newPasswordForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 0));

        expect(updatePasswordMock).not.toHaveBeenCalled();
        expect(document.getElementById('newPasswordError').textContent).toContain('رمزاً');
    });

    it('كلمة مرور صحيحة ومتطابقة: يستدعي updatePassword ويُغلق النافذة عند النجاح', async () => {
        const { NewPasswordModal } = await import('../NewPasswordModal.js');
        const modal = new NewPasswordModal();
        modal.open();
        document.getElementById('newPassword1').value = 'Str0ng!Pass';
        document.getElementById('newPassword2').value = 'Str0ng!Pass';
        document.getElementById('newPasswordForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 0));

        expect(updatePasswordMock).toHaveBeenCalledWith('Str0ng!Pass');
        expect(document.getElementById('newPasswordModalOverlay')).toBeNull();
    });

    it('فشل updatePassword: يعرض رسالة الخطأ ولا يُغلق النافذة', async () => {
        updatePasswordMock.mockResolvedValueOnce({ ok: false, error: 'خطأ من الخادم' });
        const { NewPasswordModal } = await import('../NewPasswordModal.js');
        const modal = new NewPasswordModal();
        modal.open();
        document.getElementById('newPassword1').value = 'Str0ng!Pass';
        document.getElementById('newPassword2').value = 'Str0ng!Pass';
        document.getElementById('newPasswordForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 0));

        expect(document.getElementById('newPasswordModalOverlay')).not.toBeNull();
        expect(document.getElementById('newPasswordError').textContent).toContain('خطأ من الخادم');
    });
});

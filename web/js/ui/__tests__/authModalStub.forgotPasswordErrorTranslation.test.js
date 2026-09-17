/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16: مسار "نسيت كلمة المرور" كان يعرض error الخام من Supabase
 * (مثال حرفي: "For security purposes, you can only request this after 42 seconds")
 * رغم وجود translateResendError بالضبط لهذا النمط في مسار شقيق (إعادة إرسال رابط
 * التأكيد) بنفس الملف — لم يكن مطبَّقاً هنا. نفس نمط موك authModalStub.errorTranslationAndGoogleIcon.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const resetPasswordForEmailMock = vi.fn(async () => ({
    error: { message: 'For security purposes, you can only request this after 42 seconds.' },
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: { resetPasswordForEmail: resetPasswordForEmailMock },
    })),
}));

async function waitUntil(predicate, { timeout = 2000, interval = 10 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) throw new Error('waitUntil: timed out');
        await new Promise((r) => setTimeout(r, interval));
    }
}

describe('AuthModalStub — ترجمة خطأ "نسيت كلمة المرور"', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        resetPasswordForEmailMock.mockClear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('رسالة rate-limit الخام لا تظهر إطلاقاً — تظهر رسالة عربية بدلاً منها', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();

        modal.overlay.querySelector('#authBtnForgotPassword').click();
        modal.overlay.querySelector('#authForgotEmail').value = 'a@b.com';
        modal.overlay.querySelector('#authBtnSendReset').click();

        await waitUntil(() => modal.overlay.querySelector('#authForgotMessage')?.textContent);

        const msg = modal.overlay.querySelector('#authForgotMessage').textContent;
        expect(msg).not.toContain('security purposes');
        expect(msg).toContain('انتظر قليلاً');
    });
});

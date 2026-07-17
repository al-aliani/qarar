/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-17: نافذة الدخول كانت تعرض حقول الاسم/الجوال (غير مطلوبة إلا عند
 * إنشاء حساب) دائماً بجانب البريد/كلمة المرور — لا فصل واضح بين دخول وتسجيل. أُضيف
 * تبويبان (دخول/إنشاء حساب) يتحكمان بإظهار الحقول الإضافية وأي زر إجراء أساسي ظاهر،
 * وبأي دالة (runAuth(true/false)) يُوجَّه إليها إرسال النموذج (Enter/submit).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInWithPasswordMock = vi.fn(async () => ({ data: { user: { email: 'a@b.com' } }, error: null }));
const signUpSdkMock = vi.fn(async () => ({ data: { user: { email: 'a@b.com' } }, error: null }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: { signInWithPassword: signInWithPasswordMock, signUp: signUpSdkMock },
    })),
}));

async function waitUntil(predicate, { timeout = 2000, interval = 10 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) throw new Error('waitUntil: timed out');
        await new Promise((r) => setTimeout(r, interval));
    }
}

describe('AuthModalStub — تبويبا دخول/إنشاء حساب', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        signInWithPasswordMock.mockClear();
        signUpSdkMock.mockClear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('الحالة الافتراضية: تبويب "دخول" نشط، حقلا الاسم/الجوال مخفيان، زر الدخول فقط ظاهر', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();

        expect(modal.overlay.querySelector('#authTabSignIn').getAttribute('aria-selected')).toBe('true');
        expect(modal.overlay.querySelector('#authTabSignUp').getAttribute('aria-selected')).toBe('false');
        expect(modal.overlay.querySelector('#authNameGroup').style.display).toBe('none');
        expect(modal.overlay.querySelector('#authPhoneGroup').style.display).toBe('none');
        expect(modal.overlay.querySelector('#authBtnSignIn').style.display).not.toBe('none');
        expect(modal.overlay.querySelector('#authBtnSignUp').style.display).toBe('none');
    });

    it('النقر على تبويب "إنشاء حساب": يُظهر الاسم/الجوال وزر الإنشاء، ويُخفي زر الدخول', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();

        modal.overlay.querySelector('#authTabSignUp').click();

        expect(modal.overlay.querySelector('#authTabSignUp').getAttribute('aria-selected')).toBe('true');
        expect(modal.overlay.querySelector('#authTabSignIn').getAttribute('aria-selected')).toBe('false');
        expect(modal.overlay.querySelector('#authNameGroup').style.display).toBe('block');
        expect(modal.overlay.querySelector('#authPhoneGroup').style.display).toBe('block');
        expect(modal.overlay.querySelector('#authBtnSignIn').style.display).toBe('none');
        expect(modal.overlay.querySelector('#authBtnSignUp').style.display).not.toBe('none');
    });

    it('الرجوع لتبويب "دخول" بعد "إنشاء حساب": يُخفي الحقول الإضافية مجدداً', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();

        modal.overlay.querySelector('#authTabSignUp').click();
        modal.overlay.querySelector('#authTabSignIn').click();

        expect(modal.overlay.querySelector('#authNameGroup').style.display).toBe('none');
        expect(modal.overlay.querySelector('#authPhoneGroup').style.display).toBe('none');
        expect(modal.overlay.querySelector('#authBtnSignIn').style.display).not.toBe('none');
        expect(modal.overlay.querySelector('#authBtnSignUp').style.display).toBe('none');
    });

    it('Enter/submit على تبويب "دخول": يستدعي signIn لا signUp', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();

        modal.overlay.querySelector('#authEmail').value = 'a@b.com';
        modal.overlay.querySelector('#authPassword').value = 'Str0ng!Pass1';
        modal.overlay.querySelector('#authModalForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => signInWithPasswordMock.mock.calls.length > 0);

        expect(signInWithPasswordMock).toHaveBeenCalledTimes(1);
        expect(signUpSdkMock).not.toHaveBeenCalled();
    });

    it('Enter/submit بعد التبديل لتبويب "إنشاء حساب": يستدعي signUp لا signIn', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();

        modal.overlay.querySelector('#authTabSignUp').click();
        modal.overlay.querySelector('#authEmail').value = 'a@b.com';
        modal.overlay.querySelector('#authPassword').value = 'Str0ng!Pass1';
        modal.overlay.querySelector('#authName').value = 'أحمد السالم';
        modal.overlay.querySelector('#authPhone').value = '0512345678';
        modal.overlay.querySelector('#authModalForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => signUpSdkMock.mock.calls.length > 0);

        expect(signUpSdkMock).toHaveBeenCalledTimes(1);
        expect(signInWithPasswordMock).not.toHaveBeenCalled();
    });
});

/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-09 (توحيد المصادقة):
 * (أ) 2FA (MFA) قابل للتفعيل عبر TwoFactorModal، لكن AuthModalStub.js (المسار الحي
 *     الوحيد لتسجيل الدخول) لم يكن يتحقق من AAL بعد نجاح كلمة المرور — منطق التحدي
 *     الوحيد عاش داخل AuthComponent.js الميت. بلا هذا التحقق، 2FA شكلية بلا إنفاذ.
 * (ب) auditLog(SIGNUP/OAUTH) لم يكن يُستدعى من هذه النافذة الحية إطلاقاً.
 *
 * ملاحظة منهجية: AuthModalStub.js يستدعي supabaseClient.js عبر import() ديناميكي —
 * محاولة vi.mock('.../supabaseClient.js') من ملف الاختبار لا تُعترَض بشكل موثوق هنا
 * (استيراد ديناميكي عابر لملفات مختلفة بمسارات نسبية مختلفة تُحلّل لنفس الملف على
 * هذا المسار الذي يحوي عربياً/مسافات). الحل الأكثر متانة: موك @supabase/supabase-js
 * (حزمة خارجية، تحليلها عبر node_modules غير متأثر بهذه العلة) — فتعمل signIn/signUp/
 * mfaGetAAL... الحقيقية غير المعدَّلة على عميل وهمي بالكامل تحت تحكمنا.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAuditLog, clearAuditLog } from '../../utils/auditLogger.js';

const signInWithPasswordMock = vi.fn(async () => ({ data: { user: { email: 'a@b.com' } }, error: null }));
const signUpSdkMock = vi.fn(async () => ({ data: { user: { email: 'a@b.com' } }, error: null }));
const signInWithOAuthSdkMock = vi.fn(async () => ({ data: { url: 'https://oauth.example/redirect' }, error: null }));
const getAALMock = vi.fn(async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }));
const listFactorsMock = vi.fn(async () => ({ data: { totp: [] }, error: null }));
const challengeAndVerifyMock = vi.fn(async () => ({ data: {}, error: null }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: {
            signInWithPassword: signInWithPasswordMock,
            signUp: signUpSdkMock,
            signInWithOAuth: signInWithOAuthSdkMock,
            mfa: {
                getAuthenticatorAssuranceLevel: getAALMock,
                listFactors: listFactorsMock,
                challengeAndVerify: challengeAndVerifyMock
            }
        }
    }))
}));

// انتظار فعلي حتى استقرار الحالة (لا مهلة ثابتة هشة تحت حمل موازٍ عالٍ عند تشغيل
// الحزمة كاملة — لوحظ فشل متقطّع لهذا الاختبار تحديداً بسبب ذلك).
async function waitUntil(predicate, { timeout = 2000, interval = 10 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) throw new Error('waitUntil: timed out');
        await new Promise((r) => setTimeout(r, interval));
    }
}

async function fillAndSubmit(overlay, { email = 'a@b.com', password = 'Str0ng!Pass1', signUp = false } = {}) {
    overlay.querySelector('#authEmail').value = email;
    overlay.querySelector('#authPassword').value = password;
    if (signUp) {
        overlay.querySelector('#authBtnSignUp').click();
        await waitUntil(() => signUpSdkMock.mock.calls.length > 0 || overlay.querySelector('#authModalError')?.textContent);
    } else {
        overlay.querySelector('#authModalForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => signInWithPasswordMock.mock.calls.length > 0 || overlay.querySelector('#authModalError')?.textContent);
    }
    // اترك دورة إضافية قصيرة لأي معالجة تالية (تحدي 2FA أو إغلاق النافذة)
    await new Promise((r) => setTimeout(r, 20));
}

describe('AuthModalStub — تحدي 2FA (AAL) + auditLog للتسجيل/OAuth', () => {
    beforeEach(() => {
        signInWithPasswordMock.mockClear();
        signUpSdkMock.mockClear();
        signInWithOAuthSdkMock.mockClear();
        getAALMock.mockClear();
        listFactorsMock.mockClear();
        challengeAndVerifyMock.mockClear();
        getAALMock.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null });
        document.body.innerHTML = '';
        clearAuditLog();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('دخول عادي بلا 2FA مفعّلة: ينجح مباشرة دون عرض لوحة الرمز', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const onSuccess = vi.fn();
        const modal = new AuthModal('c', { onSuccess });
        modal.open();
        await fillAndSubmit(modal.overlay);

        expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: 'a@b.com', password: 'Str0ng!Pass1' });
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(challengeAndVerifyMock).not.toHaveBeenCalled();
    });

    it('دخول بحساب مفعَّل 2FA: يعرض لوحة الرمز ولا ينجح قبل التحقق', async () => {
        getAALMock.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
        listFactorsMock.mockResolvedValue({ data: { totp: [{ id: 'factor-1' }] }, error: null });

        const { AuthModal } = await import('../AuthModalStub.js');
        const onSuccess = vi.fn();
        const modal = new AuthModal('c', { onSuccess });
        modal.open();
        await fillAndSubmit(modal.overlay);

        // النجاح لا يُستدعى بعد — بانتظار رمز 2FA
        expect(onSuccess).not.toHaveBeenCalled();
        const mfaPanel = modal.overlay.querySelector('#authModalMfaPanel');
        expect(mfaPanel.style.display).toBe('block');

        // إدخال رمز صحيح
        modal.overlay.querySelector('#authMfaCode').value = '123456';
        modal.overlay.querySelector('#authMfaForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => onSuccess.mock.calls.length > 0);

        expect(challengeAndVerifyMock).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' });
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('رمز 2FA خاطئ: يعرض خطأ ولا يُنهي الدخول', async () => {
        getAALMock.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
        listFactorsMock.mockResolvedValue({ data: { totp: [{ id: 'factor-1' }] }, error: null });
        challengeAndVerifyMock.mockResolvedValueOnce({ data: null, error: { message: 'Invalid TOTP code' } });

        const { AuthModal } = await import('../AuthModalStub.js');
        const onSuccess = vi.fn();
        const modal = new AuthModal('c', { onSuccess });
        modal.open();
        await fillAndSubmit(modal.overlay);

        modal.overlay.querySelector('#authMfaCode').value = '000000';
        modal.overlay.querySelector('#authMfaForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => modal.overlay.querySelector('#authMfaError')?.textContent);

        expect(onSuccess).not.toHaveBeenCalled();
        expect(modal.overlay.querySelector('#authMfaError').textContent).toContain('Invalid TOTP code');
    });

    it('تسجيل حساب جديد (signUp) ناجح: يسجّل ACTIONS.SIGNUP في auditLog الحقيقي', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();
        await fillAndSubmit(modal.overlay, { signUp: true });

        expect(signUpSdkMock).toHaveBeenCalled();
        const entries = getAuditLog(5);
        expect(entries[0]).toMatchObject({ action: 'signup', email: 'a@b.com' });
        // signUp لا يمر بتحدي 2FA إطلاقاً (لا يوجد بعد عند إنشاء حساب جديد)
        expect(getAALMock).not.toHaveBeenCalled();
    });

    it('الدخول بـ Google: يسجّل ACTIONS.OAUTH في auditLog الحقيقي قبل التوجيه', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();
        modal.overlay.querySelector('#authBtnGoogle').click();
        await waitUntil(() => signInWithOAuthSdkMock.mock.calls.length > 0);

        const entries = getAuditLog(5);
        expect(entries[0]).toMatchObject({ action: 'oauth', provider: 'google' });
    });
});

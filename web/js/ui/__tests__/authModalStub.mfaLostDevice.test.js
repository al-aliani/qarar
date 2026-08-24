/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-08-24 (رموز استرداد 2FA): "فقدت جهاز المصادقة؟" داخل لوحة تحدي AAL2
 * في AuthModalStub.js — يستهلك رمز استرداد عبر mfa-recovery-unenroll (Edge Function)
 * ليحذف عامل TOTP إدارياً بلا حاجة لـAAL2 من نفس الجلسة، ثم يسجّل خروجاً محلياً
 * صريحاً (الخادم أسقط الجلسة فعلاً لأنه حذف عاملاً verified).
 *
 * ملاحظة منهجية (مطابقة لـauthModalStub.mfaAndAudit.test.js): لا نموك
 * '../services/MfaRecoveryService.js' مباشرة — استيراده هنا ديناميكي عبر مسار محلي
 * نسبي، وvi.mock لملفات محلية (لا حزم npm) لا يُعترَض بشكل موثوق على هذا المسار
 * (عربي/مسافات). بدلاً من ذلك نموك @supabase/supabase-js فقط (حزمة خارجية عبر
 * node_modules)، ونترك MfaRecoveryService.js/supabaseClient.js الحقيقيَّين يعملان
 * فوق عميل وهمي بالكامل تحت تحكمنا (بما فيه functions.invoke).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAALMock = vi.fn(async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null }));
const listFactorsMock = vi.fn(async () => ({ data: { totp: [{ id: 'factor-1' }] }, error: null }));
const signInWithPasswordMock = vi.fn(async () => ({ data: { user: { email: 'a@b.com' } }, error: null }));
const signOutSdkMock = vi.fn(async () => ({ error: null }));
const getUserSdkMock = vi.fn(async () => ({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null }));
const functionsInvokeMock = vi.fn(async () => ({ data: { ok: true }, error: null }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: {
            signInWithPassword: signInWithPasswordMock,
            signOut: signOutSdkMock,
            getUser: getUserSdkMock,
            mfa: {
                getAuthenticatorAssuranceLevel: getAALMock,
                listFactors: listFactorsMock
            }
        },
        functions: { invoke: functionsInvokeMock }
    }))
}));

async function waitUntil(predicate, { timeout = 2000, interval = 10 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) throw new Error('waitUntil: timed out');
        await new Promise((r) => setTimeout(r, interval));
    }
}

async function signInToMfaPanel(overlay) {
    overlay.querySelector('#authEmail').value = 'a@b.com';
    overlay.querySelector('#authPassword').value = 'Str0ng!Pass1';
    overlay.querySelector('#authModalForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitUntil(() => overlay.querySelector('#authModalMfaPanel').style.display === 'block');
}

describe('AuthModalStub — "فقدت جهاز المصادقة؟" (استرداد 2FA)', () => {
    beforeEach(() => {
        signInWithPasswordMock.mockClear();
        signOutSdkMock.mockClear();
        getUserSdkMock.mockClear();
        getAALMock.mockClear();
        listFactorsMock.mockClear();
        functionsInvokeMock.mockClear();
        getAALMock.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null });
        listFactorsMock.mockResolvedValue({ data: { totp: [{ id: 'factor-1' }] }, error: null });
        document.body.innerHTML = '';
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('زر "فقدت جهاز المصادقة؟" يُظهر لوحة رمز الاسترداد ويُخفي لوحة رمز 2FA', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();
        await signInToMfaPanel(modal.overlay);

        modal.overlay.querySelector('#authBtnLostDevice').click();

        expect(modal.overlay.querySelector('#authModalMfaPanel').style.display).toBe('none');
        expect(modal.overlay.querySelector('#authModalRecoveryPanel').style.display).toBe('block');
    });

    it('رمز استرداد صحيح: يستدعي mfa-recovery-unenroll، يسجّل خروجاً محلياً، ولا يستدعي onSuccess', async () => {
        functionsInvokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });
        const { AuthModal } = await import('../AuthModalStub.js');
        const onSuccess = vi.fn();
        const onClose = vi.fn();
        const modal = new AuthModal('c', { onSuccess, onClose });
        modal.open();
        await signInToMfaPanel(modal.overlay);

        modal.overlay.querySelector('#authBtnLostDevice').click();
        modal.overlay.querySelector('#authRecoveryCode').value = 'ABCD-1234';
        modal.overlay.querySelector('#authRecoveryForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        await waitUntil(() => signOutSdkMock.mock.calls.length > 0);

        expect(functionsInvokeMock).toHaveBeenCalledWith('mfa-recovery-unenroll', { body: { recoveryCode: 'ABCD-1234' } });
        expect(onSuccess).not.toHaveBeenCalled();
        await waitUntil(() => modal.overlay === null);
        expect(onClose).toHaveBeenCalledTimes(1); // النافذة أُغلقت بلا نجاح دخول — يُعامَل كتخطٍّ من ناحية الحارس
    });

    it('رمز استرداد خاطئ: يعرض رسالة خطأ ولا يغلق النافذة ولا يسجّل خروجاً', async () => {
        functionsInvokeMock.mockResolvedValueOnce({ data: { ok: false, error: 'invalid_recovery_code' }, error: null });
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();
        await signInToMfaPanel(modal.overlay);

        modal.overlay.querySelector('#authBtnLostDevice').click();
        modal.overlay.querySelector('#authRecoveryCode').value = 'WRONG-CODE';
        modal.overlay.querySelector('#authRecoveryForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        await waitUntil(() => modal.overlay.querySelector('#authRecoveryError')?.textContent);

        expect(signOutSdkMock).not.toHaveBeenCalled();
        expect(modal.overlay.querySelector('#authRecoveryError').textContent).toContain('غير صحيح');
        expect(modal.overlay).not.toBeNull();
    });
});

/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-17:
 * (أ) خطأ الدخول من Supabase GoTrue كان يُعرض خاماً بالإنجليزية (مثال حرفي: "Invalid
 *     login credentials") لكل حالة عدا "email not confirmed" — تُترجَم الآن الرسائل
 *     الشائعة، وأي رسالة أخرى غير معروفة تُستبدَل برسالة عربية عامة، لا تُعرض أبداً خاماً.
 * (ب) زر "الدخول بـ Google" كان يستخدم إيموجي 🔐 (قفل) بدل شعار Google — صار الآن SVG
 *     حقيقياً لشعار Google.
 *
 * نفس نمط موك @supabase/supabase-js من authModalStub.mfaAndAudit.test.js (استيراد
 * supabaseClient.js الديناميكي من AuthModalStub.js لا يُعترَض بموثوقية بموك مباشر لملف
 * المسار النسبي هنا).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInWithPasswordMock = vi.fn(async () => ({
    data: { user: null },
    error: { message: 'Invalid login credentials' },
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: { signInWithPassword: signInWithPasswordMock },
    })),
}));

async function waitUntil(predicate, { timeout = 2000, interval = 10 } = {}) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeout) throw new Error('waitUntil: timed out');
        await new Promise((r) => setTimeout(r, interval));
    }
}

describe('AuthModalStub — ترجمة رسالة خطأ الدخول + أيقونة Google', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        signInWithPasswordMock.mockClear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('"Invalid login credentials" الخام لا يظهر إطلاقاً — تظهر رسالة عربية بدلاً منه', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();

        modal.overlay.querySelector('#authEmail').value = 'a@b.com';
        modal.overlay.querySelector('#authPassword').value = 'wrong-password';
        modal.overlay.querySelector('#authModalForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => modal.overlay.querySelector('#authModalError')?.textContent);

        const errText = modal.overlay.querySelector('#authModalError').textContent;
        expect(errText).not.toContain('Invalid login credentials');
        expect(errText).toContain('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    });

    it('زر Google: بلا إيموجي 🔐، ويحتوي SVG فعلياً', async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();

        const googleBtn = modal.overlay.querySelector('#authBtnGoogle');
        expect(googleBtn.innerHTML).not.toContain('🔐');
        expect(googleBtn.querySelector('svg')).not.toBeNull();
    });
});

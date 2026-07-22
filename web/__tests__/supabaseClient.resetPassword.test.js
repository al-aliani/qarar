/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-09 (توحيد المصادقة): resetPassword() كان يرسل رابط استعادة إلى
 * '/reset-password' — مسار غير موجود إطلاقاً (لا صفحة HTML، لا مسار SPA، لا معالج
 * لحدث PASSWORD_RECOVERY) — فتنتهي رحلة "نسيت كلمة المرور" لصفحة لا تفعل شيئاً بعد
 * إرسال البريد الحقيقي فعلياً من Supabase. الإصلاح وقتها: توجيه الرابط لجذر SPA نفسه
 * (window.location.origin)، حيث detectSessionInUrl يلتقط رمز الاستعادة تلقائياً.
 *
 * تدقيق حي 2026-07-22: الجذر لم يعد يصل للـSPA — vercel.json يحوّل "/" إلى
 * "/landing.html"، وهي صفحة تسويقية لا تُحمّل app.js ولا AuthGuard، فعاد العطل نفسه
 * بصورة أخرى. الوجهة الصحيحة هي "/index.html" صراحةً: الصفحة الوحيدة التي تُحمّل
 * AuthGuard (معالج PASSWORD_RECOVERY → NewPasswordModal). لذا يحرس هذا الملف الآن
 * الشرط الجوهري — وجهة تُحمّل المعالج فعلاً — بدل مساواة حرفية بالجذر.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const resetPasswordForEmailMock = vi.fn(async () => ({ error: null }));
const resendMock = vi.fn(async () => ({ error: null }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: {
            resetPasswordForEmail: resetPasswordForEmailMock,
            resend: resendMock
        }
    }))
}));

describe('روابط البريد تقود لصفحة تُحمّل معالج المصادقة', () => {
    beforeEach(() => {
        resetPasswordForEmailMock.mockClear();
        resendMock.mockClear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('resetPassword: redirectTo يشير لـ/index.html لا للجذر ولا لمسار وهمي', async () => {
        const { resetPassword } = await import('../supabaseClient.js');
        const result = await resetPassword('user@example.com');

        expect(result.ok).toBe(true);
        expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
        const [email, options] = resetPasswordForEmailMock.mock.calls[0];
        expect(email).toBe('user@example.com');
        expect(options.redirectTo).toBe(`${window.location.origin}/index.html`);
        expect(options.redirectTo).not.toContain('/reset-password');
        // الجذر المجرّد يُحوَّل إلى landing.html التي لا تُحمّل AuthGuard — انحدار 2026-07-22.
        expect(options.redirectTo).not.toBe(window.location.origin);
    });

    it('resendConfirmationEmail: emailRedirectTo يشير لـ/index.html لا للجذر', async () => {
        const { resendConfirmationEmail } = await import('../supabaseClient.js');
        const result = await resendConfirmationEmail('user@example.com');

        expect(result.ok).toBe(true);
        expect(resendMock).toHaveBeenCalledTimes(1);
        const [{ options }] = resendMock.mock.calls[0];
        expect(options.emailRedirectTo).toBe(`${window.location.origin}/index.html`);
        expect(options.emailRedirectTo).not.toBe(window.location.origin);
    });
});

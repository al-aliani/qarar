/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-09 (توحيد المصادقة): resetPassword() كان يرسل رابط استعادة إلى
 * '/reset-password' — مسار غير موجود إطلاقاً (لا صفحة HTML، لا مسار SPA، لا معالج
 * لحدث PASSWORD_RECOVERY) — فتنتهي رحلة "نسيت كلمة المرور" لصفحة لا تفعل شيئاً بعد
 * إرسال البريد الحقيقي فعلياً من Supabase. الإصلاح: توجيه الرابط لجذر SPA نفسه
 * (window.location.origin)، حيث detectSessionInUrl يلتقط رمز الاستعادة تلقائياً.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const resetPasswordForEmailMock = vi.fn(async () => ({ error: null }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: {
            resetPasswordForEmail: resetPasswordForEmailMock
        }
    }))
}));

describe('resetPassword() — رابط الاستعادة يشير لجذر SPA لا مسار غير موجود', () => {
    beforeEach(() => {
        resetPasswordForEmailMock.mockClear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('redirectTo = window.location.origin (لا يحتوي أي مسار فرعي مثل /reset-password)', async () => {
        const { resetPassword } = await import('../supabaseClient.js');
        const result = await resetPassword('user@example.com');

        expect(result.ok).toBe(true);
        expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
        const [email, options] = resetPasswordForEmailMock.mock.calls[0];
        expect(email).toBe('user@example.com');
        expect(options.redirectTo).toBe(window.location.origin);
        expect(options.redirectTo).not.toContain('/reset-password');
    });
});

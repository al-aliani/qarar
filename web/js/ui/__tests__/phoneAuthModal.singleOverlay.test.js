// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../supabaseClient.js', () => ({
    signInWithOtpPhone: vi.fn(),
    verifyOtpPhone: vi.fn(),
    updateUserProfile: vi.fn(),
    signInWithOAuth: vi.fn()
}));

import { PhoneAuthModal } from '../PhoneAuthModal.js';

describe('PhoneAuthModal — نافذة دخول واحدة ومعالجة خطأ OAuth', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.body.style.overflow = '';
        window.history.replaceState({}, '', '/index.html#/home');
    });

    it('لا ينشئ طبقتين عند استدعاء open أكثر من مرة', () => {
        new PhoneAuthModal('authModalContainer').open();
        new PhoneAuthModal('authModalContainer').open();

        expect(document.querySelectorAll('#phoneAuthModalOverlay')).toHaveLength(1);
    });

    it('يعرض خطأ Google بالعربية وينظف معاملات الخطأ من الرابط', () => {
        // سيناريو حقيقي مُلاحَظ: Supabase يُرفق error_code=unexpected_failure (رمز
        // عام غير مصنَّف) مع هذا الوصف — النص التفصيلي يجب أن يفوز في التصنيف
        // على الرمز العام، وإلا ظهرت رسالة "فشل حفظ المستخدم" الخاطئة بدل
        // التشخيص الصحيح (فشل تبادل الرمز / Client Secret).
        window.history.replaceState({}, '', '/index.html?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+4%2F0A#error=server_error&error_code=unexpected_failure&error_description=Unable%20to%20exchange%20external%20code%3A%204%2F0A');

        new PhoneAuthModal('authModalContainer').open();

        const shown = document.querySelector('#phoneAuthError')?.textContent || '';
        expect(shown).toContain('تعذر إكمال تسجيل الدخول عبر Google');
        // يعرض السبب الحقيقي (فشل تبادل الرمز = Client Secret) لا تخمينًا ثابتًا،
        // ويُلحق نص الخطأ الأصلي من Supabase للتشخيص.
        expect(shown).toContain('Client Secret');
        expect(shown).not.toContain('حفظ المستخدم في قاعدة البيانات');
        expect(shown).toContain('Unable to exchange external code');
        expect(window.location.search).not.toContain('error_description');
        expect(window.location.hash).toBe('#/home');
    });

    it('يعرض رسالة عامة موجِّهة للسجلات حين لا يحمل الوصف أي دليل محدَّد', () => {
        window.history.replaceState({}, '', '/index.html?error=server_error&error_code=unexpected_failure&error_description=Something+went+wrong#error=server_error&error_code=unexpected_failure&error_description=Something%20went%20wrong');

        new PhoneAuthModal('authModalContainer').open();

        const shown = document.querySelector('#phoneAuthError')?.textContent || '';
        expect(shown).toContain('تعذر إكمال تسجيل الدخول عبر Google');
        expect(shown).toContain('Logs');
        expect(shown).toContain('Something went wrong');
    });

    it('زر «تخطي الآن» يُغلق النافذة بلا تسجيل ويُخطر onClose بأن الدخول تُخطّي', () => {
        const onClose = vi.fn();
        const onSuccess = vi.fn();
        new PhoneAuthModal('authModalContainer', { onClose, onSuccess }).open();

        document.querySelector('#phoneAuthSkip').click();

        expect(document.getElementById('phoneAuthModalOverlay')).toBeNull();
        expect(document.body.style.overflow).toBe('');
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSuccess).not.toHaveBeenCalled();
    });
});

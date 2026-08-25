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

// aal1/aal1 = لا تحدي 2FA — يسمح لمسار الدخول بالوصول فعلياً لنقطة النجاح (_succeeded)
// التي تُكتَب عندها علامة «لديه حساب» المستخدَمة في اختبارات التبويب الافتراضي أدناه.
const getAalMock = vi.fn(async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: {
            signInWithPassword: signInWithPasswordMock,
            signUp: signUpSdkMock,
            mfa: { getAuthenticatorAssuranceLevel: getAalMock },
        },
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
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    it('الحالة الافتراضية (بلا قمع تسويقي): تبويب "دخول" نشط، حقلا الاسم/الجوال مخفيان، زر الدخول فقط ظاهر', async () => {
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

/**
 * تدقيق حي 2026-08-25: النافذة كانت تُفتح دائماً على تبويب «دخول» بعنوان «أهلاً بعودتك»
 * حتى لزائر جديد وصل لتوّه من زر «ابدأ دراستك الآن» أو أحد أزرار الباقات في صفحة التسويق
 * — وapp.js يكون قد حفظ landing_cta/selected_package في sessionStorage، أي إن التطبيق
 * يعرف أنه قادم بنيّة البدء. القاعدة الجديدة: «إنشاء حساب» فقط لقادمٍ من القمع بلا دليل
 * على حساب سابق على هذا الجهاز (localStorage.qarar_has_account)، وما عداه «دخول».
 */
describe('AuthModalStub — التبويب الافتراضي عند الفتح', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        signInWithPasswordMock.mockClear();
        signUpSdkMock.mockClear();
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('SUPABASE_URL', 'https://test.supabase.co');
        localStorage.setItem('SUPABASE_ANON_KEY', 'test-anon-key');
    });

    const openModal = async () => {
        const { AuthModal } = await import('../AuthModalStub.js');
        const modal = new AuthModal('c', {});
        modal.open();
        return modal;
    };

    const expectSignInTab = (modal) => {
        expect(modal.overlay.querySelector('#authTabSignIn').getAttribute('aria-selected')).toBe('true');
        expect(modal.overlay.querySelector('#authTabSignUp').getAttribute('aria-selected')).toBe('false');
        expect(modal.overlay.querySelector('#authModalTitle').textContent).toBe('أهلاً بعودتك');
        expect(modal.overlay.querySelector('#authBtnSignIn').style.display).not.toBe('none');
        expect(modal.overlay.querySelector('#authBtnSignUp').style.display).toBe('none');
    };

    const expectSignUpTab = (modal) => {
        expect(modal.overlay.querySelector('#authTabSignUp').getAttribute('aria-selected')).toBe('true');
        expect(modal.overlay.querySelector('#authTabSignIn').getAttribute('aria-selected')).toBe('false');
        expect(modal.overlay.querySelector('#authModalTitle').textContent).toBe('إنشاء حساب جديد');
        expect(modal.overlay.querySelector('#authNameGroup').style.display).toBe('block');
        expect(modal.overlay.querySelector('#authPhoneGroup').style.display).toBe('block');
        expect(modal.overlay.querySelector('#authBtnSignUp').style.display).not.toBe('none');
        expect(modal.overlay.querySelector('#authBtnSignIn').style.display).toBe('none');
    };

    it('قادم من القمع (cta) بلا حساب سابق: يُفتح على "إنشاء حساب" بعنوان "إنشاء حساب جديد"', async () => {
        sessionStorage.setItem('landing_cta', 'hero');
        expectSignUpTab(await openModal());
    });

    it('قادم من القمع (pkg) بلا حساب سابق: يُفتح على "إنشاء حساب"', async () => {
        sessionStorage.setItem('selected_package', 'reviewed');
        expectSignUpTab(await openModal());
    });

    it('زائر عائد (qarar_has_account) رغم قدومه من القمع: يُفتح على "دخول" بعنوان "أهلاً بعودتك"', async () => {
        localStorage.setItem('qarar_has_account', '1');
        sessionStorage.setItem('landing_cta', 'price-full');
        sessionStorage.setItem('selected_package', 'full');
        expectSignInTab(await openModal());
    });

    it('نجاح الدخول يسِم الجهاز بـqarar_has_account، فتُفتح النافذة التالية على "دخول" رغم القمع', async () => {
        sessionStorage.setItem('landing_cta', 'hero');
        const first = await openModal();
        expectSignUpTab(first); // القمع + لا علامة ⟶ إنشاء حساب
        first.overlay.querySelector('#authTabSignIn').click();
        first.overlay.querySelector('#authEmail').value = 'a@b.com';
        first.overlay.querySelector('#authPassword').value = 'Str0ng!Pass1';
        first.overlay.querySelector('#authModalForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitUntil(() => localStorage.getItem('qarar_has_account') === '1');

        expectSignInTab(await openModal());
    });

    it('لا قمع ولا حساب سابق: يبقى السلوك الحالي — تبويب "دخول"', async () => {
        expectSignInTab(await openModal());
    });
});

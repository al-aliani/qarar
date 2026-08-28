/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-22: نموذجا المختصين والموردين (public_applications) كانا يفشلان
 * بخطأ 400 صامت — السبب الجذري: حقل الجوال بلا minlength بينما قاعدة البيانات تشترط
 * طول 9-20 حرفاً (public_applications.sql)، ورسالة الخطأ الفعلية من Supabase لم تكن
 * تصل لأي مراقبة (لا console.error ولا Sentry)، فيستحيل تشخيص أي فشل مستقبلي غير
 * متعلق بالجوال. هذا يثبّت أن الخطأ الحقيقي يصل الآن لـmonitoring.captureException.
 *
 * دفعة 3 (2026-08-27، طبقة Rate limiting): الإدراج المباشر إلى الجدول استُبدل
 * بـsupabase.functions.invoke('submit-application', ...) — حُدِّث هذا الملف
 * ليعكس المسار الجديد، وأُضيف اختبار استجابة "rate_limited" الجديدة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
const getSupabaseClientMock = vi.fn(async () => ({ supabase: { functions: { invoke: invokeMock } }, ok: true }));
vi.mock('../../supabaseClient.js', () => ({
    getSupabaseClient: (...a) => getSupabaseClientMock(...a),
}));

vi.mock('../utils/analytics.js', () => ({ trackEvent: vi.fn() }));

const captureExceptionMock = vi.fn();
vi.mock('../utils/monitoring.js', () => ({
    monitoring: { captureException: captureExceptionMock },
}));

function mountForm() {
    document.body.innerHTML = `
        <form data-public-application="expert">
            <input name="website">
            <input name="full_name" value="أحمد">
            <input name="phone" value="0512345">
            <input name="email" value="a@b.com">
            <input name="sector" value="تسويق">
            <textarea name="summary">نبذة كافية هنا</textarea>
            <div data-form-status></div>
            <button type="submit">إرسال طلب مبدئي للمراجعة</button>
        </form>
    `;
}

async function submitAndSettle() {
    document.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
}

describe('public-applications.js — تسجيل الخطأ الفعلي عند فشل الإرسال', () => {
    beforeEach(() => {
        vi.resetModules();
        invokeMock.mockReset();
        captureExceptionMock.mockClear();
        mountForm();
    });

    it('فشل الإدخال (قيد الجوال في قاعدة البيانات) ⇒ يُرسَل الخطأ الحقيقي لـmonitoring، لا يُبتلَع بصمت', async () => {
        invokeMock.mockResolvedValue({
            data: null,
            error: {
                message: 'new row for relation "public_applications" violates check constraint "public_applications_phone_check"',
                code: '23514',
            },
        });
        await import('../public-applications.js');
        await submitAndSettle();

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        const [err, context] = captureExceptionMock.mock.calls[0];
        expect(err.message).toContain('phone');
        expect(context).toEqual({ applicationType: 'expert' });
        expect(document.querySelector('[data-form-status]').textContent).toContain('لم يتم إرسال الطلب');
    });

    it('نجاح الإرسال ⇒ لا يُستدعى captureException وتظهر رسالة نجاح', async () => {
        invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
        await import('../public-applications.js');
        await submitAndSettle();

        expect(captureExceptionMock).not.toHaveBeenCalled();
        expect(document.querySelector('[data-form-status]').textContent).toContain('تم استلام طلبك');
    });

    it('يستدعي submit-application ببيانات النموذج + حقل website (honeypot) — لا إدراج مباشر للجدول', async () => {
        invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
        await import('../public-applications.js');
        await submitAndSettle();

        expect(invokeMock).toHaveBeenCalledTimes(1);
        const [fnName, options] = invokeMock.mock.calls[0];
        expect(fnName).toBe('submit-application');
        expect(options.body).toMatchObject({
            application_type: 'expert',
            full_name: 'أحمد',
            phone: '0512345',
            sector: 'تسويق',
        });
        expect(options.body).toHaveProperty('website');
    });

    it('استجابة rate_limited من الدالة تعرض رسالة واضحة بدل رسالة الفشل العامة', async () => {
        invokeMock.mockResolvedValue({ data: { error: 'rate_limited', retryAfterSeconds: 3600 }, error: null });
        await import('../public-applications.js');
        await submitAndSettle();

        expect(captureExceptionMock).not.toHaveBeenCalled();
        expect(document.querySelector('[data-form-status]').textContent).toContain('تجاوز الحد المسموح');
    });

    it('تدقيق حي 2026-07-22: زر الإرسال يعود لنص "طلب مبدئي" (لا التزام تعاقدي) بعد النجاح والفشل', async () => {
        invokeMock.mockResolvedValue({ data: { ok: true }, error: null });
        await import('../public-applications.js');
        await submitAndSettle();
        expect(document.querySelector('button[type="submit"]').textContent).toBe('إرسال طلب مبدئي للمراجعة');

        invokeMock.mockResolvedValue({ data: null, error: { message: 'فشل' } });
        await submitAndSettle();
        expect(document.querySelector('button[type="submit"]').textContent).toBe('إرسال طلب مبدئي للمراجعة');
    });
});

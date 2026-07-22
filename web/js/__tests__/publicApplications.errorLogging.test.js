/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-22: نموذجا المختصين والموردين (public_applications) كانا يفشلان
 * بخطأ 400 صامت — السبب الجذري: حقل الجوال بلا minlength بينما قاعدة البيانات تشترط
 * طول 9-20 حرفاً (public_applications.sql)، ورسالة الخطأ الفعلية من Supabase لم تكن
 * تصل لأي مراقبة (لا console.error ولا Sentry)، فيستحيل تشخيص أي فشل مستقبلي غير
 * متعلق بالجوال. هذا يثبّت أن الخطأ الحقيقي يصل الآن لـmonitoring.captureException.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn();
const getSupabaseClientMock = vi.fn(async () => ({ supabase: { from: () => ({ insert: insertMock }) }, ok: true }));
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
            <button type="submit">إرسال الطلب</button>
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
        insertMock.mockReset();
        captureExceptionMock.mockClear();
        mountForm();
    });

    it('فشل الإدخال (قيد الجوال في قاعدة البيانات) ⇒ يُرسَل الخطأ الحقيقي لـmonitoring، لا يُبتلَع بصمت', async () => {
        insertMock.mockResolvedValue({
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
        insertMock.mockResolvedValue({ error: null });
        await import('../public-applications.js');
        await submitAndSettle();

        expect(captureExceptionMock).not.toHaveBeenCalled();
        expect(document.querySelector('[data-form-status]').textContent).toContain('تم استلام طلبك');
    });
});

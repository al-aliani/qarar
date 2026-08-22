/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn(async () => ({ data: null, error: null }));
const getSupabaseClientMock = vi.fn(async () => ({ ok: true, supabase: { rpc: rpcMock } }));

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: (...a) => getSupabaseClientMock(...a),
}));

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * trackEvent (2026-07-16) — كان stub معطّلاً تماماً (gtag/fbq غير مُهيّأين،
 * CustomEvent بلا أي مستمع). الآن يُدرج أيضاً في جدول events الحقيقي —
 * إضافي وغير منتظِر عمداً (لا يجوز أن يعطّل أي إجراء في الواجهة).
 * تدقيق 2026-07-21 (بند #47): الإدراج المباشر .insert() استُبدل بـRPC
 * track_event (تفرض حدّ معدّل خادمياً وتشتقّ user_id من الجلسة لا من العميل).
 * تدقيق كوكيز 2026-08-22: trackEvent أصبح مشروطاً بموافقة الزائر (إشعار الكوكيز
 * public/js/cookie-notice.js) — الاختبارات أدناه تمنح الموافقة صراحة لتبقى تختبر
 * آلية الإرسال نفسها، وأُضيف اختبار مستقل يثبت المنع الفعلي بلا موافقة.
 */
describe('trackEvent', () => {
    beforeEach(() => {
        rpcMock.mockClear();
        getSupabaseClientMock.mockReset().mockResolvedValue({ ok: true, supabase: { rpc: rpcMock } });
        localStorage.setItem('qarar_cookie_consent', 'granted');
    });

    it('بلا موافقة كوكيز مسجّلة ⇒ لا استدعاء RPC إطلاقاً، لا استثناء', async () => {
        localStorage.removeItem('qarar_cookie_consent');
        const { trackEvent } = await import('../analytics.js');
        expect(() => trackEvent('export_click', { format: 'pdf' })).not.toThrow();
        await flushMicrotasks();
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('برفض صريح لكوكيز التحليلات ⇒ لا استدعاء RPC إطلاقاً', async () => {
        localStorage.setItem('qarar_cookie_consent', 'denied');
        const { trackEvent } = await import('../analytics.js');
        trackEvent('export_click', { format: 'pdf' });
        await flushMicrotasks();
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('استدعاء متزامن بلا استثناء، لا يعطّل المستدعي', async () => {
        const { trackEvent } = await import('../analytics.js');
        expect(() => trackEvent('wizard_step_view', { stepId: '3' })).not.toThrow();
    });

    it('يستدعي track_event RPC بالشكل المتوقع', async () => {
        const { trackEvent } = await import('../analytics.js');
        trackEvent('export_click', { format: 'pdf' });
        await flushMicrotasks();
        expect(rpcMock).toHaveBeenCalledWith('track_event', expect.objectContaining({
            p_event_name: 'export_click',
            p_props: expect.objectContaining({ format: 'pdf' }),
        }));
    });

    it('Supabase غير مهيأ (ok:false) ⇒ لا استدعاء RPC، لا استثناء', async () => {
        getSupabaseClientMock.mockResolvedValue({ ok: false, supabase: null });
        const { trackEvent } = await import('../analytics.js');
        expect(() => trackEvent('x', {})).not.toThrow();
        await flushMicrotasks();
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('يحفظ مصدر الزيارة الأول ويضيف وسوم UTM إلى الأحداث اللاحقة', async () => {
        window.history.replaceState({}, '', '/?utm_source=linkedin&utm_campaign=launch');
        const { trackEvent } = await import('../analytics.js');
        trackEvent('study_start', {});
        await flushMicrotasks();
        expect(rpcMock).toHaveBeenCalledWith('track_event', expect.objectContaining({
            p_props: expect.objectContaining({ utm_source: 'linkedin', utm_campaign: 'launch' }),
        }));
        window.history.replaceState({}, '', '/');
        sessionStorage.removeItem('qarar_first_touch_attribution');
    });
});

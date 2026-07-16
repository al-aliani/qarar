import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertMock = vi.fn(async () => ({ data: null, error: null }));
const fromMock = vi.fn(() => ({ insert: insertMock }));
const getAuthUserMock = vi.fn(async () => ({ user: { id: 'u1' } }));
const getSupabaseClientMock = vi.fn(async () => ({ ok: true, supabase: { from: fromMock } }));

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: (...a) => getSupabaseClientMock(...a),
    getAuthUser: (...a) => getAuthUserMock(...a),
}));

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * trackEvent (2026-07-16) — كان stub معطّلاً تماماً (gtag/fbq غير مُهيّأين،
 * CustomEvent بلا أي مستمع). الآن يُدرج أيضاً في جدول events الحقيقي —
 * إضافي وغير منتظِر عمداً (لا يجوز أن يعطّل أي إجراء في الواجهة).
 */
describe('trackEvent', () => {
    beforeEach(() => {
        fromMock.mockClear();
        insertMock.mockClear();
        getAuthUserMock.mockReset().mockResolvedValue({ user: { id: 'u1' } });
        getSupabaseClientMock.mockReset().mockResolvedValue({ ok: true, supabase: { from: fromMock } });
    });

    it('استدعاء متزامن بلا استثناء، لا يعطّل المستدعي', async () => {
        const { trackEvent } = await import('../analytics.js');
        expect(() => trackEvent('wizard_step_view', { stepId: '3' })).not.toThrow();
    });

    it('يُدرج صفاً في events بالشكل المتوقع', async () => {
        const { trackEvent } = await import('../analytics.js');
        trackEvent('export_click', { format: 'pdf' });
        await flushMicrotasks();
        expect(fromMock).toHaveBeenCalledWith('events');
        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'u1',
                event_name: 'export_click',
                props: { format: 'pdf' },
            })
        );
    });

    it('مستخدم غير مسجَّل ⇒ user_id فارغ (null) لا يعطّل الإدراج', async () => {
        getAuthUserMock.mockResolvedValue({ user: null });
        const { trackEvent } = await import('../analytics.js');
        trackEvent('landing_cta_view', { cta: 'hero' });
        await flushMicrotasks();
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: null }));
    });

    it('Supabase غير مهيأ (ok:false) ⇒ لا إدراج، لا استثناء', async () => {
        getSupabaseClientMock.mockResolvedValue({ ok: false, supabase: null });
        const { trackEvent } = await import('../analytics.js');
        expect(() => trackEvent('x', {})).not.toThrow();
        await flushMicrotasks();
        expect(insertMock).not.toHaveBeenCalled();
    });
});

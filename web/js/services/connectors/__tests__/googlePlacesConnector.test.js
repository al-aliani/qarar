/**
 * Unit tests لـ GooglePlacesConnector بعد تفعيله عبر Supabase Edge Function حقيقية
 * (places-nearby) — نفس نمط موك whatsAppOtpService.test.js: vi.mock لـ
 * supabaseClient.js بدل vi.stubGlobal('fetch', ...) لأن الموصّل لم يعد يستدعي
 * fetch مباشرة، بل supabase.functions.invoke.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn(async () => ({ data: null, error: null }));
const getSupabaseClientMock = vi.fn(async () => ({
    ok: true,
    supabase: { functions: { invoke: invokeMock } },
}));

vi.mock('../../../../supabaseClient.js', () => ({
    getSupabaseClient: (...a) => getSupabaseClientMock(...a),
}));

import { PROVENANCE, isUsable, suggest } from '../../DataConnectors.js';
import googlePlacesConnector from '../GooglePlacesConnector.js';

describe('GooglePlacesConnector', () => {
    beforeEach(() => {
        invokeMock.mockReset().mockResolvedValue({ data: { count: 7 }, error: null });
        getSupabaseClientMock.mockReset().mockResolvedValue({
            ok: true,
            supabase: { functions: { invoke: invokeMock } },
        });
    });

    it('بلا إحداثيات يعيد unavailable ولا يستدعي invoke', async () => {
        const d = await googlePlacesConnector({});
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(invokeMock).not.toHaveBeenCalled();
    });

    it('نجاح: يستدعي places-nearby بالإحداثيات ونصف القطر ويعيد Datum SOURCED بالعدّ', async () => {
        const d = await googlePlacesConnector({ coords: { lat: 24.7, lng: 46.6 }, radiusMeters: 2000 });
        expect(invokeMock).toHaveBeenCalledWith('places-nearby', {
            body: { lat: 24.7, lng: 46.6, radiusMeters: 2000 }
        });
        expect(d.provenance).toBe(PROVENANCE.SOURCED);
        expect(d.value.count).toBe(7);
        expect(isUsable(d)).toBe(true);
    });

    it('يستخدم نصف القطر الافتراضي (1500) حين لا يُمرَّر', async () => {
        await googlePlacesConnector({ coords: { lat: 24.7, lng: 46.6 } });
        expect(invokeMock).toHaveBeenCalledWith('places-nearby', {
            body: { lat: 24.7, lng: 46.6, radiusMeters: 1500 }
        });
    });

    it('عميل Supabase غير جاهز (ok:false) يعيد unavailable دون رمي', async () => {
        getSupabaseClientMock.mockResolvedValue({ ok: false, supabase: null });
        const d = await googlePlacesConnector({ coords: { lat: 24.7, lng: 46.6 } });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
        expect(d.value).toBeNull();
    });

    it('خطأ من invoke (error) يعيد unavailable دون رمي', async () => {
        invokeMock.mockResolvedValue({ data: null, error: { message: 'function_error' } });
        const d = await googlePlacesConnector({ coords: { lat: 24.7, lng: 46.6 } });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });

    it('استجابة بلا count رقمي تعيد unavailable', async () => {
        invokeMock.mockResolvedValue({ data: { error: 'not_configured' }, error: null });
        const d = await googlePlacesConnector({ coords: { lat: 24.7, lng: 46.6 } });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });

    it('invoke يرمي استثناءً (فشل شبكة) يعيد unavailable دون رمي', async () => {
        invokeMock.mockRejectedValue(new Error('network down'));
        const d = await googlePlacesConnector({ coords: { lat: 24.7, lng: 46.6 } });
        expect(d.provenance).toBe(PROVENANCE.UNAVAILABLE);
    });

    it("موصّل 'market.competitorsPrecise' مسجّل في السجل الموحّد (suggest يعمل)", async () => {
        const d = await suggest('market.competitorsPrecise', { coords: { lat: 24.7, lng: 46.6 } });
        expect(d.provenance).toBe(PROVENANCE.SOURCED);
        expect(d.value.count).toBe(7);
    });
});

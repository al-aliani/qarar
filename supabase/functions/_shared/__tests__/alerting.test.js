/**
 * اختبار alerting.ts (تنبيه Sentry بلا SDK) عبر Vitest (Node) — يستخدم fetch/crypto
 * القياسيين فقط بلا أي API خاص بـDeno، فيعمل بلا تعديل هنا رغم أن الوجهة الفعلية
 * (Edge Functions) هي بيئة Deno غير المتوفرة محلياً في هذه الجلسة (نفس نمط
 * webhookVerify.test.js). fetch يُزيَّف عالمياً لتفادي أي طلب شبكة حقيقي.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendAlert, parseDsn } from '../alerting.ts';

describe('parseDsn', () => {
    it('يستخرج المفتاح العام والمضيف ومعرّف المشروع من DSN صالح', () => {
        const parsed = parseDsn('https://abc123@o456.ingest.us.sentry.io/789');
        expect(parsed).toEqual({ publicKey: 'abc123', host: 'o456.ingest.us.sentry.io', projectId: '789' });
    });

    it('يُرجِع null لـDSN غير صالح (بلا مفتاح أو مسار)', () => {
        expect(parseDsn('not-a-url')).toBeNull();
        expect(parseDsn('https://o456.ingest.us.sentry.io/789')).toBeNull(); // بلا مفتاح
    });
});

describe('sendAlert', () => {
    const realFetch = global.fetch;
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        global.fetch = realFetch;
        vi.restoreAllMocks();
    });

    it('لا تستدعي fetch وتسجّل محلياً فقط حين لا يوجد DSN (بلا رمي استثناء)', async () => {
        await expect(sendAlert(null, { message: 'test' })).resolves.toBeUndefined();
        expect(global.fetch).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('SENTRY_DSN غير مضبوط'));
    });

    it('لا تستدعي fetch وتسجّل محلياً فقط حين يكون DSN غير صالح', async () => {
        await sendAlert('not-a-valid-dsn', { message: 'test' });
        expect(global.fetch).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('SENTRY_DSN غير صالح'));
    });

    it('يبني ويُرسِل envelope صالحاً لعنوان Sentry الصحيح المشتق من DSN', async () => {
        const dsn = 'https://abc123@o456.ingest.us.sentry.io/789';
        await sendAlert(dsn, { message: 'order update failed', level: 'error', tags: { source: 'webhook-moyasar' } });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://o456.ingest.us.sentry.io/api/789/envelope/');
        expect(options.method).toBe('POST');
        expect(options.headers['Content-Type']).toBe('application/x-sentry-envelope');
        expect(options.headers['X-Sentry-Auth']).toContain('sentry_key=abc123');

        const lines = options.body.trim().split('\n');
        expect(lines).toHaveLength(3);
        const [header, itemHeader, item] = lines.map((l) => JSON.parse(l));
        expect(header.dsn).toBe(dsn);
        expect(itemHeader.type).toBe('event');
        expect(item.level).toBe('error');
        expect(item.message.formatted).toBe('order update failed');
        expect(item.tags.source).toBe('webhook-moyasar');
    });

    it('لا تَرمي ولا تُسقط الاستدعاء حين يفشل fetch نفسه (خطأ شبكة)', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
        const dsn = 'https://abc123@o456.ingest.us.sentry.io/789';
        await expect(sendAlert(dsn, { message: 'test' })).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('استثناء أثناء إرسال التنبيه'), expect.any(Error));
    });

    it('تسجّل خطأً حين يستجيب Sentry بحالة فشل (مثل 401 مفتاح خاطئ) بلا رمي', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
        const dsn = 'https://abc123@o456.ingest.us.sentry.io/789';
        await expect(sendAlert(dsn, { message: 'test' })).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('فشل إرسال التنبيه'));
    });
});

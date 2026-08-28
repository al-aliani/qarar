/**
 * دفعة 9 (2026-08-27، تغطية اختبارات الوحدات المشتركة): cors.ts هو ما يجعل أي
 * نداء supabase.functions.invoke() من المتصفح (دفع، OTP، إلخ) يعمل أصلاً — بلا
 * رد صريح على OPTIONS preflight بترويسات CORS، يُسقط المتصفح الطلب الفعلي قبل
 * وصوله للخادم إطلاقاً. بلا أي اختبار وحدة رغم هذا الأثر الحرج. لا تغيير سلوك
 * هنا، فقط تثبيت السلوك الحالي.
 *
 * ALLOWED_ORIGINS تُحسَب مرة واحدة عند تحميل الوحدة (Deno.env.get('APP_ORIGIN')
 * كثابت أعلى الملف) — نستخدم vi.resetModules() + استيراد ديناميكي مع globalThis.Deno
 * مُموَّهاً بقيمة مختلفة قبل كل استيراد، لاختبار سيناريوهات APP_ORIGIN متعددة.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function stubDenoEnv(appOrigin) {
    globalThis.Deno = { env: { get: (key) => (key === 'APP_ORIGIN' ? appOrigin : undefined) } };
}

function fakeRequest(method, origin) {
    return {
        method,
        headers: { get: (name) => (name.toLowerCase() === 'origin' ? origin : null) },
    };
}

describe('corsHeaders / handlePreflight', () => {
    const realDeno = globalThis.Deno;

    beforeEach(() => {
        vi.resetModules();
    });
    afterEach(() => {
        globalThis.Deno = realDeno;
    });

    it('أصل مطابق لـAPP_ORIGIN المضبوط فعلياً ⇒ يُعكَس في Access-Control-Allow-Origin', async () => {
        stubDenoEnv('https://app.example.com');
        const { corsHeaders } = await import('../cors.ts');

        const headers = corsHeaders(fakeRequest('POST', 'https://app.example.com'));

        expect(headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
        expect(headers['Vary']).toBe('Origin');
    });

    it('sahib.sa مسموح دائماً (ثابت بالكود) بصرف النظر عن APP_ORIGIN', async () => {
        stubDenoEnv(undefined);
        const { corsHeaders } = await import('../cors.ts');

        const headers = corsHeaders(fakeRequest('POST', 'https://sahib.sa'));

        expect(headers['Access-Control-Allow-Origin']).toBe('https://sahib.sa');
    });

    it('localhost:5173 مسموح دائماً (بيئة تطوير) بصرف النظر عن APP_ORIGIN', async () => {
        stubDenoEnv(undefined);
        const { corsHeaders } = await import('../cors.ts');

        const headers = corsHeaders(fakeRequest('POST', 'http://localhost:5173'));

        expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    });

    it('[أمني] أصل غير موثوق تماماً ⇒ لا يُعكَس إطلاقاً (سلسلة فارغة، لا الأصل المُرسَل)', async () => {
        stubDenoEnv('https://app.example.com');
        const { corsHeaders } = await import('../cors.ts');

        const headers = corsHeaders(fakeRequest('POST', 'https://evil-attacker.example'));

        expect(headers['Access-Control-Allow-Origin']).toBe(''); // ليس الأصل المُرسَل، ولا حتى APP_ORIGIN
    });

    it('APP_ORIGIN غير مضبوط (undefined) لا يُنتج قيمة "undefined" حرفية ضمن الأصول المسموحة', async () => {
        stubDenoEnv(undefined);
        const { corsHeaders } = await import('../cors.ts');

        const headers = corsHeaders(fakeRequest('POST', 'undefined'));

        expect(headers['Access-Control-Allow-Origin']).toBe(''); // .filter(Boolean) يستبعد undefined فعلياً
    });

    it('handlePreflight: طلب OPTIONS ⇒ يردّ فوراً 204 بترويسات CORS كاملة', async () => {
        stubDenoEnv('https://app.example.com');
        const { handlePreflight } = await import('../cors.ts');

        const response = handlePreflight(fakeRequest('OPTIONS', 'https://app.example.com'));

        expect(response).not.toBeNull();
        expect(response.status).toBe(204);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
        expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('handlePreflight: طلب POST عادي ⇒ يُرجِع null (لا يعترض المسار الطبيعي)', async () => {
        stubDenoEnv('https://app.example.com');
        const { handlePreflight } = await import('../cors.ts');

        const response = handlePreflight(fakeRequest('POST', 'https://app.example.com'));

        expect(response).toBeNull();
    });
});

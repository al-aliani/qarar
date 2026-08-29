/**
 * دفعة 3 من خطة إغلاق فجوات الطبقات الـ16: يستدعي المعالج الحقيقي (نفس نمط
 * webhook-moyasar integration test — انظر batch 2) عبر تمويه Deno.serve/env،
 * ويستخدم checkAnonRateLimit الحقيقي (لا موك) — فقط createClient مموَّه.
 *
 * تدقيق 2026-08-29 (سباق تزامن): checkAnonRateLimit صار يستدعي RPC ذرّي واحد
 * (check_and_record_anon_rate_limit) بدل .from('anon_endpoint_hits').select()
 * ...insert() منفصلين — الموك أدناه يحاكي منطق تلك الدالة (تحقّق العدّ ضمن
 * النافذة ثم تسجيل الطلب) داخل .rpc() بدل .from()، بلا تغيير أي توقّع اختبار
 * (نفس سيناريوهات الحد/العزل بين عناوين IP كما كانت). إثبات الذرّية الفعلي
 * (لا مجرد إعادة إنتاج المنطق) في rateLimitConcurrency.test.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let capturedHandler = null;
let hits = []; // [{endpoint, identifier_hash, created_at}]
let insertedApplications = [];

function buildAdminClient() {
    return {
        rpc: (fnName, args) => {
            if (fnName !== 'check_and_record_anon_rate_limit') throw new Error(`unexpected rpc: ${fnName}`);
            return {
                single: async () => {
                    const sinceMs = Date.now() - args.p_window_seconds * 1000;
                    const matching = hits.filter(
                        (h) => h.endpoint === args.p_endpoint && h.identifier_hash === args.p_identifier_hash && new Date(h.created_at).getTime() >= sinceMs
                    );
                    if (matching.length >= args.p_max_requests) {
                        const oldest = Math.min(...matching.map((h) => new Date(h.created_at).getTime()));
                        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + args.p_window_seconds * 1000 - Date.now()) / 1000));
                        return { data: { allowed: false, retry_after_seconds: retryAfterSeconds }, error: null };
                    }
                    hits.push({ endpoint: args.p_endpoint, identifier_hash: args.p_identifier_hash, created_at: new Date().toISOString() });
                    return { data: { allowed: true, retry_after_seconds: null }, error: null };
                },
            };
        },
        from: (table) => {
            if (table === 'public_applications') {
                return {
                    insert: async (row) => {
                        if (String(row.phone || '').length < 9) {
                            return { error: { message: 'violates check constraint "public_applications_phone_check"', code: '23514' } };
                        }
                        insertedApplications.push(row);
                        return { error: null };
                    },
                };
            }
            throw new Error(`unexpected table: ${table}`);
        },
    };
}

vi.mock('npm:@supabase/supabase-js@2', () => ({
    createClient: () => buildAdminClient(),
}));

beforeEach(async () => {
    hits = [];
    insertedApplications = [];
    capturedHandler = null;
    globalThis.Deno = {
        serve: (handler) => { capturedHandler = handler; },
        env: { get: (key) => (key === 'SUPABASE_URL' ? 'https://x.supabase.co' : key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'x' : key === 'APP_ORIGIN' ? 'https://sahib.sa' : undefined) },
    };
    vi.resetModules();
    await import('../index.ts');
});

function makeRequest(body, ip = '1.2.3.4') {
    return {
        method: 'POST',
        json: async () => body,
        headers: { get: (h) => (h === 'x-forwarded-for' ? ip : h === 'origin' ? 'https://sahib.sa' : null) },
    };
}

const VALID_BODY = {
    application_type: 'expert',
    full_name: 'أحمد محمد',
    phone: '0512345678',
    email: 'a@b.com',
    sector: 'تسويق رقمي',
    summary: 'خبرة عشر سنوات في التسويق للمشاريع الصغيرة والمتوسطة',
};

describe('submit-application/index.ts — تكامل حقيقي لحدّ المعدّل وhoneypot', () => {
    it('يدرج الطلب فعلياً عند نجاح الفحوصات', async () => {
        const res = await capturedHandler(makeRequest(VALID_BODY));
        expect(res.status).toBe(200);
        expect(insertedApplications).toHaveLength(1);
        expect(insertedApplications[0].full_name).toBe('أحمد محمد');
    });

    it('honeypot (website) ⇒ نجاح وهمي بلا إدراج فعلي — لا يُخبر البرنامج الآلي أنه اكتُشف', async () => {
        const res = await capturedHandler(makeRequest({ ...VALID_BODY, website: 'http://spam.example' }));
        expect(res.status).toBe(200);
        const json = JSON.parse(await res.text());
        expect(json.ok).toBe(true);
        expect(insertedApplications).toHaveLength(0);
    });

    it('[إثبات الحارس] يرفض الطلب الرابع من نفس IP خلال 24 ساعة (الحد=3)', async () => {
        await capturedHandler(makeRequest(VALID_BODY, '5.5.5.5'));
        await capturedHandler(makeRequest(VALID_BODY, '5.5.5.5'));
        await capturedHandler(makeRequest(VALID_BODY, '5.5.5.5'));
        const fourth = await capturedHandler(makeRequest(VALID_BODY, '5.5.5.5'));
        expect(fourth.status).toBe(429);
        const json = JSON.parse(await fourth.text());
        expect(json.error).toBe('rate_limited');
        expect(insertedApplications).toHaveLength(3); // الرابع لم يُدرَج
    });

    it('IP مختلف لا يتأثر بحد IP آخر (العدّادات معزولة لكل عنوان)', async () => {
        await capturedHandler(makeRequest(VALID_BODY, '5.5.5.5'));
        await capturedHandler(makeRequest(VALID_BODY, '5.5.5.5'));
        await capturedHandler(makeRequest(VALID_BODY, '5.5.5.5'));
        const otherIp = await capturedHandler(makeRequest(VALID_BODY, '6.6.6.6'));
        expect(otherIp.status).toBe(200);
    });

    it('نوع طلب غير صالح يُرفَض 400 قبل أي إدراج', async () => {
        const res = await capturedHandler(makeRequest({ ...VALID_BODY, application_type: 'hacker' }));
        expect(res.status).toBe(400);
        expect(insertedApplications).toHaveLength(0);
    });

    it('خطأ قاعدة البيانات الحقيقي يصل للمتصل لا رسالة عامة مبهمة (تدقيق 2026-07-22)', async () => {
        const res = await capturedHandler(makeRequest({ ...VALID_BODY, phone: '123' }));
        expect(res.status).toBe(400);
        const json = JSON.parse(await res.text());
        expect(json.error).toContain('phone');
    });
});

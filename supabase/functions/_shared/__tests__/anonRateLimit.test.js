/**
 * دفعة 3 من خطة إغلاق فجوات الطبقات الـ16: حدّ معدّل بمعرّف IP لمسارات عامة
 * بلا تسجيل دخول (public_applications).
 *
 * مراجعة عدائية 2026-08-27 وجدت عطلين حقيقيين في التصميم الأول وأُصلحا هنا:
 * (1) استخراج IP كان يأخذ أول عنصر في x-forwarded-for — قابل للتزييف الكامل
 *     من المتصل نفسه؛ صُحِّح لأخذ آخر عنصر (أقرب وسيط، خارج تحكم المتصل).
 * (2) التجزئة كانت SHA-256 عادياً بلا ملح — مجال IPv4 قابل للقوة الغاشمة؛
 *     صُحِّح لـHMAC-SHA256 بمفتاح SUPABASE_SERVICE_ROLE_KEY (سرّ موجود أصلاً).
 * يستخدم الآن Deno.env (عبر hmacSha256Hex/webhookVerify.ts غير مباشر) —
 * يحتاج تمويه globalThis.Deno قبل الاستيراد.
 *
 * تدقيق 2026-08-29 (سباق تزامن): checkAnonRateLimit لم يعد يستدعي .from()...
 * insert() مباشرة — التحقق والتسجيل صارا داخل استدعاء RPC ذرّي واحد
 * (check_and_record_anon_rate_limit، migration 20260829030000) محميّ بقفل
 * استشاري في قاعدة البيانات. هذه الاختبارات تُثبِّت سلوك *غلاف* checkAnonRateLimit
 * (تجزئة IP، تمرير المعاملات، fail-open) عبر عميل مموَّه لاستدعاء RPC — إثبات
 * الذرّية الفعلي بمحاكاة تزامن حقيقية موجود في rateLimitConcurrency.test.js.
 */
import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
    globalThis.Deno = { env: { get: (key) => (key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-service-role-key' : undefined) } };
});

function makeAdminClient(rpcResult) {
    const calls = [];
    return {
        _rpcCalls: calls,
        rpc: (fnName, args) => {
            calls.push({ fnName, args });
            return { single: async () => rpcResult };
        },
    };
}

describe('extractClientIp', () => {
    it('يستخرج آخر عنوان في x-forwarded-for (أقرب وسيط، خارج تحكم المتصل) — لا الأول القابل للتزييف', async () => {
        const { extractClientIp } = await import('../anonRateLimit.ts');
        // العميل قد يُرسل أي قيمة بنفسه في أول عنصر؛ آخر عنصر هو ما ألحقه آخر
        // وسيط قبل وصول الطلب مباشرة — هو غير القابل للتحكم من المهاجم.
        const req = { headers: { get: (h) => (h === 'x-forwarded-for' ? 'attacker-fake-ip, 1.2.3.4, 10.0.0.1' : null) } };
        expect(extractClientIp(req)).toBe('10.0.0.1');
    });

    it('عنصر واحد فقط في الترويسة (لا وسطاء) ⇒ يُستخدَم كما هو', async () => {
        const { extractClientIp } = await import('../anonRateLimit.ts');
        const req = { headers: { get: (h) => (h === 'x-forwarded-for' ? '5.5.5.5' : null) } };
        expect(extractClientIp(req)).toBe('5.5.5.5');
    });

    it('يرجع "unknown" حين يغيب الرأس كلياً (لا يرمي استثناءً)', async () => {
        const { extractClientIp } = await import('../anonRateLimit.ts');
        const req = { headers: { get: () => null } };
        expect(extractClientIp(req)).toBe('unknown');
    });

    it('[إثبات الحارس] استدعاء extractClientIp الحقيقية: القيمة المعادة ليست ما تحكّم به المهاجم في أول عنصر', async () => {
        const { extractClientIp } = await import('../anonRateLimit.ts');
        const req = { headers: { get: () => 'attacker-fake-ip, 1.2.3.4, 10.0.0.1' } };
        const ip = extractClientIp(req);
        expect(ip).not.toBe('attacker-fake-ip'); // العطل الأصلي: أول عنصر يمنح المهاجم تحكماً كاملاً بمعرّف الحدّ
        expect(ip).toBe('10.0.0.1');
    });
});

describe('checkAnonRateLimit — حدّ معدّل بمعرّف IP مُجزَّأ بـHMAC', () => {
    it('يسمح بالطلب الأول — الهاش HMAC (لا SHA-256 عادياً) يصل كمعامل RPC، لا IP الخام', async () => {
        const { checkAnonRateLimit } = await import('../anonRateLimit.ts');
        const adminClient = makeAdminClient({ data: { allowed: true, retry_after_seconds: null }, error: null });
        const result = await checkAnonRateLimit(adminClient, '9.9.9.9', 'submit-application', 3, 86400);
        expect(result.ok).toBe(true);
        expect(adminClient._rpcCalls).toHaveLength(1);
        expect(adminClient._rpcCalls[0].fnName).toBe('check_and_record_anon_rate_limit');
        // لا تمرير IP خام للـRPC إطلاقاً — فقط الهاش.
        expect(adminClient._rpcCalls[0].args.p_identifier_hash).not.toContain('9.9.9.9');
        expect(adminClient._rpcCalls[0].args.p_identifier_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('[إثبات المفتاح السرّي] نفس IP/endpoint بمفتاح سرّي مختلف ينتج هاشاً مختلفاً تماماً (ليس SHA-256 عادياً قابلاً لإعادة الحساب بلا مفتاح)', async () => {
        const { checkAnonRateLimit } = await import('../anonRateLimit.ts');
        const okResult = { data: { allowed: true, retry_after_seconds: null }, error: null };
        const client1 = makeAdminClient(okResult);
        await checkAnonRateLimit(client1, '9.9.9.9', 'submit-application', 3, 86400);

        globalThis.Deno.env.get = (key) => (key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'different-service-role-key' : undefined);
        const client2 = makeAdminClient(okResult);
        await checkAnonRateLimit(client2, '9.9.9.9', 'submit-application', 3, 86400);

        expect(client1._rpcCalls[0].args.p_identifier_hash).not.toBe(client2._rpcCalls[0].args.p_identifier_hash);
    });

    it('يرفض بعد بلوغ الحد الأقصى ضمن النافذة الزمنية (RPC الذرّي يُرجِع allowed:false)', async () => {
        const { checkAnonRateLimit } = await import('../anonRateLimit.ts');
        const adminClient = makeAdminClient({ data: { allowed: false, retry_after_seconds: 42 }, error: null });
        const result = await checkAnonRateLimit(adminClient, '9.9.9.9', 'submit-application', 3, 86400);
        expect(result.ok).toBe(false);
        expect(result.retryAfterSeconds).toBe(42);
    });

    it('[fail-open] فشل استدعاء RPC لا يحجب الطلب — عطل الحدّ نفسه لا يمنع خدمة شرعية', async () => {
        const { checkAnonRateLimit } = await import('../anonRateLimit.ts');
        const adminClient = makeAdminClient({ data: null, error: { message: 'boom' } });
        const result = await checkAnonRateLimit(adminClient, '9.9.9.9', 'submit-application', 3, 86400);
        expect(result.ok).toBe(true);
    });

    it('نفس IP على دالة (endpoint) مختلفة له عدّاد منفصل تماماً (الهاش يضمّن اسم الدالة)', async () => {
        const { checkAnonRateLimit } = await import('../anonRateLimit.ts');
        const okResult = { data: { allowed: true, retry_after_seconds: null }, error: null };
        const adminClient1 = makeAdminClient(okResult);
        await checkAnonRateLimit(adminClient1, '9.9.9.9', 'submit-application', 3, 86400);
        const adminClient2 = makeAdminClient(okResult);
        await checkAnonRateLimit(adminClient2, '9.9.9.9', 'other-endpoint', 3, 86400);
        expect(adminClient1._rpcCalls[0].args.p_identifier_hash).not.toBe(adminClient2._rpcCalls[0].args.p_identifier_hash);
    });
});

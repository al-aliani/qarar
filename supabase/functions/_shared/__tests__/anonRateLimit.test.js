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
 */
import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
    globalThis.Deno = { env: { get: (key) => (key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-service-role-key' : undefined) } };
});

function makeAdminClient(existingRows) {
    const inserted = [];
    return {
        _inserted: inserted,
        from: () => ({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        gte: () => ({
                            order: async () => ({ data: existingRows, error: null }),
                        }),
                    }),
                }),
            }),
            insert: async (row) => { inserted.push(row); return { error: null }; },
        }),
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

    it('[إثبات الحارس] العطل الأصلي: أخذ أول عنصر كان يمنح المهاجم تحكماً كاملاً بمعرّف الحدّ', () => {
        const oldExtractClientIp = (req) => {
            const forwarded = req.headers.get('x-forwarded-for') || '';
            return forwarded.split(',')[0]?.trim() || 'unknown';
        };
        const req = { headers: { get: () => 'attacker-fake-ip, 1.2.3.4, 10.0.0.1' } };
        expect(oldExtractClientIp(req)).toBe('attacker-fake-ip'); // قيمة يتحكم بها المهاجم بالكامل
    });
});

describe('checkAnonRateLimit — حدّ معدّل بمعرّف IP مُجزَّأ بـHMAC', () => {
    it('يسمح بالطلب الأول ويُدرِج حدثاً جديداً — الهاش HMAC لا SHA-256 عادياً', async () => {
        const { checkAnonRateLimit } = await import('../anonRateLimit.ts');
        const adminClient = makeAdminClient([]);
        const result = await checkAnonRateLimit(adminClient, '9.9.9.9', 'submit-application', 3, 86400);
        expect(result.ok).toBe(true);
        expect(adminClient._inserted).toHaveLength(1);
        // لا تخزين IP خام إطلاقاً — فقط الهاش.
        expect(adminClient._inserted[0].identifier_hash).not.toContain('9.9.9.9');
        expect(adminClient._inserted[0].identifier_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('[إثبات المفتاح السرّي] نفس IP/endpoint بمفتاح سرّي مختلف ينتج هاشاً مختلفاً تماماً (ليس SHA-256 عادياً قابلاً لإعادة الحساب بلا مفتاح)', async () => {
        const { checkAnonRateLimit } = await import('../anonRateLimit.ts');
        const client1 = makeAdminClient([]);
        await checkAnonRateLimit(client1, '9.9.9.9', 'submit-application', 3, 86400);

        globalThis.Deno.env.get = (key) => (key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'different-service-role-key' : undefined);
        const client2 = makeAdminClient([]);
        await checkAnonRateLimit(client2, '9.9.9.9', 'submit-application', 3, 86400);

        expect(client1._inserted[0].identifier_hash).not.toBe(client2._inserted[0].identifier_hash);
    });

    it('يرفض بعد بلوغ الحد الأقصى ضمن النافذة الزمنية', async () => {
        const { checkAnonRateLimit } = await import('../anonRateLimit.ts');
        const now = new Date().toISOString();
        const adminClient = makeAdminClient([{ created_at: now }, { created_at: now }, { created_at: now }]);
        const result = await checkAnonRateLimit(adminClient, '9.9.9.9', 'submit-application', 3, 86400);
        expect(result.ok).toBe(false);
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('[fail-open] فشل استعلام قاعدة البيانات لا يحجب الطلب — عطل الحدّ نفسه لا يمنع خدمة شرعية', async () => {
        const { checkAnonRateLimit } = await import('../anonRateLimit.ts');
        const adminClient = {
            from: () => ({
                select: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ order: async () => ({ data: null, error: { message: 'boom' } }) }) }) }) }),
                insert: async () => ({ error: null }),
            }),
        };
        const result = await checkAnonRateLimit(adminClient, '9.9.9.9', 'submit-application', 3, 86400);
        expect(result.ok).toBe(true);
    });

    it('نفس IP على دالة (endpoint) مختلفة له عدّاد منفصل تماماً (الهاش يضمّن اسم الدالة)', async () => {
        const { checkAnonRateLimit } = await import('../anonRateLimit.ts');
        const adminClient1 = makeAdminClient([]);
        await checkAnonRateLimit(adminClient1, '9.9.9.9', 'submit-application', 3, 86400);
        const adminClient2 = makeAdminClient([]);
        await checkAnonRateLimit(adminClient2, '9.9.9.9', 'other-endpoint', 3, 86400);
        expect(adminClient1._inserted[0].identifier_hash).not.toBe(adminClient2._inserted[0].identifier_hash);
    });
});

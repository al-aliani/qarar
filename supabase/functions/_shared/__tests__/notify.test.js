/**
 * اختبار insertNotification (إدراج صف في public.notifications عند دفع/مراجعة
 * ناجحة) عبر Vitest (Node) — نفس مبدأ alerting.test.js: الملف المصدر بلا أي
 * API خاص بـDeno (adminClient مُمرَّر كمعامل، لا createClient حقيقي)، فيُختبر
 * بعميل Supabase وهمي بلا شبكة حقيقية.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { insertNotification } from '../notify.ts';

function makeAdminClient(insertResult) {
    const insert = vi.fn().mockResolvedValue(insertResult);
    const from = vi.fn().mockReturnValue({ insert });
    return { from, insert };
}

describe('insertNotification', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('يُدرج صفاً بالحقول الصحيحة عبر جدول notifications عند نجاح الحدث', async () => {
        const adminClient = makeAdminClient({ error: null });

        await insertNotification(
            adminClient,
            {
                userId: 'user-123',
                type: 'payment',
                title: 'تم تأكيد دفعتك',
                body: 'وصلتنا دفعتك بنجاح، ويمكنك الآن تنزيل دراستك.',
                studyId: 'study-456',
            },
            'webhook-moyasar'
        );

        expect(adminClient.from).toHaveBeenCalledWith('notifications');
        expect(adminClient.insert).toHaveBeenCalledWith({
            user_id: 'user-123',
            type: 'payment',
            title: 'تم تأكيد دفعتك',
            body: 'وصلتنا دفعتك بنجاح، ويمكنك الآن تنزيل دراستك.',
            study_id: 'study-456',
        });
    });

    it('يستبدل body/studyId المفقودين بـnull بدل undefined (يطابق عمود nullable)', async () => {
        const adminClient = makeAdminClient({ error: null });

        await insertNotification(adminClient, { userId: 'user-1', type: 'review', title: 'بدأت مراجعة دراستك' }, 'reviewer-claim');

        expect(adminClient.insert).toHaveBeenCalledWith({
            user_id: 'user-1',
            type: 'review',
            title: 'بدأت مراجعة دراستك',
            body: null,
            study_id: null,
        });
    });

    it('تتخطى الإدراج كلياً (بلا أي نداء شبكة) حين يكون userId مفقوداً', async () => {
        const adminClient = makeAdminClient({ error: null });

        await insertNotification(adminClient, { userId: null, type: 'payment', title: 'تم تأكيد دفعتك' }, 'webhook-stripe');

        expect(adminClient.from).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('userId مفقود'));
    });

    it('لا تَرمي حين يُرجع insert خطأ (قيد قاعدة بيانات مثلاً) — تُسجِّل فقط', async () => {
        const adminClient = makeAdminClient({ error: { message: 'check constraint violated' } });

        await expect(
            insertNotification(adminClient, { userId: 'user-1', type: 'payment', title: 'تم تأكيد دفعتك' }, 'webhook-tamara')
        ).resolves.toBeUndefined();

        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('فشل إدراج الإشعار'),
            expect.objectContaining({ message: 'check constraint violated' })
        );
    });

    it('لا تَرمي حين يرمي adminClient.from/insert استثناءً فعلياً (عطل شبكة) — تُسجِّل فقط', async () => {
        const insert = vi.fn().mockRejectedValue(new Error('network down'));
        const adminClient = { from: vi.fn().mockReturnValue({ insert }) };

        await expect(
            insertNotification(adminClient, { userId: 'user-1', type: 'review', title: 'أعاد المراجع دراستك مع ملاحظات' }, 'reviewer-submit')
        ).resolves.toBeUndefined();

        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('استثناء أثناء إدراج الإشعار'), expect.any(Error));
    });

    it('حارس: فشل إدراج الإشعار لا يُسقط باقي معالجة الحدث المستدعي (نمط webhook)', async () => {
        // يحاكي بالضبط شكل الاستدعاء الفعلي في webhook-moyasar/stripe/tamara وreviewer-claim/
        // submit: await insertNotification(...) غير مُغلَّفة بـtry/catch من المستدعي، لأن
        // الدالة نفسها لا ترمي أبداً — إثبات أن الكود التالي مباشرة ينفَّذ فعلياً رغم فشل الإدراج.
        const adminClient = makeAdminClient({ error: { message: 'insert failed' } });

        async function simulateWebhookTail() {
            await insertNotification(adminClient, { userId: 'user-1', type: 'payment', title: 'تم تأكيد دفعتك' }, 'webhook-moyasar');
            return new Response('ok', { status: 200 }); // نفس سطر النهاية الفعلي في index.ts
        }

        const response = await simulateWebhookTail();
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('ok');
    });
});

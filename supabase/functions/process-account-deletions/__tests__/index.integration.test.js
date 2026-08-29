/**
 * تكامل حقيقي لدالة process-account-deletions (2026-08-29، تنفيذ حذف الحساب
 * بتفويض مالك صريح) — نفس نمط webhook-moyasar/__tests__/index.integration.test.js:
 * تمويه Deno.serve/Deno.env عبر globalThis (Deno.serve أثر جانبي وقت الاستيراد)،
 * والمعالج الحقيقي (capturedHandler) يُستدعى مباشرة، لا موك للمنطق نفسه — فقط
 * createClient/sendAlert مُموَّهان.
 *
 * يثبت الاختبارات الخمسة المطلوبة صراحة لهذه الميزة:
 * 1) طلب تجاوز فترة السماح (7 أيام) يُعالَج فعلياً (deleteUser + status=completed).
 * 2) طلب لم يتجاوز المهلة لا يُعالَج — عبر إثبات أن الاستعلام نفسه يُبنى بفلترة
 *    status='requested' ومهلة 7 أيام دقيقة (فالقاعدة الحقيقية لن تُعيده أصلاً).
 * 3) فشل جزئي (deleteUser أو تحديث status) يُبقي status='requested' ويستدعي sendAlert.
 * 4) orders لا يُلمَس إطلاقاً — الاستثناء بنيوي (ON DELETE SET NULL) لا كودي هنا.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SECRET = 'test-cron-secret';
let capturedHandler = null;

let dueRequests = [];
let updateCalls = [];
let deleteUserCalls = [];
let deleteUserShouldFail = false;
let failDeleteForUserId = null;
let updateShouldFail = false;
let fetchShouldFail = false;
let capturedQuery = null;

function buildAdminClient() {
    return {
        from: (table) => {
            if (table !== 'account_deletion_requests') {
                throw new Error(`unexpected table touched: ${table}`);
            }
            return {
                select: () => ({
                    eq: (col, val) => ({
                        lt: async (ltCol, ltVal) => {
                            capturedQuery = { statusFilter: val, cutoffColumn: ltCol, cutoffValue: ltVal };
                            if (fetchShouldFail) return { data: null, error: { message: 'fetch boom' } };
                            return { data: dueRequests, error: null };
                        },
                    }),
                }),
                update: (fields) => ({
                    eq: async (col, id) => {
                        updateCalls.push({ id, fields });
                        if (updateShouldFail) return { error: { message: 'update boom' } };
                        return { error: null };
                    },
                }),
            };
        },
        auth: {
            admin: {
                deleteUser: async (userId) => {
                    deleteUserCalls.push(userId);
                    if (deleteUserShouldFail || userId === failDeleteForUserId) {
                        return { error: { message: 'delete boom' } };
                    }
                    return { error: null };
                },
            },
        },
    };
}

vi.mock('npm:@supabase/supabase-js@2', () => ({
    createClient: () => buildAdminClient(),
}));

const sendAlertMock = vi.fn();
vi.mock('../../_shared/alerting.ts', () => ({ sendAlert: (...args) => sendAlertMock(...args) }));

beforeEach(async () => {
    dueRequests = [];
    updateCalls = [];
    deleteUserCalls = [];
    deleteUserShouldFail = false;
    failDeleteForUserId = null;
    updateShouldFail = false;
    fetchShouldFail = false;
    capturedQuery = null;
    capturedHandler = null;
    sendAlertMock.mockClear();

    globalThis.Deno = {
        serve: (handler) => { capturedHandler = handler; },
        env: {
            get: (key) => {
                if (key === 'ACCOUNT_DELETION_CRON_SECRET') return SECRET;
                if (key === 'SUPABASE_URL') return 'https://x.supabase.co';
                if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'x';
                return undefined;
            },
        },
    };
    vi.resetModules();
    await import('../index.ts');
});

function makeRequest({ authorized = true, method = 'POST' } = {}) {
    return {
        method,
        headers: { get: (name) => (name === 'Authorization' && authorized ? `Bearer ${SECRET}` : null) },
    };
}

describe('process-account-deletions/index.ts — بوابة الأمان (سرّ الاستدعاء المجدول)', () => {
    it('[إثبات الحارس] يرفض 401 بلا سرّ صحيح، ولا يلمس القاعدة إطلاقاً', async () => {
        const res = await capturedHandler(makeRequest({ authorized: false }));
        expect(res.status).toBe(401);
        expect(deleteUserCalls).toHaveLength(0);
        expect(capturedQuery).toBeNull();
    });

    it('يرفض أي method غير POST', async () => {
        const res = await capturedHandler(makeRequest({ method: 'GET' }));
        expect(res.status).toBe(405);
    });
});

describe('process-account-deletions/index.ts — [اختبار 1] طلب تجاوز فترة السماح يُعالَج فعلياً', () => {
    it('يستدعي auth.admin.deleteUser بالمستخدم الصحيح ويحدّث status إلى completed', async () => {
        dueRequests = [{ id: 'req-1', user_id: 'user-1', created_at: '2026-08-01T00:00:00Z' }];
        const res = await capturedHandler(makeRequest());
        expect(res.status).toBe(200);
        expect(deleteUserCalls).toEqual(['user-1']);
        expect(updateCalls).toEqual([{ id: 'req-1', fields: { status: 'completed' } }]);
    });

    it('user_id فارغ (SET NULL أطلقته مسبقاً عبر مسار آخر): لا يستدعي deleteUser، فقط يُكمل الطلب مباشرة', async () => {
        dueRequests = [{ id: 'req-1', user_id: null, created_at: '2026-08-01T00:00:00Z' }];
        await capturedHandler(makeRequest());
        expect(deleteUserCalls).toHaveLength(0);
        expect(updateCalls).toEqual([{ id: 'req-1', fields: { status: 'completed' } }]);
    });
});

describe('process-account-deletions/index.ts — [اختبار 2] طلب لم يتجاوز المهلة لا يُعالَج', () => {
    it('الاستعلام يُبنى فعلياً بفلترة status=requested ومهلة 7 أيام دقيقة — فالقاعدة الحقيقية لن تُعيد طلباً أحدث من ذلك أصلاً', async () => {
        dueRequests = [];
        await capturedHandler(makeRequest());
        expect(capturedQuery.statusFilter).toBe('requested');
        expect(capturedQuery.cutoffColumn).toBe('created_at');
        const cutoffMs = new Date(capturedQuery.cutoffValue).getTime();
        const expectedMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
        expect(Math.abs(cutoffMs - expectedMs)).toBeLessThan(5000);
    });

    it('لا طلبات مستحقة (تمثّل نتيجة استعلام قاعدة بيانات استبعدت طلباً حديثاً) ⇒ لا حذف ولا تحديث', async () => {
        dueRequests = [];
        const res = await capturedHandler(makeRequest());
        expect(res.status).toBe(200);
        expect(deleteUserCalls).toHaveLength(0);
        expect(updateCalls).toHaveLength(0);
    });
});

describe('process-account-deletions/index.ts — [اختبار 4] orders/account_deletion_requests لا تُحذَف', () => {
    it('لا يستدعي from() على أي جدول غير account_deletion_requests — orders لا يُلمَس إطلاقاً (buildAdminClient يرمي لو حدث ذلك)', async () => {
        dueRequests = [{ id: 'req-1', user_id: 'user-1', created_at: '2026-08-01T00:00:00Z' }];
        await expect(capturedHandler(makeRequest())).resolves.toBeDefined();
    });

    it('التحديث الوحيد الذي يحدث هو عمود status على account_deletion_requests — لا حذف للصف نفسه ولا لمس أي عمود آخر', async () => {
        dueRequests = [{ id: 'req-1', user_id: 'user-1', created_at: '2026-08-01T00:00:00Z' }];
        await capturedHandler(makeRequest());
        expect(updateCalls).toHaveLength(1);
        expect(updateCalls[0].fields).toEqual({ status: 'completed' });
    });
});

describe('process-account-deletions/index.ts — [اختبار 3] فشل جزئي لا يُعلَّم كمكتمل زوراً', () => {
    it('فشل auth.admin.deleteUser: status يبقى requested (لا تحديث لـcompleted)، وsendAlert يُستدعى', async () => {
        dueRequests = [{ id: 'req-1', user_id: 'user-1', created_at: '2026-08-01T00:00:00Z' }];
        deleteUserShouldFail = true;
        const res = await capturedHandler(makeRequest());
        expect(res.status).toBe(200);
        expect(updateCalls).toHaveLength(0);
        expect(sendAlertMock).toHaveBeenCalledTimes(1);
        const alertCtx = sendAlertMock.mock.calls[0][1];
        expect(alertCtx.message).toContain('req-1');
        expect(alertCtx.tags.source).toBe('process-account-deletions');
    });

    it('فشل تحديث status بعد نجاح الحذف فعلياً: الحذف لا يُتراجَع عنه، وsendAlert يُستدعى (لا يُبتلَع الخطأ صامتاً)', async () => {
        dueRequests = [{ id: 'req-1', user_id: 'user-1', created_at: '2026-08-01T00:00:00Z' }];
        updateShouldFail = true;
        const res = await capturedHandler(makeRequest());
        expect(res.status).toBe(200);
        expect(deleteUserCalls).toEqual(['user-1']);
        expect(sendAlertMock).toHaveBeenCalledTimes(1);
    });

    it('فشل الاستعلام الأولي عن الطلبات المستحقة: يستدعي sendAlert ويُعيد 500 (لا يبدو نجاحاً صامتاً)', async () => {
        fetchShouldFail = true;
        const res = await capturedHandler(makeRequest());
        expect(res.status).toBe(500);
        expect(sendAlertMock).toHaveBeenCalledTimes(1);
    });

    it('طلبان: أحدهما ينجح والآخر يفشل — الناجح يُكمَل فعلياً، الفاشل يبقى requested (لا يُفسِد أحدهما الآخر)', async () => {
        dueRequests = [
            { id: 'req-ok', user_id: 'user-ok', created_at: '2026-08-01T00:00:00Z' },
            { id: 'req-bad', user_id: 'user-bad', created_at: '2026-08-01T00:00:00Z' },
        ];
        failDeleteForUserId = 'user-bad';

        const res = await capturedHandler(makeRequest());
        expect(res.status).toBe(200);
        expect(deleteUserCalls).toEqual(['user-ok', 'user-bad']);
        // فقط الطلب الناجح حُدِّث إلى completed — الفاشل لم يُلمَس إطلاقاً (يبقى requested).
        expect(updateCalls).toEqual([{ id: 'req-ok', fields: { status: 'completed' } }]);
        expect(sendAlertMock).toHaveBeenCalledTimes(1);
        expect(sendAlertMock.mock.calls[0][1].message).toContain('req-bad');
    });
});

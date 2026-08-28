/**
 * دفعة 9 (2026-08-27، تغطية اختبارات الوحدات المشتركة): reviewerAuth.ts تستخدمه
 * الثلاث دوال reviewer-queue/claim/submit كلها لتحديد "مراجع نشط" — بلا أي اختبار
 * وحدة رغم أنه بوابة التفويض الوحيدة لكل مسار مراجعة الدراسات. لا تغيير سلوك هنا،
 * فقط تثبيت السلوك الحالي (بلا Deno APIs في هذا الملف — عميل Supabase مموَّه فقط).
 */
import { describe, it, expect, vi } from 'vitest';
import { verifyReviewer } from '../reviewerAuth.ts';

function fakeUserClient(getUserResult) {
    return { auth: { getUser: vi.fn(async () => getUserResult) } };
}

function fakeAdminClient(maybeSingleResult) {
    const maybeSingle = vi.fn(async () => maybeSingleResult);
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { client: { from }, from, select, eq, maybeSingle };
}

describe('verifyReviewer', () => {
    it('بلا JWT إطلاقاً ⇒ 401 missing_auth، بلا أي استدعاء لعميل المصادقة', async () => {
        const userClient = fakeUserClient({ data: { user: null }, error: null });
        const { client: adminClient } = fakeAdminClient({ data: null, error: null });

        const result = await verifyReviewer(userClient, adminClient, '');

        expect(result).toEqual({ ok: false, errorStatus: 401, errorBody: { error: 'missing_auth' } });
        expect(userClient.auth.getUser).not.toHaveBeenCalled();
    });

    it('JWT غير صالح (خطأ من auth.getUser) ⇒ 401 invalid_session', async () => {
        const userClient = fakeUserClient({ data: { user: null }, error: new Error('bad jwt') });
        const { client: adminClient } = fakeAdminClient({ data: null, error: null });

        const result = await verifyReviewer(userClient, adminClient, 'some.jwt.token');

        expect(result).toEqual({ ok: false, errorStatus: 401, errorBody: { error: 'invalid_session' } });
    });

    it('auth.getUser ينجح لكن بلا user في الرد ⇒ 401 invalid_session أيضاً', async () => {
        const userClient = fakeUserClient({ data: { user: null }, error: null });
        const { client: adminClient } = fakeAdminClient({ data: null, error: null });

        const result = await verifyReviewer(userClient, adminClient, 'some.jwt.token');

        expect(result).toEqual({ ok: false, errorStatus: 401, errorBody: { error: 'invalid_session' } });
    });

    it('مستخدم صالح لكن استعلام reviewers يفشل ⇒ 403 not_a_reviewer (فشل القراءة لا يُمنح ثقة)', async () => {
        const userClient = fakeUserClient({ data: { user: { id: 'user-1' } }, error: null });
        const { client: adminClient } = fakeAdminClient({ data: null, error: new Error('db down') });

        const result = await verifyReviewer(userClient, adminClient, 'some.jwt.token');

        expect(result).toEqual({ ok: false, errorStatus: 403, errorBody: { error: 'not_a_reviewer' } });
    });

    it('مستخدم صالح لكن لا صف reviewers مطابق (maybeSingle:null) ⇒ 403 not_a_reviewer', async () => {
        const userClient = fakeUserClient({ data: { user: { id: 'user-1' } }, error: null });
        const { client: adminClient } = fakeAdminClient({ data: null, error: null });

        const result = await verifyReviewer(userClient, adminClient, 'some.jwt.token');

        expect(result).toEqual({ ok: false, errorStatus: 403, errorBody: { error: 'not_a_reviewer' } });
    });

    it('صف reviewers موجود لكن active=false ⇒ 403 not_a_reviewer (عضوية غير مفعَّلة لا تُعامَل كمراجع)', async () => {
        const userClient = fakeUserClient({ data: { user: { id: 'user-1' } }, error: null });
        const { client: adminClient } = fakeAdminClient({ data: { id: 'user-1', active: false }, error: null });

        const result = await verifyReviewer(userClient, adminClient, 'some.jwt.token');

        expect(result).toEqual({ ok: false, errorStatus: 403, errorBody: { error: 'not_a_reviewer' } });
    });

    it('مراجع نشط فعلياً (active=true) ⇒ ok:true بمعرّف المستخدم من JWT نفسه', async () => {
        const userClient = fakeUserClient({ data: { user: { id: 'user-42' } }, error: null });
        const { client: adminClient, from, eq } = fakeAdminClient({ data: { id: 'user-42', active: true }, error: null });

        const result = await verifyReviewer(userClient, adminClient, 'some.jwt.token');

        expect(result).toEqual({ ok: true, reviewerId: 'user-42' });
        expect(from).toHaveBeenCalledWith('reviewers');
        // الهوية المستعلَم عنها يجب أن تكون هوية JWT نفسها — لا أي قيمة من جسم الطلب
        // (هذه الدالة لا تستقبل أي معرّف خارجي إطلاقاً؛ التحقق هنا يثبّت ذلك التصميم).
        expect(eq).toHaveBeenCalledWith('id', 'user-42');
    });
});

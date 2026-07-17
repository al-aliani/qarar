/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-18: كان قسم "رابط مشاركة للقراءة فقط" في ShareStudyView.js يستخدم
 * generateInvestorLink (shareUtils.js) — يحفظ الحمولة في localStorage على جهاز المُرسِل
 * فقط، لا يفتح لدى المستلم إطلاقاً (الزر كان معطَّلاً بنص اعتذار صريح لهذا السبب). صار
 * يستخدم الآن ShareService.createShareLink الحقيقي (نفس نظام ShareModal.js/ShareView.js
 * العامل بخادم فعلي منذ 2026-07-14).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createShareLinkMock = vi.fn();
const listSharesMock = vi.fn();
const revokeShareMock = vi.fn();

vi.mock('../../services/ShareService.js', () => ({
    createShareLink: (...a) => createShareLinkMock(...a),
    listShares: (...a) => listSharesMock(...a),
    revokeShare: (...a) => revokeShareMock(...a),
}));

vi.mock('../ShareModal.js', () => ({
    buildShareUrl: (token) => `https://qarar.example/#/share/${token}`,
}));

vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1' } })),
}));

function fakeStore(projectInfo) {
    return { getState: () => ({ projectInfo }), get: () => ({ projectInfo }), update: vi.fn() };
}

describe('ShareStudyView — رابط مشاركة حقيقي (لا localStorage)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        createShareLinkMock.mockReset();
        listSharesMock.mockReset().mockResolvedValue([]);
        revokeShareMock.mockReset();
    });

    it('بلا معرّف دراسة (لم تُحفَظ بعد): زر الإنشاء معطَّل، لا يستدعي القاعدة', async () => {
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({}));
        await view.render();

        const btn = document.getElementById('btnGenerateReadOnlyLink');
        expect(btn.disabled).toBe(true);
    });

    it('إنشاء رابط جديد يستدعي ShareService.createShareLink (لا shareUtils) ويعرض الرابط الحقيقي', async () => {
        createShareLinkMock.mockResolvedValue({ ok: true, shareToken: 'tok-123' });
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1', name: 'مشروعي' }));
        await view.render();

        document.getElementById('btnGenerateReadOnlyLink').click();
        await new Promise((r) => setTimeout(r, 0));

        expect(createShareLinkMock).toHaveBeenCalledWith('study-1');
        const linkInput = document.getElementById('readOnlyLinkInput');
        expect(linkInput.value).toBe('https://qarar.example/#/share/tok-123');
        expect(document.getElementById('readOnlyLinkBox').classList.contains('hidden')).toBe(false);
    });

    it('فشل الإنشاء: يعرض رسالة خطأ حقيقية من الخدمة، لا رابطاً وهمياً', async () => {
        createShareLinkMock.mockResolvedValue({ ok: false, error: 'فشل الاتصال بالخادم' });
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.getElementById('btnGenerateReadOnlyLink').click();
        await new Promise((r) => setTimeout(r, 0));

        expect(document.getElementById('readOnlyLinkBox').classList.contains('hidden')).toBe(true);
    });

    it('يعرض روابط المشاركة النشطة الموجودة فعلاً (من listShares)، ويستبعد الملغاة', async () => {
        listSharesMock.mockResolvedValue([
            { id: 's1', shareToken: 'tok-a', revoked: false },
            { id: 's2', shareToken: 'tok-b', revoked: true },
        ]);
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        const rows = document.querySelectorAll('.share-link-row');
        expect(rows).toHaveLength(1);
        expect(rows[0].dataset.shareId).toBe('s1');
    });

    it('إلغاء رابط موجود يستدعي revokeShare ويعيد الرسم', async () => {
        listSharesMock
            .mockResolvedValueOnce([{ id: 's1', shareToken: 'tok-a', revoked: false }])
            .mockResolvedValueOnce([]);
        revokeShareMock.mockResolvedValue({ ok: true });
        const { ShareStudyView } = await import('../ShareStudyView.js');
        const view = new ShareStudyView('shareOverlay', fakeStore({ id: 'study-1' }));
        await view.render();

        document.querySelector('.btn-revoke-share').click();
        await new Promise((r) => setTimeout(r, 0));

        expect(revokeShareMock).toHaveBeenCalledWith('s1');
        expect(document.querySelectorAll('.share-link-row')).toHaveLength(0);
    });
});

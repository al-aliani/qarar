/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-18: بعد توحيد المشاركة (ShareStudyView.js تستخدم الآن نفس نظام
 * ShareView.js الحقيقي)، أُضيف تتبّع مشاهدات (نمط DocSend). recordShareView يُستدعى
 * مرة واحدة فقط عند نجاح الرسم — لا لرابط غير صالح/منتهٍ (لا معنى لتسجيل مشاهدة لرابط
 * لم يُعرَض فيه شيء أصلاً).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSharedStudyMock = vi.fn();
const recordShareViewMock = vi.fn();

vi.mock('../../services/ShareService.js', () => ({
    getSharedStudy: (...a) => getSharedStudyMock(...a),
    recordShareView: (...a) => recordShareViewMock(...a),
}));

vi.mock('../../services/InternalAIGenerator.js', () => ({
    generateExecutiveSummary: vi.fn(() => 'ملخص تنفيذي تجريبي.'),
}));

describe('ShareView — تسجيل مشاهدة الرابط (نمط DocSend)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        getSharedStudyMock.mockReset();
        recordShareViewMock.mockReset();
    });

    it('رابط صالح: يستدعي recordShareView بنفس التوكن مرة واحدة', async () => {
        getSharedStudyMock.mockResolvedValue({
            title: 'مشروعي', sector: 'fnb', permission: 'view',
            data: { projectInfo: { name: 'مشروعي' }, engineResults: {} },
        });
        const { ShareView } = await import('../ShareView.js');
        const view = new ShareView('root', {}, null);
        await view.render('tok-abc');

        expect(recordShareViewMock).toHaveBeenCalledWith('tok-abc');
        expect(recordShareViewMock).toHaveBeenCalledTimes(1);
    });

    it('رابط غير صالح/منتهٍ (getSharedStudy تُعيد null): لا يستدعي recordShareView إطلاقاً', async () => {
        getSharedStudyMock.mockResolvedValue(null);
        const { ShareView } = await import('../ShareView.js');
        const view = new ShareView('root', {}, null);
        await view.render('tok-expired');

        expect(recordShareViewMock).not.toHaveBeenCalled();
        expect(document.getElementById('root').textContent).toContain('غير صالح');
    });

    it('بلا shareToken إطلاقاً: لا يستدعي getSharedStudy ولا recordShareView', async () => {
        const { ShareView } = await import('../ShareView.js');
        const view = new ShareView('root', {}, null);
        await view.render(null);

        expect(getSharedStudyMock).not.toHaveBeenCalled();
        expect(recordShareViewMock).not.toHaveBeenCalled();
    });
});

describe('ShareView — حلقة نمو: زر "جرّب مجاناً" يحمل توكن المشاركة', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="root"></div>';
        getSharedStudyMock.mockReset().mockResolvedValue({
            title: 'مشروعي', sector: 'fnb', permission: 'view',
            data: { projectInfo: { name: 'مشروعي' }, engineResults: {} },
        });
        recordShareViewMock.mockReset();
    });

    it('النقر يوجّه لجذر الصفحة مع ?ref=<shareToken>، بلا hash', async () => {
        const { ShareView } = await import('../ShareView.js');
        const view = new ShareView('root', {}, null);
        await view.render('tok-abc');

        delete window.location;
        window.location = new URL('https://qarar.example/#/share/tok-abc');
        let assignedHref = null;
        Object.defineProperty(window.location, 'href', {
            set(value) { assignedHref = value; },
            get() { return 'https://qarar.example/#/share/tok-abc'; },
        });

        document.getElementById('btnTryFreeReferral').click();

        expect(assignedHref).toBeTruthy();
        const url = new URL(assignedHref);
        expect(url.searchParams.get('ref')).toBe('tok-abc');
        expect(url.hash).toBe('');
    });
});

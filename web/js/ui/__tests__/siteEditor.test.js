/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/SiteContentService.js', () => ({
    listPages: vi.fn(async () => ({ ok: true, data: [{ id: '1', slug: 'home', title: 'الرئيسية', status: 'published', template: 'landing', updated_at: '2026-09-17T00:00:00Z', content: { hero: { title: 'عنوان' }, sections: [] } }] })),
    listNavigation: vi.fn(async () => ({ ok: true, data: [] })),
    listPartners: vi.fn(async () => ({ ok: true, data: [] })),
    savePage: vi.fn(async (page) => ({ ok: true, data: { ...page, id: '1', updated_at: '2026-09-17T00:00:00Z' } })),
    deletePage: vi.fn(), saveNavigation: vi.fn(), deleteNavigation: vi.fn(), savePartner: vi.fn(), deletePartner: vi.fn(), uploadMedia: vi.fn(), listMedia: vi.fn(async () => ({ ok: true, data: [] })), deleteMedia: vi.fn(), listRevisions: vi.fn(async () => ({ ok: true, data: [] })),
}));
vi.mock('../../utils/toast.js', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { SiteEditorView } = await import('../SiteEditorView.js');
const service = await import('../../services/SiteContentService.js');

describe('SiteEditorView', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="editor"></div>'; });

    it('يعرض إدارة الصفحات والقوائم والشركاء والصور', async () => {
        const view = new SiteEditorView(document.getElementById('editor'));
        await view.render();
        expect(document.body.textContent).toContain('محرر الموقع');
        expect(document.body.textContent).toContain('القوائم والروابط');
        expect(document.body.textContent).toContain('مكتبة الصور');
        expect(document.body.textContent).toContain('الرئيسية');
    });

    it('يحفظ تعديلات الصفحة من حقول مرئية من دون JSON أو كود', async () => {
        const view = new SiteEditorView(document.getElementById('editor'));
        await view.render();
        document.querySelector('[data-edit-page="1"]').click();
        const form = document.getElementById('cmsPageForm');
        form.elements.namedItem('hero_title').value = 'عنوان جديد';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await vi.waitFor(() => expect(service.savePage).toHaveBeenCalled());
        expect(service.savePage.mock.calls[0][0].content.hero.title).toBe('عنوان جديد');
        expect(service.savePage.mock.calls[0][0].slug).toBe('home');
    });
});

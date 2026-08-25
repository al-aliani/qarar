/**
 * @vitest-environment jsdom
 *
 * الدفعة الثانية من عقد الوصول: الأسطح الخمسة التي بقيت خارج ترحيل modalA11y رغم
 * حملها role="dialog" و aria-modal="true". القياس قبل الإصلاح:
 *   ExportMenu            — Escape ✓، حبس ✓ (نسخة يدوية)، إعادة تركيز ✗
 *   DatabaseCompanyPicker — Escape ✓، حبس ✗، إعادة تركيز جزئية
 *   DatabaseFilesView     — Escape ✓، حبس ✗، إعادة تركيز ✗
 *   ShareStudyView        — Escape ✓، حبس ✗، إعادة تركيز ✗
 *   TemplateGallery       — Escape ✓، حبس ✗، إعادة تركيز ✗
 *
 * aria-modal بلا حبس Tab أسوأ من غيابه: يُخبر قارئ الشاشة أن ما خلف النافذة مُخفى
 * بينما Tab يهرب إليه فعلاً — لذلك كل سطح هنا يمرّ بالرحلة كاملة: زر حقيقي يفتح ⟸
 * التركيز بالداخل ⟸ Tab لا يخرج ⟸ Escape يُغلق ⟸ الإغلاق يُعيد التركيز للزر نفسه،
 * وحتى إن أُزيل الزر الفاتح من DOM أثناء الفتح.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEmptyStudy } from '../../core/schema.js';

// شبكة فعلية ممنوعة في الاختبار: getAuthUser وحده هو ما تستدعيه ShareStudyView.
vi.mock('../../../supabaseClient.js', async (importOriginal) => ({
    ...(await importOriginal()),
    getAuthUser: vi.fn(async () => ({ user: { id: 'u1', email: 'owner@example.com' }, ok: true }))
}));

vi.mock('../../services/ShareService.js', () => ({
    listShares: vi.fn(async () => []),
    createShareLink: vi.fn(async () => ({ ok: true, shareToken: 't1' })),
    revokeShare: vi.fn(async () => ({ ok: true }))
}));

function fakeStore() {
    const state = createEmptyStudy();
    state.projectInfo.name = 'مشروع اختبار';
    state.projectInfo.id = null;       // يتخطّى شارة المراجعة (نداء شبكة لا علاقة له بالوصول)
    return {
        getState: () => state,
        get: () => state,
        update: vi.fn(),
        updatePath: vi.fn(),
        notify: vi.fn(),
        save: vi.fn()
    };
}

/** صفحة فيها منطقة محتوى وزر يفتح النافذة — كما يحدث فعلياً في التطبيق. */
function pageWithOpener() {
    document.body.innerHTML = '<main id="appMain"><button id="opener">افتح</button><div id="host"></div></main>';
    const opener = document.getElementById('opener');
    opener.focus();
    return opener;
}

function pressKey(key, { shift = false } = {}) {
    const event = new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true });
    (document.activeElement || document.body).dispatchEvent(event);
    return event;
}

/** نفس فلترة modalA11y: العناصر القابلة للتركيز *والمرئية* (بطاقات التصدير المخفية بمسار). */
function focusablesIn(root) {
    const all = Array.from(root.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    return all.filter((el) => {
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
            if (n.hidden || n.style?.display === 'none' || n.style?.visibility === 'hidden') return false;
        }
        return true;
    });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const SURFACES = [
    {
        name: 'ExportMenu',
        async build() {
            document.getElementById('host').insertAdjacentHTML('beforeend', '<div id="exportMenuOverlay"></div>');
            const { ExportMenu } = await import('../ExportMenu.js');
            const menu = new ExportMenu('exportMenuOverlay', fakeStore());
            return {
                open: () => menu.open(),
                close: () => menu.close(),
                root: () => menu.overlay,
                isOpen: () => menu.overlay.classList.contains('is-open')
            };
        }
    },
    {
        name: 'DatabaseCompanyPicker',
        async build() {
            global.fetch = vi.fn(async () => ({
                ok: true,
                json: async () => ({ groups: [{ id: 'g1', label: 'مطاعم', files: [{ id: 'f1', title: 'دليل المطاعم' }] }] })
            }));
            const { DatabaseCompanyPicker } = await import('../DatabaseCompanyPicker.js');
            const picker = new DatabaseCompanyPicker({ onAdd: vi.fn() });
            return {
                open: () => picker.open('suppliers'),
                close: () => picker.close(),
                root: () => picker.overlay,
                isOpen: () => picker.overlay.classList.contains('is-open')
            };
        }
    },
    {
        name: 'DatabaseFilesView (معاينة ملف)',
        async build() {
            // fetch يفشل عمداً: مسار الخطأ يرسم نفس بطاقة الحوار بأزرار الإغلاق،
            // بلا تحميل exceljs الفعلي (لا علاقة له بعقد الوصول).
            global.fetch = vi.fn(async () => { throw new Error('offline'); });
            const { DatabaseFilesView } = await import('../DatabaseFilesView.js');
            const view = new DatabaseFilesView('host');
            view.loaded = true;
            view.catalog = {
                totalFiles: 1,
                totalGroups: 1,
                groups: [{
                    id: 'g1', label: 'مجال', description: 'وصف', count: 1,
                    files: [{ id: 'f1', title: 'ملف', formatLabel: 'xlsx', sizeLabel: '1MB', url: '/f1.xlsx', downloadName: 'f1.xlsx' }]
                }]
            };
            await view.render();
            return {
                // زر «معاينة المحتوى» نفسه هو الفاتح — لا استدعاء داخلي مباشر.
                opener: () => document.querySelector('[data-preview-file]'),
                open: async () => { document.querySelector('[data-preview-file]').click(); await flush(); },
                close: () => view._closePreview(),
                root: () => view.previewOverlay,
                isOpen: () => !!view.previewOverlay?.classList.contains('is-open')
            };
        }
    },
    {
        name: 'ShareStudyView',
        async build() {
            document.getElementById('host').insertAdjacentHTML('beforeend', '<div id="shareStudyOverlay"></div>');
            const { ShareStudyView } = await import('../ShareStudyView.js');
            const view = new ShareStudyView('shareStudyOverlay', fakeStore(), {});
            return {
                open: () => view.open(),
                close: () => view.close(),
                root: () => view.overlay,
                isOpen: () => view.overlay.classList.contains('is-open')
            };
        }
    },
    {
        name: 'TemplateGallery',
        async build() {
            document.getElementById('host').insertAdjacentHTML('beforeend', '<div id="templateGalleryOverlay" class="modal-overlay"></div>');
            const { TemplateGallery } = await import('../TemplateGallery.js');
            const gallery = new TemplateGallery('templateGalleryOverlay', fakeStore());
            return {
                open: () => gallery.open(),
                close: () => gallery.close(),
                root: () => gallery.overlay,
                isOpen: () => gallery.overlay.classList.contains('is-open')
            };
        }
    }
];

describe('عقد الوصول — الأسطح الخمسة المتبقية', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    for (const spec of SURFACES) {
        describe(spec.name, () => {
            it('عند الفتح ينتقل التركيز إلى داخل النافذة', async () => {
                const pageOpener = pageWithOpener();
                const h = await spec.build();
                const opener = h.opener ? h.opener() : pageOpener;
                opener.focus();

                await h.open();

                expect(document.activeElement).not.toBe(opener);
                expect(document.activeElement).not.toBe(document.body);
                expect(h.root().contains(document.activeElement)).toBe(true);
                await h.close();
            });

            it('Tab لا يخرج التركيز من النافذة (ذهاباً وإياباً)', async () => {
                const pageOpener = pageWithOpener();
                const h = await spec.build();
                (h.opener ? h.opener() : pageOpener).focus();
                await h.open();

                const dialog = h.root().querySelector('[role="dialog"]') || h.root();
                const items = focusablesIn(dialog);
                expect(items.length).toBeGreaterThan(0);

                items[items.length - 1].focus();
                const forward = pressKey('Tab');
                expect(forward.defaultPrevented).toBe(true);
                expect(dialog.contains(document.activeElement)).toBe(true);

                items[0].focus();
                const backward = pressKey('Tab', { shift: true });
                expect(backward.defaultPrevented).toBe(true);
                expect(dialog.contains(document.activeElement)).toBe(true);

                await h.close();
            });

            it('Escape يُغلق النافذة ويُعيد التركيز للعنصر الفاتح', async () => {
                const pageOpener = pageWithOpener();
                const h = await spec.build();
                const opener = h.opener ? h.opener() : pageOpener;
                opener.focus();
                await h.open();
                expect(h.isOpen()).toBe(true);

                pressKey('Escape');
                await flush();

                expect(h.isOpen()).toBe(false);
                expect(document.activeElement).toBe(opener);
            });

            it('الإغلاق يُعيد التركيز إلى العنصر الذي فتح النافذة', async () => {
                const pageOpener = pageWithOpener();
                const h = await spec.build();
                const opener = h.opener ? h.opener() : pageOpener;
                opener.focus();
                await h.open();
                expect(document.activeElement).not.toBe(opener);

                await h.close();

                expect(document.activeElement).toBe(opener);
            });

            it('الإغلاق لا يُضيّع التركيز إن أُزيل العنصر الفاتح من DOM أثناء الفتح', async () => {
                const pageOpener = pageWithOpener();
                const h = await spec.build();
                const opener = h.opener ? h.opener() : pageOpener;
                opener.focus();
                await h.open();

                opener.remove();               // إعادة رسم الصفحة خلف النافذة
                await h.close();

                expect(document.activeElement).toBe(document.getElementById('appMain'));
                expect(document.activeElement).not.toBe(document.body);
            });
        });
    }
});

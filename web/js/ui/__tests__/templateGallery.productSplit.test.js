/**
 * @vitest-environment jsdom
 *
 * تدقيق جولة الموقع 2026-07-20 (بند #3): معالج التأسيس كان يقسّم نص المنتجات على
 * سلسلة حرفية مزدوجة الهروب بدل سطر جديد حقيقي، والتعبير النمطي لإزالة الترقيم مزدوج
 * الهروب أيضاً — فكل المنتجات المتعددة الأسطر تُدمَج في منتج واحد مشوّه يغذّي نموذج
 * الإيراد خطأً. الإصلاح: سطر جديد حقيقي وتعبير نمطي صحيح غير مزدوج الهروب.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateGallery } from '../TemplateGallery.js';

function fakeStore() {
    return {
        getState: () => ({}),
        reset: async () => {},
        update: () => {},
        updatePath: vi.fn(),
        flush: async () => {}
    };
}

describe('TemplateGallery — تقسيم المنتجات في معالج التأسيس', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('يقسّم منتجات متعددة الأسطر إلى عناصر منفصلة ويزيل الترقيم (لا يدمجها في منتج واحد)', async () => {
        const store = fakeStore();
        const gallery = new TemplateGallery('templateGalleryOverlay', store);
        gallery.open();

        document.querySelector('#btnStartBlank').click();
        document.querySelector('#btnBlankCreate').click(); // الوضع «مفصل» الافتراضي
        await Promise.resolve();

        // الخطوة 1: فكرة المشروع
        document.querySelector('#fw_projectName').value = 'مقهى مختص';
        document.querySelector('#fw_btnNext').click();

        // الخطوة 2: المنتجات (ثلاثة أسطر حقيقية مع ترقيم)
        document.querySelector('#fw_products').value = '1. قهوة\n2. شاي\n3. حلى مخبوزات';
        document.querySelector('#fw_btnNext').click();

        // الخطوة 3: إنهاء المعالج
        document.querySelector('#fw_btnNext').click();
        await Promise.resolve();

        const productsCall = store.updatePath.mock.calls.find(
            ([section, path]) => section === 'projectInfo' && path === 'products'
        );
        expect(productsCall).toBeTruthy();
        const list = productsCall[2];
        expect(list).toHaveLength(3);
        expect(list.map((p) => p.name)).toEqual(['قهوة', 'شاي', 'حلى مخبوزات']);
    });
});

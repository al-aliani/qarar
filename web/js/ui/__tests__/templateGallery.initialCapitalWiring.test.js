/**
 * @vitest-environment jsdom
 *
 * اختبار تجربة مستخدم 2026-07-19 (شخصية شريك/مستثمر): سؤال «رأس المال التقديري
 * المتوفر» في نافذة إنشاء الدراسة (الخطوة 3/3) كان يكتب القيمة في financing.equity
 * — حقل غير موجود بالمخطط، لا يقرأه أي شيء في المحرك (engine.js) — فتُهمَل إجابة
 * المستخدم بصمت، ويبقى IRR/فترة الاسترداد "غير قابل للحساب" رغم أن المستخدم أدخل
 * رقماً فعلياً. المسار الصحيح: financing.sources.equity.amount (نفس ما تقرأه
 * paidCapital/fundingGap في engine.js ونفس ما تكتبه لوحة «معايرة سريعة»).
 * انظر [[qarar-irr-payback-broken-capex-gap-2026-07-19]] في ذاكرة المشروع.
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

describe('TemplateGallery — سؤال رأس المال التقديري عند إنشاء دراسة جديدة', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('يكتب القيمة في financing.sources.equity.amount (المسار الحقيقي الذي يقرأه المحرك)، لا financing.equity الميت', async () => {
        const store = fakeStore();
        const gallery = new TemplateGallery('templateGalleryOverlay', store);
        gallery.open();

        document.querySelector('#btnStartBlank').click();
        document.querySelector('#btnBlankCreate').click(); // وضع "مفصل" الافتراضي
        await Promise.resolve(); // startWizard() تنتظر store.reset() قبل رسم الخطوة 1

        // الخطوة 1: فكرة المشروع
        document.querySelector('#fw_projectName').value = 'عيادة أسنان - حي الملقا';
        document.querySelector('#fw_btnNext').click();

        // الخطوة 2: المنتجات والخدمات
        document.querySelector('#fw_btnNext').click();

        // الخطوة 3: الاستثمار المبدئي
        const capitalInput = document.querySelector('#fw_initialCapital');
        expect(capitalInput).not.toBeNull();
        capitalInput.value = '300000';
        document.querySelector('#fw_btnNext').click();
        await Promise.resolve();

        const equityCalls = store.updatePath.mock.calls.filter(([section]) => section === 'financing');
        expect(equityCalls).toContainEqual(['financing', 'sources.equity.amount', 300000]);
        expect(equityCalls.some(([, path]) => path === 'equity')).toBe(false);
    });
});

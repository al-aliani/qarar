/**
 * بند 3 (بانر إصدار المحرك، 2026-08-29): «رقم إصدار الدراسة» المطبوع في التقرير
 * (تحت "رقم إصدار الدراسة") كان state.version — إصدار المخطط الثابت تقريباً
 * (schema.js:95، لا علاقة له بمنطق الحساب) — لا ENGINE_VERSION الفعلي (engine.js).
 * تقريران بنفس هذا "الإصدار" (دائماً "4.0.0" تقريباً) قد يحملان NPV مختلفاً تماماً
 * بسبب تغيّر معادلات المحرك بينهما، بلا أي أثر مطبوع يكشف ذلك لممول يقارن تقريرين.
 *
 * كذلك يثبّت هذا الملف بلوكر «المحو الذاتي»: generateHTML كانت تستدعي store.update()
 * العادية (تُفعِّل سلسلة الحفظ الكاملة) بعد إعادة حساب النتائج — فتصدير تقرير كان هو
 * نفسه ما يمحو وسم _meta.engineVersion الذي يُبنى عليه تنبيه ProjectOverviewView.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

function makeStore(state) {
    return { getState: () => state, update: vi.fn(), updateSectionInMemory: vi.fn() };
}

const BASE_STATE = {
    projectInfo: { name: 'مشروع اختبار', concept: 'اختبار' },
    version: '4.0.0', // إصدار المخطط — لا يجب أن يظهر تحت "رقم إصدار الدراسة" بعد الإصلاح
};

describe('ReportGenerator — رقم الإصدار المطبوع في التقرير يعكس ENGINE_VERSION لا state.version', () => {
    afterEach(() => {
        vi.doUnmock('../../core/engine.js');
        vi.resetModules();
    });

    it('يطبع ENGINE_VERSION الحقيقي الحالي — لا "4.0.0" الثابت من schema.js', async () => {
        const { ReportGenerator } = await import('../ReportGenerator.js');
        const { ENGINE_VERSION } = await import('../../core/engine.js');
        const html = ReportGenerator.generateHTML(makeStore(BASE_STATE));

        expect(html).toContain('رقم إصدار الدراسة');
        expect(html).toContain(ENGINE_VERSION);
    });

    it('[إثبات الحارس] رقمان مختلفان من ENGINE_VERSION ينتجان طباعتين مختلفتين لنفس الدراسة تماماً', async () => {
        // نفس state حرفياً في الاستيرادين — الفرق الوحيد بينهما هو ENGINE_VERSION،
        // فلو أعاد الكود قراءة state.version بدلاً منه (الخلل الأصلي) لطبع الاثنان
        // "4.0.0" نفسها ولفشل هذا التوقع تحديداً.
        vi.doMock('../../core/engine.js', async (importOriginal) => ({
            ...(await importOriginal()),
            ENGINE_VERSION: 'engine-v1',
        }));
        vi.resetModules();
        const { ReportGenerator: RG1 } = await import('../ReportGenerator.js');
        const htmlV1 = RG1.generateHTML(makeStore(BASE_STATE));
        expect(htmlV1).toContain('engine-v1');

        vi.doMock('../../core/engine.js', async (importOriginal) => ({
            ...(await importOriginal()),
            ENGINE_VERSION: 'engine-v2-changed',
        }));
        vi.resetModules();
        const { ReportGenerator: RG2 } = await import('../ReportGenerator.js');
        const htmlV2 = RG2.generateHTML(makeStore(BASE_STATE));
        expect(htmlV2).toContain('engine-v2-changed');
        expect(htmlV2).not.toContain('engine-v1');

        // وكلا الطباعتين تبقيان بلا أي أثر لإصدار المخطط الثابت state.version="4.0.0"
        // تحت عنوان "رقم إصدار الدراسة" تحديداً.
        expect(htmlV1).not.toBe(htmlV2);
    });

    it('لا تلمس store.update() العادية عند إعادة حساب نتائج التقرير — تستخدم updateSectionInMemory (لا تُفعِّل سلسلة الحفظ)', async () => {
        const { ReportGenerator } = await import('../ReportGenerator.js');
        const store = makeStore(BASE_STATE);
        ReportGenerator.generateHTML(store);

        expect(store.updateSectionInMemory).toHaveBeenCalledWith('results', expect.any(Object));
        expect(store.update).not.toHaveBeenCalled();
    });
});

/**
 * @vitest-environment jsdom
 *
 * تحقّق حي 2026-07-15 (ثلاث محاولات منفصلة: إنشاء دراسة بكل وضع على حدة) كشف نقطتي
 * ضعف في نافذة اختيار مستوى التفصيل (مصغّر/بسيط/مفصل) بعد اختيار «مشروع فارغ»:
 *   1) البطاقات لا تذكر عدد خطوات تقريبي يساعد على تقدير الوقت قبل الاختيار.
 *   2) البطاقة المُفعّلة عند إعادة فتح النافذة تبقى آخر اختيار يدوي سابق (عبر
 *      appSettings.mode المتبقي في المخزن من الدراسة السابقة) بدل «مفصل» دائماً.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { TemplateGallery } from '../TemplateGallery.js';

function fakeStore(appSettingsMode) {
    const state = appSettingsMode ? { appSettings: { mode: appSettingsMode } } : {};
    return {
        getState: () => state,
        reset: async () => {},
        update: () => {},
        updatePath: () => {},
        flush: async () => {}
    };
}

/** يفتح المعرض وينقر بطاقة «مشروع فارغ» — نفس مسار المستخدم الفعلي لبلوغ نموذج الأوضاع. */
function openBlankModeForm(store) {
    const gallery = new TemplateGallery('templateGalleryOverlay', store);
    gallery.open();
    document.querySelector('.template-card[data-id="empty"]').click();
    return gallery;
}

describe('TemplateGallery — نافذة مستوى تفصيل الدراسة (مشروع فارغ)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('كل بطاقة وضع تذكر عدد خطوات تقريبي حقيقي محسوب من wizardSteps.js، لا وصفاً عاماً فقط', () => {
        openBlankModeForm(fakeStore());

        const miniDesc = document.querySelector('.mode-card[data-mode="mini"] .mode-card__desc').textContent;
        const simpleDesc = document.querySelector('.mode-card[data-mode="simple"] .mode-card__desc').textContent;
        const advancedDesc = document.querySelector('.mode-card[data-mode="advanced"] .mode-card__desc').textContent;

        expect(miniDesc).toContain('7 خطوات');
        expect(simpleDesc).toContain('23 خطوة');
        expect(advancedDesc).toContain('40 خطوة');
    });

    it('بلا دراسة محمَّلة (appSettings.mode غير معرَّف): البطاقة المُفعّلة افتراضياً هي «مفصل»', () => {
        openBlankModeForm(fakeStore());

        const active = document.querySelector('.mode-card.active');
        expect(active.dataset.mode).toBe('advanced');
    });

    it('عند إعادة فتح النافذة بعد إنشاء دراسة سابقة بوضع «مصغّر» (appSettings.mode المتبقي في المخزن): تبقى «مفصل» هي الافتراضي، لا آخر اختيار يدوي', () => {
        openBlankModeForm(fakeStore('mini'));

        const active = document.querySelector('.mode-card.active');
        expect(active.dataset.mode).toBe('advanced');
        expect(document.querySelector('.mode-card[data-mode="mini"]').classList.contains('active')).toBe(false);
    });
});

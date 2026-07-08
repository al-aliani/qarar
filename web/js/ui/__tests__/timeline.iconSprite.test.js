/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #29): عنوان القسم وزر «اقتراح خطة تنفيذية» في
 * الجدول الزمني (Timeline.js) كانا يستخدمان إيموجي خام (📅✨🏗️) بينما لوحة القرار
 * (DecisionDashboard.js) اعتمدت أيقونات SVG من مكتبة index.html الموحّدة — تناقض
 * بصري بين شاشتين لنفس المفهوم. الآن تستخدم نفس نمط <svg class="ic"><use href="#i-..."/></svg>.
 * ملاحظة: حالتا التحميل (i-reset) والاستعادة (i-bolt) بعد الضغط على الزر تُكتَبان
 * عبر e.target.innerHTML وليس textContent — لو استُخدم textContent لظهر الوسم
 * كنص هارب مرئي بدل عنصر SVG فعلي، لذا أحد الاختبارات هنا يثبت أن العنصر عقدة DOM حقيقية.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SECTIONS } from '../../core/schema.js';

vi.mock('../../services/AIConnector.js', () => ({
    generateTableSuggestions: vi.fn()
}));

import { generateTableSuggestions } from '../../services/AIConnector.js';
import { Timeline } from '../Timeline.js';

function fakeStore(state) {
    return {
        get: () => state,
        getState: () => state,
        updatePath: (section, key, value) => { state[section][key] = value; },
        update: () => {},
        notify: () => {}
    };
}

function buildStudy() {
    return {
        projectInfo: {},
        [SECTIONS.TIMELINE]: { activities: [] }
    };
}

describe('Timeline — عنوان القسم وزر الاقتراح الذكي توحّدا على أيقونات SVG بدل الإيموجي (#29)', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        generateTableSuggestions.mockReset();
    });
    afterEach(() => { document.body.innerHTML = ''; });

    it('يعرض عنوان القسم بأيقونة i-history بدل إيموجي 📅', () => {
        const timeline = new Timeline('c', fakeStore(buildStudy()));
        timeline.render();
        const html = document.getElementById('c').innerHTML;

        expect(html).toContain('href="#i-history"');
        const header = document.querySelector('.section-header h2');
        expect(header.textContent).not.toMatch(/[📅✨]/u);
    });

    it('يعرض زر «اقتراح خطة تنفيذية» بأيقونة i-bolt بدل إيموجي ✨ عند العرض الأولي', () => {
        const timeline = new Timeline('c', fakeStore(buildStudy()));
        timeline.render();

        const btn = document.querySelector('.ai-timeline-btn');
        expect(btn.innerHTML).toContain('href="#i-bolt"');
        expect(btn.textContent).not.toMatch(/[📅✨]/u);
    });

    it('لا يحتوي محتوى القسم كاملاً على حرفي الإيموجي 📅 أو ✨ الحرفيين', () => {
        const timeline = new Timeline('c', fakeStore(buildStudy()));
        timeline.render();
        const html = document.getElementById('c').innerHTML;

        expect(html).not.toMatch(/[📅✨]/u);
    });

    it('يبدّل الزر إلى أيقونة i-reset فعلية (عقدة SVG حقيقية) أثناء التحميل، لا كنص هارب', async () => {
        // نبقي الوعد معلّقاً (غير محلول) لنفحص حالة التحميل بشكل متزامن بعد الضغط
        let resolvePromise;
        generateTableSuggestions.mockImplementation(() => new Promise(resolve => { resolvePromise = resolve; }));

        const timeline = new Timeline('c', fakeStore(buildStudy()));
        timeline.render();

        const btn = document.querySelector('.ai-timeline-btn');
        btn.click();

        // الكود قبل أول await يُنفَّذ بشكل متزامن ضمن dispatch الحدث
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).toContain('جاري التخطيط...');
        expect(btn.textContent).not.toMatch(/[📅✨]/u);

        // إثبات أن الأيقونة عقدة DOM فعلية (لو كانت textContent لظهرت كنص "<svg...>" حرفي بدل عنصر)
        const loadingIcon = btn.querySelector('svg use[href="#i-reset"]');
        expect(loadingIcon).not.toBeNull();
        expect(loadingIcon.tagName.toLowerCase()).toBe('use');
        expect(btn.innerHTML).not.toContain('&lt;svg');

        // إنهاء الوعد بمصفوفة فارغة (مسار نجاح لا يستدعي render() الكامل بمصفوفة صفرية الأنشطة... تبقى فارغة فتُستدعى render فعلياً)
        resolvePromise('[]');
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        // بعد الإكمال تعود الأيقونة إلى i-bolt (إمّا عبر إعادة الرسم الكامل أو تحديث الزر مباشرة)
        const restoredIcon = document.querySelector('.ai-timeline-btn svg use[href="#i-bolt"]');
        expect(restoredIcon).not.toBeNull();
    });
});

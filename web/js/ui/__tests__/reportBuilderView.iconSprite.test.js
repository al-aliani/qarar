/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #29): عنوان «بناء التقرير» وشريط التوليد السريع
 * بالذكاء الاصطناعي في ReportBuilderView.js كانا يستخدمان إيموجي خام (📋✨) بينما
 * لوحة القرار (DecisionDashboard.js) اعتمدت أيقونات SVG من مكتبة index.html الموحّدة —
 * تناقض بصري بين شاشتين لنفس المفهوم. الآن تستخدم نفس نمط
 * <svg class="ic"><use href="#i-..."/></svg>.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReportBuilderView } from '../ReportBuilderView.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, notify: () => {} };
}

describe('ReportBuilderView — العنوان وشريط الذكاء الاصطناعي يستخدمان أيقونات SVG بدل الإيموجي (#29)', () => {
    beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('يستخدم أيقونتي SVG (i-doc/i-bolt) في العنوان وشريط التوليد السريع', () => {
        const view = new ReportBuilderView('c', fakeStore({}));
        view.render();
        const html = document.getElementById('c').innerHTML;

        expect(html).toContain('href="#i-doc"');
        expect(html).toContain('href="#i-bolt"');
    });

    it('لا تظهر إيموجي العنوان القديمة (📋✨) في نص الشاشة', () => {
        const view = new ReportBuilderView('c', fakeStore({}));
        view.render();
        const html = document.getElementById('c').innerHTML;

        expect(html).not.toMatch(/[📋✨]/u);
    });
});

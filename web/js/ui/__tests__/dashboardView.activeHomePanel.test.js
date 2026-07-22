/**
 * @vitest-environment jsdom
 *
 * تدقيق حي 2026-07-22: روابط #/tools و#/ready-studies و#/data كانت تسقط في
 * NotFoundView رغم أن محتواها موجود فعلياً كلوحات داخل الرئيسية (data-dv-panel-button)
 * — الإصلاح في app.js يمرّر الآن options.activeHomePanel عند فتح هذه المسارات مباشرة.
 * هذا يثبّت أن DashboardView (الآلية الموجودة أصلاً في الباني، لم تكن مغطاة باختبار)
 * تعرض فعلياً اللوحة المطلوبة بدل «الرئيسية والمشاريع» الافتراضية.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DashboardView } from '../DashboardView.js';

describe('DashboardView — تفعيل لوحة أولية عبر options.activeHomePanel', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        localStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('بلا خيار: تظهر لوحة "studies" افتراضياً (السلوك القائم لم يتغيّر)', async () => {
        const view = new DashboardView('c', { get: () => ({}), getState: () => ({}) }, () => {});
        await view.renderList([]);
        expect(document.querySelector('[data-dv-panel-button="studies"]').classList.contains('is-active')).toBe(true);
        expect(document.querySelector('[data-home-panel="studies"]').hidden).toBe(false);
        expect(document.querySelector('[data-home-panel="engines"]').hidden).toBe(true);
    });

    it('activeHomePanel:"engines" (#/tools) ⇒ تظهر لوحة الأدوات والمحرّكات مباشرة', async () => {
        const view = new DashboardView('c', { get: () => ({}), getState: () => ({}) }, () => {}, { activeHomePanel: 'engines' });
        await view.renderList([]);
        expect(document.querySelector('[data-dv-panel-button="engines"]').classList.contains('is-active')).toBe(true);
        expect(document.querySelector('[data-home-panel="engines"]').hidden).toBe(false);
        expect(document.querySelector('[data-home-panel="studies"]').hidden).toBe(true);
    });

    it('activeHomePanel:"additional" (#/ready-studies) ⇒ تظهر لوحة دراسات الجدوى الجاهزة مباشرة', async () => {
        const view = new DashboardView('c', { get: () => ({}), getState: () => ({}) }, () => {}, { activeHomePanel: 'additional' });
        await view.renderList([]);
        expect(document.querySelector('[data-dv-panel-button="additional"]').classList.contains('is-active')).toBe(true);
        expect(document.querySelector('[data-home-panel="additional"]').hidden).toBe(false);
    });

    it('activeHomePanel:"databases" (#/data) ⇒ تظهر لوحة قواعد البيانات مباشرة', async () => {
        const view = new DashboardView('c', { get: () => ({}), getState: () => ({}) }, () => {}, { activeHomePanel: 'databases' });
        await view.renderList([]);
        expect(document.querySelector('[data-dv-panel-button="databases"]').classList.contains('is-active')).toBe(true);
        expect(document.querySelector('[data-home-panel="databases"]').hidden).toBe(false);
    });
});

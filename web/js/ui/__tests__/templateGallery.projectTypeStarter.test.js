/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyStudy } from '../../core/schema.js';
import { TemplateGallery } from '../TemplateGallery.js';

function setNested(sectionObj, path, value) {
    const keys = path.split('.');
    let target = sectionObj;
    for (let i = 0; i < keys.length - 1; i += 1) {
        if (!target[keys[i]]) target[keys[i]] = {};
        target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
}

function fakeStore(state) {
    return {
        getState: () => state,
        get: () => state,
        reset: vi.fn(async () => {
            Object.assign(state, createEmptyStudy());
        }),
        update: vi.fn((section, value) => {
            state[section] = { ...(state[section] || {}), ...value };
        }),
        updatePath: vi.fn((section, path, value) => {
            if (!state[section]) state[section] = {};
            setNested(state[section], path, value);
        }),
        flush: vi.fn(async () => {})
    };
}

describe('TemplateGallery — تدفق بداية ذكي حسب نوع المشروع', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('اختيار مطعم/مقهى يجهز مسودات الجداول الأساسية دون استبدال المنتجات التي أدخلها المستخدم', async () => {
        const state = createEmptyStudy();
        const store = fakeStore(state);
        const gallery = new TemplateGallery('templateGalleryOverlay', store);
        gallery.open();

        document.querySelector('#btnStartBlank').click();
        await document.querySelector('#btnBlankCreate').onclick();

        document.querySelector('#fw_projectName').value = 'مقهى الندى';
        document.querySelector('#fw_description').value = 'مقهى مختص';
        document.querySelector('#fw_projectType').value = 'restaurant';
        document.querySelector('#fw_btnNext').onclick();

        document.querySelector('#fw_products').value = 'قهوة مختصة\nحلويات';
        document.querySelector('#fw_btnNext').onclick();

        document.querySelector('#fw_initialCapital').value = '150000';
        await document.querySelector('#fw_btnNext').onclick();

        expect(state.projectInfo.projectType).toBe('restaurant');
        expect(state.projectInfo.products.map(p => p.name)).toEqual(['قهوة مختصة', 'حلويات']);
        expect(state.revenue.streams.length).toBeGreaterThan(0);
        expect(state.legal.licenses.length).toBeGreaterThan(0);
        expect(state.hr.positions.length).toBeGreaterThan(0);
        expect(state.revenue.streams.every(row => row.suggestedDraft === true)).toBe(true);
        expect(state.financing.sources.equity.amount).toBe(150000);
    });
});

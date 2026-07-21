/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyStudy } from '../../core/schema.js';
import { ExportMenu } from '../ExportMenu.js';

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
        update: vi.fn((section, value) => {
            state[section] = value;
        }),
        updatePath: vi.fn((section, path, value) => {
            if (!path) {
                state[section] = value;
                return;
            }
            if (!state[section]) state[section] = {};
            setNested(state[section], path, value);
        }),
        notify: vi.fn(),
        flush: vi.fn(async () => {})
    };
}

describe('ExportMenu — اقتراح مسودات الجداول قبل التصدير', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="exportMenuOverlay"></div>`;
    });

    it('يملأ الجداول الفارغة بصفوف مقترحة حسب نوع المشروع ولا يستبدل الجداول الموجودة', async () => {
        const state = createEmptyStudy();
        state.projectInfo.name = 'مقهى الندى';
        state.projectInfo.concept = 'مقهى مختص';
        state.projectInfo.sector = 'مطاعم ومقاهي';
        state.projectInfo.city = 'الرياض';
        state.projectInfo.products = [{ id: 'existing-product', name: 'قهوة مختصة', type: 'final' }];

        const store = fakeStore(state);
        const menu = new ExportMenu('exportMenuOverlay', store);
        const btn = document.createElement('button');
        btn.innerHTML = 'اقتراح مسودة الجداول';

        await menu._suggestDraftTables(btn);

        expect(state.projectInfo.products).toEqual([{ id: 'existing-product', name: 'قهوة مختصة', type: 'final' }]);
        expect(state.revenue.streams.length).toBeGreaterThan(0);
        expect(state.hr.positions.length).toBeGreaterThan(0);
        expect(state.marketing.campaigns.length).toBeGreaterThan(0);
        expect(state.revenue.streams.every(row => row.suggestedDraft === true)).toBe(true);
        expect(state.hr.positions.every(row => row.suggestedDraft === true)).toBe(true);
        expect(store.updatePath).toHaveBeenCalled();
        expect(store.notify).toHaveBeenCalled();
        expect(btn.disabled).toBe(false);
        expect(btn.innerHTML).toBe('اقتراح مسودة الجداول');
    });
});

/**
 * @vitest-environment jsdom
 *
 * buildPitchPayload و_buildDataFromStore يُمرّران partnerNeeds من results.partnerNeeds
 * (المحسوبة في engine.js) إلى حمولة عرض المستثمر — بلا إعادة حساب منطق التصنيف هنا.
 */
import { describe, it, expect } from 'vitest';
import { InvestorDashboard, buildPitchPayload } from '../InvestorDashboard.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';

describe('InvestorDashboard — partnerNeeds يمر في الحمولة', () => {
    it('buildPitchPayload يُمرّر results.partnerNeeds كما هو', () => {
        const needs = [{ type: 'financial_equity', label: 'شريك مالي / مستثمر حصص', reason: 'سبب تجريبي', priority: 'high', action: 'attract' }];
        const payload = buildPitchPayload(createEmptyStudy(), { partnerNeeds: needs });
        expect(payload.partnerNeeds).toEqual(needs);
    });

    it('buildPitchPayload بلا results.partnerNeeds: يُرجع مصفوفة فارغة (لا انهيار)', () => {
        const payload = buildPitchPayload(createEmptyStudy(), {});
        expect(payload.partnerNeeds).toEqual([]);
    });

    it('_buildDataFromStore (المسار الحي) يستخرج partnerNeeds من نتيجة calculateStudy الفعلية', () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const state = createEmptyStudy();
        state.assumptions = { ...state.assumptions, foreignOwnershipRate: 0.4 };
        const store = { getState: () => state };
        const dash = new InvestorDashboard('c', store);
        const data = dash._buildDataFromStore();
        expect(data.partnerNeeds.some(n => n.type === 'market_entry')).toBe(true);
    });
});

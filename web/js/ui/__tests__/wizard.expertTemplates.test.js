import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSuggestionUpdateTarget } from '../Wizard.js';
import {
    applyExpertTemplatePreset,
    getExpertTemplatePresets,
    getExpertTemplates
} from '../../services/ExpertTemplateService.js';
import { SECTIONS } from '../../core/schema.js';
import { FIELD_OPTIONS } from '../../core/fieldOptions.js';
import { detectSectorBenchmark } from '../../core/sectorBenchmarks.js';

describe('Wizard suggestion persistence', () => {
    it('keeps legacy textarea updates on the current step field', () => {
        expect(getSuggestionUpdateTarget('projectInfo', 'description', { dataset: {} })).toEqual({
            section: 'projectInfo',
            path: 'description'
        });
    });

    it('uses explicit data-section and data-path for nested fields', () => {
        const textarea = {
            dataset: {
                section: 'businessModel',
                path: 'valueProposition'
            }
        };

        expect(getSuggestionUpdateTarget('summary', 'notes', textarea)).toEqual({
            section: 'businessModel',
            path: 'valueProposition'
        });
    });
});

describe('expert template presets', () => {
    beforeEach(() => {
        const values = new Map();
        globalThis.localStorage = {
            getItem: vi.fn(key => values.get(key) ?? null),
            setItem: vi.fn((key, value) => values.set(key, String(value))),
            removeItem: vi.fn(key => values.delete(key)),
            clear: vi.fn(() => values.clear())
        };
    });

    it('offers a SaaS feasibility-platform draft without publishing it as an approved expert template', () => {
        localStorage.clear();

        const presets = getExpertTemplatePresets();
        const saasPreset = presets.find(p => p.id === 'saas_feasibility_platform');

        expect(saasPreset).toBeTruthy();
        expect(saasPreset.title).toContain('SaaS');
        expect(getExpertTemplates().map(t => t.id)).not.toContain('saas_feasibility_platform');
    });

    it('applies the SaaS draft with coherent financing and revenue assumptions', () => {
        const store = {
            mergeWithDefaults: vi.fn(data => data),
            set: vi.fn()
        };

        const applied = applyExpertTemplatePreset(store, 'saas_feasibility_platform');

        expect(applied?.preset?.id).toBe('saas_feasibility_platform');
        expect(store.set).toHaveBeenCalledTimes(1);

        const data = store.set.mock.calls[0][0];
        expect(data[SECTIONS.PROJECT_INFO].concept).toContain('SaaS');
        expect(data[SECTIONS.PROJECT_INFO].expertTemplatePresetId).toBe('saas_feasibility_platform');
        expect(data[SECTIONS.REVENUE].streams.length).toBeGreaterThanOrEqual(4);
        expect(data[SECTIONS.FINANCING].sources.equity.amount).toBe(700000);
        expect(data[SECTIONS.FINANCING].sources.bankLoan.amount).toBe(850000);
        expect(data[SECTIONS.FINANCING].targetDSCR).toBe(1.5);
    });

    it('keeps the SaaS activity selectable and tied to the SaaS benchmark', () => {
        const option = FIELD_OPTIONS.concept.options.find(o => o.value.includes('SaaS'));

        expect(option).toBeTruthy();
        expect(detectSectorBenchmark(option.value)?.label).toContain('SaaS');
    });
});

import { describe, expect, it } from 'vitest';
import { getSuggestionUpdateTarget } from '../Wizard.js';

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

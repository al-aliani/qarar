import { describe, expect, it } from 'vitest';
import { validateAssumptions } from '../validation.js';

describe('validateAssumptions', () => {
    it('rejects missing discount rate and working-capital months', () => {
        const result = validateAssumptions({ discountRate: null, workingCapitalMonths: null });
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(2);
    });
});

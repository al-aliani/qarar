/**
 * Unit Tests للتحقق من صحة البيانات (validation.js)
 */
import { describe, it, expect } from 'vitest';
import { validateStudy, validateAssumptions, validateProjectInfo } from '../validation.js';

describe('validateStudy', () => {
    it('returns valid for minimal study', () => {
        const study = { projectInfo: { name: 'Test' }, assumptions: {} };
        const r = validateStudy(study);
        expect(r).toHaveProperty('valid');
        expect(r).toHaveProperty('errors');
        expect(Array.isArray(r.errors)).toBe(true);
    });
});

describe('validateAssumptions', () => {
    it('accepts valid assumptions', () => {
        const r = validateAssumptions({ taxRate: 0.15, discountRate: 0.1, projectionYears: 5, workingCapitalMonths: 3 });
        expect(r.valid).toBe(true);
    });
    it('rejects invalid tax rate', () => {
        const r = validateAssumptions({ taxRate: 2 });
        expect(r.valid).toBe(false);
    });
});

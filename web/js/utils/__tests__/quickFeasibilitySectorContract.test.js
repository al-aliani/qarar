import { describe, expect, it } from 'vitest';
import {
    getQuickDefaultsForSector,
    getQuickSectorLabel,
    normalizeQuickSector,
    QUICK_SECTOR_OPTIONS,
    quickSanityChecks
} from '../quickFeasibilityCalc.js';

describe('quick feasibility sector contract', () => {
    it('uses stable engine-facing sector keys while keeping Arabic labels for display', () => {
        expect(QUICK_SECTOR_OPTIONS.map(s => s.value)).toEqual([
            'restaurant',
            'retail',
            'service',
            'industrial',
            'tech',
            'other'
        ]);

        expect(getQuickSectorLabel('restaurant')).toBe('مطعم / مقهى');
        expect(getQuickSectorLabel('خدمي')).toBe('خدمي');
    });

    it('normalizes legacy Arabic and English aliases without breaking saved quick studies', () => {
        expect(normalizeQuickSector('مطعم')).toBe('restaurant');
        expect(normalizeQuickSector('مقهى')).toBe('restaurant');
        expect(normalizeQuickSector('خدمي')).toBe('service');
        expect(normalizeQuickSector('صناعي')).toBe('industrial');
        expect(normalizeQuickSector('تقني')).toBe('tech');
        expect(normalizeQuickSector('أخرى')).toBe('other');
        expect(normalizeQuickSector('unknown-sector')).toBe('other');

        expect(getQuickDefaultsForSector('مطعم')).toEqual(getQuickDefaultsForSector('restaurant'));
        expect(getQuickDefaultsForSector('خدمي')).toEqual(getQuickDefaultsForSector('service'));
    });

    it('applies venue sanity checks through normalized sector keys, not hard-coded Arabic literals', () => {
        const result = { annualNet: 100000, paybackYears: 3 };
        const warnings = quickSanityChecks(
            { sector: 'restaurant', area: 100, initialInvestment: 50000, monthlyRevenue: 80000, monthlyCosts: 50000 },
            result
        );

        expect(warnings.some(w => String(w.text).includes('ريال/م²'))).toBe(true);
    });
});

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('QuickFeasibilityWizard platform contract', () => {
    it('keeps engine keys separate from user-facing Arabic sector labels', () => {
        const src = fs.readFileSync(resolve(__dirname, '../QuickFeasibilityWizard.js'), 'utf8');

        expect(src).toContain("sector: 'restaurant'");
        expect(src).toContain('sectorLabel: getQuickSectorLabel');
        expect(src).toContain('normalizeQuickSector');
        expect(src).toContain('concept: this.quickData.sectorLabel');
    });

    it('supports cities outside the curated list through an explicit custom city field', () => {
        const src = fs.readFileSync(resolve(__dirname, '../QuickFeasibilityWizard.js'), 'utf8');

        expect(src).toContain("const OTHER_CITY_VALUE = '__other__'");
        expect(src).toContain('id="qf-city-other"');
        expect(src).toContain('اكتب المدينة أو المحافظة');
        expect(src).toContain("selectedCity === OTHER_CITY_VALUE ? customCity : selectedCity");
    });
});

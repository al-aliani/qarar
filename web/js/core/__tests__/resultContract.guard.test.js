import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getOfficialIndicators, requireOfficialIndicators } from '../resultContract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('official financial result contract', () => {
    it('reads official KPIs from calculateStudy(...).indicators by default', () => {
        const results = {
            npv: 999,
            irr: 9,
            paybackPeriod: 99,
            indicators: { npv: 100, irr: 0.2, paybackPeriod: 3.5 }
        };

        expect(getOfficialIndicators(results)).toEqual({ npv: 100, irr: 0.2, paybackPeriod: 3.5 });
    });

    it('allows legacy adapters only when a caller explicitly opts in', () => {
        const legacy = { npv: 100, irr: 0.2, paybackPeriod: 3.5 };

        expect(getOfficialIndicators(legacy)).toEqual({});
        expect(getOfficialIndicators(legacy, { allowLegacy: true })).toMatchObject(legacy);
        expect(() => requireOfficialIndicators(legacy)).toThrow(/indicators/);
    });

    it('prevents UI drift back to local financial formulas or root-level KPI fallbacks', () => {
        const serviceAnalysis = fs.readFileSync(resolve(__dirname, '../../ui/ServiceAnalysis.js'), 'utf8');
        const shareView = fs.readFileSync(resolve(__dirname, '../../ui/ShareView.js'), 'utf8');

        expect(serviceAnalysis).toContain("from '../core/financial/cashflow.js'");
        expect(serviceAnalysis).not.toMatch(/\n\s+calculateNPV\s*\(/);
        expect(serviceAnalysis).not.toMatch(/\n\s+calculateIRR\s*\(/);
        expect(serviceAnalysis).not.toMatch(/\n\s+calculatePayback\s*\(/);

        expect(shareView).toContain("from '../core/resultContract.js'");
        expect(shareView).not.toContain('engineResults.npv');
        expect(shareView).not.toContain('engineResults.irr');
    });
});

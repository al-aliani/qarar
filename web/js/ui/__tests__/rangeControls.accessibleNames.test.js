import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COMPONENTS_WITH_RANGES = [
    '../OperationalSim.js',
    '../PricingOptimizerView.js',
    '../StressTest.js',
    '../DecisionDashboard.js',
    '../widgets/SensitivityWidget.js'
];

describe('إتاحة عناصر السحب', () => {
    it('يملك كل range اسماً واضحاً لقارئ الشاشة', () => {
        for (const relativePath of COMPONENTS_WITH_RANGES) {
            const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
            const controls = source.match(/<input\s+type="range"[^>]*>/g) || [];

            expect(controls.length, `${relativePath} يجب أن يحتوي range`).toBeGreaterThan(0);
            for (const control of controls) {
                expect(control, `${relativePath}: ${control}`).toMatch(/aria-label="[^"]+"/);
            }
        }
    });
});

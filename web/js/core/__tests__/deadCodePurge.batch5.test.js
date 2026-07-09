import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Repo root (this file lives at web/js/core/__tests__/, so go up 4 levels).
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

// Batch 5 dead-code purge: files confirmed to have zero live references anywhere
// in the repo (only stale historical docs / internal references among themselves).
// See task history for the verification method. This guard test makes sure none
// of them silently reappear (e.g. via a bad merge, a revert, or a stray restore).
const DELETED_FILES = [
    'lib/calc/financialModel.js',
    'lib/calc/gosi.js',
    'web/js/ui/TemplateSelector.js',
    'web/js/ui/CompetitorScout.js',
    'web/js/ui/components/Toast.js',
    'web/js/ui/forms.js',
    'web/js/ui/widgets/IdeaScoreGauge.js',
    'wizard_old.js',
    'web/export/pdf.js',
    'web/report/generateReport.js',
    'web/report/recommendations.js',
    'web/report/reportSchema.js',
    'web/components/Dashboard.js',
    'web/components/ExecutiveSummary.js',
    'web/components/FinancialTables.js'
];

describe('dead code purge (batch 5)', () => {
    for (const relPath of DELETED_FILES) {
        it(`does not resurrect ${relPath}`, () => {
            const fullPath = path.join(repoRoot, relPath);
            expect(fs.existsSync(fullPath), `${relPath} leaked back into the repo -- it was deleted as dead code and must stay deleted`).toBe(false);
        });
    }
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

describe('utilities.css', () => {
    it('يمر عبر محلل CSS دون تحذيرات صياغة', async () => {
        const path = fileURLToPath(new URL('../css/utilities.css', import.meta.url));
        const source = readFileSync(path, 'utf8');
        const result = await transform(source, { loader: 'css', minify: true, logLevel: 'silent' });

        expect(result.warnings).toEqual([]);
    });
});

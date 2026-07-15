import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverSource = () => fs.readFileSync(resolve(__dirname, '../../../../ai_server_enhanced.py'), 'utf8');

describe('local API server contract', () => {
    it('exposes a GET health endpoint and permits GET CORS preflight', () => {
        const src = serverSource();

        expect(src).toContain("Access-Control-Allow-Methods', 'GET, POST, OPTIONS'");
        expect(src).toContain("self.path.startswith('/api/health')");
        expect(src).toContain('"market_engine"');
    });

    it('keeps market defaults robust against non-numeric query params', () => {
        const src = serverSource();

        expect(src).toContain('def int_param(name, default=0):');
        expect(src).toContain("area = int_param('area', 100)");
        expect(src).toContain("budget = int_param('budget', 0)");
        expect(src).toContain('_log_request(self.command');
    });
});

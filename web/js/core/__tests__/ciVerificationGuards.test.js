/**
 * حارس انحدار (تدقيق 2026-07-08، مهندس الجودة): يمنع عودة "عمى التحقق" الذي كان
 * يجعل npm test يبدو ناجحاً بينما جزءاً من الاختبارات لا يُنفَّذ أصلاً أو لا شيء
 * يوقف انحداراً في CI. أربع فجوات مستقلة كانت قائمة معاً:
 * 1) jsdom غير مثبَّتة → ملفات اختبار كاملة تفشل بصمت كـ"Unhandled Error" عام.
 * 2) عتبات تغطية Vitest بصياغة قديمة (مباشرة تحت coverage بدل coverage.thresholds)
 *    فتُتجاهل صامتة — "80%" كانت وثيقة زخرفية لا تُفشل أي شيء أبداً.
 * 3) لا وظيفة CI تُشغّل npm test/test:coverage — فقط Playwright e2e.
 * 4) (اكتشفها التحقق العدائي) .github/workflows/e2e.yml نفسه لم يكن YAML صالحاً
 *    (فاصلة غير مُقتبَسة داخل اسم خطوة) — فحص نصي بسيط (grep) كان سيمر رغم أن
 *    GitHub Actions يرفض الملف بالكامل ولا يُشغّل أي job فيه، بما فيها "unit"
 *    الجديدة. لذلك التحقق أدناه يُحلّل YAML فعلياً (js-yaml) لا نصاً خاماً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as loadYaml } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');

describe('حارس عمى التحقق (jsdom + عتبات التغطية + CI)', () => {
    it('jsdom مثبَّتة فعلياً في node_modules (لا تُحذف بلا تحديث هذا الحارس)', () => {
        expect(existsSync(resolve(REPO_ROOT, 'node_modules/jsdom'))).toBe(true);
    });

    it('vite.config.js يضع عتبات التغطية داخل coverage.thresholds (لا كمفاتيح مسطّحة قديمة)', () => {
        const src = readFileSync(resolve(REPO_ROOT, 'vite.config.js'), 'utf8');
        const coverageIdx = src.indexOf('coverage: {');
        const thresholdsIdx = src.indexOf('thresholds: {');
        const excludeIdx = src.indexOf('exclude: [');
        expect(coverageIdx).toBeGreaterThan(-1);
        expect(thresholdsIdx).toBeGreaterThan(coverageIdx);
        expect(excludeIdx).toBeGreaterThan(thresholdsIdx);

        // الصياغة القديمة كانت تكتب lines/functions/branches/statements مباشرة بين
        // coverage: { و thresholds لم تكن موجودة أصلاً؛ نتأكد ألا يوجد مفتاح "lines:"
        // خام بين بداية coverage ونهاية thresholds (خارج الكائن المتداخل الصحيح).
        const beforeThresholds = src.slice(coverageIdx, thresholdsIdx);
        expect(beforeThresholds).not.toMatch(/\blines:\s*\d/);
    });

    it('عتبات التغطية أرقام واقعية (ratchet) لا صفر ولا مطلقة غير محققة', () => {
        const src = readFileSync(resolve(REPO_ROOT, 'vite.config.js'), 'utf8');
        const thresholdsIdx = src.indexOf('thresholds: {');
        const closeIdx = src.indexOf('},', thresholdsIdx);
        const block = src.slice(thresholdsIdx, closeIdx);
        const nums = [...block.matchAll(/:\s*(\d+(?:\.\d+)?)/g)].map(x => Number(x[1]));
        expect(nums.length).toBeGreaterThanOrEqual(4);
        nums.forEach(n => {
            expect(n).toBeGreaterThan(0);
            expect(n).toBeLessThanOrEqual(100);
        });
    });

    it('كل ملفات .github/workflows تُحلَّل كـYAML صالح (لا اكتفاء بفحص نصي)', () => {
        const workflowsDir = resolve(REPO_ROOT, '.github/workflows');
        const files = readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
        expect(files.length).toBeGreaterThan(0);
        files.forEach(f => {
            const src = readFileSync(resolve(workflowsDir, f), 'utf8');
            // إن كان الملف غير صالح، load() يرمي خطأً فيفشل هذا الاختبار بوضوح
            // بدل أن يمر بصمت كما كان سيحدث مع بحث نصي (grep) على ملف مكسور.
            expect(() => loadYaml(src)).not.toThrow();
        });
    });

    it('وظيفة CI فعلية (job حقيقي في YAML صالح) تُشغّل اختبارات الوحدة', () => {
        const workflowsDir = resolve(REPO_ROOT, '.github/workflows');
        const files = readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
        const allSteps = files.flatMap(f => {
            const doc = loadYaml(readFileSync(resolve(workflowsDir, f), 'utf8'));
            const jobs = doc?.jobs || {};
            return Object.values(jobs).flatMap(job => job?.steps || []);
        });
        const runsUnitTests = allSteps.some(step =>
            typeof step.run === 'string' && /npm run test:coverage|npm test\b/.test(step.run)
        );
        expect(runsUnitTests).toBe(true);
    });
});

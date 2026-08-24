/**
 * تدقيق أمني 2026-08-24: حارس البديل المحلي عن حزمة `image-size`.
 *
 * الخلفية: `npm audit` كان يبلّغ عن ثغرتَي DoS في `image-size`
 * (GHSA-w3rx-r6r6-pgpr وGHSA-5p2g-fcmc-qvqq) بنطاق `<=2.0.2`، وأحدث إصدار
 * منشور هو 2.0.2 بالضبط ⟹ لا ترقيع upstream. الحزمة تصل عبر `pptxgenjs`
 * وحده، ولا يستوردها أي كود لدينا. الحل: استبدالها ببديل محلي في
 * `tools/image-size-stub/` عبر `overrides`. التفاصيل الكاملة في تعليق
 * `tools/image-size-stub/index.js`.
 *
 * لماذا هذا الحارس موجود؟ لأن الإصلاح يمكن أن ينهار **بصمت** بثلاث طرق،
 * كلها تُبقي `npm audit` أخضر فلا ينتبه أحد:
 *   1. حذف/تلف مجلد البديل أو عدم التزامه في git ⟹ رابط معلّق في node_modules.
 *   2. إزالة أحد طرفَي الربط في package.json (dependencies أو overrides).
 *   3. ترقية `pptxgenjs` إلى إصدار يستورد `image-size` فعلياً ⟹ البديل يرمي
 *      في مسار حقيقي بدل أن يكون كوداً ميتاً (تحذير مذكور صراحة في تعليق البديل).
 *
 * ملاحظة تصميمية مقصودة: كل التوكيدات أدناه صريحة (`expect`)، ولا يوجد
 * `try/catch` يبتلع `MODULE_NOT_FOUND` — غياب البديل يجب أن يُفشل الاختبار
 * بصخب، لا أن يُقرأ كنجاح.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');

/** الإصدار المميِّز للبديل — أي إصدار آخر يعني أن الحزمة الأصلية عادت. */
const STUB_VERSION = '9.9.9';

describe('حارس البديل المحلي عن image-size (ثغرتا DoS بلا ترقيع upstream)', () => {
    it('الحزمة المُحلّاة باسم image-size هي البديل المحلي، لا الحزمة الأصلية المصابة', () => {
        // require.resolve يرمي إن غاب البديل — وهذا فشل مقصود وصريح، لا نبتلعه.
        const resolvedPkgPath = require.resolve('image-size/package.json');
        const pkg = JSON.parse(readFileSync(resolvedPkgPath, 'utf8'));

        expect(pkg.name).toBe('image-size');
        // التوكيد الحاسم: الإصدار الأصلي المصاب كان 1.2.1 (والنطاق المصاب <=2.0.2).
        expect(
            pkg.version,
            'إصدار image-size ليس البديل المحلي — الحزمة الأصلية المصابة عادت للشجرة'
        ).toBe(STUB_VERSION);
        // البديل لا يجرّ أي تبعية (الأصل كان يجرّ queue)، ولا يُعلن bin غير موجود.
        expect(pkg.dependencies ?? {}).toEqual({});
        expect(pkg.bin).toBeUndefined();
    });

    it('مصدر البديل موجود فعلياً في المستودع (لا رابط معلّق إلى مسار محذوف)', () => {
        const stubDir = join(REPO_ROOT, 'tools/image-size-stub');
        expect(existsSync(stubDir), 'مجلد tools/image-size-stub غير موجود').toBe(true);
        expect(existsSync(join(stubDir, 'index.js'))).toBe(true);
        expect(existsSync(join(stubDir, 'package.json'))).toBe(true);
    });

    it('طرفا الربط في package.json سليمان معاً (dependencies + overrides)', () => {
        const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));

        // الصيغة المباشرة "file:" داخل overrides وحدها تكسر `npm ci` مع npm 11.x
        // (تُحَل نسبةً إلى الحزمة الأب) — لذا الربط طرفان: تبعية مباشرة + إشارة $.
        expect(rootPkg.dependencies?.['image-size']).toBe('file:./tools/image-size-stub');
        expect(rootPkg.overrides?.['image-size']).toBe('$image-size');
    });

    it('الاستيراد لا يرمي، والاستدعاء يرمي برسالة البديل الصريحة', async () => {
        const mod = require('image-size'); // لو غاب البديل يرمي هنا ⟹ فشل صريح
        expect(typeof mod).toBe('function');

        // نطابق نص رسالة البديل تحديداً — لا مجرد "رمى شيئاً ما"، حتى لا تمرّ
        // الحزمة الأصلية (التي ترمي TypeError على مدخل غير صالح) كأنها البديل.
        expect(() => mod()).toThrow(/معطَّلة عمداً/);
    });

    it('شكل التصدير يطابق الأصل (حتى لا ينكسر أي interop مع pptxgenjs)', () => {
        const mod = require('image-size');
        // في الأصل: كائن التصدير هو الدالة نفسها، وdefault/imageSize مرجعان لها.
        expect(mod.default).toBe(mod);
        expect(mod.imageSize).toBe(mod);
        expect(typeof mod.disableFS).toBe('function');
        expect(typeof mod.disableTypes).toBe('function');
        expect(typeof mod.setConcurrency).toBe('function');
        expect(Array.isArray(mod.types)).toBe(true);
        expect(mod.types).toContain('png');
    });

    it('pptxgenjs المشحون لا يستورد image-size إطلاقاً (يلتقط أي ترقية تُعيد الاستيراد)', () => {
        // هذا هو الافتراض الذي يقوم عليه أمان الاستبدال كله: توزيع pptxgenjs
        // أسقط image-size عند البناء (rollup)، فبقيت إعلان تبعية يتيماً.
        // إن أعادها إصدار لاحق، البديل سيرمي في مسار حقيقي — نريد كشف ذلك هنا
        // لا في الإنتاج.
        const distDir = join(REPO_ROOT, 'node_modules/pptxgenjs/dist');
        expect(existsSync(distDir), 'توزيع pptxgenjs غير موجود — هل التبعيات مثبَّتة؟').toBe(true);

        const offenders = readdirSync(distDir)
            .filter((f) => f.endsWith('.js'))
            .filter((f) => readFileSync(join(distDir, f), 'utf8').includes('image-size'));

        expect(
            offenders,
            'إصدار pptxgenjs الحالي يستورد image-size فعلياً — راجع تعليق tools/image-size-stub/index.js قبل المتابعة'
        ).toEqual([]);
    });
});

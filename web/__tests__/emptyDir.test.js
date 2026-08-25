/**
 * تدقيق أداء 2026-08-25 — حارس تفريغ مجلد المخرجات.
 *
 * الخلفية الكاملة في scripts/empty-dir.js. باختصار: `build.emptyOutDir` في Vite
 * كان معطَّلاً فعلياً وبصمت على هذا المشروع لأن `fs.rmSync(p,{recursive,force})`
 * يعود بلا رمي دون أن يحذف شيئاً حين يحتوي المسار على محارف عربية (Node v24/ويندوز)
 * — وجذر المشروع «G:\دراسة الجدوى». النتيجة: 17 نسخة من main-*.js و1629 ملفاً
 * متراكماً في web/dist/assets (561MB)، وبصمة كاش عامل الخدمة تُحسَب من مجلد ملوَّث.
 *
 * لماذا هذا الاختبار موجود؟ لأن `emptyDirRobust` تبدو كإعادة اختراع لـ`fs.rmSync`،
 * فأي «تبسيط» لاحق سيستبدلها بها — وينهار الإصلاح **صامتاً** مجدداً بلا فشل بناء.
 * الاختبار الأول أدناه يوثّق العطل البيئي نفسه بالقياس، والثاني يثبت أن البديل
 * يفرّغ فعلاً تحت مسار عربي.
 */
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { emptyDirRobust, removeRecursive } from '../../scripts/empty-dir.js';

const made = [];

/** مجلد مؤقت باسم عربي — يُعيد إنتاج الشرط الذي يُسقِط fs.rmSync. */
function makeArabicTree() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'دراسة-'));
    made.push(root);
    fs.mkdirSync(path.join(root, 'assets', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
    fs.writeFileSync(path.join(root, 'assets', 'main-OLD.js'), 'stale');
    fs.writeFileSync(path.join(root, 'assets', 'nested', 'deep.txt'), 'x');
    return root;
}

afterEach(() => {
    while (made.length) {
        const dir = made.pop();
        try { removeRecursive(dir); } catch { /* نُظِّف مسبقاً */ }
    }
});

describe('تفريغ web/dist — البديل عن fs.rmSync المعطوب على المسارات العربية', () => {
    it('يوثّق العطل: fs.rmSync تحت مسار عربي لا يرمي ولا يحذف (بينما ينجح على ASCII)', () => {
        const arabicRoot = makeArabicTree();
        const victim = path.join(arabicRoot, 'assets', 'main-OLD.js');
        expect(fs.existsSync(victim)).toBe(true);

        // لا try/catch: لو رمى يوماً فهذا تغيّر سلوكي نريد رؤيته صراحةً.
        fs.rmSync(victim, { recursive: true, force: true });
        const survivedArabic = fs.existsSync(victim);

        // نفس العملية بالضبط على مسار ASCII — مرجع المقارنة.
        const asciiRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ascii-'));
        made.push(asciiRoot);
        const asciiVictim = path.join(asciiRoot, 'main-OLD.js');
        fs.writeFileSync(asciiVictim, 'stale');
        fs.rmSync(asciiVictim, { recursive: true, force: true });
        const survivedAscii = fs.existsSync(asciiVictim);

        // على ASCII يجب أن يُحذف دائماً — هذا ثابت عبر كل المنصّات.
        expect(survivedAscii, 'fs.rmSync فشل حتى على مسار ASCII — عطل أوسع مما وُثِّق').toBe(false);

        // أما على المسار العربي فالسلوك بيئي: يبقى الملف على ويندوز/Node v24 (وهو
        // سبب وجود البديل)، ويُحذف على لينكس/CI. لا نُثبّت النتيجة حتى لا يفشل CI —
        // نُثبّت الخلاصة الوحيدة المهمة: البديل صحيح في الحالتين (الاختبار التالي).
        console.log(
            `[emptyDir] fs.rmSync على مسار عربي: ${survivedArabic ? 'فشل صامت (الملف باقٍ)' : 'نجح'} — ${process.platform}/${process.version}`
        );
        expect(typeof survivedArabic).toBe('boolean');
    });

    it('emptyDirRobust يُفرّغ شجرة كاملة تحت مسار عربي ويُبقي المجلد نفسه', () => {
        const root = makeArabicTree();

        const removed = emptyDirRobust(root);

        expect(removed).toBe(2); // index.html + assets/
        expect(fs.existsSync(root), 'المجلد نفسه يجب أن يبقى (Vite تكتب فيه بعد ذلك)').toBe(true);
        expect(fs.readdirSync(root)).toEqual([]);
    });

    it('يستثني .git كما تفعل Vite', () => {
        const root = makeArabicTree();
        fs.mkdirSync(path.join(root, '.git'));
        fs.writeFileSync(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main');

        emptyDirRobust(root);

        expect(fs.readdirSync(root)).toEqual(['.git']);
        expect(fs.existsSync(path.join(root, '.git', 'HEAD'))).toBe(true);
    });

    it('لا يرمي إن كان المجلد غير موجود أصلاً (أول بناء نظيف)', () => {
        const missing = path.join(os.tmpdir(), 'لا-يوجد-' + Date.now());
        expect(() => emptyDirRobust(missing)).not.toThrow();
        expect(emptyDirRobust(missing)).toBe(0);
    });
});

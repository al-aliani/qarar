/**
 * تفريغ مجلد المخرجات — بديل صامد عن `fs.rmSync` المعطوب على المسارات العربية.
 *
 * تدقيق أداء 2026-08-25: `build.emptyOutDir` في Vite لا يعمل إطلاقاً على هذا
 * المشروع، وبصمت تام. السبب ليس إعداداً خاطئاً — القيمة المُحلّاة `null` وoutDir
 * داخل root، أي أن Vite *يستدعي* `emptyDir` فعلاً. العطل في الطبقة الأدنى:
 *
 *     fs.rmSync(p, { recursive: true, force: true })
 *
 * يعود **بلا رمي** دون أن يحذف شيئاً حين يحتوي `p` على محارف غير لاتينية، على
 * Node v24 / ويندوز. جذر هذا المشروع «G:\دراسة الجدوى». مُقاس على ملف أُنشئ للتوّ:
 *   - `rmSync` تحت المسار العربي   ⟹ لا رمي، والملف باقٍ.
 *   - `rmSync` تحت مسار ASCII       ⟹ يحذف بنجاح.
 *   - `unlinkSync` على نفس المسار العربي ⟹ يحذف بنجاح.
 *
 * الأثر قبل الإصلاح: كل بناء يضيف حزمة جديدة دون حذف القديمة — بلغت 17 نسخة من
 * `main-*.js` و1629 ملفاً في `assets/` (561MB). وهذا لا يضخّم المجلد فحسب، بل
 * يُفسد أي منطق يقرأ محتوى `assets/` (مثل بصمة الكاش في scripts/sw-build-id.js).
 *
 * لذلك: `unlinkSync` + `rmdirSync` (كلاهما يعمل على المسار العربي) بدل `rmSync`.
 * لا تُبسَّط هذه الدالة إلى `fs.rmSync` — سيبدو الاختصار سليماً وينهار صامتاً هنا.
 */
import fs from 'fs';
import path from 'path';

/** حذف تعاودي لملف أو مجلد. لا يتبع الروابط الرمزية (lstat لا stat). */
export function removeRecursive(target) {
    if (fs.lstatSync(target).isDirectory()) {
        for (const entry of fs.readdirSync(target)) {
            removeRecursive(path.resolve(target, entry));
        }
        fs.rmdirSync(target);
    } else {
        fs.unlinkSync(target);
    }
}

/**
 * يُفرّغ `dir` من كل محتوياته مع إبقاء المجلد نفسه (ويستثني `.git` كما تفعل Vite).
 * يرمي صراحةً إن بقي شيء — الفشل الصامت هو بالضبط ما نتفاداه هنا.
 * لا يفعل شيئاً إن كان المجلد غير موجود.
 */
export function emptyDirRobust(dir, skip = ['.git']) {
    if (!fs.existsSync(dir)) return 0;
    let removed = 0;
    for (const entry of fs.readdirSync(dir)) {
        if (skip.includes(entry)) continue;
        removeRecursive(path.resolve(dir, entry));
        removed += 1;
    }
    const left = fs.readdirSync(dir).filter((e) => !skip.includes(e));
    if (left.length) {
        throw new Error(
            `[emptyDirRobust] تعذّر تفريغ ${dir} — بقي ${left.length} عنصراً: ${left.slice(0, 5).join(', ')}`
        );
    }
    return removed;
}

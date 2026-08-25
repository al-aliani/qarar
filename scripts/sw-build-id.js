/**
 * بصمة البناء لاسم كاش الـService Worker.
 *
 * لماذا وحدة منفصلة بدل سطرين داخل vite.config.js: web/public/sw.js يُنسخ إلى dist
 * حرفياً بلا أي معالجة من Vite (publicDir لا يمر بـtransform، فلا import.meta.env
 * ولا define تعمل داخله). فالطريقة الوحيدة لجعل اسم الكاش يتغيّر مع كل نشر هي
 * ختم بصمة على الملف بعد البناء. هذا الختم صامت الفشل بطبيعته (لو تغيّر اسم
 * العنصر النائب في sw.js يبقى الكاش اسمه «dev» إلى الأبد بلا أي خطأ) — لذلك
 * المنطق هنا مستقل وقابل للاختبار، وstampBuildId يرمي استثناءً بدل التجاهل.
 */
import { createHash } from 'crypto';

/** العنصر النائب داخل web/public/sw.js الذي يُستبدل ببصمة البناء. */
export const SW_BUILD_ID_PLACEHOLDER = '__SW_BUILD_ID__';

/**
 * بصمة مشتقّة من أسماء ملفات dist/assets — وهي أصلاً تحتوي بصمة محتوى كل حزمة
 * (index-a1b2c3.js)، فأي تغيير في الكود يغيّر البصمة، وإعادة بناء بلا تغيير
 * تُبقيها ثابتة (لا تبديل كاش بلا داعٍ، خلافاً لطابع زمني).
 * @param {string[]} assetFileNames
 * @returns {string}
 */
export function computeBuildId(assetFileNames) {
    const names = [...assetFileNames].sort();
    return createHash('sha256').update(names.join('\n')).digest('hex').slice(0, 12);
}

/**
 * يستبدل العنصر النائب في مصدر sw.js ببصمة البناء.
 * @param {string} source
 * @param {string} buildId
 * @returns {string}
 */
export function stampBuildId(source, buildId) {
    if (!source.includes(SW_BUILD_ID_PLACEHOLDER)) {
        throw new Error(
            `[stamp-sw-build-id] لم يُعثر على ${SW_BUILD_ID_PLACEHOLDER} في sw.js — ` +
            'اسم الكاش سيبقى ثابتاً عبر النشرات (نمو بلا سقف على أجهزة المستخدمين).'
        );
    }
    return source.split(SW_BUILD_ID_PLACEHOLDER).join(buildId);
}

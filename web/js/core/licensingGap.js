/**
 * تنبيه استشاري: تراخيص شائعة لنشاط المشروع المكتشَف (نفس قائمة generateLicenses
 * السعرية) لم تُدرَج في جدول «التراخيص والرسوم القانونية» الفعلي — لا استدعاء API
 * حكومي (لا واجهة عامة موثّقة لهذا)، فقط مقارنة بالقائمة الداخلية الموجودة أصلاً
 * والمستخدَمة فعلاً في زر "اقتراح بنود" لنفس الجدول (suggest_licenses)، بنفس أسلوب
 * مطابقة الكلمات في findOfferingsWithoutCustomerValue (OfferingView.js) — لا مطابقة ثانية مختلفة.
 */
import { generateLicenses } from '../services/InternalAIGenerator.js';
import { normalizeOfferingWords } from '../ui/OfferingView.js';

/**
 * @param {object} state
 * @returns {string[]} أسماء تراخيص شائعة لنفس النشاط لم تُدرَج بعد (فارغ إن تعذّر الاكتشاف)
 */
export function findMissingCommonLicenses(state) {
    const legal = state?.legal || {};
    const existing = Array.isArray(legal.licenses) ? legal.licenses : [];

    let typical = [];
    try { typical = generateLicenses(state) || []; } catch (_) { typical = []; }
    if (!typical.length) return [];

    const existingWordSets = existing
        .map(row => new Set(normalizeOfferingWords(row?.name || '')))
        .filter(s => s.size);

    return typical
        .map(row => (row?.name || '').trim())
        .filter(Boolean)
        .filter(name => {
            const nameWords = normalizeOfferingWords(name);
            if (!nameWords.length) return false;
            return !existingWordSets.some(exWords => nameWords.some(w => exWords.has(w)));
        });
}

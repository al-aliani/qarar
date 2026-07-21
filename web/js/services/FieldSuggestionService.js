/**
 * FieldSuggestionService — مساعد الكتابة في كل حقل (AI Writing Assistant)
 * يرسل اسم الحقل وبيانات المشروع إلى الـ AI ويعيد صياغة احترافية أو اقتراحاً لتعبئة الحقل.
 * يدعم الاستجابة التدفقية (Streaming) لعرض النص تدريجياً.
 */

import { AIConnector } from './AIConnector.js';
import { generateFieldSuggestion } from './InternalAIGenerator.js';

const CHUNK_DELAY_MS = 25;
const MIN_CHUNK_SIZE = 2;
const MAX_CHUNK_SIZE = 8;

/**
 * توليد اقتراح نصي لحقل معيّن
 * @param {string} fieldName - مفتاح الحقل (مثل projectInfo.description أو marketing.trends)
 * @param {string} currentValue - القيمة الحالية للحقل
 * @param {Object} projectContext - بيانات المشروع (state أو projectInfo)
 * @returns {Promise<string>} النص المقترح
 */
export async function generateSuggestion(fieldName, currentValue, projectContext, tone = 'professional') {
    const projectInfo = projectContext?.projectInfo ?? projectContext ?? {};
    const state = { projectInfo };

    // F3: مساعد الكتابة يعمل داخلياً وفورياً — النموذج الداخلي يغطي كل الحقول. كان المسار
    // يمرّ أولاً عبر الخادم بمهلة 20 ثانية، فيبدو الزر «صامتاً» طوال الانتظار قبل السقوط
    // للمولّد الداخلي. الآن نبدأ بالداخلي (فوري وحتمي) ونجعل الخادم بديلاً احتياطياً فقط.
    try {
        const internal = generateFieldSuggestion(fieldName, currentValue, state, tone);
        if (typeof internal === 'string' && internal.trim()) return internal;
    } catch (e) {
        console.warn('generateSuggestion internal path failed', e);
    }

    const connector = new AIConnector();
    try {
        const result = await connector.query('field_suggestion', 'field_suggestion', {
            projectInfo,
            context: { fieldName, currentValue: currentValue || '', tone }
        });
        return typeof result === 'string' ? result : (result?.text ?? result?.content ?? '');
    } catch (e) {
        console.error('FieldSuggestionService.generateSuggestion:', e);
        return '';
    }
}

/**
 * إعادة صياغة تدفقية: تستدعي onChunk لكل جزء من النص ثم onDone عند الانتهاء
 * @param {string} fieldName
 * @param {string} currentValue
 * @param {Object} projectContext
 * @param {Object} options - { onChunk, onDone, onError, tone }
 */
export async function generateSuggestionStreaming(fieldName, currentValue, projectContext, { onChunk, onDone, onError, tone = 'professional' }) {
    let fullText = '';
    try {
        fullText = await generateSuggestion(fieldName, currentValue, projectContext, tone);
    } catch (e) {
        if (onError) onError(e?.message || 'فشل التوليد');
        if (onDone) onDone();
        return;
    }

    if (!fullText || typeof fullText !== 'string') {
        if (onDone) onDone();
        return;
    }

    // محاكاة التدفق: عرض النص تدريجياً (كلمة كلمة أو حرف حرف حسب الطول)
    const words = fullText.split(/(\s+)/);
    let accumulated = '';
    let index = 0;

    function pushNext() {
        if (index >= words.length) {
            if (onChunk && accumulated) onChunk(accumulated);
            if (onDone) onDone();
            return;
        }
        let chunk = '';
        let count = 0;
        const targetChunkSize = Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, Math.ceil(words.length / 30)));
        while (index < words.length && count < targetChunkSize) {
            chunk += words[index];
            index++;
            count++;
        }
        accumulated += chunk;
        if (onChunk) onChunk(accumulated);
        setTimeout(pushNext, CHUNK_DELAY_MS);
    }

    pushNext();
}

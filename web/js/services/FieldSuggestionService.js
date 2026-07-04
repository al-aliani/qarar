/**
 * FieldSuggestionService — مساعد الكتابة في كل حقل (AI Writing Assistant)
 * يرسل اسم الحقل وبيانات المشروع إلى الـ AI ويعيد صياغة احترافية أو اقتراحاً لتعبئة الحقل.
 * يدعم الاستجابة التدفقية (Streaming) لعرض النص تدريجياً.
 */

import { AIConnector } from './AIConnector.js';

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
export async function generateSuggestion(fieldName, currentValue, projectContext) {
    const connector = new AIConnector();
    const projectInfo = projectContext?.projectInfo ?? projectContext ?? {};
    try {
        const result = await connector.query('field_suggestion', 'field_suggestion', {
            projectInfo,
            context: { fieldName, currentValue: currentValue || '' }
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
 * @param {function(string): void} onChunk - يُستدعى عند كل قطعة (نص تراكمي حتى الآن)
 * @param {function(): void} onDone - يُستدعى عند الانتهاء
 * @param {function(string): void} onError - يُستدعى عند الخطأ
 */
export async function generateSuggestionStreaming(fieldName, currentValue, projectContext, { onChunk, onDone, onError }) {
    let fullText = '';
    try {
        fullText = await generateSuggestion(fieldName, currentValue, projectContext);
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

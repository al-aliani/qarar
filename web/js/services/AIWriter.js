import { AIConnector } from './AIConnector.js';
import { InternalAIGenerator } from './InternalAIGenerator.js';

export class AIWriter {
    static async generate(type, data) {
        const connector = new AIConnector();
        const projectInfo = data?.projectInfo ?? data ?? {};

        switch (type) {
            case 'legal_advice': {
                // توليد التراخيص والشكل القانوني داخلياً — لا يمرّ إطلاقاً على مستشار «advisor» العام
                // (الذي كان يعيد رسالة «استخدم القوائم المالية» غير ذات صلة بالتراخيص)
                let licenses = [];
                try {
                    const rows = InternalAIGenerator.generateLicenses({ projectInfo });
                    licenses = Array.isArray(rows) ? rows : [];
                } catch (e) {
                    console.warn('legal_advice: generateLicenses failed', e);
                    licenses = [];
                }
                // الشكل القانوني الافتراضي الأنسب لمعظم المشاريع الصغيرة/المتوسطة في السعودية
                const legalForm = 'شركة ذات مسؤولية محدودة';
                return { legalForm, licenses };
            }
            // ملاحظة: connector.query يتجاهل نص البرومبت (توليد محلي من القوالب، لا LLM) —
            // نمرّر النوع فقط. لا نبني برومبتات LLM موهِمة بذكاء خارجي غير موجود.
            case 'swot':
                return connector.query('swot', 'analysis', { projectInfo });
            case 'pestel':
                return connector.query('pestel', 'pestel', { projectInfo });
            case 'customer_segments':
            case 'suggest_segments':
                return connector.generateTableSuggestions('suggest_segments', projectInfo);
            case 'competitors':
                return connector.generateTableSuggestions('competitors', projectInfo);
            default:
                console.warn(`Unknown AI generation type: ${type}`);
                return null;
        }
    }

}

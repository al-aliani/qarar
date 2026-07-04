import { AIConnector } from './AIConnector.js';

export class AIWriter {
    static async generate(type, data) {
        const connector = new AIConnector();
        const projectInfo = data?.projectInfo ?? data ?? {};

        switch (type) {
            case 'legal_advice':
                return connector.getBusinessAdvice({ projectInfo }, {});
            case 'swot':
                return connector.query(this.buildSwotPrompt(projectInfo), 'analysis', { projectInfo });
            case 'pestel':
                return connector.query(this.buildPestelPrompt(projectInfo), 'pestel', { projectInfo });
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

    static buildSwotPrompt(data) {
        const d = data || {};
        return `أنت خبير استراتيجي. قم بإعداد تحليل SWOT لمشروع: ${d.name || 'مشروع جديد'}
        النشاط: ${d.sector || d.concept || 'غير محدد'}
        الموقع: ${d.city || 'غير محدد'}

        المطلوب:
        1. نقاط القوة (Strengths)
        2. نقاط الضعف (Weaknesses)
        3. الفرص (Opportunities)
        4. التهديدات (Threats)

        قدم الإجابة بتنسيق JSON.`;
    }

    static buildPestelPrompt(data) {
        const d = data || {};
        return `أنت خبير استراتيجي. قم بإعداد تحليل PESTEL لمشروع: ${d.name || 'مشروع جديد'}
النشاط: ${d.sector || d.concept || 'غير محدد'}
الموقع: ${d.city || 'غير محدد'}

المطلوب تحليل العوامل الستة للبيئة الخارجية:
1. سياسي (political)  2. اقتصادي (economic)  3. اجتماعي (social)
4. تقني (technological)  5. بيئي (environmental)  6. قانوني (legal)

لكل عامل: وصف التأثير على المشروع، وحقل impact بقيمة واحدة فقط: positive أو negative أو neutral.

أرجع JSON على شكل مصفوفة من 6 عناصر. كل عنصر: { "factor": "political|economic|social|technological|environmental|legal", "description": "نص عربي", "impact": "positive|negative|neutral" }. لا أقسام أخرى.`;
    }
}

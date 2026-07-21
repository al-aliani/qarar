import { resolveQaStepIndex } from './qaStepMapper.js';

function normalizeItem(item, severity) {
    const message = typeof item === 'string' ? item : (item?.message || item?.code || 'بند يحتاج مراجعة');
    return {
        code: typeof item === 'object' ? item?.code || '' : '',
        path: typeof item === 'object' ? item?.path || '' : '',
        message,
        severity,
        stepIndex: typeof item === 'object' ? resolveQaStepIndex(item) : null
    };
}

/** يحوّل مخرجات QA المتفرقة إلى بوابة قرار واحدة تستخدمها الواجهة والتصدير. */
export function buildDecisionQualityGate(qa = {}) {
    const hardItems = [
        ...(qa.hardErrors || []),
        ...(qa.validationErrors || [])
    ].map((item) => normalizeItem(item, 'hard'));
    const warningItems = [
        ...(qa.softWarnings || []),
        ...(qa.validationWarnings || [])
    ].map((item) => normalizeItem(item, 'warning'));

    const score = Math.max(0, Math.min(100,
        100 - Math.min(75, hardItems.length * 25) - Math.min(40, warningItems.length * 5)
    ));
    const locked = hardItems.length > 0;
    const status = locked ? 'blocked' : warningItems.length ? 'review' : 'ready';

    return {
        locked,
        status,
        score,
        hardCount: hardItems.length,
        warningCount: warningItems.length,
        title: locked
            ? 'القرار محجوب حتى إصلاح البيانات الحرجة'
            : warningItems.length
                ? 'القرار متاح مع ملاحظات جودة'
                : 'الدراسة جاهزة لإظهار القرار',
        summary: locked
            ? 'لن تعرض المنصة توصية GO أو NO-GO قبل اكتمال الحد الأدنى من البيانات واتساق القوائم المالية.'
            : warningItems.length
                ? 'لا توجد أخطاء مانعة، لكن معالجة التنبيهات ترفع موثوقية التقرير أمام الممول أو المستثمر.'
                : 'اجتازت الدراسة فحوص البيانات والاتساق الأساسية.',
        actions: [...hardItems, ...warningItems].slice(0, 8),
        hardItems,
        warningItems
    };
}

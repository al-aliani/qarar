import { buildDecisionActionPlan } from './decisionActionPlan.js';

const SECTION_STEPS = {
    projectInfo: 0, technical: 4, hr: 6, assumptions: 2, revenue: 12,
    marketing: 9, marketSizing: 10, legal: 7, riskAnalysis: 22,
    scenarios: 20, financing: 17
};

const weight = { critical: 0, high: 1, medium: 2, low: 3 };
const daysUntil = value => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null;

function add(list, item) {
    if (!item?.id || list.some(existing => existing.id === item.id)) return;
    list.push({ status: 'new', priority: 'medium', ...item });
}

/** يرتب الإجراء التالي من حالة الدراسة والعمل المحيط بها، بلا عتبات مالية موازية للمحرك. */
export function buildNextActions({ study = {}, results = {}, completeness = {}, qualityGate = {}, workspace = {} } = {}) {
    const actions = [];
    const tasks = workspace.tasks || [];
    const requests = workspace.requests || [];
    const quotes = workspace.quotes || [];
    const suggestions = workspace.suggestions || [];

    tasks.filter(task => task.status !== 'done' && task.due_date && daysUntil(task.due_date) < 0).forEach(task => add(actions, {
        id: `task-${task.id}`, title: `مهمة متأخرة: ${task.title}`, reason: 'تجاوزت موعدها وتؤثر في تقدم المشروع.',
        impact: 'إزالة التعثر من خطة التنفيذ', priority: 'critical', route: 'workspace', source: 'task'
    }));
    requests.filter(request => request.status === 'waiting_customer').forEach(request => add(actions, {
        id: `request-${request.id}`, title: `أكمل المطلوب في: ${request.title}`, reason: 'الجهة تنتظر رداً منك.',
        impact: 'استمرار دورة الطلب', priority: 'critical', route: 'workspace', source: 'request'
    }));
    suggestions.filter(item => item.status === 'pending').forEach(item => add(actions, {
        id: `review-${item.id}`, title: `راجع اقتراح الخبير على ${item.field_path}`, reason: item.rationale,
        impact: 'تحسين دقة الدراسة', priority: 'high', route: 'workspace', source: 'review'
    }));
    quotes.filter(quote => !quote.accepted_at && quote.valid_until && daysUntil(quote.valid_until) <= 7).forEach(quote => add(actions, {
        id: `quote-${quote.id}`, title: `احسم عرض ${quote.item_label}`, reason: `تنتهي صلاحيته خلال ${Math.max(0, daysUntil(quote.valid_until))} أيام.`,
        impact: 'تثبيت تكلفة واقعية', priority: 'high', route: 'workspace', source: 'quote'
    }));
    if (qualityGate.locked) add(actions, {
        id: 'quality-blocked', title: 'أصلح أخطاء جودة البيانات', reason: `القرار محجوب بسبب ${qualityGate.hardCount || 1} أخطاء حرجة.`,
        impact: 'إتاحة قرار موثوق', priority: 'critical', stepIndex: 0, source: 'quality'
    });

    const incomplete = Object.entries(completeness.details || {})
        .filter(([section, detail]) => Number(detail.percentage) < 50 && SECTION_STEPS[section] != null)
        .sort((a, b) => Number(a[1].percentage) - Number(b[1].percentage))[0];
    if (Number(completeness.percentage || 0) < 70 && incomplete) {
        const [section, detail] = incomplete;
        add(actions, { id: `complete-${section}`, title: `أكمل ${detail.missing?.[0] || 'بيانات الدراسة'}`, reason: `اكتمال هذا القسم ${Math.round(detail.percentage || 0)}%.`, impact: 'رفع موثوقية النتائج', priority: 'high', stepIndex: SECTION_STEPS[section] ?? 0, source: 'completeness' });
    }

    buildDecisionActionPlan(study, results).forEach(item => add(actions, {
        ...item, reason: item.description, impact: item.priority === 'high' ? 'معالجة سبب مؤثر في القرار' : 'تحسين جاهزية المشروع', source: 'decision'
    }));

    return actions.sort((a, b) => weight[a.priority] - weight[b.priority]).slice(0, 4);
}

export function actionTarget(action) {
    if (action?.route) return `#/${action.route}`;
    return Number.isInteger(action?.stepIndex) ? `#/step/${action.stepIndex}` : '#/workspace';
}

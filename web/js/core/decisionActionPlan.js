import { STEPS } from './wizardSteps.js';

const stepIndex = (predicate) => STEPS.findIndex(predicate);

const STEP_TARGETS = {
    pricing: () => stepIndex(step => step.isPricingOptimizer),
    revenue: () => stepIndex(step => step.id === 'revenue'),
    financing: () => stepIndex(step => step.isFinancing),
    market: () => stepIndex(step => step.isMarketAnalysis),
    technical: () => stepIndex(step => step.id === 'technical'),
    risk: () => stepIndex(step => step.isRiskMatrix),
    scenarios: () => stepIndex(step => step.isScenarios),
    timeline: () => stepIndex(step => step.isTimeline),
    executiveSummary: () => stepIndex(step => step.isExecutiveSummary),
};

function action(id, title, description, target, priority = 'medium') {
    return { id, title, description, priority, ...target };
}

function actionForIssue(issue = {}) {
    const path = String(issue.path || '').toLowerCase();
    const metric = String(issue.metric || '').toLowerCase();
    const text = `${path} ${metric} ${issue.title || ''}`.toLowerCase();

    if (/fund|financ|dscr|debt|cashflow|cash flow/.test(text)) {
        return action('fix-financing', 'عالج التمويل والسيولة', issue.action || issue.explanation, { stepIndex: STEP_TARGETS.financing() }, 'high');
    }
    if (/price|margin|npv|irr|roi|payback|break.?even|revenue/.test(text)) {
        return action('fix-pricing', 'اختبر السعر والهامش', issue.action || issue.explanation, { stepIndex: STEP_TARGETS.pricing() }, issue.severity === 'critical' ? 'high' : 'medium');
    }
    if (/capacity|technical|asset/.test(text)) {
        return action('fix-capacity', 'راجع الطاقة والأصول', issue.action || issue.explanation, { stepIndex: STEP_TARGETS.technical() }, 'high');
    }
    if (/market|som|tam|sam/.test(text)) {
        return action('fix-market', 'راجع واقعية السوق', issue.action || issue.explanation, { stepIndex: STEP_TARGETS.market() }, 'high');
    }
    if (/scenario|pessimistic/.test(text)) {
        return action('fix-scenarios', 'اختبر السيناريوهات', issue.action || issue.explanation, { stepIndex: STEP_TARGETS.scenarios() });
    }
    if (/risk/.test(text)) {
        return action('fix-risk', 'خفّف المخاطر', issue.action || issue.explanation, { stepIndex: STEP_TARGETS.risk() });
    }
    return null;
}

function actionForPartnerNeed(need = {}) {
    const descriptions = {
        supplier: 'استعرض معايير المورد المناسب وسجّل الموردين المرشحين داخل الدراسة.',
        financial_equity: 'جهّز ملف المشروع وحدد نوع الشريك أو الممول المطلوب.',
        technology: 'حدد نطاق الشريك التقني ومعايير الاختيار قبل التواصل.',
        market_entry: 'جهّز متطلبات شريك الدخول للسوق وتحقق من التوافق.',
        franchise_relationship: 'وثّق التزامات المانح والعلاقة التعاقدية قبل التنفيذ.'
    };
    return action(
        `partner-${need.type || 'general'}`,
        need.label || 'اختر الشريك المناسب',
        descriptions[need.type] || need.reason || 'راجع احتياج المشروع للشراكات.',
        { route: 'partner' },
        need.priority || 'medium'
    );
}

/** يبني إجراءات قابلة للتنفيذ من نفس أسباب القرار واحتياجات الشركاء المحسوبة. */
export function buildDecisionActionPlan(_study = {}, results = {}) {
    const actions = [];
    const issues = Array.isArray(results?.decisionExplanation?.issues) ? results.decisionExplanation.issues : [];
    const partnerNeeds = Array.isArray(results?.partnerNeeds) ? results.partnerNeeds : [];

    issues.forEach(issue => {
        const item = actionForIssue(issue);
        if (item) actions.push(item);
    });
    partnerNeeds.forEach(need => actions.push(actionForPartnerNeed(need)));

    if (results?.decision === 'GO') {
        actions.push(action('start-execution', 'حوّل القرار إلى خطة تنفيذ', 'راجع الأنشطة والمواعيد والمسؤوليات قبل بدء المشروع.', { stepIndex: STEP_TARGETS.timeline() }, 'high'));
        actions.push(action('prepare-report', 'جهّز النسخة المعتمدة', 'راجع الملخص التنفيذي ثم صدّر التقرير للممول أو الشريك.', { stepIndex: STEP_TARGETS.executiveSummary() }));
    } else if (issues.length > 0) {
        actions.push(action('request-review', 'اطلب مراجعة مختص', 'اربط طلب الاستشارة بهذه الدراسة ليراجع المختص نقاط القرار الحرجة.', { route: 'advisory' }));
    }

    const seen = new Set();
    return actions
        .filter(item => item.stepIndex >= 0 || item.route)
        .filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        })
        .sort((a, b) => (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1))
        .slice(0, 6);
}

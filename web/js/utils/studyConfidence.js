const finite = (value) => Number.isFinite(Number(value));
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const assumptionRows = [
    ['discountRate', 'معدل الخصم', (value) => `${(Number(value) * 100).toFixed(1)}%`],
    ['inflationRate', 'التضخم', (value) => `${(Number(value) * 100).toFixed(1)}%`],
    ['projectionYears', 'سنوات التوقع', (value) => `${Number(value)} سنوات`],
    ['taxRate', 'معدل الضريبة', (value) => `${(Number(value) * 100).toFixed(1)}%`],
];

export function buildStudyConfidence(state = {}, results = {}, qa = null) {
    const assumptions = state.assumptions || {};
    const project = state.projectInfo || {};
    const revenueStreams = state.revenue?.revenueStreams || [];
    const scoreParts = [
        Boolean(project.name || project.concept),
        revenueStreams.length > 0,
        finite(state.technical?.totalCost) || finite(results?.investment?.total),
        finite(state.financing?.sources?.equity?.amount) || finite(state.financing?.sources?.bankLoan?.amount),
        finite(assumptions.discountRate),
    ];
    const hard = (qa?.hardErrors || []).length + (qa?.validationErrors || []).length;
    const warnings = (qa?.softWarnings || []).length + (qa?.validationWarnings || []).length;
    const completeness = Math.round((scoreParts.filter(Boolean).length / scoreParts.length) * 70);
    const score = Math.max(0, Math.min(100, completeness + 30 - (hard * 20) - (warnings * 5)));
    const level = score >= 85 ? 'مرتفع' : score >= 60 ? 'متوسط' : 'مبدئي';
    const sourceSet = new Set(['مدخلات صاحب الدراسة: الأسعار، التكاليف، والتمويل']);
    const marketSource = state.marketSizing?.source || results?.marketPreview?.source;
    if (marketSource) sourceSet.add(String(marketSource));
    if (results?.assumptionsApplied?.discountRateSource === 'wacc') sourceSet.add('معدل الخصم محسوب من هيكل التمويل (WACC)');
    else sourceSet.add('معدل الخصم: افتراض معلن في الدراسة');

    return {
        score,
        level,
        generatedAt: new Date().toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'latn' }),
        assumptions: assumptionRows
            .filter(([key]) => finite(assumptions[key]))
            .map(([key, label, format]) => ({ label, value: format(assumptions[key]) })),
        sources: [...sourceSet],
        note: 'الدرجة تقيس اكتمال المدخلات واتساق فحص الجودة، وليست ضماناً للعائد أو قرار التمويل.'
    };
}

export function renderStudyConfidence(confidence) {
    const assumptions = confidence.assumptions.length
        ? confidence.assumptions.map((item) => `<li>${escapeHtml(item.label)}: <strong>${escapeHtml(item.value)}</strong></li>`).join('')
        : '<li>لم تُسجّل افتراضات مالية كافية بعد.</li>';
    const sources = confidence.sources.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    return `
        <section class="study-confidence" aria-label="موثوقية نتائج الدراسة" style="border:1px solid var(--c-border);border-radius:10px;padding:14px;margin:12px 0;background:var(--c-surface-2,rgba(255,255,255,.04));">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap;">
                <strong>درجة موثوقية النتائج: ${confidence.score}% <span class="text-muted">(${confidence.level})</span></strong>
                <span class="text-xs text-muted">حُسبت: ${confidence.generatedAt}</span>
            </div>
            <p class="text-xs text-muted" style="margin:8px 0;">${confidence.note}</p>
            <details>
                <summary class="text-sm" style="cursor:pointer;">الافتراضات والمصادر المستخدمة</summary>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:10px;" class="text-xs">
                    <div><strong>افتراضات ظاهرة</strong><ul style="margin:6px 0;padding-inline-start:18px;">${assumptions}</ul></div>
                    <div><strong>مصادر/منشأ الأرقام</strong><ul style="margin:6px 0;padding-inline-start:18px;">${sources}</ul></div>
                </div>
            </details>
        </section>`;
}

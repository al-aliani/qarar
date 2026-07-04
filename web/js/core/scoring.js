/**
 * Project Scoring Engine
 * يقيّم الدراسة ويعطي درجة (0–100) وتوصية GO/NO-GO/REVISE
 * مبنية على Thresholds في 01_Assumptions (معايير QA).
 *
 * @param {Object} state - الحالة (للاستدلال: assumptions.thresholds، اكتمال البيانات)
 * @param {Object} results - مخرجات المحرك (indicators، decision، decisionReasons، incomeStatement)
 */
export function calculateProjectScore(state, results) {
    if (!results) {
        return {
            score: 0,
            rating: 'F',
            details: [],
            recommendation: 'nogo',
            recommendationLabel: 'غير محدد (لا توجد نتائج)',
            color: 'text-muted'
        };
    }

    const ind = results.indicators || results.kpis || results.financials || {};
    const npv = ind.npv ?? 0;
    const irr = ind.irr ?? 0;
    const payback = ind.paybackPeriod ?? ind.payback ?? 999;
    const roi = ind.roi ?? 0;
    const margin = ind.profitMargin ?? (results.incomeStatement?.[0]
        ? (results.incomeStatement[0].netIncome || 0) / ((results.incomeStatement[0].revenue || 1))
        : 0);

    const th = (state && state.assumptions && state.assumptions.thresholds) ? state.assumptions.thresholds : {};
    const minNPV = th.minNPV != null ? Number(th.minNPV) : 0;
    const minIRR = th.minIRR != null ? Number(th.minIRR) : 0.15;
    const maxPayback = th.maxPayback != null ? Number(th.maxPayback) : 7;
    const minROI = th.minROI != null ? Number(th.minROI) : 0.20;

    const details = [];
    let score = 0;

    // NPV (حتى 25)
    if (npv > minNPV) {
        score += 25;
        details.push({ category: 'financial', label: 'صافي القيمة الحالية (NPV) يحقق الحد الأدنى', score: 25, max: 25 });
    } else {
        details.push({ category: 'financial', label: 'صافي القيمة الحالية دون الحد الأدنى', score: 0, max: 25, issue: true });
    }

    // IRR (حتى 25)
    if (irr >= minIRR) {
        score += 25;
        details.push({ category: 'financial', label: `معدل العائد الداخلي (IRR) ≥ ${(minIRR * 100).toFixed(0)}%`, score: 25, max: 25 });
    } else if (irr > 0) {
        score += 10;
        details.push({ category: 'financial', label: 'معدل العائد الداخلي دون المستوى المطلوب', score: 10, max: 25, issue: true });
    } else {
        details.push({ category: 'financial', label: 'معدل العائد الداخلي غير محقق', score: 0, max: 25, issue: true });
    }

    // فترة الاسترداد (حتى 25)
    if (payback > 0 && payback <= maxPayback) {
        score += 25;
        details.push({ category: 'financial', label: `فترة الاسترداد ≤ ${maxPayback} سنوات`, score: 25, max: 25 });
    } else if (payback > 0 && payback < 10) {
        score += 10;
        details.push({ category: 'financial', label: 'فترة الاسترداد أطول من المطلوب', score: 10, max: 25, issue: true });
    } else {
        details.push({ category: 'financial', label: 'فترة الاسترداد غير محققة', score: 0, max: 25, issue: true });
    }

    // هامش الربح / العائد (حتى 25)
    if (roi >= minROI || (minROI <= 0 && margin > 0.1)) {
        score += 25;
        details.push({ category: 'financial', label: 'العائد على الاستثمار أو هامش الربح مقبول', score: 25, max: 25 });
    } else if (margin > 0 || roi > 0) {
        score += 10;
        details.push({ category: 'financial', label: 'ربحية منخفضة', score: 10, max: 25, issue: true });
    } else {
        details.push({ category: 'financial', label: 'الربحية غير محققة', score: 0, max: 25, issue: true });
    }

    // اكتمال البيانات (اختياري، لا يغيّر التوصية المعتمدة على الـ Thresholds)
    if (state) {
        if ((state.marketSizing?.som?.value ?? state.marketSizing?.tam?.value) > 0) {
            details.push({ category: 'data', label: 'حجم السوق مُدخل', score: 5, max: 5 });
        }
        if ((state.hr?.positions?.length || state.technical?.equipment?.length) > 0) {
            details.push({ category: 'data', label: 'البنود الأساسية مكتملة', score: 5, max: 5 });
        }
    }

    let rating = 'F';
    if (score >= 90) rating = 'A+';
    else if (score >= 80) rating = 'A';
    else if (score >= 70) rating = 'B';
    else if (score >= 60) rating = 'C';
    else if (score >= 50) rating = 'D';

    // التوصية: نعتمد results.decision (من المحرك/Thresholds) إن وُجد، وإلا نستنتج من الدرجة
    let recommendation = 'revise';
    let recommendationLabel = 'مراجعة مطلوبة (REVISE)';
    let color = 'text-warning';

    const d = (results.decision || '').toUpperCase();
    if (d === 'GO') {
        recommendation = 'go';
        recommendationLabel = 'مشروع مجدي (GO)';
        color = 'text-success';
    } else if (d === 'NO-GO' || d === 'NOGO') {
        recommendation = 'nogo';
        recommendationLabel = 'غير مجدي (NO-GO)';
        color = 'text-danger';
    } else if (d === 'REVISE') {
        recommendation = 'revise';
        recommendationLabel = 'مراجعة مطلوبة (REVISE)';
        color = 'text-warning';
    } else {
        // استنتاج من الدرجة عند غياب results.decision
        if (score >= 80) {
            recommendation = 'go';
            recommendationLabel = 'مشروع مجدي (GO)';
            color = 'text-success';
        } else if (score < 50) {
            recommendation = 'nogo';
            recommendationLabel = 'غير مجدي (NO-GO)';
            color = 'text-danger';
        }
    }

    return {
        score,
        rating,
        details,
        recommendation,
        recommendationLabel,
        color
    };
}

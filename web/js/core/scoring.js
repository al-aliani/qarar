import { resolveDecisionThresholds } from './engine.js';

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
    // تدقيق 2026-07-08 (ملاحظة منخفضة #44): كان المسار الاحتياطي يقسم على
    // (الإيرادات || 1) — إيراد صفري فعلي (لا مفقود) كان يقسم صافي الدخل على 1
    // فيُنتج هامشاً غير منطقي (مثال: صافي دخل ‎-50,000‏ / 1 = ‎-5,000,000%‏).
    const y1 = results.incomeStatement?.[0];
    const margin = ind.profitMargin ?? (y1 && y1.revenue > 0 ? (y1.netIncome || 0) / y1.revenue : 0);

    // تدقيق 2026-07-08 (ملاحظة متوسطة #7): كانت هذه العتبات تُشتق محلياً (استرداد
    // احتياطي 7 سنوات) بدل resolveDecisionThresholds الموحّدة في engine.js (استرداد
    // احتياطي 3.5 سنة فعلياً) — فتتناقض بطاقة تفاصيل التقييم مع شارة القرار الفعلية
    // في نفس شاشة لوحة القرار لنفس المشروع. نقرأ الآن العتبات المُحلَّلة فعلياً من
    // نتيجة المحرك (results.assumptionsApplied.thresholds) حين تتوفر.
    const resolvedThresholds = results.assumptionsApplied?.thresholds
        || resolveDecisionThresholds(state?.assumptions?.thresholds, state?.financing);
    const minNPV = resolvedThresholds.minNPV;
    const minIRR = resolvedThresholds.minIRR;
    const maxPayback = resolvedThresholds.maxPayback;
    const minROI = resolvedThresholds.minROI;

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

    // هامش الربح / العائد (حتى 5) — تدقيق 2026-07-12: كانت 15 (مالية 90 + بيانات 10)؛
    // خُفِّضت إلى 5 لإفساح مكوّن مخاطر/مونت كارلو جديد (10 نقاط) دون المساس بالبنود
    // المالية الثلاثة الكبرى (NPV/IRR/استرداد) المختبرة بالفعل بقيمها الحرفية.
    // الأوزان تجمع 100 بالضبط الآن: مالية 80 (25+25+25+5) + مخاطر 10 + بيانات 10.
    if (roi >= minROI || (minROI <= 0 && margin > 0.1)) {
        score += 5;
        details.push({ category: 'financial', label: 'العائد على الاستثمار أو هامش الربح مقبول', score: 5, max: 5 });
    } else if (margin > 0 || roi > 0) {
        score += 2;
        details.push({ category: 'financial', label: 'ربحية منخفضة', score: 2, max: 5, issue: true });
    } else {
        details.push({ category: 'financial', label: 'الربحية غير محققة', score: 0, max: 5, issue: true });
    }

    // مخاطر / مونت كارلو (حتى 10) — تدقيق 2026-07-12: الدرجة كانت خالية من أي مكوّن
    // مخاطر رغم وجود محاكاة مونت كارلو كاملة في المحرك (نفس البيانات التي تُخفّض القرار
    // من GO إلى REVISE في engine.js عند احتمالية < 50%) — درجة 100/100 كانت ممكنة لمشروع
    // هش لا يصمد أمام التذبذب. نفس عتبتَي 0.4/0.7 المستخدمتَين في عرض بطاقة الاحتمالية
    // بلوحة القرار (اتساق لغة المنتج). غياب تشغيل سابق محايد (5 لا صفر) — نفس فلسفة بوابة
    // القرار في المحرك: المحاكاة استشارية اختيارية، غيابها ليس خللاً مؤكَّداً في المشروع.
    const mcProbability = Number(state?.monteCarlo?.lastRun?.successProbability);
    if (!Number.isFinite(mcProbability)) {
        score += 5;
        details.push({ category: 'risk', label: 'لم يُشغَّل تحليل مونت كارلو بعد — نقاط محايدة', score: 5, max: 10 });
    } else if (mcProbability >= 0.7) {
        score += 10;
        details.push({ category: 'risk', label: 'احتمالية نجاح مونت كارلو مرتفعة (صامدة تحت التذبذب)', score: 10, max: 10 });
    } else if (mcProbability >= 0.4) {
        score += 5;
        details.push({ category: 'risk', label: 'احتمالية نجاح مونت كارلو متوسطة', score: 5, max: 10, issue: true });
    } else {
        details.push({ category: 'risk', label: 'احتمالية نجاح مونت كارلو منخفضة — راجع هامش الأمان', score: 0, max: 10, issue: true });
    }

    // اكتمال البيانات (10 نقاط) — تُضاف للدرجة كي تساوي الدرجة مجموع التفاصيل (مالية 80 + مخاطر 10 + بيانات 10 = 100)
    if (state) {
        if ((state.marketSizing?.som?.value ?? state.marketSizing?.tam?.value) > 0) {
            score += 5;
            details.push({ category: 'data', label: 'حجم السوق مُدخل', score: 5, max: 5 });
        } else {
            details.push({ category: 'data', label: 'حجم السوق غير مُدخل', score: 0, max: 5, issue: true });
        }
        if ((state.hr?.positions?.length || state.technical?.equipment?.length) > 0) {
            score += 5;
            details.push({ category: 'data', label: 'البنود الأساسية مكتملة', score: 5, max: 5 });
        } else {
            details.push({ category: 'data', label: 'البنود الأساسية ناقصة', score: 0, max: 5, issue: true });
        }
    }

    // سقف 100 (الأوزان مضبوطة على 100، والسقف حماية إضافية)
    score = Math.min(100, score);

    // تجميع التفاصيل في فئات — مصدر واحد للدرجة يستهلكه كلٌّ من لوحة القرار والملخص التنفيذي
    // (كان لكلٍّ خوارزمية مستقلة فتظهر درجات متضاربة لنفس المشروع).
    const CATEGORY_LABELS = { financial: 'الجدوى المالية', risk: 'المخاطر ومونت كارلو', data: 'اكتمال البيانات' };
    const breakdown = {};
    for (const item of details) {
        const cat = item.category || 'other';
        if (!breakdown[cat]) breakdown[cat] = { label: CATEGORY_LABELS[cat] || cat, score: 0, max: 0 };
        breakdown[cat].score += item.score || 0;
        breakdown[cat].max += item.max || 0;
    }

    let rating = 'F';
    if (score >= 90) rating = 'A+';
    else if (score >= 80) rating = 'A';
    else if (score >= 70) rating = 'B';
    else if (score >= 60) rating = 'C';
    else if (score >= 50) rating = 'D';

    // التوصية: نعتمد results.decision (من المحرك/Thresholds) إن وُجد، وإلا نستنتج من الدرجة
    let recommendation = 'revise';
    let recommendationLabel = 'مراجعة مطلوبة';
    let color = 'text-warning';

    const d = (results.decision || '').toUpperCase();
    if (d === 'GO') {
        recommendation = 'go';
        recommendationLabel = 'مشروع مجدي';
        color = 'text-success';
    } else if (d === 'NO-GO' || d === 'NOGO') {
        recommendation = 'nogo';
        recommendationLabel = 'غير مجدي';
        color = 'text-danger';
    } else if (d === 'REVISE') {
        recommendation = 'revise';
        recommendationLabel = 'مراجعة مطلوبة';
        color = 'text-warning';
    } else {
        // استنتاج من الدرجة عند غياب results.decision
        if (score >= 80) {
            recommendation = 'go';
            recommendationLabel = 'مشروع مجدي';
            color = 'text-success';
        } else if (score < 50) {
            recommendation = 'nogo';
            recommendationLabel = 'غير مجدي';
            color = 'text-danger';
        }
    }

    return {
        score,
        rating,
        details,
        breakdown,
        recommendation,
        recommendationLabel,
        color
    };
}

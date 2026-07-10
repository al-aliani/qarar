const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

function money(value) {
    return Math.round(num(value)).toLocaleString('ar-SA') + ' ريال';
}

function pct(value) {
    return (num(value) * 100).toFixed(1) + '%';
}

function pushIssue(issues, issue) {
    issues.push({
        severity: 'warning',
        metric: '',
        value: null,
        threshold: null,
        path: '',
        title: '',
        explanation: '',
        action: '',
        ...issue
    });
}

export function explainDecisionBreakers(study = {}, results = {}) {
    const issues = [];
    const indicators = results.indicators || {};
    const thresholds = study.assumptions?.thresholds || {};
    const financing = study.financing || {};
    const studyType = study.projectInfo?.studyType || 'bank_financing';
    const minNPV = num(thresholds.minNPV ?? 0);
    const minIRR = num(thresholds.minIRR ?? 0.15);
    const maxPayback = num(thresholds.maxPayback ?? 7);
    const minROI = num(thresholds.minROI ?? 0.20);
    const fundingGap = num(results.financingCheck?.fundingGap);
    // مرآة لعتبة مادية الفجوة في engine.js (تدقيق ٢٠٢٦-٠٧-٠٩) — بلا هذا، تُصعَّد أي فجوة
    // تقريب عادية بين خطوة التمويل والاستثمار المُعاد حسابه لاحقاً إلى «حرجة» هنا أيضاً.
    const fundingGapThreshold = num(
        results.financingCheck?.fundingGapMaterialityThreshold
        ?? Math.max(1000, num(results.financingCheck?.totalInvestment) * 0.01)
    );
    const loanAmount = num(financing.sources?.bankLoan?.amount || results.loanSchedule?.loanAmount);
    const targetDSCR = num(financing.targetDSCR ?? 1.25);
    const dscr = indicators.dscr;

    if (fundingGap > fundingGapThreshold) {
        pushIssue(issues, {
            severity: 'critical',
            metric: 'fundingGap',
            value: fundingGap,
            threshold: 0,
            path: 'financing.sources',
            title: 'فجوة التمويل',
            tooltipKey: '',
            explanation: `مصادر التمويل أقل من الاستثمار المطلوب بفارق ${money(fundingGap)}.`,
            action: 'ارفع التمويل الذاتي/المستثمرين، أو خفّض CAPEX ورأس المال العامل قبل اعتماد القرار.'
        });
    }

    if (loanAmount > 0 && (dscr == null || num(dscr) < targetDSCR)) {
        pushIssue(issues, {
            severity: studyType === 'bank_financing' ? 'critical' : 'warning',
            metric: 'dscr',
            value: dscr,
            threshold: targetDSCR,
            path: 'financing.sources.bankLoan.amount',
            title: 'تغطية خدمة الدين',
            tooltipKey: 'DSCR',
            explanation: dscr == null
                ? 'DSCR غير قابل للحساب غالباً بسبب EBITDA سالبة أو صفرية في السنة الأولى.'
                : `DSCR الحالي ${num(dscr).toFixed(2)}x أقل من المستهدف ${targetDSCR.toFixed(2)}x.`,
            action: 'خفّض مبلغ القرض، زد فترة السماح، ارفع رأس المال الذاتي، أو أثبت إيرادات مسبقة.'
        });
    }

    if (num(indicators.npv) <= minNPV) {
        pushIssue(issues, {
            severity: 'critical',
            metric: 'npv',
            value: indicators.npv,
            threshold: minNPV,
            path: 'revenue.streams',
            title: 'صافي القيمة الحالية',
            tooltipKey: 'NPV',
            explanation: `NPV يساوي ${money(indicators.npv)} ولا يتجاوز الحد ${money(minNPV)}.`,
            action: 'راجع السعر، الحجم، المصاريف الثابتة، أو الاستثمار الأولي.'
        });
    }

    if (indicators.irr == null || num(indicators.irr) < minIRR) {
        pushIssue(issues, {
            severity: 'warning',
            metric: 'irr',
            value: indicators.irr,
            threshold: minIRR,
            path: 'assumptions.thresholds.minIRR',
            title: 'معدل العائد الداخلي',
            tooltipKey: 'IRR',
            explanation: indicators.irr == null
                ? 'IRR غير قابل للحساب من التدفقات الحالية.'
                : `IRR الحالي ${pct(indicators.irr)} أقل من الحد ${pct(minIRR)}.`,
            action: 'وازن بين نمو الإيراد والاستثمار المطلوب، أو عدّل حد القبول حسب نوع الدراسة.'
        });
    }

    if (indicators.paybackPeriod == null || num(indicators.paybackPeriod) > maxPayback) {
        pushIssue(issues, {
            severity: 'warning',
            metric: 'paybackPeriod',
            value: indicators.paybackPeriod,
            threshold: maxPayback,
            path: 'assumptions.thresholds.maxPayback',
            title: 'فترة الاسترداد',
            tooltipKey: 'PAYBACK',
            explanation: indicators.paybackPeriod == null
                ? 'لا يمكن استرداد رأس المال ضمن الأفق الزمني المتاح (عجز متراكم).'
                : `الاسترداد خلال ${num(indicators.paybackPeriod).toFixed(1)} سنة أطول من سقف ${maxPayback} سنوات.`,
            action: 'إما أن تخفض النفقات الرأسمالية الأولية، أو تزيد هوامش الربح لتسريع النقد.'
        });
    }

    if (indicators.roi == null || num(indicators.roi) < minROI) {
        pushIssue(issues, {
            severity: 'warning',
            metric: 'roi',
            value: indicators.roi,
            threshold: minROI,
            path: 'assumptions.thresholds.minROI',
            title: 'العائد على الاستثمار',
            tooltipKey: 'ROI',
            explanation: `ROI يبلغ ${pct(indicators.roi)} وهو أقل من المستهدف ${pct(minROI)}.`,
            action: 'راجع تكلفة الأصول والمصروفات التأسيسية لرفع كفاءة الاستثمار.'
        });
    }

    // هامش أمان نقطة التعادل: نسبة قيمة التعادل إلى إيراد السنة الأولى الفعلي. هامش ضيق
    // (<15%) يعني أن أي تراجع بسيط في الإيراد يُسقط المشروع تحت التعادل؛ bepRatio > 1
    // يعني أن التعادل غير قابل للتحقيق أصلاً بافتراضات الإيراد الحالية.
    const year1Revenue = num(results.incomeStatement?.[0]?.revenue);
    const breakEvenValue = num(indicators.breakEvenPointValue);
    if (year1Revenue > 0 && breakEvenValue > 0) {
        const bepRatio = breakEvenValue / year1Revenue;
        const bepSafetyMargin = 1 - bepRatio;
        if (bepSafetyMargin < 0.15) {
            pushIssue(issues, {
                severity: bepRatio > 1 ? 'critical' : 'warning',
                metric: 'breakEvenSafetyMargin',
                value: bepSafetyMargin,
                threshold: 0.15,
                path: 'indicators.breakEvenPointValue',
                title: 'هامش أمان نقطة التعادل ضعيف',
                tooltipKey: 'BEP',
                explanation: bepRatio > 1
                    ? `نقطة التعادل (${money(breakEvenValue)}) تتجاوز إيراد السنة الأولى المتوقع (${money(year1Revenue)}) — التعادل غير قابل للتحقيق بالافتراضات الحالية.`
                    : `هامش الأمان قبل الوصول لنقطة التعادل ${pct(bepSafetyMargin)} فقط (نقطة التعادل ${money(breakEvenValue)} مقابل إيراد سنة أولى ${money(year1Revenue)}).`,
                action: 'ارفع السعر أو حجم المبيعات المتوقع، أو خفّض التكاليف الثابتة لتوسيع هامش الأمان قبل نقطة التعادل.'
            });
        }
    }

    // عجز نقدي تراكمي ممتد: عدد السنوات (بعد سنة الصفر) التي يظل فيها التدفق النقدي
    // التراكمي سالباً قبل أن يتحول لموجب. سنتان فأكثر تعني حاجة حقيقية لاحتياطي نقدي
    // أو إعادة جدولة تمويل، ولو كانت مؤشرات NPV/IRR الإجمالية مقبولة.
    const cashFlowRows = Array.isArray(results.cashFlow) ? results.cashFlow : [];
    const negativeCumYears = cashFlowRows.filter(cf => cf.year > 0 && num(cf.cumulative) < 0).length;
    if (negativeCumYears >= 2) {
        pushIssue(issues, {
            severity: 'warning',
            metric: 'negativeCumulativeCashFlow',
            value: negativeCumYears,
            threshold: 2,
            path: 'cashFlow',
            title: 'تدفق نقدي تراكمي سالب لعدة سنوات',
            explanation: `التدفق النقدي التراكمي يبقى سالباً لمدة ${negativeCumYears} سنة قبل أن يتحول لموجب — عجز نقدي ممتد يحتاج تمويلاً إضافياً أو احتياطياً كافياً لتغطيته.`,
            action: 'وفّر احتياطياً نقدياً يغطي فترة العجز، راجع جدول سداد القرض، أو سرّع نمو الإيراد في السنوات الأولى.'
        });
    }

    if (results.capacityCheck?.exceeded) {
        pushIssue(issues, {
            severity: 'critical',
            metric: 'capacity',
            value: results.capacityCheck.plannedUnitsPerMonth,
            threshold: results.capacityCheck.maxUnitsPerMonth,
            path: 'technical.capacityModel',
            title: 'الطاقة التشغيلية',
            explanation: 'المبيعات المخططة تتجاوز الطاقة القصوى المدخلة.',
            action: 'خفّض عدد العملاء/الطلبات أو وسّع الطاقة التشغيلية في الدراسة الفنية.'
        });
    }

    // مرآة لبوابة engine.js (GO الهش تحت السيناريو المتشائم) — بلا هذا السبب، يظهر شارة
    // REVISE في لوحة القرار دون سبب مطابق في لوحة «لماذا هذا القرار».
    const pessNpv = results.scenarios?.pessimistic?.kpis?.npv;
    if (pessNpv != null && pessNpv < 0 && num(indicators.npv) > minNPV) {
        pushIssue(issues, {
            severity: 'warning',
            metric: 'pessimisticNpv',
            value: pessNpv,
            threshold: 0,
            path: 'scenarios.pessimistic',
            title: 'مرونة السيناريو المتشائم',
            explanation: `المشروع مجدٍ في الحالة الأساسية (NPV ${money(indicators.npv)}) لكنه يخسر تحت السيناريو المتشائم (NPV ${money(pessNpv)}).`,
            action: 'راجع هامش الأمان: قلّص التكاليف الثابتة، نوّع الإيرادات، أو أضف احتياطاً نقدياً قبل الاعتماد على القرار.'
        });
    }

    if (results.saudiMarket?.warnings?.length) {
        results.saudiMarket.warnings.forEach(w => pushIssue(issues, {
            severity: w.code === 'REVENUE_EXCEEDS_SOM' ? 'critical' : 'warning',
            metric: w.code,
            path: w.path,
            title: 'واقعية السوق',
            explanation: w.message,
            action: 'وثّق حجم السوق أو عدّل توقع الإيرادات والحصة المستهدفة.'
        }));
    }

    if (results.saasMetrics?.warnings?.length) {
        results.saasMetrics.warnings.forEach(w => pushIssue(issues, {
            severity: w.code === 'SAAS_MRR_MISSING' ? 'critical' : 'warning',
            metric: w.code,
            path: w.path,
            title: 'مؤشرات SaaS',
            explanation: w.message,
            action: 'راجع الاشتراكات، التسعير، تكلفة السحابة، والتسويق.'
        }));
    }

    const ordered = issues.sort((a, b) => {
        const rank = { critical: 0, warning: 1, info: 2 };
        return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
    });

    return {
        issues: ordered,
        primary: ordered[0] || null,
        summary: ordered.length
            ? `أقوى سبب يؤثر على القرار: ${ordered[0].title}.`
            : 'لا يوجد رقم كاسر واضح؛ راجع جودة الافتراضات والتوثيق قبل الاعتماد النهائي.',
        nextField: ordered[0]?.path || null
    };
}

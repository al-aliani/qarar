/**
 * حساب سريع لجدوى مبدئية من: إيراد شهري، تكاليف شهرية، استثمار أولي، مصدر التمويل.
 * يُستخدم في مسار "جدوى سريعة" (3 خطوات) فقط.
 */

const DEFAULT_DISCOUNT_RATE = 0.10;
const DEFAULT_LOAN_YEARS = 5;
const DEFAULT_LOAN_RATE = 0.08;
const PROJECTION_YEARS = 5;

/**
 * @param {Object} inputs
 * @param {number} inputs.monthlyRevenue - إيراد شهري متوقع (ريال)
 * @param {number} inputs.monthlyCosts - تكاليف تشغيل شهرية (ريال)
 * @param {number} inputs.initialInvestment - استثمار أولي (ريال)
 * @param {string} inputs.fundingSource - 'self' | 'loan'
 * @returns {{ npv, paybackYears, breakevenMonthly, annualNet, recommendation, recommendationLabel }}
 */
export function quickFeasibilityCalc(inputs) {
    const rev = Number(inputs.monthlyRevenue) || 0;
    const cost = Number(inputs.monthlyCosts) || 0;
    const initial = Number(inputs.initialInvestment) || 0;
    const isLoan = (inputs.fundingSource || '').toLowerCase() === 'loan';

    const annualRevenue = rev * 12;
    const annualCosts = cost * 12;

    // ربح تشغيلي بعد زكاة تقريبية 2.5% (اتساقاً مع المحرك الكامل — مشروع سعودي)
    const operatingProfit = annualRevenue - annualCosts;
    const zakat = operatingProfit > 0 ? operatingProfit * 0.025 : 0;
    const operatingNet = operatingProfit - zakat;

    let annualDebtService = 0;
    if (isLoan && initial > 0) {
        const r = DEFAULT_LOAN_RATE;
        const n = DEFAULT_LOAN_YEARS;
        annualDebtService = (initial * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
    }
    const annualNet = operatingNet - annualDebtService;

    // NPV من منظور صاحب المشروع (خصم 10%):
    // تمويل ذاتي: يدفع الاستثمار كاملاً سنة 0 ويستلم الربح التشغيلي.
    // قرض: البنك يدفع الاستثمار (لا خروج نقدي سنة 0) ويُخصم قسط القرض من الصافي.
    // (كان الحساب القديم يخصم الاستثمار كاملاً *و* أقساط القرض معاً = عدّ مزدوج
    //  يجعل التمويل بقرض 8% يبدو أسوأ من الذاتي رغم أنه أرخص من معدل الخصم.)
    const equityOutflow = isLoan ? 0 : initial;
    let npv = -equityOutflow;
    const dr = DEFAULT_DISCOUNT_RATE;
    for (let t = 1; t <= PROJECTION_YEARS; t++) {
        npv += annualNet / Math.pow(1 + dr, t);
    }
    npv = Math.round(npv);

    // فترة الاسترداد على أساس المشروع (الاستثمار ÷ الصافي التشغيلي) —
    // ثابتة بين طريقتي التمويل كي لا يوحي القرض باسترداد فوري وهمي
    let paybackYears = 999;
    if (operatingNet > 0 && initial > 0) {
        paybackYears = initial / operatingNet;
        paybackYears = Math.round(paybackYears * 10) / 10;
    } else if (initial === 0) {
        paybackYears = 999; // لا استثمار = لا معنى للاسترداد؛ لا نعرض «0 سنة»
    }

    // نقطة التعادل: إيراد شهري = تكاليف شهرية (+ خدمة دين إن وُجد)
    const debtMonthly = annualDebtService / 12;
    const breakevenMonthly = cost + debtMonthly;

    // توصية مبسطة
    let recommendation = 'nogo';
    let recommendationLabel = 'لا يُنصح (NO-GO)';
    if (npv > 0 && paybackYears <= 7) {
        recommendation = 'go';
        recommendationLabel = 'مُوصى به (GO)';
    } else if (npv > 0 && paybackYears <= 10) {
        recommendation = 'revise';
        recommendationLabel = 'مراجعة (REVISE)';
    } else if (npv > 0) {
        recommendation = 'revise';
        recommendationLabel = 'مراجعة (REVISE) — فترة استرداد طويلة';
    } else if (annualNet > 0) {
        recommendation = 'revise';
        recommendationLabel = 'مراجعة (REVISE) — تحسين الإيرادات أو خفض التكاليف';
    }

    return {
        npv,
        paybackYears: paybackYears >= 999 ? null : paybackYears,
        breakevenMonthly: Math.round(breakevenMonthly),
        annualNet: Math.round(annualNet),
        annualRevenue: Math.round(annualRevenue),
        annualCosts: Math.round(annualCosts),
        recommendation,
        recommendationLabel
    };
}

/** قيم افتراضية حسب القطاع (إيراد شهري، تكلفة شهرية، استثمار أولي) */
export const QUICK_DEFAULTS_BY_SECTOR = {
    مطعم: { monthlyRevenue: 80000, monthlyCosts: 50000, initialInvestment: 400000 },
    retail: { monthlyRevenue: 60000, monthlyCosts: 35000, initialInvestment: 250000 },
    خدمي: { monthlyRevenue: 45000, monthlyCosts: 25000, initialInvestment: 150000 },
    صناعي: { monthlyRevenue: 120000, monthlyCosts: 70000, initialInvestment: 800000 },
    تقني: { monthlyRevenue: 35000, monthlyCosts: 20000, initialInvestment: 100000 },
    أخرى: { monthlyRevenue: 50000, monthlyCosts: 30000, initialInvestment: 200000 }
};

/**
 * تقدير استثمار أولي *شامل* من قيم محرك السوق (لا يُكتفى بالتجهيز فقط).
 * كان الحساب القديم = fitout_per_sqm × المساحة فقط، فينتج مثلاً 42–150 ألف لمقهى 100م²
 * (غير واقعي: يُهمل المعدات والأثاث والتراخيص وما قبل التشغيل ورأس المال العامل)،
 * ما يعطي فترة استرداد ≈ 0 وصافي قيمة حالية منتفخاً وتوصية GO زائفة.
 * الآن: تجهيز + معدات/أثاث + تراخيص وما قبل التشغيل + رأس مال عامل ٣ أشهر.
 * @returns {number} تقدير الاستثمار الأولي الكامل (ريال)
 */
export function estimateAllInInvestment(defaults, area, monthlyCosts) {
    const a = Number(area) || 100;
    const fitoutPerSqm = Number(defaults?.fitout_per_sqm) || 1500;
    const fitout = fitoutPerSqm * a;                     // بناء وتجهيز المكان
    const equipmentFurniture = Math.round(fitout * 0.6); // معدات وأثاث ≈ 60% من التجهيز (تقدير قطاعي)
    const setupLicenses = Number(defaults?.setup_cost) || Math.round((Number(monthlyCosts) || 0) * 1); // تراخيص + ما قبل التشغيل ≈ شهر تشغيل
    const workingCapital = Math.round((Number(monthlyCosts) || 0) * 3); // رأس مال عامل يغطي ٣ أشهر
    return Math.round(fitout + equipmentFurniture + setupLicenses + workingCapital);
}

/**
 * فحوصات جدارة سريعة (نسخة مصغّرة من بوابة الجودة في المسار الكامل) — المهمة: منع «GO المُلفّق».
 * تُبرز الأرقام غير الواقعية للمستخدم المبتدئ المتعجل قبل أن يتخذ قراراً بناءً عليها.
 * @returns {{ level: 'hard'|'soft', text: string }[]}
 */
export function quickSanityChecks(inputs, result, opts = {}) {
    const warnings = [];
    const rev = Number(inputs.monthlyRevenue) || 0;
    const cost = Number(inputs.monthlyCosts) || 0;
    const initial = Number(inputs.initialInvestment) || 0;
    const area = Number(inputs.area) || 0;
    const isVenue = inputs.sector === 'مطعم' || inputs.sector === 'retail';

    // أرقام تعتمد على تقدير قطاعي عام وليست أرقام المستخدم الحقيقية
    if (opts.estimatesApplied) {
        warnings.push({
            level: 'hard',
            text: 'الأرقام الحالية مبنية على تقدير قطاعي عام (متوسطات) لا تخص مشروعك تحديداً. عدّلها بأرقامك الحقيقية (عروض أسعار، إيجار فعلي، مبيعات متوقعة مدروسة) قبل أي قرار.'
        });
    }

    // فترة استرداد سريعة بشكل غير واقعي
    if (result.paybackYears != null && result.paybackYears < 1.5) {
        warnings.push({
            level: 'hard',
            text: `فترة الاسترداد المحسوبة (${result.paybackYears} سنة) سريعة بشكل غير معتاد. غالباً يعني أن الاستثمار الأولي مُقدَّر بأقل من الواقع أو الإيراد مبالغ فيه — راجع الرقمين.`
        });
    }

    // عائد سنوي مرتفع بشكل غير واقعي (الصافي / الاستثمار)
    if (initial > 0 && result.annualNet > 0) {
        const roi = result.annualNet / initial;
        if (roi > 0.6) {
            warnings.push({
                level: 'soft',
                text: `العائد السنوي على الاستثمار مرتفع جداً (${Math.round(roi * 100)}٪). تأكد أن الاستثمار الأولي يشمل كل البنود (تجهيز، معدات، تراخيص، رأس مال عامل).`
            });
        }
    }

    // استثمار أولي منخفض لمساحة مطعم/تجزئة
    if (isVenue && area >= 30 && initial > 0 && initial / area < 1500) {
        warnings.push({
            level: 'hard',
            text: `الاستثمار الأولي (${Math.round(initial / area).toLocaleString('ar-SA')} ريال/م²) منخفض لمشروع ${area}م². عادةً يتجاوز 2,000–3,500 ريال/م² شاملاً التجهيز والمعدات والأثاث والتراخيص ورأس المال العامل.`
        });
    }

    // هامش ربح مرتفع بشكل غير معتاد (التكاليف أقل من نصف الإيراد)
    if (rev > 0 && cost > 0 && cost / rev < 0.5) {
        warnings.push({
            level: 'soft',
            text: 'هامش الربح مرتفع بشكل غير معتاد (التكاليف أقل من 50٪ من الإيراد). تأكد أنك أدرجت كل التكاليف: إيجار، رواتب، مواد/بضاعة، كهرباء، تسويق، صيانة.'
        });
    }

    // إيراد يبدأ كاملاً من الشهر الأول بلا فترة تهيئة (الجدوى السريعة لا تُدخِل ramp-up)
    warnings.push({
        level: 'soft',
        text: 'هذا التقدير السريع يفترض إيراداً ثابتاً من الشهر الأول بلا فترة تهيئة. في الواقع تحتاج المشاريع أشهراً لبلوغ الطاقة — استخدم «الدراسة الكاملة» لنمذجة فترة التهيئة والتدفق الشهري.'
    });

    return warnings;
}

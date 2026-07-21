import { resolveDecisionThresholds } from '../core/engine.js';

const defaultMoney = (value) => `${new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(Number(value) || 0)} ر.س`;

/** مصدر الحقيقة لقراءة التمويل في لوحة القرار والتقرير العام والتقرير البنكي. */
export function buildFinancingDiagnostics(state = {}, results = {}, options = {}) {
    const financing = state?.financing || {};
    const loan = financing.sources?.bankLoan || {};
    const loanAmount = Number(loan.amount || results?.loanSchedule?.loanAmount || 0);
    const thresholds = resolveDecisionThresholds(state?.assumptions?.thresholds, financing);
    const targetDSCR = Number(results?.assumptionsApplied?.thresholds?.targetDSCR ?? thresholds.targetDSCR);
    const fundingGap = Number(results?.financingCheck?.fundingGap ?? 0);
    const fundingGapThreshold = Number(
        results?.financingCheck?.fundingGapMaterialityThreshold
        ?? Math.max(1000, Number(results?.financingCheck?.totalInvestment ?? 0) * 0.01)
    );
    const dscr = results?.indicators?.dscr ?? null;
    const dscrReason = results?.indicators?.dscrReason ?? null;
    const y1Ebitda = Number(results?.incomeStatement?.[0]?.ebitda ?? NaN);
    const concept = String(state?.projectInfo?.concept || state?.projectInfo?.sector || '');
    const isSaas = /saas|منصة|تطبيق|برمجي|تقني|موقع دراسة جدوى/i.test(concept);
    const money = typeof options.formatCurrency === 'function' ? options.formatCurrency : defaultMoney;
    const alerts = [];

    if (fundingGap > fundingGapThreshold) {
        alerts.push({
            type: 'funding-gap',
            title: 'فجوة تمويل غير مغطاة',
            text: `مصادر التمويل أقل من الاستثمار المطلوب بفجوة ${money(fundingGap)}. أكمل التمويل أو خفّض الاستثمار.`
        });
    } else if (fundingGap < -fundingGapThreshold) {
        alerts.push({
            type: 'funding-surplus',
            title: 'مصادر تمويل أعلى من الاستثمار المطلوب',
            text: `مصادر التمويل تتجاوز الاستثمار المطلوب بمقدار ${money(Math.abs(fundingGap))}. طابق التمويل مع الأصول والتكاليف قبل التقديم.`
        });
    }

    const dscrBlocked = loanAmount > 0 && (dscr == null || Number(dscr) < targetDSCR);
    if (dscrBlocked) {
        const valueText = dscr != null
            ? `${Number(dscr).toFixed(2)}x`
            : dscrReason === 'no_debt_service'
                ? 'غير قابل للحساب لعدم وجود خدمة دين في السنة الأولى'
                : 'غير قابل للحساب لأن CFADS صفر أو سالب';
        alerts.push({
            type: 'dscr',
            title: 'تغطية خدمة الدين غير كافية',
            text: `DSCR السنة الأولى ${valueText}، والمستهدف ${targetDSCR.toFixed(2)}x. راجع مبلغ القرض ومدة السداد وفترة السماح.`
        });
    }

    if (isSaas && loanAmount > 0 && (!Number.isFinite(y1Ebitda) || y1Ebitda <= 0)) {
        alerts.push({
            type: 'saas-bank-readiness',
            title: 'قراءة البنك تختلف عن قراءة المستثمر',
            text: 'مشروع SaaS قد يجذب مستثمراً بالنمو، بينما يحتاج البنك تدفقات مبكرة تغطي خدمة الدين.'
        });
    }

    return {
        alerts,
        hasBlockers: alerts.length > 0,
        bankReady: alerts.length === 0,
        fundingGap,
        fundingGapThreshold,
        dscr,
        dscrReason,
        targetDSCR,
        loanAmount,
        y1Ebitda,
        isSaas,
        dscrBlocked
    };
}

import { resolveDecisionThresholds } from '../core/engine.js';

/** تفسيرات قرار قصيرة؛ الرقم، معناه، مصدره، والخطوة التالية في كائن واحد. */
export function buildIndicatorInsights(results = {}, state = {}) {
    const ind = results?.indicators || {};
    const thresholds = resolveDecisionThresholds(state?.assumptions?.thresholds, state?.financing);
    const items = [];

    const add = (item) => items.push(item);
    const npv = Number(ind.npv);
    add({
        key: 'npv', label: 'صافي القيمة الحالية', value: Number.isFinite(npv) ? npv : null,
        status: Number.isFinite(npv) ? (npv >= thresholds.minNPV ? 'good' : 'bad') : 'unknown',
        meaning: Number.isFinite(npv) ? (npv >= thresholds.minNPV ? 'المشروع يضيف قيمة بعد احتساب الزمن ومعدل الخصم.' : 'العائد المتوقع لا يعوض الاستثمار ومعدل الخصم حالياً.') : 'لا يمكن حسابه قبل اكتمال التدفقات النقدية.',
        source: 'محسوب من الاستثمار والتدفقات النقدية المتوقعة ومعدل الخصم.',
        action: npv >= thresholds.minNPV ? 'اختبر بقاءه موجباً في السيناريو المتحفظ.' : 'راجع المبيعات والتكاليف والاستثمار ومعدل الخصم.'
    });

    const irr = ind.irr == null ? null : Number(ind.irr);
    add({
        key: 'irr', label: 'معدل العائد الداخلي', value: Number.isFinite(irr) ? irr : null,
        status: Number.isFinite(irr) ? (irr >= thresholds.minIRR ? 'good' : 'warning') : 'unknown',
        meaning: Number.isFinite(irr) ? (irr >= thresholds.minIRR ? 'العائد المتوقع يتجاوز حد القبول المحدد للدراسة.' : 'العائد أدنى من حد القبول المحدد للدراسة.') : 'التدفقات الحالية لا تنتج معدل عائد داخلي قابلاً للحساب.',
        source: 'محسوب من كامل سلسلة التدفقات النقدية، وليس من ربح سنة واحدة.',
        action: Number.isFinite(irr) ? 'قارنه بتكلفة رأس المال ومخاطر النشاط.' : 'أكمل الاستثمار والتدفقات وتأكد من تغير إشارتها عبر السنوات.'
    });

    const payback = Number(ind.paybackPeriod ?? ind.payback);
    add({
        key: 'payback', label: 'فترة الاسترداد', value: Number.isFinite(payback) && payback > 0 ? payback : null,
        status: Number.isFinite(payback) && payback > 0 ? (payback <= thresholds.maxPayback ? 'good' : 'warning') : 'unknown',
        meaning: Number.isFinite(payback) && payback > 0 ? `يستعيد المشروع الاستثمار خلال نحو ${payback.toFixed(1)} سنة.` : 'لا يسترد الاستثمار خلال فترة التوقع الحالية.',
        source: 'محسوبة من التدفقات النقدية التراكمية بعد الاستثمار.',
        action: 'اختبر الاسترداد أيضاً تحت سيناريو مبيعات متحفظ.'
    });

    const dscr = ind.dscr == null ? null : Number(ind.dscr);
    add({
        key: 'dscr', label: 'تغطية خدمة الدين', value: Number.isFinite(dscr) ? dscr : null,
        status: Number.isFinite(dscr) ? (dscr >= thresholds.targetDSCR ? 'good' : 'warning') : 'unknown',
        meaning: Number.isFinite(dscr) ? (dscr >= thresholds.targetDSCR ? 'النقد المتاح يغطي أقساط القرض بهامش مقبول.' : 'النقد المتاح لا يحقق هامش التغطية المستهدف.') : 'لا توجد خدمة دين قابلة للقياس أو أن النقد المتاح غير موجب.',
        source: 'محسوب من CFADS مقسوماً على أصل القرض وفوائده للسنة الأولى.',
        action: 'راجع مبلغ القرض، مدة السداد، فترة السماح والتدفق التشغيلي.'
    });

    return items;
}

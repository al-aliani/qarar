function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
}

export function buildRevenueModel(ctx) {
    const { study, SECTIONS, serviceItems, getSaving } = ctx;

    const revenueStreams = toArray(study[SECTIONS.REVENUE]?.streams);
    const hasServices = serviceItems && serviceItems.length > 0;
    const defaultGrowth = 0.05;

    const revenueSources = [];

    // الخدمات المفصلة: تشغيلية دائماً
    if (serviceItems) {
        serviceItems.forEach(item => {
            const customers = Number(item.customersPerMonth || 0) * 12;
            const saving = getSaving('Services');
            revenueSources.push({
                rev1: customers * Number(item.pricePerUnit || 0),
                vc1: customers * Number(item.variableCostPerUnit || 0) * (1 - saving),
                units1: customers,
                growth: Number(item.growthRate ?? defaultGrowth),
                operating: true
            });
        });
    }

    // مصادر الإيرادات: التشغيلية تُستبدل بالخدمات إن وُجدت
    revenueStreams.forEach(stream => {
        const type = stream.type || 'operating';
        if (type === 'operating' && hasServices) return;
        const annualCust = Number(stream.customersPerMonth || 0) * 12;
        const revenue = annualCust * Number(stream.avgPrice || 0);
        
        const rawVCR = Number(stream.variableCostRate ?? 0.30);
        const vcr = rawVCR > 1 ? rawVCR / 100 : rawVCR;

        // تدقيق دفعة 3 (2026-07-12): wasteRate (تلف وهدر) وplatformCommissionRate
        // (عمولة منصة) عمودان اختياريان جديدان في جدول الإيرادات — كلاهما كسر (0–1)
        // مثل variableCostRate تماماً (مسجَّلان في DynamicTable.isFractionPercentColumn)،
        // وكلاهما افتراضهما صفر فلا يغيّران شيئاً في الدراسات القديمة التي لا تملأهما.
        // نفس تسامح ">1 يُعامَل كنسبة مئوية خام" المطبَّق على variableCostRate أعلاه —
        // دفاعاً عن نفس فخّ ×100 الموثَّق لو أُدخلا خطأً كرقم مئوي خام (30 بدل 0.30).
        const rawWaste = Number(stream.wasteRate ?? 0);
        const wasteRate = rawWaste > 1 ? rawWaste / 100 : rawWaste;
        const rawCommission = Number(stream.platformCommissionRate ?? 0);
        const commissionRate = rawCommission > 1 ? rawCommission / 100 : rawCommission;
        const totalVcr = vcr + wasteRate + commissionRate;

        revenueSources.push({
            rev1: revenue,
            vc1: type === 'operating' ? revenue * totalVcr : 0,
            units1: annualCust,
            growth: Number(stream.growthRate ?? defaultGrowth),
            operating: type === 'operating'
        });
    });

    // قيمة الفئة في سنة معينة وفق نمو كل مصدر (yearIndex = 0 للسنة الأولى)
    const sourcesAtYear = (operating, field, yearIndex) =>
        revenueSources.filter(s => s.operating === operating)
            .reduce((a, s) => a + s[field] * Math.pow(1 + (Number.isFinite(s.growth) ? s.growth : defaultGrowth), yearIndex), 0);

    return {
        revenueSources,
        sourcesAtYear
    };
}

function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
}

function rateOrDefault(v, dflt) {
    if (v === null || v === undefined || v === '') return dflt;
    const n = Number(v);
    return Number.isFinite(n) ? n : dflt;
}

/**
 * إهلاك عنصر في سنة مُعيَّنة — يُوقِف الإهلاك بعد life (كما كان)، ويُقيِّد أيضاً
 * السنة الأخيرة كي لا يتجاوز تراكم الإهلاك base (تكلفة العنصر القابلة للإهلاك).
 * ضروري لأن life = Math.round(1/rate) تقريب صحيح لأقرب سنة — فمعدل مثل 15%
 * (life=7) يُراكم 7×dep = 105% من base بلا هذا القيد، لا 100% بالضبط.
 */
export function itemDepAtYear(it, yr) {
    if (!(it.life > 0) || yr > it.life) return 0;
    const accruedBefore = it.dep * (yr - 1);
    return Math.max(0, Math.min(it.dep, it.base - accruedBefore));
}

export function buildDepreciationModel(ctx) {
    const {
        technical,
        techResources,
        equipmentTotal,
        capexBreakdown,
        launchStrategy,
        getSaving,
        establishmentAmortization
    } = ctx;

    const assetDepreciation = (arr, defaultRate, category) => toArray(arr).reduce((acc, item) => {
        const cost = Number(item.price || item.cost || 0);
        const qty = Number(item.quantity || item.count || 1);
        const rate = rateOrDefault(item.depreciationRate, defaultRate);
        const saving = getSaving(category);
        return acc + (cost * qty * rate * (1 - saving));
    }, 0);

    const annualDepreciation =
        establishmentAmortization +
        assetDepreciation(technical.buildings, 0.05, 'Buildings') +
        (equipmentTotal * 0.15) +
        assetDepreciation(technical.furniture, 0.20, 'Furniture') +
        assetDepreciation(technical.vehicles, 0.20, 'Vehicles') +
        assetDepreciation(techResources.techResources, 0.25, 'TechResources') +
        (capexBreakdown.servicesCapex * 0.15);

    const equipmentScale = (launchStrategy === 'Outsourcing' ? 0.3 : (launchStrategy === 'Pilot_Phase' ? 0.5 : 1.0)) * 1.10;

    // تدقيق حي 2026-07-22: buildReplaceable كان يقبل flatRate لإجبار مبلغ الإهلاك على
    // defaultRate (15%) بصرف النظر عن نسبة الاستهلاك التي يُدخلها العميل لكل قطعة معدات —
    // بينما نفس النسبة المُدخلة تُستخدم فعلاً لحساب عمر الأصل (life) وتوقيت إعادة الشراء.
    // النتيجة: عميل يُدخل نسبة استهلاك أسرع (مثلاً 30%) يرى عمراً أقصر صحيحاً، لكن مبلغ
    // الإهلاك السنوي المعروض يبقى محسوباً وكأنه 15% دائماً — تناقض داخلي، وخلافاً تماماً
    // لفئتي الأثاث والموارد التقنية أدناه اللتين تستخدمان نسبة العميل للمبلغ والعمر معاً.
    // لا مبرر موثَّق لهذا الاستثناء، فأُزيل ليتسق مع بقية الفئات.
    const buildReplaceable = (arr, defaultRate, category, scale) => toArray(arr).map(item => {
        const cost = Number(item.price || item.cost || 0);
        const qty = Number(item.quantity || item.count || 1);
        const itemRate = rateOrDefault(item.depreciationRate, defaultRate);
        const saving = getSaving(category);
        const base = cost * qty * (1 - saving) * scale;
        return {
            // اسم/فئة العنصر — لبناء جدول إهلاك مسمّى لكل أصل (assetSchedule) بدل تجميعه
            // في رقم فئة واحد فقط؛ لا يغيّر أي مستهلك حالي (يستخدم فقط .dep/.life).
            name: item.name || item.label || category,
            category,
            base, dep: base * itemRate, life: itemRate > 0 ? Math.round(1 / itemRate) : 0
        };
    });

    const replaceableItems = [
        ...buildReplaceable(technical.equipment, 0.15, 'Equipment', equipmentScale),
        ...buildReplaceable(technical.furniture, 0.20, 'Furniture', 1),
        ...buildReplaceable(techResources.techResources, 0.25, 'TechResources', 1)
    ];

    const replaceableDepAtYear = (yr) => replaceableItems.reduce(
        (d, it) => d + itemDepAtYear(it, yr), 0);

    // تدقيق حي 2026-07-22: buildings/vehicles/servicesCapex («الفئات الدائمة») كانت تُهلَك
    // بمبلغ ثابت (permanentAnnualDep المُشتقّ سابقاً) كل سنة إلى الأبد بلا سقف — فبعد انتهاء
    // عمرها الافتراضي (buildings 5%=20 سنة، vehicles 20%=5 سنوات، servicesCapex 15%≈6.7
    // سنوات) يستمر القيد فيتجاوز تراكم الإهلاك تكلفة الأصل نفسها، فتختل هوية الميزانية
    // (isBalanced=false) بمجرد تجاوز أفق الدراسة عمر أحد هذه الأصول. الإصلاح: نفس مبدأ
    // replaceableItems أعلاه تماماً — كل عنصر يتوقف إهلاكه عند نهاية عمره الافتراضي (life).
    const permanentItems = [
        ...toArray(technical.buildings).map(item => {
            const cost = Number(item.price || item.cost || 0);
            const qty = Number(item.quantity || item.count || 1);
            const rate = rateOrDefault(item.depreciationRate, 0.05);
            const saving = getSaving('Buildings');
            const base = cost * qty * (1 - saving);
            return { base, dep: base * rate, life: rate > 0 ? Math.round(1 / rate) : 0 };
        }),
        ...toArray(technical.vehicles).map(item => {
            const cost = Number(item.price || item.cost || 0);
            const qty = Number(item.quantity || item.count || 1);
            const rate = rateOrDefault(item.depreciationRate, 0.20);
            const saving = getSaving('Vehicles');
            const base = cost * qty * (1 - saving);
            return { base, dep: base * rate, life: rate > 0 ? Math.round(1 / rate) : 0 };
        }),
        ...(capexBreakdown.servicesCapex > 0 ? [{ base: capexBreakdown.servicesCapex, dep: capexBreakdown.servicesCapex * 0.15, life: Math.round(1 / 0.15) }] : [])
    ];
    const permanentDepAtYear = (yr) => permanentItems.reduce(
        (d, it) => d + itemDepAtYear(it, yr), 0);

    const checkReplacement = (arr, defaultRate, yr) => toArray(arr).reduce((acc, item) => {
        const rate = rateOrDefault(item.depreciationRate, defaultRate);
        if (rate <= 0) return acc;
        const life = Math.round(1 / rate);
        if (life > 0 && (yr - 1) % life === 0 && yr > 1) {
            const cost = Number(item.price || item.cost || 0);
            const qty = Number(item.quantity || item.count || 1);
            return acc + (cost * qty);
        }
        return acc;
    }, 0);

    const getReplacementCostAtYear = (yr) => {
        let replacementCost = 0;
        replacementCost += checkReplacement(technical.equipment, 0.15, yr);
        replacementCost += checkReplacement(technical.furniture, 0.20, yr);
        replacementCost += checkReplacement(techResources.techResources, 0.25, yr);
        return replacementCost;
    };

    return {
        annualDepreciation,
        permanentDepAtYear,
        replaceableDepAtYear,
        getReplacementCostAtYear,
        // مُصدَّرة لأول مرة — تُستهلك في engine.js لبناء result.assetSchedule (جدول
        // إهلاك مسمّى لكل أصل بدل رقم فئة مجمّع فقط).
        replaceableItems
    };
}

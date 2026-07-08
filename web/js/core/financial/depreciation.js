function toArray(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
}

function rateOrDefault(v, dflt) {
    if (v === null || v === undefined || v === '') return dflt;
    const n = Number(v);
    return Number.isFinite(n) ? n : dflt;
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
    
    const buildReplaceable = (arr, defaultRate, category, scale, flatRate) => toArray(arr).map(item => {
        const cost = Number(item.price || item.cost || 0);
        const qty = Number(item.quantity || item.count || 1);
        const itemRate = rateOrDefault(item.depreciationRate, defaultRate);
        const saving = getSaving(category);
        const depRate = flatRate ? defaultRate : itemRate;
        return { dep: cost * qty * (1 - saving) * scale * depRate, life: itemRate > 0 ? Math.round(1 / itemRate) : 0 };
    });

    const replaceableItems = [
        ...buildReplaceable(technical.equipment, 0.15, 'Equipment', equipmentScale, true),
        ...buildReplaceable(technical.furniture, 0.20, 'Furniture', 1, false),
        ...buildReplaceable(techResources.techResources, 0.25, 'TechResources', 1, false)
    ];

    const replaceableDepAtYear = (yr) => replaceableItems.reduce(
        (d, it) => d + (it.life > 0 && yr <= it.life ? it.dep : 0), 0);

    const replaceableDepYear1 = replaceableItems.reduce((d, it) => d + (it.life > 0 ? it.dep : 0), 0);
    const permanentAnnualDep = annualDepreciation - replaceableDepYear1 - establishmentAmortization;

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
        permanentAnnualDep,
        replaceableDepAtYear,
        getReplacementCostAtYear
    };
}

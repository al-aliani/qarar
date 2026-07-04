/**
 * Bridge Utility
 * Transforms detailed service data into revenue streams.
 */

export function bridgeServicesToRevenueStreams(serviceItems, existingStreams) {
    // قسم خدمات فارغ لا يمسح مصادر الإيرادات اليدوية —
    // كان حفظ خدمات فارغة يستبدل revenue.streams بمصفوفة فارغة فتختفي مدخلات المستخدم
    if (!serviceItems || !Array.isArray(serviceItems) || serviceItems.length === 0) {
        return existingStreams || [];
    }

    // Simple mapping: Convert detailed service items to revenue streams
    // This allows the revenue section to reflect what was entered in services
    // نحافظ على نوع المصدر ونسبة التكلفة المتغيرة والنمو المدخلين يدوياً إن وُجد مصدر مطابق بالاسم
    const byName = new Map((existingStreams || []).map(s => [(s.service || s.name || '').trim(), s]));
    return serviceItems.map(item => {
        const name = item.name || 'Service';
        const prev = byName.get(name.trim()) || {};
        return {
            name,
            service: name,
            type: prev.type || 'operating',
            customersPerMonth: Number(item.customersPerMonth || 0),
            avgPrice: Number(item.pricePerUnit || 0),
            variableCostRate: prev.variableCostRate ?? (Number(item.pricePerUnit) > 0
                ? Math.min(0.95, Math.max(0, Number(item.variableCostPerUnit || 0) / Number(item.pricePerUnit)))
                : undefined),
            growthRate: Number(item.growthRate ?? prev.growthRate ?? 0.05)
        };
    });
}

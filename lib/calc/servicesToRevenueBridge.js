/**
 * Services → Revenue Bridge (Single Source of Truth)
 * Used by: web/js/core/bridge.js, web/js/services/DataBridge.js.
 * Ensures UI and Calculation Engine use the same mapping: price OR pricePerUnit.
 */

/**
 * @param {Array} serviceItems - state.services.items
 * @param {Array} [currentRevenue=[]] - existing revenue.streams for merging (e.g. growthRate)
 * @returns {Array|null} streams in revenue format { id?, service, name, avgPrice, customersPerMonth, growthRate }, or null if no items
 */
export function bridgeServicesToRevenueStreams(serviceItems, currentRevenue = []) {
    if (!serviceItems || !Array.isArray(serviceItems)) return null;

    return serviceItems.map(srv => {
        const existing = (currentRevenue || []).find(r => (r.name || r.service) === (srv.name || ''));
        return {
            id: existing?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random()),
            service: srv.name || 'خدمة غير معنونة',
            name: srv.name || 'خدمة غير معنونة',
            avgPrice: parseFloat(srv.price) || parseFloat(srv.pricePerUnit) || 0,
            customersPerMonth: srv.expectedDailySales != null
                ? (Number(srv.expectedDailySales) * 30)
                : (srv.customersPerMonth ?? existing?.customersPerMonth ?? 0),
            growthRate: existing?.growthRate ?? srv.growthRate ?? 0.05
        };
    });
}

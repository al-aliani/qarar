/**
 * Bridge Utility
 * Transforms detailed service data into revenue streams.
 */

export function bridgeServicesToRevenueStreams(serviceItems, existingStreams) {
    if (!serviceItems || !Array.isArray(serviceItems)) return existingStreams || [];
    
    // Simple mapping: Convert detailed service items to revenue streams
    // This allows the revenue section to reflect what was entered in services
    return serviceItems.map(item => ({
        name: item.name || 'Service',
        customersPerMonth: Number(item.customersPerMonth || 0),
        avgPrice: Number(item.pricePerUnit || 0),
        growthRate: 0.05 // Default assumption
    }));
}

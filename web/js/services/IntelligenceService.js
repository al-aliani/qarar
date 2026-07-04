/**
 * Intelligence Service
 * Bridge between Frontend and Python Backend Engines (Market & Experience)
 * Express Mode: GET /api/market/defaults?sector=&city=&area=&budget=
 */

/** في المتصفح مع Vite يُفضّل استخدام مسار نسبي /api ليعمل الـ proxy إلى 8080 */
function marketApiUrl(path) {
    if (typeof window !== 'undefined') {
        const base = window.__VITE_API__ || '';
        return base ? `${base.replace(/\/$/, '')}${path}` : path;
    }
    return `http://localhost:8080${path}`;
}

export const IntelligenceService = {
    /**
     * Get default values for Express Mode from Market Engine (GET with query params).
     * @param {string} sector - e.g. 'مطعم', 'cafe', 'restaurant'
     * @param {string} city - e.g. 'الرياض', 'Riyadh'
     * @param {number} area - e.g. 100 (m²)
     * @param {number} budget - optional total budget (SAR)
     * @returns {Promise<Object>} - { rent_per_sqm, fitout_per_sqm, salaries, marketing, market?, source }
     */
    async getMarketDefaults(sector, city, area = 100, budget = 0) {
        try {
            const params = new URLSearchParams({ sector: String(sector || ''), city: String(city || ''), area: String(Number(area) || 100), budget: String(Number(budget) || 0) });
            const response = await fetch(`${marketApiUrl('/api/market/defaults')}?${params}`, { method: 'GET' });
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            if (data.error && !data.rent_per_sqm) {
                throw new Error(data.error);
            }
            return data;
        } catch (error) {
            console.warn('Market Engine (Express) fallback:', error?.message || error);
            return {
                rent_per_sqm: 1000,
                fitout_per_sqm: 1500,
                salaries: { manager: 5000, staff: 3000 },
                marketing: { initial: 5000, monthly: 1000 },
                source: 'Offline Fallback'
            };
        }
    },

    /**
     * Get a magic suggestion for a specific field from Experience Engine
     * @param {string} field - e.g. 'rent_annual', 'salary_total'
     * @param {string} sector 
     * @param {string} city 
     * @returns {Promise<Object>} - { value, unit, reason }
     */
    async getMagicSuggestion(field, sector, city) {
        try {
            const response = await fetch(marketApiUrl('/api/experience/suggest'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ field, sector, city })
            });
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Experience Engine Error:', error);
            return { value: 0, reason: 'Offline Fallback' };
        }
    }
};

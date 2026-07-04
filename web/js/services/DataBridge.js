/**
 * Data Bridge Service
 * Bridges the gap between detailed analysis sections and the core financial model.
 * Uses shared bridgeServicesToRevenueStreams from lib/calc for single source of truth.
 *
 * Main Responsibility:
 * - Watch 'services' section -> Sync to 'revenue' section
 * - Watch 'technical' -> Sync to 'capex' (machinery/equipment)
 * - Watch 'hr' -> Sync to 'opex' (salaries)
 */

import { bridgeServicesToRevenueStreams } from '../core/bridge.js';

export class DataBridge {
    static syncServicesToRevenue(state) {
        const currentRevenue = state.revenue?.streams || [];
        const streams = bridgeServicesToRevenueStreams(state.services?.items, currentRevenue);
        return streams;
    }
}


/**
 * Simple Mode Controller
 * Manages the visibility of Sidebar steps and Form fields based on the active mode.
 * Modes: 'mini' (Beginner), 'simple' (Intermediate), 'advanced' (Full)
 */

export const MODES = {
    MINI: 'mini',
    SIMPLE: 'simple',
    ADVANCED: 'advanced'
};

// Definition of visible steps for each mode
// Using Step IDs from wizardSteps.js
const MODE_CONFIG = {
    [MODES.MINI]: [
        'projectIntro', 'marketAnalysis', 'costs', 'revenue', 'decisionDashboard'
    ],
    [MODES.SIMPLE]: [
        'projectIntro', 'businessModel', 'marketAnalysis', 'technical',
        'manpower', 'costs', 'revenue', 'financing', 'decisionDashboard'
    ],
    // Advanced includes everything, so no list needed (allow all)
};

export class SimpleModeController {
    constructor(store) {
        this.store = store;
    }

    /**
     * Get current mode from store
     */
    getMode() {
        const state = this.store.getState();
        return state.appSettings?.mode || MODES.ADVANCED;
    }

    /**
     * Check if a step should be visible in the current mode
     * @param {string} stepId 
     */
    isStepVisible(stepId) {
        const mode = this.getMode();
        if (mode === MODES.ADVANCED) return true;

        const allowed = MODE_CONFIG[mode];
        return allowed ? allowed.includes(stepId) : true;
    }

    /**
     * Apply mode classes to body for CSS styling (hiding complex fields)
     */
    applyModeToBody() {
        const mode = this.getMode();
        document.body.classList.remove('mode-mini', 'mode-simple', 'mode-advanced');
        document.body.classList.add(`mode-${mode}`);
    }

    /**
     * Filter sidebar steps based on mode
     * @param {Array} allSteps 
     * @returns {Array} List of visible steps with original indices preserved
     */
    getVisibleSteps(allSteps) {
        const mode = this.getMode();
        if (mode === MODES.ADVANCED) return allSteps;

        const allowed = MODE_CONFIG[mode];
        if (!allowed) return allSteps;

        return allSteps.filter(step => allowed.includes(step.id));
    }
}

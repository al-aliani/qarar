
/**
 * Simple Mode Controller
 * Manages the visibility of Sidebar steps and Form fields based on the active mode.
 * Modes: 'mini' (Beginner), 'simple' (Intermediate), 'advanced' (Full)
 */

export const MODES = {
    QUICK: 'quick',
    ADVANCED: 'advanced'
};

export class SimpleModeController {
    constructor(store) {
        this.store = store;
    }

    getMode() {
        const state = this.store.getState();
        // Fallback to local storage if store doesn't have it
        return state.appSettings?.mode || localStorage.getItem('study_mode_preference') || MODES.ADVANCED;
    }

    setMode(mode) {
        localStorage.setItem('study_mode_preference', mode);
        // 2026-08-26: كان `this.store.set('appSettings.mode', mode)`. و`set(data)` تأخذ
        // وسيطاً واحداً وتفعل `this.state = data` ثم `save()` — فكان استدعاء واحد يستبدل
        // حالة الدراسة كلها (41 مفتاحاً) بالنص 'appSettings.mode' ويحفظ المحو. لم يُلاحَظ
        // لأن المستدعي الوحيد (Sidebar.js:513) داخل شريط جانبي مخفي دائماً بقرار متعمد —
        // أي أنه لغم صامت ينفجر لحظة إعادة تفعيل الشريط أو استدعاء setMode من أي مكان آخر.
        this.store.updatePath('appSettings', 'mode', mode);
        this.applyModeToBody();
    }

    isStepVisible(step) {
        if (!step) return true;
        const mode = this.getMode();
        if (mode === MODES.ADVANCED) return true;
        
        // In basic mode, hide advanced steps
        return !step.isAdvancedStep;
    }

    applyModeToBody() {
        const mode = this.getMode();
        document.body.classList.remove('mode-quick', 'mode-advanced');
        document.body.classList.add(`mode-${mode}`);
    }

    getVisibleSteps(allSteps) {
        return allSteps.filter(step => this.isStepVisible(step));
    }
}

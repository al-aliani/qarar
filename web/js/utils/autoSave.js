/**
 * Auto-save functionality for the store.
 * Uses store.save() so that local + cloud sync (PersistenceService) run in one path,
 * and the UI (Sidebar) gets save status updates ("محفوظ في السحابة" when synced).
 * Legacy key 'feas_autosave' is deprecated; we only read it for one-time migration.
 */

const LEGACY_KEY = 'feas_autosave';

export class AutoSave {
    constructor(store, interval = 30000) {
        this.store = store;
        this.interval = interval;
        this.timer = null;
        this.lastSaved = null;
        this.enabled = true;
    }

    start() {
        if (!this.enabled) return;

        // One-time migration from deprecated feas_autosave into store + ProjectManager
        if (typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_KEY)) {
            this.migrateLegacyAndClear().catch(e => console.warn('AutoSave: legacy migration failed', e));
        }

        // Save immediately on start (writes to ProjectManager)
        this.save();

        this.timer = setInterval(() => this.save(), this.interval);
        console.log('✅ Auto-save enabled (store.save → local + cloud, every 30s)');
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            console.log('⏸️ Auto-save disabled');
        }
    }

    save() {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            try {
                // Use store.save() so _syncToCloud runs and Sidebar shows "محفوظ في السحابة"
                if (this.store && typeof this.store.save === 'function') {
                    this.store.save();
                    this.lastSaved = new Date();
                    console.log('💾 Auto-save triggered at', this.lastSaved.toLocaleTimeString('ar-SA'));
                }
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        }, 1000);
    }

    /**
     * One-time migration: load from deprecated feas_autosave, hydrate store,
     * persist via ProjectManager, then clear the legacy key.
     */
    async migrateLegacyAndClear() {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_KEY) : null;
        if (!raw) return null;

        try {
            const { data, timestamp } = JSON.parse(raw);
            if (!data || typeof data !== 'object') {
                localStorage.removeItem(LEGACY_KEY);
                return null;
            }
            console.log('📂 Migrating legacy feas_autosave from', new Date(timestamp).toLocaleString('ar-SA'));

            if (this.store.hydrateFromDraft) {
                await this.store.hydrateFromDraft(data);
            }
            const { ProjectManager } = await import('../services/ProjectManager.js');
            await ProjectManager.saveProject(this.store.getState());

            localStorage.removeItem(LEGACY_KEY);
            console.log('✅ Legacy feas_autosave migrated and cleared');
            return data;
        } catch (e) {
            console.warn('migrateLegacyAndClear failed:', e);
            localStorage.removeItem(LEGACY_KEY);
            return null;
        }
    }

    /**
     * If legacy feas_autosave exists: migrate into store and ProjectManager, clear, return data.
     * Otherwise return null. Prefer migrateLegacyAndClear for one-time migration on start.
     */
    async restore() {
        return this.migrateLegacyAndClear();
    }

    /** True only if deprecated feas_autosave key exists (legacy). */
    hasAutoSave() {
        return typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_KEY) !== null;
    }

    clearAutoSave() {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(LEGACY_KEY);
            console.log('🗑️ Legacy feas_autosave cleared');
        }
    }

    getLastSavedTime() {
        if (typeof localStorage !== 'undefined') {
            try {
                const raw = localStorage.getItem(LEGACY_KEY);
                if (raw) {
                    const { timestamp } = JSON.parse(raw);
                    return new Date(timestamp);
                }
            } catch (_) {}
        }
        return this.lastSaved || null;
    }
}

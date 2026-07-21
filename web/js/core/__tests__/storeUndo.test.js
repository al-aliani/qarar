import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('window', { addEventListener: () => {}, dispatchEvent: () => {} });
vi.stubGlobal('crypto', { randomUUID: () => 'undo-test-uuid' });
const memoryStorage = new Map();
vi.mock('../../utils/storageManager.js', () => ({
    storageManager: {
        getItem: vi.fn(async (key) => memoryStorage.get(key) ?? null),
        setItem: vi.fn(async (key, value) => memoryStorage.set(key, value)),
    },
}));
vi.mock('../../utils/encryption.js', () => ({
    encryptionService: { decryptSensitiveFields: vi.fn(async (value) => value) },
    SENSITIVE_FIELDS: [],
}));
vi.mock('../../services/DataBridge.js', () => ({ DataBridge: { syncServicesToRevenue: vi.fn(() => null) } }));
vi.mock('../../utils/monitoring.js', () => ({ monitoring: { captureException: vi.fn(), addBreadcrumb: vi.fn() } }));

const { store } = await import('../store.js');

describe('StudyStore undo and redo', () => {
    beforeEach(() => {
        if (store._localSaveTimeout) clearTimeout(store._localSaveTimeout);
        store.state = store.mergeWithDefaults({ projectInfo: { name: 'before' } });
        store._undoStack = [];
        store._redoStack = [];
        vi.spyOn(store, 'saveLocal').mockResolvedValue();
    });

    afterEach(() => {
        store.saveLocal.mockRestore();
        if (store._localSaveTimeout) clearTimeout(store._localSaveTimeout);
    });

    it('restores the previous state and can redo it', async () => {
        store.updatePath('projectInfo', 'name', 'after');
        expect(store.canUndo()).toBe(true);
        await store.undo();
        expect(store.state.projectInfo.name).toBe('before');
        expect(store.canRedo()).toBe(true);
        await store.redo();
        expect(store.state.projectInfo.name).toBe('after');
    });

    it('clears redo history after a new edit', async () => {
        store.updatePath('projectInfo', 'name', 'first');
        await store.undo();
        store.updatePath('projectInfo', 'name', 'second');
        expect(store.canRedo()).toBe(false);
    });
});

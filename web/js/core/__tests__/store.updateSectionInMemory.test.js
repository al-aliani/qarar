/**
 * @vitest-environment jsdom
 *
 * بلوكر بانر إصدار المحرك (2026-08-29): updateSection/update العاديتان تنتهيان دائماً
 * بـ save() → saveLocalDebounced (1000ms) → _syncToCloud (800ms) → PersistenceService.save
 * التي تُعيد وسم _meta.engineVersion بالإصدار الحالي. عرض لوحة القرار أو تصدير تقرير
 * كانا يستخدمان update('results', ...) لمجرّد تحديث عرض — بلا أي نيّة "حفظ" فعلي من
 * المستخدم — فيمحوان صمتاً الدليل الذي يُبنى عليه تنبيه تغيّر إصدار المحرك (نفس صنف خلل
 * ProjectOverviewView.store.set الأصلي). updateSectionInMemory الجديدة تحدّث الحالة
 * وتُبلّغ المستمعين فقط، بلا لمس مسار الحفظ إطلاقاً.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('crypto', { randomUUID: () => 'update-in-memory-test-uuid' });

const memoryStorage = new Map();
vi.mock('../../utils/storageManager.js', () => ({
    storageManager: {
        getItem: vi.fn(async (k) => memoryStorage.get(k) ?? null),
        setItem: vi.fn(async (k, v) => { memoryStorage.set(k, v); }),
    },
}));
vi.mock('../../utils/encryption.js', () => ({
    encryptionService: { decryptSensitiveFields: vi.fn(async (obj) => obj) },
    SENSITIVE_FIELDS: [],
}));
vi.mock('../../services/DataBridge.js', () => ({
    DataBridge: { syncServicesToRevenue: vi.fn(() => null) },
}));
vi.mock('../../utils/monitoring.js', () => ({
    monitoring: { captureException: vi.fn(), addBreadcrumb: vi.fn() },
}));

const { store } = await import('../store.js');
const { createEmptyStudy } = await import('../schema.js');

describe('store.updateSectionInMemory — تحديث عرض بلا حفظ فعلي', () => {
    beforeEach(() => {
        if (store._localSaveTimeout) clearTimeout(store._localSaveTimeout);
        if (store._cloudSyncTimeout) clearTimeout(store._cloudSyncTimeout);
        store.state = createEmptyStudy();
        store._undoStack = [];
        store._redoStack = [];
        vi.spyOn(store, 'save');
        vi.spyOn(store, 'saveLocal').mockResolvedValue();
    });

    afterEach(() => {
        store.save.mockRestore();
        store.saveLocal.mockRestore();
        if (store._localSaveTimeout) clearTimeout(store._localSaveTimeout);
        if (store._cloudSyncTimeout) clearTimeout(store._cloudSyncTimeout);
    });

    it('[إثبات الحارس] لا تستدعي save() إطلاقاً — بخلاف updateSection العادية', () => {
        // نفس القسم، نفس البيانات: الفرق الوحيد هو الدالة المستدعاة. لو أُعيد تنفيذ
        // updateSectionInMemory يوماً بالاستدعاء الداخلي القديم (this.save()) بدل
        // _applySectionData وحدها، يفشل هذا التوقع تحديداً على الكود الحقيقي.
        store.updateSectionInMemory('results', { indicators: { npv: 555 } });
        expect(store.save).not.toHaveBeenCalled();

        store.updateSection('results', { indicators: { npv: 999 } });
        expect(store.save).toHaveBeenCalledTimes(1);
    });

    it('تُحدِّث state.results فوراً ويراها أي قارئ لـgetState().results (نمط PaywallModal/ReportPreviewModal)', () => {
        store.updateSectionInMemory('results', { decision: 'GO', indicators: { npv: 12345 } });
        // نفس نمط قراءة PaywallModal.js (state.results?.decision) وReportPreviewModal.js
        // (state.results || {}) — كلاهما يقرأ من store.getState() مباشرة بلا إعادة حساب.
        const state = store.getState();
        expect(state.results.decision).toBe('GO');
        expect(state.results.indicators.npv).toBe(12345);
    });

    it('تُبلّغ المستمعين (notify) بنفس القسم المُحدَّث', () => {
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        store.updateSectionInMemory('results', { indicators: { npv: 1 } });
        expect(listener).toHaveBeenCalledWith(store.state, 'results');
        unsubscribe();
    });

    it('لا تُسجِّل تراجعاً (undo) — هذا تحديث عرض لا تعديل مستخدم', () => {
        const before = store._undoStack.length;
        store.updateSectionInMemory('results', { indicators: { npv: 1 } });
        expect(store._undoStack.length).toBe(before);
    });

    it('تحترم نفس منطق الدمج المستخرَج في _applySectionData (مفتاح قديم غير المُمرَّر يبقى، لا يُمحى)', () => {
        store.state.results = { indicators: { npv: 1 }, decisionReasons: ['سبب قديم'] };
        store.updateSectionInMemory('results', { decision: 'REVISE' });
        // نشر سطحي على مستوى القسم: decision مفتاح جديد يُضاف، وdecisionReasons غير
        // المُمرَّر يبقى كما كان — لو أُعيد تنفيذ الدالة يوماً باستبدال كامل للقسم
        // (this.state[section] = data) بدل استدعاء _applySectionData المشترك، يفشل هذا.
        expect(store.state.results.decision).toBe('REVISE');
        expect(store.state.results.decisionReasons).toEqual(['سبب قديم']);
    });
});

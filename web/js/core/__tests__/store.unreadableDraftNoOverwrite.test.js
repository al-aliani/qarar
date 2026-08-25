/**
 * فشل قراءة المسودة المحلية كان ينتهي بـreset() فيكتب دراسة فارغة فوق الأصل
 * والنسخة الاحتياطية (مسح ليلة 2026-08-26).
 *
 * السيناريو الحقيقي: دراسة تجاوزت 5MB فصار موطنها IndexedDB وكُتبت العلامة
 * mac_blash_study_v2_ref = 'indexeddb'. في جلسة تالية تفشل indexedDB.open (قاعدة
 * تالفة/ملف تعريف يمنع التخزين) فيُعيد storageManager.getItem القيمة null عمداً.
 * كان load() يقرأ هذا الـnull كـ«لا توجد بيانات» فيستدعي reset() ⟶ saveLocal يكتب
 * الدراسة الفارغة فوق المفتاحين ويزيل علامة _ref، فتُظلَّل نسخة IndexedDB السليمة
 * نهائياً: عمل المستخدم يُدمَّر بسبب فشل قراءة قد يكون عابراً، وبلا كلمة تحذير.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('window', { addEventListener: () => { }, dispatchEvent: () => { } });
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

const localStorageMap = new Map();
vi.stubGlobal('localStorage', {
    getItem: (k) => (localStorageMap.has(k) ? localStorageMap.get(k) : null),
    setItem: (k, v) => localStorageMap.set(k, String(v)),
    removeItem: (k) => localStorageMap.delete(k),
});

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
vi.mock('../../utils/toast.js', () => ({
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock('../../services/PersistenceService.js', () => ({
    PersistenceService: { load: vi.fn(async () => null), save: vi.fn(async () => ({ success: true })) },
}));
vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: null })),
    getSupabaseClient: vi.fn(async () => ({ supabase: null })),
}));

const STORAGE_KEY = 'mac_blash_study_v2';
const STORAGE_KEY_BACKUP = 'mac_blash_study_v2_backup';

const { store } = await import('../store.js');
const { storageManager } = await import('../../utils/storageManager.js');
const { toast } = await import('../../utils/toast.js');

const wroteDraft = () => storageManager.setItem.mock.calls
    .some(([k]) => k === STORAGE_KEY || k === STORAGE_KEY_BACKUP);

// التنبيه يمرّ باستيراد ديناميكي لـtoast: تكّة واحدة تكفي لاستقراره بعد انتهاء load()
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('StudyStore.load — فشل قراءة المسودة لا يكتب فوقها', () => {
    beforeEach(() => {
        memoryStorage.clear();
        localStorageMap.clear();
        vi.clearAllMocks();
    });

    it('موطن المسودة IndexedDB وغير متاحة (getItem = null) ⟵ لا كتابة فوق أي مفتاح + تنبيه للمستخدم', async () => {
        // العلامة التي يكتبها storageManager._moveHomeToIndexedDB للحمولات الكبيرة
        localStorage.setItem(`${STORAGE_KEY}_ref`, 'indexeddb');
        localStorage.setItem(`${STORAGE_KEY_BACKUP}_ref`, 'indexeddb');
        // القاعدة غير متاحة ⟶ null صريح لكلا المفتاحين (memoryStorage فارغ)

        await store.load();
        await flush();

        expect(wroteDraft()).toBe(false);
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(toast.error.mock.calls[0][0]).toContain('تعذّر قراءة مسودتك المحفوظة');
    });

    it('نسخة احتياطية تالفة (JSON غير صالح) والمسودة مفقودة ⟵ لا كتابة فوق التالف', async () => {
        memoryStorage.set(STORAGE_KEY_BACKUP, '{"projectInfo": {"name": "مصنع تعبئة"'); // مقطوع

        await store.load();
        await flush();

        expect(wroteDraft()).toBe(false);
        expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it('المسودة والنسخة الاحتياطية تالفتان معاً ⟵ لا كتابة فوقهما', async () => {
        memoryStorage.set(STORAGE_KEY, 'NOT-JSON-AT-ALL');
        memoryStorage.set(STORAGE_KEY_BACKUP, 'ALSO-NOT-JSON');

        await store.load();
        await flush();

        expect(wroteDraft()).toBe(false);
        expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it('مستخدم جديد فعلاً (لا مفاتيح ولا علامة _ref) ⟵ يُبذَر التخزين كالسابق بلا تنبيه', async () => {
        await store.load();
        await flush();

        expect(wroteDraft()).toBe(true);
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('مسودة سليمة تُقرأ كما هي ولا تُلمَس بمسار الفشل', async () => {
        const study = store.mergeWithDefaults({});
        study.projectInfo.id = 'X-1';
        study.projectInfo.name = 'مصنع تعبئة';
        memoryStorage.set(STORAGE_KEY, JSON.stringify(study));

        await store.load();
        await flush();

        expect(store.state.projectInfo.name).toBe('مصنع تعبئة');
        expect(toast.error).not.toHaveBeenCalled();
    });
});

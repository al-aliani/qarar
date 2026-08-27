/**
 * مستمع storage بين التبويبات كان يستبدل الدراسة المفتوحة صامتاً (مسح ليلة 2026-08-26).
 *
 * السيناريو الحقيقي: التبويب A على خطوة الرواتب في «مقهى النرجس» وفيه 6 صفوف لم
 * تُحفظ بعد (_dirty). التبويب B يفتح «مطعم الريف» من لوحة التحكم فيكتب مفتاح
 * mac_blash_study_v2. المستمع كان ينفّذ load() بلا شرط فيستبدل حالة التبويب A
 * بالكامل بينما نموذج الويزارد ما زال يعرض «مقهى النرجس» — فأول تعديل تالٍ يُكتب
 * داخل «مطعم الريف»: صفوف ضائعة + دراستان مختلطتان.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const windowListeners = new Map();
vi.stubGlobal('window', {
    addEventListener: (type, fn) => {
        if (!windowListeners.has(type)) windowListeners.set(type, []);
        windowListeners.get(type).push(fn);
    },
    dispatchEvent: () => { },
});
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });

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
vi.mock('../../services/PersistenceService.js', () => ({
    PersistenceService: { load: vi.fn(async () => null), save: vi.fn(async () => ({ success: true })) },
}));
vi.mock('../../../supabaseClient.js', () => ({
    getAuthUser: vi.fn(async () => ({ user: null })),
    getSupabaseClient: vi.fn(async () => ({ supabase: null })),
}));

const STORAGE_KEY = 'mac_blash_study_v2';
const { store } = await import('../store.js');
const onStorage = windowListeners.get('storage')[0];

const SIX_POSITIONS = [
    { id: 1, title: 'باريستا', count: 2, salary: 4500 },
    { id: 2, title: 'كاشير', count: 1, salary: 4000 },
    { id: 3, title: 'مشرف وردية', count: 1, salary: 6500 },
    { id: 4, title: 'عامل نظافة', count: 1, salary: 3500 },
    { id: 5, title: 'محاسب', count: 1, salary: 7000 },
    { id: 6, title: 'مدير فرع', count: 1, salary: 12000 },
];

function makeStudy(id, name, positions = []) {
    const s = store.mergeWithDefaults({});
    s.projectInfo.id = id;
    s.projectInfo.name = name;
    s.hr.positions = positions;
    return s;
}

describe('StudyStore — حدث storage من تبويب آخر لا يكتب فوق عمل التبويب الحالي', () => {
    beforeEach(() => {
        memoryStorage.clear();
        vi.clearAllMocks();
    });

    it('تعديلات غير محفوظة + دراسة أخرى قادمة ⟵ لا استبدال: تبقى «مقهى النرجس» وصفوفها الستة', async () => {
        store.state = makeStudy('A-narjis', 'مقهى النرجس', SIX_POSITIONS);
        store._dirty = true; // 6 صفوف كُتبت ولم يمرّ الحفظ التلقائي بعد

        const reef = makeStudy('B-reef', 'مطعم الريف', [{ id: 9, title: 'طباخ', count: 3, salary: 5000 }]);
        const reefJson = JSON.stringify(reef);
        memoryStorage.set(STORAGE_KEY, reefJson); // ما كتبه التبويب B فعلاً

        await onStorage({ key: STORAGE_KEY, newValue: reefJson });

        expect(store.state.projectInfo.id).toBe('A-narjis');
        expect(store.state.projectInfo.name).toBe('مقهى النرجس');
        expect(store.state.hr.positions).toHaveLength(6);
        expect(store.state.hr.positions[5].title).toBe('مدير فرع');
    });

    it('دراسة أخرى قادمة بلا تعديلات غير محفوظة ⟵ لا استبدال أيضاً (النموذج المعروض يبقى للدراسة نفسها)', async () => {
        store.state = makeStudy('A-narjis', 'مقهى النرجس', SIX_POSITIONS);
        store._dirty = false;

        const reefJson = JSON.stringify(makeStudy('B-reef', 'مطعم الريف'));
        memoryStorage.set(STORAGE_KEY, reefJson);

        await onStorage({ key: STORAGE_KEY, newValue: reefJson });

        expect(store.state.projectInfo.id).toBe('A-narjis');
        expect(store.state.hr.positions).toHaveLength(6);
    });

    it('نفس الدراسة وبلا تعديلات غير محفوظة ⟵ يُتبنّى ما كتبه التبويب الآخر (لا تراجع في السلوك المفيد)', async () => {
        store.state = makeStudy('A-narjis', 'مقهى النرجس', []);
        store._dirty = false;

        const updated = makeStudy('A-narjis', 'مقهى النرجس', SIX_POSITIONS);
        const updatedJson = JSON.stringify(updated);
        memoryStorage.set(STORAGE_KEY, updatedJson);

        await onStorage({ key: STORAGE_KEY, newValue: updatedJson });

        expect(store.state.projectInfo.id).toBe('A-narjis');
        expect(store.state.hr.positions).toHaveLength(6);
    });

    it('حمولة كبيرة (newValue = null) لدراسة أخرى تُقرأ من التخزين ولا تُستبدَل', async () => {
        store.state = makeStudy('A-narjis', 'مقهى النرجس', SIX_POSITIONS);
        store._dirty = false;

        memoryStorage.set(STORAGE_KEY, JSON.stringify(makeStudy('B-reef', 'مطعم الريف')));

        await onStorage({ key: STORAGE_KEY, newValue: null });

        expect(store.state.projectInfo.id).toBe('A-narjis');
        expect(store.state.hr.positions).toHaveLength(6);
    });
});

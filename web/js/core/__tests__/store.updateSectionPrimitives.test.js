/**
 * updateSection كانت تنشر **أي** قيمة داخل كائن:
 *   this.state[section] = { ...this.state[section], ...data }
 * فأي مفتاح جذري قيمته بدائية (id / version / createdAt / updatedAt) يُفكَّك حرفاً
 * بحرف إلى كائن مفهرس ({"0":"4","1":".","2":"0"})، وأي مصفوفة تُدمج بالفهرس فتبقى
 * عناصر المصفوفة السابقة في المواضع الزائدة (بقايا الدراسة السابقة).
 * المستدعي في الإنتاج: حلقة استعادة/استيراد الدراسة في DecisionDashboard.
 *
 * الحارس الأخير هنا مقصود: دمج الكائنات العادية مفتاحاً بمفتاح هو **سلوك الدالة
 * المقصود** ويجب ألا يتغيّر مع الإصلاح.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubGlobal('window', { addEventListener: () => { }, dispatchEvent: () => { } });
vi.stubGlobal('crypto', { randomUUID: () => 'primitives-test-uuid' });

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

/** بصمة التلف: نص فُكِّك إلى كائن مفهرس بالأحرف {"0":"1","1":"9",...} */
function isCharIndexedObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length > 0
        && Object.keys(value).every(k => /^\d+$/.test(k));
}

describe('updateSection — القيم غير الكائنية تُستبدل كاملةً ولا تُنشر داخل كائن', () => {
    beforeEach(() => {
        if (store._localSaveTimeout) clearTimeout(store._localSaveTimeout);
        store.state = createEmptyStudy();
        store._undoStack = [];
        store._redoStack = [];
        vi.spyOn(store, 'saveLocal').mockResolvedValue();
    });

    afterEach(() => {
        store.saveLocal.mockRestore();
        if (store._localSaveTimeout) clearTimeout(store._localSaveTimeout);
    });

    it('id نصّي يبقى نصاً (لا كائن مفهرس بالأحرف)', () => {
        const id = '19b3c7d4-0000-4000-8000-000000000001';
        store.update('id', id, true);
        expect(isCharIndexedObject(store.state.id), `id تحوّل إلى كائن أحرف: ${JSON.stringify(store.state.id)}`).toBe(false);
        expect(store.state.id).toBe(id);
    });

    it('version نصّي يبقى نصاً', () => {
        store.update('version', '4.0.0', true);
        expect(isCharIndexedObject(store.state.version), `version تحوّل إلى كائن أحرف: ${JSON.stringify(store.state.version)}`).toBe(false);
        expect(store.state.version).toBe('4.0.0');
    });

    it('createdAt/updatedAt نصّيان يبقيان نصّين', () => {
        store.update('createdAt', '2026-01-01T00:00:00.000Z', true);
        store.update('updatedAt', '2026-02-02T00:00:00.000Z', true);
        expect(typeof store.state.createdAt).toBe('string');
        expect(typeof store.state.updatedAt).toBe('string');
        expect(store.state.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('مصفوفة جذرية تُستبدل كاملةً ولا تُدمج بالفهرس (لا بقايا من المصفوفة السابقة)', () => {
        store.state.reportSectionOrder = ['قديم-١', 'قديم-٢', 'قديم-٣'];
        store.update('reportSectionOrder', ['جديد-١'], true);
        expect(Array.isArray(store.state.reportSectionOrder), `صارت ${JSON.stringify(store.state.reportSectionOrder)}`).toBe(true);
        expect(store.state.reportSectionOrder).toEqual(['جديد-١']);
    });

    it('null يستبدل القسم كاملاً (لا يُتجاهَل كنشر فارغ)', () => {
        store.update('appendices', null, true);
        expect(store.state.appendices).toBeNull();
    });

    it('حارس عدم انحدار: دمج كائن عادي ما زال مفتاحاً بمفتاح كما كان', () => {
        store.state.projectInfo.name = 'مطعم الريف';
        store.state.projectInfo.city = 'الرياض';
        store.update('projectInfo', { name: 'كشك عصائر' }, true);
        expect(store.state.projectInfo.name).toBe('كشك عصائر'); // المُمرَّر يطغى
        expect(store.state.projectInfo.city).toBe('الرياض');    // وغير المُمرَّر يبقى
        expect(store.state.projectInfo).toHaveProperty('description'); // ولا يضيع مفتاح المخطط
    });

    it('حارس عدم انحدار: undefined لا يمحو القسم (كما كان مع النشر السطحي)', () => {
        store.state.projectInfo.name = 'مطعم الريف';
        store.update('projectInfo', undefined, true);
        expect(store.state.projectInfo?.name).toBe('مطعم الريف');
    });
});

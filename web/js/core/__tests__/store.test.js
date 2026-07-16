/**
 * اختبارات store.js — قلب الحفظ/الاسترجاع كان بلا أي اختبار (تدقيق 2026-07-08).
 * نُثبّت التبعيات المتصفحية (storageManager/encryption/DataBridge/monitoring/PersistenceService)
 * بمزيّفات في الذاكرة كي نختبر منطق الدمج/الترميم/المسارات الحقيقي بمعزل عن I/O والشبكة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('window', {
    addEventListener: () => {},
    dispatchEvent: () => {},
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
    SENSITIVE_FIELDS: [
        'financing.sources.bankLoan.amount',
        'revenue.streams',
        'hr.positions',
        'assumptions.discountRate',
    ],
}));
vi.mock('../../services/DataBridge.js', () => ({
    DataBridge: { syncServicesToRevenue: vi.fn(() => null) },
}));
vi.mock('../../utils/monitoring.js', () => ({
    monitoring: { captureException: vi.fn(), addBreadcrumb: vi.fn() },
}));

const { store } = await import('../store.js');
const { SECTIONS } = await import('../schema.js');

describe('StudyStore — الدمج الآمن مع تطور المخطط (mergeWithDefaults/_deepMerge)', () => {
    it('يدمج حقلاً جزئياً محفوظاً مع باقي المخطط الافتراضي دون فقدان بقية الأقسام', () => {
        const merged = store.mergeWithDefaults({ projectInfo: { name: 'مشروعي' } });
        expect(merged.projectInfo.name).toBe('مشروعي');
        expect(merged[SECTIONS.FINANCING]).toBeDefined();
        expect(merged[SECTIONS.TECHNICAL]).toBeDefined();
    });

    it('يستبدل المصفوفات كاملة (لا يدمج العناصر) لتفادي التكرار', () => {
        const merged = store.mergeWithDefaults({
            [SECTIONS.HR]: { positions: [{ id: 1, salary: 5000 }] },
        });
        expect(merged[SECTIONS.HR].positions).toEqual([{ id: 1, salary: 5000 }]);
    });

    it('نص مكان مصفوفة متوقعة (حمولة تشفير قديمة تالفة) يُتجاهَل ويبقى الافتراضي', () => {
        const merged = store.mergeWithDefaults({
            [SECTIONS.HR]: { positions: 'U2FsdGVkX1+corrupted==' },
        });
        expect(Array.isArray(merged[SECTIONS.HR].positions)).toBe(true);
        expect(merged[SECTIONS.HR].positions).toEqual([]);
    });

    it('نص مكان كائن متوقع يُتجاهَل ويبقى الافتراضي', () => {
        const merged = store.mergeWithDefaults({
            [SECTIONS.FINANCING]: { sources: 'corrupted-ciphertext' },
        });
        expect(typeof merged[SECTIONS.FINANCING].sources).toBe('object');
        expect(merged[SECTIONS.FINANCING].sources).not.toBe('corrupted-ciphertext');
    });
});

describe('StudyStore — ترميم الحقول التالفة (_sanitizeCorruptedFields)', () => {
    it('نص رقمي صالح لحقل رقمي يُحوَّل لرقم (مسار fallback القديم)', () => {
        const state = store.mergeWithDefaults({});
        state.assumptions = { ...state.assumptions, discountRate: '0.15' };
        const repaired = store._sanitizeCorruptedFields(state);
        expect(state.assumptions.discountRate).toBe(0.15);
        expect(repaired).not.toContain('assumptions.discountRate');
    });

    it('نص غير رقمي لحقل رقمي يُعاد للافتراضي ويُسجَّل كحقل مُصلَح', () => {
        const state = store.mergeWithDefaults({});
        state.assumptions = { ...state.assumptions, discountRate: 'U2FsdGVkX1+abc==' };
        const defaults = store.mergeWithDefaults({});
        const repaired = store._sanitizeCorruptedFields(state);
        expect(state.assumptions.discountRate).toBe(defaults.assumptions.discountRate);
        expect(repaired).toContain('assumptions.discountRate');
    });

    it('نص مكان مصفوفة حسّاسة (revenue.streams) يُعاد لمصفوفة فارغة ويُسجَّل', () => {
        const state = store.mergeWithDefaults({});
        state.revenue.streams = 'U2FsdGVkX1+ciphertext==';
        const repaired = store._sanitizeCorruptedFields(state);
        expect(Array.isArray(state.revenue.streams)).toBe(true);
        expect(state.revenue.streams.length).toBe(0);
        expect(repaired).toContain('revenue.streams');
    });

    it('حقول سليمة لا تُلمَس ولا تظهر في قائمة المُصلَح', () => {
        const state = store.mergeWithDefaults({});
        state.revenue.streams = [{ service: 'بيع', avgPrice: 50 }];
        state.assumptions.discountRate = 0.1;
        const repaired = store._sanitizeCorruptedFields(state);
        expect(state.revenue.streams).toEqual([{ service: 'بيع', avgPrice: 50 }]);
        expect(repaired.length).toBe(0);
    });
});

describe('StudyStore — updatePath (تحديث مسار متداخل)', () => {
    beforeEach(() => {
        store.state = store.mergeWithDefaults({});
    });

    it('يُنشئ المسار المتداخل إن لم يكن موجوداً ويكتب القيمة', () => {
        store.updatePath('assumptions', 'terminalValue.growthRate', 0.03);
        expect(store.state.assumptions.terminalValue.growthRate).toBe(0.03);
    });

    it('مسار فارغ يستبدل القسم كاملاً (لأقسام المصفوفات)', () => {
        store.updatePath(SECTIONS.HR, '', { positions: [{ id: 9 }] });
        expect(store.state[SECTIONS.HR]).toEqual({ positions: [{ id: 9 }] });
    });

    it('قسم مفقود (مسودة قديمة) يُهيَّأ تلقائياً من المخطط قبل الكتابة', () => {
        delete store.state[SECTIONS.HR];
        store.updatePath(SECTIONS.HR, 'positions', [{ id: 1 }]);
        expect(store.state[SECTIONS.HR].positions).toEqual([{ id: 1 }]);
    });
});

describe('StudyStore — مزامنة SWOT ثنائية الاتجاه (_syncSwot)', () => {
    beforeEach(() => {
        store.state = store.mergeWithDefaults({});
    });

    it('تعديل strategic.swot (مصفوفات) ينعكس نصاً في marketing.swot', () => {
        store.state.strategic.swot = { strengths: ['موقع مميز', 'فريق قوي'], weaknesses: [], opportunities: [], threats: [] };
        store._syncSwot('strategic');
        expect(store.state.marketing.swot.strengths).toBe('موقع مميز\nفريق قوي');
    });

    it('تعديل marketing.swot (نص) ينعكس مصفوفة في strategic.swot', () => {
        store.state.marketing.swot = { strengths: 'ميزة أولى\nميزة ثانية', weaknesses: '', opportunities: '', threats: '' };
        store._syncSwot('marketing');
        expect(store.state.strategic.swot.strengths).toEqual(['ميزة أولى', 'ميزة ثانية']);
    });

    it('قسم غير مرتبط بـ SWOT لا يُحدِث أي مزامنة', () => {
        store.state.strategic.swot = { strengths: ['قوة'], weaknesses: [], opportunities: [], threats: [] };
        store._syncSwot('strategic');
        const before = JSON.stringify(store.state.marketing.swot);
        store._syncSwot('financing');
        expect(JSON.stringify(store.state.marketing.swot)).toBe(before);
    });
});

describe('StudyStore — validateState وسجل الإصدارات', () => {
    it('يرفض حالة فارغة أو غير كائن', () => {
        expect(store.validateState(null)).toBe(false);
        expect(store.validateState({})).toBe(false);
        expect(store.validateState('x')).toBe(false);
    });

    it('يقبل حالة كائن غير فارغ', () => {
        expect(store.validateState({ projectInfo: {} })).toBe(true);
    });

    it('restoreVersion على تاريخ فارغ يعيد false ولا يرمي', async () => {
        store._versionHistory = [];
        const ok = await store.restoreVersion(0);
        expect(ok).toBe(false);
    });
});

describe('StudyStore — استمرارية سجل الإصدارات عبر localStorage (persist/_loadVersionHistory)', () => {
    beforeEach(() => {
        store.state = store.mergeWithDefaults({});
        store._versionHistory = [];
        memoryStorage.delete('qarar_version_history');
    });

    it('saveLocal يحفظ سجل الإصدارات في التخزين، ويُستعاد كاملاً بعد محاكاة إعادة تحميل', async () => {
        store.state.projectInfo.name = 'نسخة 1';
        await store.saveLocal();
        store.state.projectInfo.name = 'نسخة 2';
        await store.saveLocal();

        expect(store.getVersionHistory().length).toBe(2);

        // محاكاة إعادة تحميل الصفحة: امسح الذاكرة وأعد القراءة من نفس مخزن localStorage المزيّف
        store._versionHistory = [];
        await store._loadVersionHistory();

        const restored = store.getVersionHistory();
        expect(restored.length).toBe(2);
        expect(restored[0].state.projectInfo.name).toBe('نسخة 1');
        expect(restored[1].state.projectInfo.name).toBe('نسخة 2');
    });

    it('يبقى سقف الـ10 نسخ محفوظاً في localStorage وصحيحاً بعد محاكاة إعادة التحميل', async () => {
        for (let i = 0; i < 12; i++) {
            store.state.projectInfo.name = `نسخة ${i}`;
            await store.saveLocal();
        }
        expect(store.getVersionHistory().length).toBe(10);

        store._versionHistory = [];
        await store._loadVersionHistory();

        const restored = store.getVersionHistory();
        expect(restored.length).toBe(10);
        // أقدم نسخة يجب أن تكون رقم 2 (٠ و١ سقطتا خارج السقف)، وآخر نسخة رقم 11
        expect(restored[0].state.projectInfo.name).toBe('نسخة 2');
        expect(restored[restored.length - 1].state.projectInfo.name).toBe('نسخة 11');
    });

    it('_loadVersionHistory لا يرمي ولا يغيّر الذاكرة إن لم يوجد سجل محفوظ بعد', async () => {
        store._versionHistory = [{ timestamp: 't', state: {} }];
        memoryStorage.delete('qarar_version_history');
        await store._loadVersionHistory();
        expect(store._versionHistory).toEqual([{ timestamp: 't', state: {} }]);
    });
});

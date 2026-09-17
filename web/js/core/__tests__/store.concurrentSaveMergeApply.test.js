/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16 (دمج تعديل متزامن): PersistenceService.save قد تُعيد الآن
 * result.merged عندما تدمج _saveCloud نسخة سحابية أحدث من جهاز آخر (انظر
 * persistenceService.concurrentSaveMerge.test.js لاختبار الدمج نفسه في الخدمة).
 * هذا الملف يتحقق أن store._syncToCloud تُطبِّق تلك الأقسام المدموجة على الحالة
 * الحيّة فعلاً — بلا هذا، الجهاز يفقد معرفته بتعديل الطرف الآخر رغم أن السحابة
 * (والخدمة) دمجتاه بالفعل، فيُعيد الحفظ التالي من هذا الجهاز إسقاطه مجدداً.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' });
vi.mock('../../utils/storageManager.js', () => ({
    storageManager: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) },
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

const saveMock = vi.fn();
vi.mock('../../services/PersistenceService.js', () => ({
    PersistenceService: { save: (...a) => saveMock(...a) },
}));

const { store } = await import('../store.js');

describe('store._syncToCloud — يُطبِّق result.merged على الحالة الحيّة', () => {
    beforeEach(() => {
        saveMock.mockReset();
        vi.restoreAllMocks();
        store._cloudSyncInFlight = false;
        store._pendingCloudSyncData = null;
    });

    it('قسم دُمِج من جهاز آخر (technical) يصل للحالة الحيّة رغم أن هذا الجهاز لم يعدّله', async () => {
        const sentData = { projectInfo: { id: 'study-1' }, hr: { positions: [{ position: 'مدير' }] } };
        store.state = { ...sentData };
        saveMock.mockResolvedValue({
            success: true,
            location: 'both',
            merged: { ...sentData, technical: { equipment: [{ name: 'من جهاز آخر' }] } },
        });

        await store._syncToCloud(sentData);

        expect(store.state.technical).toEqual({ equipment: [{ name: 'من جهاز آخر' }] });
        expect(store.state.hr).toEqual(sentData.hr); // قسمنا نحن يبقى كما هو أيضاً
    });

    it('لا يكتب فوق تعديل أحدث حصل في نفس القسم أثناء رحلة هذا الحفظ نفسها', async () => {
        const sentData = { projectInfo: { id: 'study-1' }, hr: { positions: [] } };
        store.state = { ...sentData };
        saveMock.mockImplementation(async () => {
            // المستخدم عدّل hr مرة أخرى أثناء رحلة هذا الحفظ (قبل وصول النتيجة)
            store.state.hr = { positions: [{ position: 'تعديل أحدث أثناء الحفظ' }] };
            return { success: true, location: 'both', merged: { ...sentData, hr: { positions: [{ position: 'قديم من السحابة' }] } } };
        });

        await store._syncToCloud(sentData);

        // التعديل الأحدث (أثناء الحفظ) يبقى، لا يُستبدَل بالنسخة المدموجة الأقدم
        expect(store.state.hr).toEqual({ positions: [{ position: 'تعديل أحدث أثناء الحفظ' }] });
    });

    it('لا merged في النتيجة (الحالة الشائعة، لا تعارض): لا تعديل إضافي على أقسام الحالة الحيّة', async () => {
        const sentData = { projectInfo: { id: 'study-1' }, hr: { positions: [] } };
        store.state = { ...sentData };
        saveMock.mockResolvedValue({ success: true, location: 'both' });

        await store._syncToCloud(sentData);

        // state.id تضبطها _syncToCloud نفسها بمعزل عن الدمج (سلوك قائم غير متعلق
        // بهذا الإصلاح) — المهم هنا: hr/projectInfo لم يتغيّرا بلا داعٍ.
        expect(store.state.hr).toEqual(sentData.hr);
        expect(store.state.projectInfo).toEqual(sentData.projectInfo);
    });
});

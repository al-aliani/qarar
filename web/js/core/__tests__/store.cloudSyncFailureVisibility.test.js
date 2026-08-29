/**
 * @vitest-environment jsdom
 *
 * دفعة 5 من خطة إغلاق فجوات الطبقات الـ16 (2026-08-27، طبقة Availability):
 * result.cloudSyncFailed من PersistenceService.save() لم يكن يصل إطلاقاً إلى
 * _lastSaveStatus (فقط location/success/error كانت تُقرأ) — فحالة "مسجَّل
 * دخول لكن فشلت المزامنة السحابية فعلياً" كانت تختفي خلف نفس حالة "غير
 * مسجَّل دخول" المحايدة في الواجهة (HeaderIndicators.js). أيضاً: لا استماع
 * لعودة الاتصال لإعادة محاولة المزامنة المؤجَّلة تلقائياً.
 *
 * مراجعة عدائية لاحقة على هذا الإصلاح نفسه وجدت عطلين إضافيين حقيقيين:
 * (أ) مستمع 'online' من فشل سابق لم يكن يُزال بعد نجاح لاحق غير مرتبط، فيبقى
 *     حياً ويُعيد بيانات قديمة عند أي اتصال لاحق عرضي (استيقاظ الجهاز مثلاً).
 * (ب) لا حارس ضد نداءات _syncToCloud متراكبة أثناء انقطاع فعلي — كل تعديل
 *     متتابع أثناء الانقطاع كان يُطلق حتى 3 محاولات إعادة اتصال بمفرده،
 *     تضخيماً حقيقياً لحمل الشبكة/الخادم أثناء عطل حقيقي بدل حمايته منه.
 * الاختبارات هنا تستخدم تجسّساً مباشراً على addEventListener/removeEventListener
 * (لا window.dispatchEvent الحقيقي) لتفادي هشاشة التوقيت بين اختبارات تشترك
 * نفس كائن window الحقيقي في jsdom.
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

// انتظار كافٍ لتصريف كل الوعود المعلَّقة (استيراد ديناميكي + PersistenceService.save
// + منطق finally/coalescing) — سلسلة async متعددة الطبقات تحتاج أكثر من tick واحد.
async function flush() {
    await new Promise((r) => setTimeout(r, 20));
}

/** يجسّس على addEventListener('online', ...) ويُرجع آخر معالج سُجِّل، لاستدعائه يدوياً بدل الاعتماد على dispatchEvent الحقيقي (يُزيل هشاشة التوقيت بين اختبارات تشترك نفس window). */
function captureOnlineHandler() {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    return {
        addSpy,
        removeSpy,
        latestHandler: () => addSpy.mock.calls.filter((c) => c[0] === 'online').at(-1)?.[1],
        onlineListenerCount: () => addSpy.mock.calls.filter((c) => c[0] === 'online').length
            - removeSpy.mock.calls.filter((c) => c[0] === 'online').length,
    };
}

describe('store._syncToCloud — يُبلِّغ cloudSyncFailed فعلياً بدل إخفائه خلف location=local', () => {
    beforeEach(() => {
        saveMock.mockReset();
        vi.restoreAllMocks();
        store.state = { projectInfo: { id: 'study-1' } };
        // تنظيف بين الاختبارات: كل اختبار يفترض بداية نظيفة لا يوجد فيها مستمع
        // 'online' معلَّق من اختبار سابق نجح في تفعيله عبر سيناريو فشل مماثل.
        store._onlineRetryListenerAttached = false;
        store._pendingOnlineHandler = null;
        store._pendingOnlineSyncData = null;
        store._cloudSyncInFlight = false;
        store._pendingCloudSyncData = null;
    });

    it('نجاح كامل (location=both) ⇒ cloudSyncFailed=false صراحة', async () => {
        saveMock.mockResolvedValue({ success: true, location: 'both' });
        const statuses = [];
        const unsub = store.subscribeSaveStatus((s) => statuses.push(s));

        await store._syncToCloud({ projectInfo: { id: 'study-1' } });
        unsub();

        const finalStatus = statuses[statuses.length - 1];
        expect(finalStatus.location).toBe('both');
        expect(finalStatus.cloudSyncFailed).toBe(false);
    });

    it('فشل المزامنة بعد استنفاد إعادة المحاولة (result.cloudSyncFailed=true) ⇒ يصل فعلياً إلى مستمعي حالة الحفظ', async () => {
        saveMock.mockResolvedValue({ success: true, location: 'local', cloudSyncFailed: true, error: 'Cloud sync failed: timeout' });
        const statuses = [];
        const unsub = store.subscribeSaveStatus((s) => statuses.push(s));

        await store._syncToCloud({ projectInfo: { id: 'study-1' } });
        unsub();

        const finalStatus = statuses[statuses.length - 1];
        expect(finalStatus.location).toBe('local');
        expect(finalStatus.cloudSyncFailed).toBe(true);
    });

    it('يستمع لحدث "online" مرة واحدة بعد فشل المزامنة، ويعيد المحاولة فور عودة الاتصال', async () => {
        const spies = captureOnlineHandler();
        saveMock
            .mockResolvedValueOnce({ success: true, location: 'local', cloudSyncFailed: true, error: 'offline' })
            .mockResolvedValueOnce({ success: true, location: 'both' });

        await store._syncToCloud({ projectInfo: { id: 'study-1' } });
        expect(saveMock).toHaveBeenCalledTimes(1);
        expect(spies.onlineListenerCount()).toBe(1);

        await spies.latestHandler()();
        await flush();

        expect(saveMock).toHaveBeenCalledTimes(2);
        expect(spies.onlineListenerCount()).toBe(0); // المستمع أزال نفسه بعد إطلاقه
    });

    it('[مراجعة عدائية] نجاح لاحق غير مرتبط بإعادة الاتصال يُبطِل أي إعادة محاولة معلَّقة — لا يبقى مستمع "online" حياً بلا داعٍ', async () => {
        const spies = captureOnlineHandler();

        // فشل أول يُسلِّح مستمع 'online' ببيانات قديمة (marker: 'OLD').
        saveMock.mockResolvedValueOnce({ success: true, location: 'local', cloudSyncFailed: true, error: 'offline' });
        await store._syncToCloud({ marker: 'OLD' });
        expect(spies.onlineListenerCount()).toBe(1);

        // نجاح لاحق طبيعي (تعديل جديد من المستخدم نجحت مزامنته عادياً — لا عبر onReconnect).
        saveMock.mockResolvedValueOnce({ success: true, location: 'both' });
        await store._syncToCloud({ marker: 'NEW' });

        // العطل الأصلي: هذا كان يبقى معلَّقاً للأبد، فيُعيد المستمع بيانات OLD لاحقاً.
        expect(spies.onlineListenerCount()).toBe(0);
        expect(store._onlineRetryListenerAttached).toBe(false);
    });

    it('[مراجعة عدائية] فشل ثانٍ أثناء نفس فترة الانقطاع يُحدِّث البيانات المعلَّقة لا يُتجاهَل، ولا يُضيف مستمعاً ثانياً', async () => {
        const spies = captureOnlineHandler();

        saveMock.mockResolvedValueOnce({ success: true, location: 'local', cloudSyncFailed: true, error: 'offline-1' });
        await store._syncToCloud({ marker: 'FIRST_FAILURE' });
        expect(spies.onlineListenerCount()).toBe(1);

        saveMock.mockResolvedValueOnce({ success: true, location: 'local', cloudSyncFailed: true, error: 'offline-2' });
        await store._syncToCloud({ marker: 'SECOND_FAILURE' });

        // مستمع واحد فقط طوال الوقت — لا مستمعين متراكمين رغم فشلين منفصلين.
        expect(spies.onlineListenerCount()).toBe(1);

        saveMock.mockResolvedValueOnce({ success: true, location: 'both' });
        await spies.latestHandler()();
        await flush();

        // العطل الأصلي: كان سيُعيد FIRST_FAILURE (اللقطة الأقدم) — الصحيح إعادة الأحدث.
        expect(saveMock).toHaveBeenCalledTimes(3);
        const lastCallData = saveMock.mock.calls[2][1];
        expect(lastCallData).toEqual({ marker: 'SECOND_FAILURE' });
    });

    it('[مراجعة عدائية] نداءان متراكبان لا يُرسلان طلبين متزامنين للخادم — يُجمَّع الثاني على أحدث بيانات فقط', async () => {
        let resolveFirst;
        saveMock.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));

        // الحارس (_cloudSyncInFlight) يُفحَص synchronously قبل أي await في الدالة،
        // فالنداء الثاني هنا يرى فوراً أن الأول "قيد التنفيذ" بلا حاجة لانتظار أي tick.
        const firstCall = store._syncToCloud({ marker: 'IN_FLIGHT' });
        const secondResult = await store._syncToCloud({ marker: 'LATEST_WHILE_BUSY' });
        expect(secondResult.coalesced).toBe(true);

        // لكن saveMock نفسه لا يُستدعى إلا بعد `await import(...)` الداخلي في الأول
        // (استيراد ديناميكي حقيقي عبر آلية Vitest/vite-node — أكثر من microtask
        // tick واحد)؛ ننتظر فعلياً قبل التحقق من أن الأول وصل له، لا الثاني.
        await flush();
        expect(saveMock).toHaveBeenCalledTimes(1); // لا نداء ثانٍ متزامن فعلي بعد

        saveMock.mockResolvedValueOnce({ success: true, location: 'both' });
        resolveFirst({ success: true, location: 'both' });
        await firstCall;
        await flush();

        // بعد انتهاء الأول، يُطلَق نداء واحد إضافي فقط بأحدث بيانات (لا نداء لكل طلب وسيط).
        expect(saveMock).toHaveBeenCalledTimes(2);
        expect(saveMock.mock.calls[1][1]).toEqual({ marker: 'LATEST_WHILE_BUSY' });
    });

    it('[إثبات الحارس] استدعاء _syncToCloud الحقيقي فعلياً: cloudSyncFailed يصل إلى _lastSaveStatus الحقيقي لا يختفي', async () => {
        saveMock.mockResolvedValue({ success: true, location: 'local', cloudSyncFailed: true, error: 'timeout' });

        await store._syncToCloud({ projectInfo: { id: 'study-1' } });

        // العطل الأصلي: لو حُذف `cloudSyncFailed: Boolean(result.cloudSyncFailed)` من بناء
        // _lastSaveStatus الحقيقي في store.js._syncToCloud، كانت هذه القيمة تختفي كلياً
        // بصرف النظر عن قيمتها الحقيقية في result، فيظهر "محفوظ محلياً" كأن كل شيء طبيعي.
        expect(store._lastSaveStatus.cloudSyncFailed).toBe(true);
        expect(store._lastSaveStatus.success).toBe(true);
    });
});

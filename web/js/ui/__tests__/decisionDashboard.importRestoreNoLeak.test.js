// @vitest-environment jsdom
/**
 * مسار «استيراد نسخة احتياطية» في لوحة القرار كان يطبّق الحمولة المستعادة
 * مفتاحاً بمفتاح: Object.entries(loaded.data).forEach(([k,v]) => store.update(k,v,true)).
 * فيدمج الملف المستورَد **داخل** الدراسة المفتوحة بدل استبدالها: كل ما لا يذكره
 * الملف يبقى من الدراسة السابقة، والمفاتيح الجذرية البدائية (id/version) كانت
 * تُفكَّك إلى كائنات مفهرسة بالأحرف.
 *
 * هنا نشغّل معالج الحدث الحقيقي (bindEvents → change على #btnImportBackup) على
 * مخزن حقيقي، لا نسخة مُقلَّدة من الحلقة — كي يفشل الاختبار إن عادت الحلقة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('gridstack', () => ({ GridStack: { initAll: vi.fn() } }));
vi.mock('../../utils/toast.js', () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../utils/analytics.js', () => ({ trackEvent: vi.fn() }));

// تبعيات المخزن (I/O وشبكة) — مزيّفات في الذاكرة كما في اختبارات core
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

const { createEmptyStudy } = await import('../../core/schema.js');

/**
 * حمولة **ناقصة** عمداً: لا قسم hr إطلاقاً، وقسم marketing حاضر جزئياً بلا مفاتيح
 * المراحل المتأخرة. هذه هي الحالة التي تميّز الإصلاح فعلاً — حمولة مطبَّعة على
 * المخطط كاملاً (كالتي تنتجها importProjectBackup اليوم) تنجح حتى مع الحلقة
 * القديمة، فلا تُثبت شيئاً. المصدر الواقعي للنقص: صفّ سحابي/مشروع محفوظ بمخطط أقدم
 * يصل عبر PersistenceService.load دون المرور بتطبيع الاستيراد.
 */
function juicePartialPayload() {
    return {
        id: '19b3c7d4-0000-4000-8000-000000000001',
        version: '4.0.0',
        projectInfo: { id: 'juice-id', name: 'كشك عصائر (مستورد)', city: 'جدة' },
        marketing: { marketAnalysis: { marketSize: 500000 }, swot: { strengths: 'موقع على الكورنيش' } },
        revenue: { streams: [{ service: 'عصير برتقال', avgPrice: 12, monthlyVolume: 3000 }] },
    };
}

vi.mock('../../services/ProjectManager.js', () => ({
    ProjectManager: {
        importProjectBackup: vi.fn(async () => ({ success: true, id: 'juice-id' })),
        loadProject: vi.fn(async () => ({ data: juicePartialPayload() })),
    },
}));

const { DecisionDashboard } = await import('../DecisionDashboard.js');
const { store } = await import('../../core/store.js');

/** «مطعم الريف»: الدراسة المفتوحة قبل الاستيراد، ببصمات نصية في أماكن متفرقة */
function riyfStudy() {
    const s = createEmptyStudy();
    s.id = 'riyf-root-id';
    s.projectInfo.id = 'riyf-id';
    s.projectInfo.name = 'مطعم الريف';
    s.projectInfo.city = 'الرياض';
    s.marketing.competitorBenchmarking = [{ criterion: 'السعر', notes: 'الريف أرخص' }];
    s.marketing.towsMatrix.so = 'توسّع فروع الريف بالرياض';
    s.hr.positions = [{ title: 'طبّاخ الريف', salary: 5000 }];
    return s;
}

/** كل القيم النصية داخل كائن، مسطَّحة — لكشف بقايا الدراسة الأولى أينما اختبأت */
function allStrings(value, out = []) {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(v => allStrings(v, out));
    return out;
}

function isCharIndexedObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length > 0
        && Object.keys(value).every(k => /^\d+$/.test(k));
}

/** FileReader مزيّف: يستدعي onload فوراً ويكشف الوعد كي ينتظره الاختبار */
let lastReader = null;
class FakeFileReader {
    readAsText() {
        lastReader = this;
        this.pending = this.onload({ target: { result: '{"app":"qarar"}' } });
    }
}

async function runImportHandler() {
    document.body.innerHTML = '<div id="dd"><input type="file" id="btnImportBackup" /></div>';
    const container = document.getElementById('dd');
    const input = container.querySelector('#btnImportBackup');
    Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File(['{"app":"qarar"}'], 'qarar_backup.json', { type: 'application/json' })],
    });

    // نتجاوز المُنشئ (يبحث عن الحاوية بالمعرّف) ونحقن ما يلمسه bindEvents فقط
    const dd = Object.create(DecisionDashboard.prototype);
    dd.container = container;
    dd.store = store;
    dd.onNavigate = null;
    dd._eventListeners = [];
    dd.render = vi.fn();

    dd.bindEvents({ projectInfo: {} }, null);
    input.dispatchEvent(new Event('change'));
    await lastReader.pending;
    return dd;
}

describe('استعادة دراسة من لوحة القرار: استبدال كامل بلا أثر من الدراسة السابقة', () => {
    beforeEach(() => {
        vi.stubGlobal('FileReader', FakeFileReader);
        lastReader = null;
        memoryStorage.clear();
        if (store._localSaveTimeout) clearTimeout(store._localSaveTimeout);
        vi.spyOn(store, 'saveLocal').mockResolvedValue();
        store.state = riyfStudy();
        store._undoStack = [];
        store._redoStack = [];
    });

    it('لا تبقى أي بصمة نصية من «مطعم الريف» بعد استيراد «كشك عصائر»', async () => {
        await runImportHandler();

        expect(store.state.projectInfo.name).toBe('كشك عصائر (مستورد)');
        expect(store.state.projectInfo.city).toBe('جدة');

        const leaks = allStrings(store.state).filter(s => s.includes('الريف'));
        expect(leaks, `بقايا من «مطعم الريف» داخل «كشك عصائر»: ${JSON.stringify(leaks)}`).toEqual([]);
    });

    it('الحمولة الناقصة لا تترك الحالة بلا أقسام (المخطط يُكمَّل من الافتراضي لا من الدراسة السابقة)', async () => {
        await runImportHandler();

        expect(store.state.hr?.positions, 'قسم hr غائب كلياً عن الحمولة — يجب أن يعود فارغاً من المخطط').toEqual([]);
        expect(store.state.marketing.competitorBenchmarking).toEqual([]);
        expect(store.state.marketing.towsMatrix.so).toBe('');
        expect(store.state.technical).toBeDefined();
        // ...ومع ذلك ما ذكرته الحمولة يصل كما هو
        expect(store.state.revenue.streams).toEqual([{ service: 'عصير برتقال', avgPrice: 12, monthlyVolume: 3000 }]);
    });

    it('المفاتيح الجذرية البدائية تصل نصوصاً لا كائنات مفهرسة بالأحرف', async () => {
        await runImportHandler();

        expect(isCharIndexedObject(store.state.id), `id: ${JSON.stringify(store.state.id)}`).toBe(false);
        expect(isCharIndexedObject(store.state.version), `version: ${JSON.stringify(store.state.version)}`).toBe(false);
        expect(store.state.id).toBe('19b3c7d4-0000-4000-8000-000000000001');
        expect(store.state.version).toBe('4.0.0');
    });

    it('الاستعادة تسجَّل خطوة تراجع واحدة (لا خطوة لكل مفتاح) وتُشعر المشتركين', async () => {
        const seen = [];
        const unsubscribe = store.subscribe((state) => seen.push(state.projectInfo.name));
        await runImportHandler();
        unsubscribe();

        expect(store._undoStack.length).toBe(1);
        expect(store._undoStack[0].projectInfo.name).toBe('مطعم الريف');
        expect(seen).toContain('كشك عصائر (مستورد)');
    });
});

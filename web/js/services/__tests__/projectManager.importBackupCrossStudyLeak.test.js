/**
 * استيراد نسخة احتياطية «ناقصة المفاتيح» كان يخلط دراستين — الجزء المتبقّي بعد
 * إصلاح ليلة 2026-08-26 (الذي عالج الأقسام الغائبة كلياً فقط).
 *
 * السيناريو الحقيقي (أعاد إنتاجه مُدقِّق مستقل): «مطعم الريف» مفتوحة في المخزن،
 * والعميل يستورد نسخة «كشك عصائر» صُدِّرت قبل توسّع المخطط — فيها قسم marketing
 * **حاضر جزئياً**: ينقصه competitorBenchmarking و towsMatrix و environmentalRisks
 * (مفاتيح موسومة New Phase 3/4 في schema.js). النشر السطحي
 * `{ ...createEmptyStudy(), ...data }` يأخذ القسم كما هو من الملف، ثم حلقة
 * DecisionDashboard.js:830 تمرّره إلى store.update ⟶ updateSection تدمج سطحياً
 * ⟶ مفاتيح «الريف» تبقى داخل قسم «كشك عصائر».
 *
 * لماذا اختبار جديد بدل توسيع projectManager.importBackupValidation.test.js:
 * ذاك يؤكّد على **الحمولة المحفوظة** فقط ولا يشغّل الحلقة على دراسة مفتوحة —
 * فيبقى أخضر والعيب حيّ. هنا نشغّل الحلقة نفسها حرفياً على مخزن حقيقي.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('window', { addEventListener: () => { }, dispatchEvent: () => { } });

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
vi.mock('../../utils/monitoring.js', () => ({
    monitoring: { captureException: vi.fn(), addBreadcrumb: vi.fn() },
}));
vi.mock('../DataBridge.js', () => ({
    DataBridge: { syncServicesToRevenue: vi.fn(() => null) },
}));
vi.mock('../WebhookService.js', () => ({ WebhookService: { triggerEvent: vi.fn() } }));

// مخزن مشاريع في الذاكرة: يجعل loadProject يُعيد ما كتبه saveProject فعلاً،
// فتمرّ الحلقة على الحمولة الحقيقية لا على كائن مُلفَّق في الاختبار.
const projects = new Map();
vi.mock('../PersistenceService.js', () => ({
    PersistenceService: {
        save: vi.fn(async (id, data) => { projects.set(id, JSON.parse(JSON.stringify(data))); return { success: true, location: 'local' }; }),
        load: vi.fn(async (id) => (projects.has(id) ? { data: projects.get(id), source: 'local' } : null)),
        listHeaders: vi.fn(async () => []),
        delete: vi.fn(async () => ({ success: true })),
    },
}));

const { ProjectManager } = await import('../ProjectManager.js');
const { store } = await import('../../core/store.js');
const { createEmptyStudy } = await import('../../core/schema.js');

/** كل القيم النصية داخل كائن، مسطَّحة — لكشف أي بقايا من الدراسة الأولى أينما اختبأت */
function allStrings(value, out = []) {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(v => allStrings(v, out));
    return out;
}

/** بصمة التلف: سلسلة نصية فُكِّكت إلى كائن مفهرس بالأحرف {"0":"1","1":"9",...} */
function isCharIndexedObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).length > 0
        && Object.keys(value).every(k => /^\d+$/.test(k));
}

/** «مطعم الريف»: الدراسة المفتوحة، ببيانات في مفاتيح New Phase 3/4 تحديداً */
function riyfStudy() {
    const s = createEmptyStudy();
    s.projectInfo.id = 'riyf-id';
    s.projectInfo.name = 'مطعم الريف';
    s.projectInfo.city = 'الرياض';
    s.marketing.competitorBenchmarking = [{ criterion: 'السعر', myRank: 1, comp1Rank: 3, notes: 'الريف أرخص' }];
    s.marketing.towsMatrix.so = 'توسّع فروع الريف بالرياض';
    s.marketing.environmentalRisks = [{ factor: 'رفع الدعم عن الوقود', impact: 'High' }];
    s.marketing.marketSurveyResults = [{ question: 'الطبق المفضل', answer: 'كبسة الريف', percentage: 64 }];
    return s;
}

/**
 * نسخة «كشك عصائر» كما تُصدَّر من إصدار أقدم من المخطط: marketing حاضر لكن
 * تنقصه مفاتيح New Phase 3/4 — وهي بالضبط الحالة التي سمّاها البلاغ الأصلي.
 */
function juiceBackupJson() {
    return JSON.stringify({
        app: 'qarar',
        formatVersion: 1,
        exportedAt: '2026-01-01T00:00:00.000Z',
        data: {
            id: '19b3c7d4-0000-4000-8000-000000000001',
            version: '4.0.0',
            createdAt: '2026-01-01T00:00:00.000Z',
            projectInfo: { id: 'juice-id', name: 'كشك عصائر', city: 'جدة' },
            marketing: {
                marketAnalysis: { marketSize: 500000, growthRate: 0.05 },
                competitors: [{ name: 'عصير الصباح' }],
                swot: { strengths: 'موقع على الكورنيش' },
                // لا competitorBenchmarking ولا towsMatrix ولا environmentalRisks
                // ولا marketSurveyResults — الملف أقدم من هذه المفاتيح.
            },
            revenue: { streams: [{ service: 'عصير برتقال', avgPrice: 12, monthlyVolume: 3000 }] },
            hr: { positions: [] },
            technical: { equipment: [] },
        },
    });
}

describe('استيراد نسخة ناقصة المفاتيح لا يخلط دراستين (سيناريو المُدقِّق كاملاً)', () => {
    beforeEach(() => {
        projects.clear();
        memoryStorage.clear();
        store.state = riyfStudy();
    });

    it('حلقة DecisionDashboard على دراسة مفتوحة: لا يبقى أي مفتاح من «مطعم الريف»', async () => {
        const result = await ProjectManager.importProjectBackup(juiceBackupJson());
        expect(result.success).toBe(true);

        // حلقة web/js/ui/DecisionDashboard.js:830 حرفياً
        const loaded = await ProjectManager.loadProject(result.id);
        expect(loaded?.data).toBeTruthy();
        Object.entries(loaded.data).forEach(([key, value]) => {
            store.update(key, value, true);
        });

        // الدراسة المعروضة صارت «كشك عصائر» في جدة
        expect(store.state.projectInfo.name).toBe('كشك عصائر (مستورد)');
        expect(store.state.projectInfo.city).toBe('جدة');

        // ...ولا تحمل مقارنة منافسي «الريف» ولا استراتيجيته ولا مخاطره
        expect(store.state.marketing.competitorBenchmarking).toEqual([]);
        expect(store.state.marketing.towsMatrix.so).toBe('');
        expect(store.state.marketing.environmentalRisks).toEqual([]);
        expect(store.state.marketing.marketSurveyResults).toEqual([]);

        // ومسح شامل: لا بقايا نصية من الدراسة الأولى في أي عمق
        const leaks = allStrings(store.state).filter(s => s.includes('الريف'));
        expect(leaks, `بقايا من «مطعم الريف» داخل «كشك عصائر»: ${JSON.stringify(leaks)}`).toEqual([]);
    });

    it('القيم البدائية (id/version) تُستبدل كاملةً ولا تصير كائناً مفهرساً بالأحرف', async () => {
        const result = await ProjectManager.importProjectBackup(juiceBackupJson());
        expect(result.success).toBe(true);

        const saved = await ProjectManager.loadProject(result.id);
        // الحمولة المحفوظة: الدمج مع المخطط يجب ألا يفكّك نصاً إلى أحرف
        expect(isCharIndexedObject(saved.data.id), `id تحوّل إلى كائن أحرف: ${JSON.stringify(saved.data.id)}`).toBe(false);
        expect(isCharIndexedObject(saved.data.version), `version تحوّل إلى كائن أحرف: ${JSON.stringify(saved.data.version)}`).toBe(false);
        expect(typeof saved.data.id).toBe('string');
        expect(saved.data.version).toBe('4.0.0');
        expect(typeof saved.data.createdAt).toBe('string');
    });
});

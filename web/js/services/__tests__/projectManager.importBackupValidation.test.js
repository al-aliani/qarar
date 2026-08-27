/**
 * استيراد نسخة احتياطية كان يقبل أي ملف JSON كنجاح، ويترك الأقسام الغائبة عنه
 * تحمل أرقام الدراسة المفتوحة قبله (مسح ليلة 2026-08-26).
 *
 * السيناريو الحقيقي: العميل فاتحٌ «مطعم الريف» على لوحة القرار، ويختار بالخطأ ملف
 * JSON آخر من مجلد التنزيلات. الفحص الوحيد كان `typeof data === 'object'` ⟶ يُحفَظ
 * كدراسة باسم «… (مستورد)»، ثم يمرّ المستدعي (DecisionDashboard) على مفاتيح الملف
 * فقط بـstore.update — وupdateSection تدمج دمجاً سطحياً ولا تلمس الأقسام الغائبة،
 * فتخرج دراسة تحمل revenue/technical/hr الخاصة بـ«مطعم الريف» وتُصدَّر لاحقاً كملف مدفوع.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// importProjectBackup يستعير store._deepMerge للتطبيع على المخطط، فيسحب وحدة
// المخزن وتبعاتها (window/تخزين/مراقبة) غير المتوفّرة في بيئة node.
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

const saveMock = vi.fn(async () => ({ success: true, location: 'local' }));
vi.mock('../PersistenceService.js', () => ({
    PersistenceService: {
        save: (...a) => saveMock(...a),
        load: vi.fn(async () => ({ data: null, source: null })),
        listHeaders: vi.fn(async () => []),
    },
}));
vi.mock('../WebhookService.js', () => ({ WebhookService: { triggerEvent: vi.fn() } }));

const { ProjectManager } = await import('../ProjectManager.js');
const { createEmptyStudy, SECTIONS } = await import('../../core/schema.js');

const savedPayload = () => saveMock.mock.calls[0][1];

describe('ProjectManager.importProjectBackup — لا يُقبل إلا ملف «قرار»', () => {
    beforeEach(() => {
        saveMock.mockClear();
    });

    it('ملف JSON عشوائي من مجلد التنزيلات يُرفَض برسالة صريحة ولا يُحفَظ إطلاقاً', async () => {
        const randomFile = JSON.stringify({
            name: 'my-app', version: '1.0.0',
            dependencies: { react: '^18.0.0' },
            scripts: { build: 'vite build' }
        });

        const result = await ProjectManager.importProjectBackup(randomFile);

        expect(result.success).toBe(false);
        expect(result.error).toContain('ليس نسخة احتياطية من «قرار»');
        expect(saveMock).not.toHaveBeenCalled();
    });

    it('مصفوفة JSON تُرفَض (كانت تمرّ لأن typeof [] === object)', async () => {
        const result = await ProjectManager.importProjectBackup('[{"projectInfo":{"name":"x"}}]');

        expect(result.success).toBe(false);
        expect(saveMock).not.toHaveBeenCalled();
    });

    it('ملف «قرار» ناقص الأقسام يُحفَظ بكل أقسام المخطط حاضرة (لا مكان لتسرّب دراسة سابقة)', async () => {
        // نسخة قديمة صُدِّرت قبل توسّع المخطط: تحمل projectInfo وثلاثة أقسام فقط
        const legacyPartial = JSON.stringify({
            projectInfo: { name: 'مخبز الحي', city: 'جدة' },
            marketing: { budget: 25000 },
            legal: { licenses: [{ name: 'رخصة بلدية', cost: 15000 }] },
            assumptions: { discountRate: 0.12 },
        });

        const result = await ProjectManager.importProjectBackup(legacyPartial);

        expect(result.success).toBe(true);
        const saved = savedPayload();
        // الأقسام التي غابت عن الملف حاضرة بقيم المخطط الافتراضية، لا بأرقام دراسة أخرى
        for (const section of Object.values(SECTIONS)) {
            expect(saved[section], `القسم ${section} غائب عن المستورَد`).toBeDefined();
        }
        expect(saved.revenue).toEqual(createEmptyStudy().revenue);
        expect(saved.hr).toEqual(createEmptyStudy().hr);
        expect(saved.technical).toEqual(createEmptyStudy().technical);
        // وما جاء في الملف يبقى كما هو
        expect(saved.marketing.budget).toBe(25000);
        expect(saved.projectInfo.name).toBe('مخبز الحي (مستورد)');
    });

    it('ملف مصدَّر من قرار (مغلّف app: qarar) يُقبل ويُستعاد كاملاً بمعرّف جديد', async () => {
        const study = createEmptyStudy();
        study.projectInfo.id = 'original-id';
        study.projectInfo.name = 'مطعم الريف';
        study.revenue.streams = [{ service: 'وجبات', avgPrice: 45, monthlyVolume: 1800 }];
        study.hr.positions = [{ id: 1, title: 'طباخ', count: 3, salary: 5000 }];

        vi.spyOn(ProjectManager, 'loadProject').mockResolvedValue({ data: study, source: 'local' });
        const exported = await ProjectManager.exportProjectBackup('original-id');
        vi.restoreAllMocks();

        expect(JSON.parse(exported.json).app).toBe('qarar');

        const result = await ProjectManager.importProjectBackup(exported.json);

        expect(result.success).toBe(true);
        const saved = savedPayload();
        expect(saved.revenue.streams).toEqual([{ service: 'وجبات', avgPrice: 45, monthlyVolume: 1800 }]);
        expect(saved.hr.positions).toHaveLength(1);
        expect(saved.projectInfo.name).toBe('مطعم الريف (مستورد)');
        expect(saved.projectInfo.id).not.toBe('original-id');
    });

    it('نسخة خام قديمة (بلا مغلّف) لدراسة قرار كاملة ما زالت تُقبل', async () => {
        const study = createEmptyStudy();
        study.projectInfo.name = 'مصنع تعبئة';
        study.revenue.streams = [{ service: 'تعبئة', avgPrice: 12, monthlyVolume: 40000 }];

        const result = await ProjectManager.importProjectBackup(JSON.stringify(study));

        expect(result.success).toBe(true);
        expect(savedPayload().revenue.streams[0].service).toBe('تعبئة');
    });

    it('ملف غير JSON إطلاقاً يُرفَض برسالة القراءة كما كان', async () => {
        const result = await ProjectManager.importProjectBackup('<html>not json</html>');

        expect(result.success).toBe(false);
        expect(result.error).toContain('تعذر قراءة الملف');
        expect(saveMock).not.toHaveBeenCalled();
    });
});

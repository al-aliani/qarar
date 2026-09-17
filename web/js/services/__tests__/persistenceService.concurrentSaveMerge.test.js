/**
 * @vitest-environment jsdom
 *
 * تدقيق شامل 2026-09-16 (دمج تعديل متزامن): تعديل فعلي متزامن لنفس الدراسة من
 * جهازين/تبويبين — حفظ لاحق كان يكتب فوق سابق صامتاً بالكامل عبر upsert غير
 * مشروط، فيُفقَد أي قسم عدّله الطرف الآخر منذ آخر مزامنة معروفة لهذا الجهاز، حتى
 * لو كان في قسم مختلف تماماً لا علاقة له بما يحفظه هذا الجهاز الآن. الإصلاح: قراءة
 * النسخة السحابية الحالية قبل كل كتابة، ودمج ثلاثي على مستوى القسم الأعلى (base =
 * آخر لقطة سحابية معروفة لهذا الجهاز، محدَّثة عند كل قراءة/كتابة ناجحة).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let remoteRow;
const maybeSingleMock = vi.fn(async () => ({ data: remoteRow ? { data: remoteRow } : null, error: null }));
const upsertMock = vi.fn(async () => ({ error: null }));
const fromMock = vi.fn(() => ({
    select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock, single: async () => ({ data: remoteRow ? { data: remoteRow, updated_at: '2026-09-16T00:00:00Z' } : null, error: remoteRow ? null : new Error('no rows') }) }) }),
    upsert: upsertMock,
}));
const supabaseMock = { from: fromMock };

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ supabase: supabaseMock, ok: true, error: '' })),
    getAuthUser: vi.fn(async () => ({ user: { id: 'user-1' }, ok: true, error: '' })),
}));

import { PersistenceService } from '../PersistenceService.js';

describe('PersistenceService._saveCloud — دمج ثلاثي عند تعارض تعديل متزامن', () => {
    beforeEach(() => {
        maybeSingleMock.mockClear();
        upsertMock.mockClear();
        fromMock.mockClear();
        remoteRow = null;
    });

    it('لا نسخة سحابية سابقة (دراسة جديدة): يكتب local كما هي بلا أي دمج', async () => {
        const local = { projectInfo: { name: 'جديدة' }, revenue: { streams: [] } };
        const saved = await PersistenceService._saveCloud('study-new', local, 'user-1');
        expect(saved).toEqual(local);
        expect(upsertMock).toHaveBeenCalledTimes(1);
    });

    it('السحابة مطابقة لما نعرفه (لا تغيّر من طرف آخر): يكتب local كما هي', async () => {
        // أول قراءة (_loadCloudWithMeta المُستدعاة ضمنياً عبر load سابق) تملأ الكاش —
        // نحاكيها هنا مباشرة عبر _saveCloud أولى ثم ثانية بنفس المحتوى.
        remoteRow = { projectInfo: { name: 'قائمة' }, technical: { equipment: [] } };
        await PersistenceService._saveCloud('study-same', remoteRow, 'user-1'); // يملأ الكاش

        const local = { ...remoteRow, projectInfo: { name: 'تعديل محلي فقط' } };
        remoteRow = local; // لا أحد غيّر شيئاً في السحابة منذ الحفظ الأول
        const saved = await PersistenceService._saveCloud('study-same', local, 'user-1');
        expect(saved).toEqual(local);
    });

    it('[الحالة الحرجة] تعديل جهاز آخر لقسم مختلف تماماً: يُدمَج لا يُفقَد', async () => {
        const base = { projectInfo: { name: 'دراسة' }, technical: { equipment: [] }, hr: { positions: [] } };
        remoteRow = base;
        await PersistenceService._saveCloud('study-conflict', base, 'user-1'); // يثبّت base في الكاش

        // هذا الجهاز يعدّل hr فقط
        const localEdit = { ...base, hr: { positions: [{ position: 'مدير' }] } };
        // بينما جهاز آخر عدّل technical فقط ووصل للسحابة أولاً
        remoteRow = { ...base, technical: { equipment: [{ name: 'معدات' }] } };

        const saved = await PersistenceService._saveCloud('study-conflict', localEdit, 'user-1');

        // كلا التعديلين محفوظان معاً — لا أحد فقد تعديله
        expect(saved.hr.positions).toEqual([{ position: 'مدير' }]);
        expect(saved.technical.equipment).toEqual([{ name: 'معدات' }]);
        expect(saved.projectInfo).toEqual(base.projectInfo);

        // والقيمة الفعلية المكتوبة سحابياً (upsert) هي المدموجة، لا localEdit وحدها
        const upsertedRow = upsertMock.mock.calls.at(-1)[0];
        expect(upsertedRow.data.technical.equipment).toEqual([{ name: 'معدات' }]);
    });

    it('تعارض حقيقي (نفس القسم تغيّر على الطرفين معاً): يُبقي نسخة الجهاز الحافظ الآن، لا يفشل', async () => {
        const base = { projectInfo: { name: 'أ' } };
        remoteRow = base;
        await PersistenceService._saveCloud('study-realconflict', base, 'user-1');

        const localEdit = { projectInfo: { name: 'تعديل محلي' } };
        remoteRow = { projectInfo: { name: 'تعديل بعيد مختلف' } };

        const saved = await PersistenceService._saveCloud('study-realconflict', localEdit, 'user-1');
        expect(saved.projectInfo.name).toBe('تعديل محلي');
    });

    it('فشل القراءة التمهيدية (شبكة) لا يمنع الحفظ — يتراجع لكتابة local كما هي', async () => {
        maybeSingleMock.mockRejectedValueOnce(new Error('network down'));
        const local = { projectInfo: { name: 'حفظ رغم فشل القراءة' } };
        const saved = await PersistenceService._saveCloud('study-readfail', local, 'user-1');
        expect(saved).toEqual(local);
        expect(upsertMock).toHaveBeenCalledTimes(1);
    });
});

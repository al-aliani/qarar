/**
 * دفعة 6 — تصليب أمني (Security Hardening) دفاعي إلى جانب RLS (لا بديل عنه):
 *
 * FIX A: PersistenceService._saveCloud كانت ترفع أي `data` كما هي بعد _sanitize فقط
 * (بلا فحص حجم/شكل) إلى عمود JSONB. الآن تُرفض قبل الرفع: بيانات ليست كائناً عادياً،
 * أو حمولة تتجاوز 5MB نصياً (أكبر بكثير من أي دراسة جدوى حقيقية).
 *
 * FIX D: InternalAIGenerator.generateFieldSuggestion كانت تسقط صامتاً لقالب الوصف
 * العام (templates.description) لأي مفتاح حقل غير مطابق — الآن تُحذّر عبر console.warn
 * حتى يلاحظ المطوّر الذي يضيف حقلاً جديداً أنه بلا قالب مخصص.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const upsertMock = vi.fn(async () => ({ error: null }));
const fromMock = vi.fn(() => ({ upsert: upsertMock }));
const supabaseMock = { from: fromMock };

vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ supabase: supabaseMock, ok: true, error: '' })),
    getAuthUser: vi.fn(async () => ({ user: { id: 'user-1' }, ok: true, error: '' })),
}));

import { PersistenceService } from '../PersistenceService.js';
import { generateFieldSuggestion } from '../InternalAIGenerator.js';

describe('FIX A — PersistenceService._saveCloud: حارس خفيف قبل الرفع السحابي', () => {
    beforeEach(() => {
        upsertMock.mockClear();
        fromMock.mockClear();
    });

    it('يرفض بيانات ليست كائناً (مصفوفة) قبل استدعاء upsert', async () => {
        await expect(PersistenceService._saveCloud('id1', ['not', 'an', 'object'], 'user-1')).rejects.toThrow();
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('يرفض null قبل استدعاء upsert', async () => {
        await expect(PersistenceService._saveCloud('id1', null, 'user-1')).rejects.toThrow();
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('يرفض نصاً بدل كائن قبل استدعاء upsert', async () => {
        await expect(PersistenceService._saveCloud('id1', 'plain string', 'user-1')).rejects.toThrow();
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('يرفض حمولة تتجاوز 5MB نصياً قبل استدعاء upsert', async () => {
        const bigData = { projectInfo: { name: 'مشروع' }, blob: 'x'.repeat(6 * 1024 * 1024) };
        await expect(PersistenceService._saveCloud('id1', bigData, 'user-1')).rejects.toThrow(/يتجاوز الحد الأقصى/);
        expect(upsertMock).not.toHaveBeenCalled();
    });

    it('يمرّر بيانات طبيعية الحجم فعلياً إلى upsert (لا يكسر المسار السليم)', async () => {
        const data = { projectInfo: { name: 'مشروع صغير طبيعي' } };
        await expect(PersistenceService._saveCloud('id1', data, 'user-1')).resolves.toBeUndefined();
        expect(upsertMock).toHaveBeenCalledTimes(1);
        expect(fromMock).toHaveBeenCalledWith('studies');
    });
});

describe('FIX D — generateFieldSuggestion: تحذير عند مفتاح حقل غير مطابق', () => {
    let warnSpy;
    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        warnSpy.mockRestore();
    });

    it('يحذّر ويستخدم القالب العام حين لا يوجد قالب مطابق للمفتاح', () => {
        const result = generateFieldSuggestion('some.totally-unknown-field-key', '', { projectInfo: { name: 'م' } });
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('some.totally-unknown-field-key'.split('.').pop());
        expect(result).toContain('م'); // نفس قالب description الافتراضي يحمل اسم المشروع
    });

    it('لا يحذّر لمفتاح معروف فعلياً (description)', () => {
        generateFieldSuggestion('description', '', { projectInfo: { name: 'م' } });
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('لا يحذّر لمفتاح معروف آخر (trends)', () => {
        generateFieldSuggestion('marketing.marketAnalysis.trends', '', { projectInfo: { name: 'م' } });
        expect(warnSpy).not.toHaveBeenCalled();
    });
});

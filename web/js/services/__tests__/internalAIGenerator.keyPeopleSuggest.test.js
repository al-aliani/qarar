/**
 * تدقيق 2026-07-09 (اختبار عميل حي: دراسة مقهى): schema.js يعلن للجدول keyPeople
 * aiPrompt: 'suggest_key_people'، لكن لا يوجد أي معالج لهذا النوع في AIConnector.js ولا
 * دالة generateKeyPeople في InternalAIGenerator.js — زر "اقتراح بنود" كان يرجع بصمت بلا
 * أي صف جديد وبلا أي رسالة خطأ للمستخدم. الإصلاح: سقالة (scaffold) لا تختلق اسم/خبرة شخص
 * حقيقي — name فارغ عمداً، والحقول الأخرى نص إرشادي بين قوسين.
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPeople } from '../InternalAIGenerator.js';

describe('generateKeyPeople — سقالة بلا اختلاق هوية (#suggest_key_people)', () => {
    it('يرجع صفاً واحداً على الأقل، والاسم فارغ عمداً (لا اختلاق هوية شخص حقيقي)', () => {
        const rows = generateKeyPeople({ projectInfo: { concept: 'كافيه/مقهى مختص' } });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0].name).toBe('');
    });

    it('الدور الافتراضي هو المؤسس/المدير العام عند غياب بيانات الموارد البشرية', () => {
        const rows = generateKeyPeople({ projectInfo: {} });
        expect(rows[0].role).toContain('المؤسس');
    });

    it('يستخدم منصب المدير الفعلي من hr.positions إن وُجد بدل النص الافتراضي', () => {
        const rows = generateKeyPeople({
            projectInfo: {},
            hr: { positions: [{ position: 'مدير/مديرة فرع', count: 1 }] }
        });
        expect(rows[0].role).toBe('مدير/مديرة فرع');
    });

    it('حقول الخبرة والمؤهلات نص إرشادي بين قوسين (وليس بيانات مختلقة محددة)', () => {
        const rows = generateKeyPeople({ projectInfo: {} });
        expect(rows[0].experience).toMatch(/^\[.*\]$/);
        expect(rows[0].qualifications).toMatch(/^\[.*\]$/);
    });
});

/**
 * تدقيق 2026-07-09 (اختبار عميل حي: دراسة مقهى): schema.js يعلن للجدول keyPeople
 * aiPrompt: 'suggest_key_people'، لكن لا يوجد أي معالج لهذا النوع في AIConnector.js ولا
 * دالة generateKeyPeople في InternalAIGenerator.js — زر "اقتراح بنود" كان يرجع بصمت بلا
 * أي صف جديد وبلا أي رسالة خطأ للمستخدم. الإصلاح: سقالة (scaffold) لا تختلق اسم/خبرة شخص
 * حقيقي — كل الحقول فارغة عمداً.
 *
 * تحديث 2026-07-12 (اختبار قبول حي): كانت الحقول الإرشادية (experience/qualifications)
 * تحمل نص «[اذكر...]» بين قوسين كـvalue فعلية — أي نقرة تحرير عادية بلا تحديد الكل تُدرج
 * كتابة المستخدم في منتصف النص فيُنتج محتوى مشوَّهاً (مُثبَت حياً). الإرشاد انتقل إلى
 * placeholder حقيقي في مخطط keyPeople (schema.js)، والحقول نفسها صارت فارغة تماماً.
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPeople } from '../InternalAIGenerator.js';
import { TABLE_SCHEMAS } from '../../core/schema.js';

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

    it('حقلا الخبرة والمؤهلات فارغان تماماً (بلا نص مُختلَق ولا نص إرشادي مكتوب كقيمة)', () => {
        const rows = generateKeyPeople({ projectInfo: {} });
        expect(rows[0].experience).toBe('');
        expect(rows[0].qualifications).toBe('');
    });

    it('الإرشاد حول المطلوب توثيقه ينتقل إلى placeholder حقيقي في مخطط الجدول، لا كقيمة قابلة للتشويه', () => {
        const cols = TABLE_SCHEMAS.keyPeople.columns;
        const experienceCol = cols.find(c => c.key === 'experience');
        const qualificationsCol = cols.find(c => c.key === 'qualifications');
        expect(experienceCol.placeholder).toBeTruthy();
        expect(qualificationsCol.placeholder).toBeTruthy();
    });
});

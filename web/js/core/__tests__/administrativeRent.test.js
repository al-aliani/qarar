/**
 * تدقيق 2026-07-08 (ملاحظة حرجة، خبير المحتوى): لا حقل مستقل لإيجار موقع المطعم،
 * وشرح خطوة «الموارد الإدارية» كان يصفها بـ"إيجار مكتب" فقط — يوحي بعدم الانطباق على
 * صالة/مطبخ المطعم نفسه فيُغفَل أهم بند تكلفة ثابتة. هذا يثبّت الإصلاح: نص واضح +
 * صف افتراضي ظاهر (بلا رقم مُختلَق) يجعل الإيجار أول ما يُطلب إدخاله.
 */
import { describe, it, expect } from 'vitest';
import { createEmptyStudy, SECTIONS } from '../schema.js';
import { STEP_HELP, STEPS } from '../wizardSteps.js';

describe('حقل إيجار المحل — لا يُغفَل بعد الآن', () => {
    it('createEmptyStudy يتضمن صف إيجار افتراضياً ظاهراً بتكلفة صفر (لا رقم مُختلَق)', () => {
        const study = createEmptyStudy();
        const rows = study[SECTIONS.ADMINISTRATIVE].administrative;
        const rentRow = rows.find(r => r.name.includes('إيجار المحل'));
        expect(rentRow).toBeTruthy();
        expect(rentRow.monthly).toBe(0);
    });

    it('شرح خطوة الموارد الإدارية يذكر إيجار موقع المطعم صراحة، لا "إيجار مكتب" فقط', () => {
        const idx = STEPS.findIndex(s => s.id === SECTIONS.ADMINISTRATIVE);
        expect(idx).toBeGreaterThan(-1);
        const help = STEP_HELP[idx];
        expect(help.why).toMatch(/إيجار موقع مطعمك|إيجار المطعم/);
        expect(help.why).not.toMatch(/إيجار مكتب/);
    });
});

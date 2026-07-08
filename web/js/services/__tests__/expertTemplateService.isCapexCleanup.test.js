/**
 * تدقيق 2026-07-08 (ملاحظة منخفضة #64): حقل isCapex في بنود تراخيص قوالب الخبراء
 * كان غير معرَّف كعمود وغير مقروء إطلاقاً في أي مكان بمحرك الحسابات (كل بنود
 * licenses تُحتسَب رأسمالياً بلا شرط أصلاً في engine.js) — بيانات ميتة تُوحي بتمييز
 * غير موجود فعلياً. حُذف من القوالب التي كانت تحمله.
 */
import { describe, it, expect } from 'vitest';
import { EXPERT_TEMPLATE_PRESETS } from '../ExpertTemplateService.js';

describe('ExpertTemplateService — لا حقل isCapex ميت في أي قالب (#64)', () => {
    it('لا يوجد أي بند ترخيص في أي قالب خبير يحمل حقل isCapex', () => {
        EXPERT_TEMPLATE_PRESETS.forEach(preset => {
            const study = preset.buildData();
            const licenses = study.legal?.licenses || [];
            licenses.forEach(item => {
                expect(item).not.toHaveProperty('isCapex');
            });
        });
    });
});

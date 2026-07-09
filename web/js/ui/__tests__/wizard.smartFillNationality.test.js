/**
 * تدقيق 2026-07-09 (اختبار عميل حي: دراسة مقهى): زر "🪄 اقتراح الهيكل والرواتب"
 * (SMART_FILL_HANDLERS.staffing) كان يُسقط حقل nationality الذي يُرجعه
 * DataService.recommendStaffing بالفعل عبر تحويل .map() يدوي ناقص — فتُحسب GOSI
 * دائماً بمعدل الوافد (2%) حتى لموظفين سعوديين، ولوحة نطاقات/التوطين في خطوة
 * «الهيكل التنظيمي» تعرض 0% بصمت رغم توطين فعلي مرتفع في جدول الرواتب نفسه —
 * تناقض داخلي مباشر بين شاشتين تقرآن نفس البيانات.
 */
import { describe, it, expect } from 'vitest';
import { SMART_FILL_HANDLERS } from '../Wizard.js';

describe('SMART_FILL_HANDLERS.staffing يحافظ على nationality (#nitaqat-nationality-loss)', () => {
    it('مقهى: كل صف مقترح يتضمن nationality (لا يُسقط بصمت)', () => {
        const state = { projectInfo: { concept: 'كافيه/مقهى مختص', areaSize: 120 } };
        const rows = SMART_FILL_HANDLERS.staffing(state);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(r => r.nationality === 'saudi' || r.nationality === 'expat')).toBe(true);
    });

    it('مقهى: أغلب المناصب سعودية (باريستا/مدير/كاشير) — لا تُحسب نطاقات 0% زوراً', () => {
        const state = { projectInfo: { concept: 'كافيه/مقهى مختص', areaSize: 120 } };
        const rows = SMART_FILL_HANDLERS.staffing(state);
        const saudiCount = rows.filter(r => r.nationality === 'saudi').length;
        expect(saudiCount).toBeGreaterThan(0);
    });
});

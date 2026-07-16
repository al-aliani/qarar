import { describe, it, expect } from 'vitest';
import { buildActivityDate, buildIcsCalendar } from '../icsExport.js';

describe('buildActivityDate', () => {
    it('يحسب تاريخ الشهر 1 كتاريخ بداية المشروع نفسه', () => {
        const d = buildActivityDate('2026-01-15', 1);
        expect(d.getUTCFullYear()).toBe(2026);
        expect(d.getUTCMonth()).toBe(0);
        expect(d.getUTCDate()).toBe(15);
    });

    it('يحسب تاريخ الشهر 4 بإضافة 3 أشهر لتاريخ البداية', () => {
        const d = buildActivityDate('2026-01-15', 4);
        expect(d.getUTCMonth()).toBe(3);
    });

    it('يُرجع null عند غياب/تعذّر تفسير تاريخ البداية', () => {
        expect(buildActivityDate(null, 1)).toBe(null);
        expect(buildActivityDate('ليس تاريخاً', 1)).toBe(null);
    });
});

describe('buildIcsCalendar', () => {
    it('يبني تقويماً صالحاً يحوي حدثاً واحداً لكل نشاط له تاريخ قابل للتفسير', () => {
        const ics = buildIcsCalendar(
            [{ id: 1, name: 'التراخيص', startMonth: 1, duration: 2 }],
            '2026-01-01'
        );
        expect(ics).toContain('BEGIN:VCALENDAR');
        expect(ics).toContain('BEGIN:VEVENT');
        expect(ics).toContain('SUMMARY:التراخيص');
        expect(ics).toContain('DTSTART;VALUE=DATE:20260101');
        expect(ics).toContain('END:VCALENDAR');
    });

    it('يستبعد أنشطة بلا تاريخ بداية قابل للتفسير بصمت (بلا رمي)', () => {
        const ics = buildIcsCalendar([{ id: 1, name: 'نشاط' }], null);
        expect(() => ics).not.toThrow();
        expect(ics).not.toContain('BEGIN:VEVENT');
    });

    it('يهرب الفاصلة والفاصلة المنقوطة (ASCII) في النص لتفادي كسر تنسيق ICS', () => {
        const ics = buildIcsCalendar([{ id: 1, name: 'ترخيص, بلدية; إدارية', startMonth: 1 }], '2026-01-01');
        expect(ics).toContain('SUMMARY:ترخيص\\, بلدية\\; إدارية');
    });
});

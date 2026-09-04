/**
 * تدقيق 2026-09-04 — رحلة عميل حقيقية (صالون حلاقة رجالي):
 *
 * أول شاشة بعد «دراسة جديدة» تعرض أربعة قوالب: مطعم/مقهى، تطبيق إلكتروني، متجر
 * تجزئة، مكتب خدمات/استشارات. لا شيء منها يخدم أي نشاط عناية شخصية. أقربها اسماً
 * «مكتب خدمات» — وهو ترخيص مهني وأثاث مكتبي وأجهزة حاسب، لا يشبه صالوناً يحتاج
 * كراسي حلاقة ومغاسل ومعقّمات وسخانات مياه وترخيصاً بلدياً وشهادات صحية.
 *
 * فالعميل إما يختار قالباً مضلِّلاً فيبدأ بأرقام لا تخصّه، أو يبدأ من الصفر —
 * وزر «ابدأ بمشروع فارغ» هو أصغر عنصر في الشاشة.
 *
 * ملاحظة على التغطية: القالب يملأ logistics بقيم غير صفرية عمداً. ترك المرافق
 * والمستهلكات صفراً هو السبب المباشر الموثّق لنمط «عائد داخلي خيالي» في هذا
 * المستودع — وهو ما حاول تدقيق 28 أغسطس علاجه بخفض عتبة المعقولية (وتراجعنا عنه
 * اليوم لأنه عالج العَرَض لا السبب).
 */
import { describe, it, expect } from 'vitest';
import { TemplateGallery } from '../TemplateGallery.js';
import { detectSectorBenchmark, SECTOR_BENCHMARKS } from '../../core/sectorBenchmarks.js';

function templates() {
    return TemplateGallery.prototype.getTemplates.call({});
}

describe('القوالب الذكية: تغطية العناية الشخصية', () => {
    it('يوجد قالب لنشاط عناية شخصية (صالون/مركز)', () => {
        const t = templates().find(x => x.id === 'personal_care');
        expect(t, 'لا قالب للعناية الشخصية').toBeTruthy();
        expect(t.name).toMatch(/صالون|عناية/);
    });

    it('نشاط القالب يُكتشف قطاعاً خدمياً — لا تجزئة عالية الهامش', () => {
        const t = templates().find(x => x.id === 'personal_care');
        const bench = detectSectorBenchmark(t.data.projectInfo.concept);
        expect(bench?.label).toBe(SECTOR_BENCHMARKS.service.label);
    });

    it('يبدأ بمعدات صالون حقيقية لا أثاث مكتبي', () => {
        const t = templates().find(x => x.id === 'personal_care');
        const names = t.data.technical.equipment.map(e => e.name).join(' | ');
        expect(names).toMatch(/كرسي|كراسي/);
        expect(names).toMatch(/مغاسل|مغسلة/);
        expect(names).not.toMatch(/أثاث مكتبي|أجهزة حاسب/);
    });

    it('يبدأ بمرافق ومستهلكات غير صفرية — تركها صفراً يُنتج عائداً خيالياً', () => {
        const t = templates().find(x => x.id === 'personal_care');
        const rows = t.data.logistics?.logistics || [];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(r => Number(r.monthly) > 0)).toBe(true);
    });

    it('طاقمه حلاقون لا «موظف تنفيذي» عام', () => {
        const t = templates().find(x => x.id === 'personal_care');
        const positions = t.data.hr.positions.map(p => p.position).join(' | ');
        expect(positions).toMatch(/حلاق|مصفف/);
    });

    it('لا انحدار: القوالب الأربعة السابقة ما زالت موجودة', () => {
        const ids = templates().map(t => t.id);
        for (const id of ['empty', 'fb', 'tech', 'retail', 'services']) {
            expect(ids, `القالب ${id} اختفى`).toContain(id);
        }
        expect(ids.length).toBeGreaterThanOrEqual(6);
    });
});

/**
 * تدقيق 2026-09-04 — رحلة عميل حقيقية (صالون حلاقة رجالي، ٦ كراسي):
 *
 * ضغطت «🪄 اقتراح الهيكل والرواتب» فأعطاني:
 *     مدير مشروع (سعودي) 6,000 · محاسب (سعودي) 4,000 · «موظف/عامل» (وافد) ×4 بـ3,000
 * ثم ضغطت «اقتراح بنود» على **نفس الجدول** فأضاف فوقها (لا استبدلها):
 *     مدير/مديرة المشروع (سعودي) 7,450 · موظف تنفيذي (وافد) ×2 بـ4,000
 * النتيجة على الشاشة: ٩ موظفين لصالون بستة كراسي، فيهم مديران براتبين مختلفين
 * ومحاسب — وصفر حلاقين.
 *
 * السبب: زرّان على نفس الجدول بمولّدين مختلفين. الأول (smartFill) كان يستدعي
 * DataService.recommendStaffing — فروعه مقهى/مخبز/مطبخ سحابي/ضيافة/SaaS فقط
 * والاحتياطي حرفياً 'cafe'. الثاني (aiPrompt) يستدعي generatePositions الواعي
 * بالقطاع — لكن نمط isService فيه كان /استشار|خدمي|صالة|رياض/ و«صالون» لا يطابق
 * «صالة» (حرف مختلف)، فيسقط هو الآخر على الاحتياطي العام.
 *
 * العلاج نفس ما فُعل للتراخيص في تدقيق 2026-07-08: مصدر واحد واعٍ بالقطاع للزرّين.
 */
import { describe, it, expect } from 'vitest';
import { SMART_FILL_HANDLERS } from '../Wizard.js';
import { InternalAIGenerator } from '../../services/InternalAIGenerator.js';

const salonState = {
    projectInfo: { name: 'صالون النخبة', concept: 'صالون / مركز تجميل', city: 'الرياض', areaSize: 180 },
};

describe('اقتراح الرواتب: مصدر واحد واعٍ بالقطاع للزرّين', () => {
    it('زر smartFill يعطي نفس ناتج المولّد الواعي بالقطاع — لا هيكلاً مختلفاً', () => {
        const viaButton = SMART_FILL_HANDLERS.staffing(salonState).map(p => p.position);
        const viaGenerator = InternalAIGenerator.generatePositions(salonState).map(p => p.position);
        expect(viaButton).toEqual(viaGenerator);
    });

    it('لا يقترح «محاسب» ولا «موظف/عامل» عاماً لصالون حلاقة', () => {
        const positions = SMART_FILL_HANDLERS.staffing(salonState).map(p => p.position);
        expect(positions.join(' | ')).not.toMatch(/محاسب/);
        expect(positions.join(' | ')).not.toMatch(/موظف\/عامل/);
    });

    it('لا يوجد منصبان إداريان متكرران في نفس الاقتراح', () => {
        const positions = SMART_FILL_HANDLERS.staffing(salonState).map(p => p.position);
        const managers = positions.filter(p => /مدير/.test(p));
        expect(managers.length, `مناصب إدارية: ${managers.join(', ')}`).toBeLessThanOrEqual(1);
    });

    it('يحافظ على الجنسية — إسقاطها يحسب التأمينات بمعدل الوافد ويُظهر توطيناً صفرياً', () => {
        const rows = SMART_FILL_HANDLERS.staffing(salonState);
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
            expect(['saudi', 'expat']).toContain(r.nationality);
            expect(Number(r.salary)).toBeGreaterThan(0);
            expect(Number(r.count)).toBeGreaterThan(0);
        }
    });

    it('يقترح فريق صالون حقيقي: حلاقون وأخصائي عناية واستقبال', () => {
        const positions = SMART_FILL_HANDLERS.staffing(salonState).map(p => p.position).join(' | ');
        expect(positions).toMatch(/حلاق/);
        expect(positions).toMatch(/عناية|بشرة/);
        expect(positions).toMatch(/استقبال/);
    });

    it('الصالون والصيانة والمغسلة تُكتشف خدمية لا تسقط على الاحتياطي العام', () => {
        const generic = InternalAIGenerator
            .generatePositions({ projectInfo: { concept: 'نشاط غير معروف إطلاقاً', city: 'الرياض' } })
            .map(p => p.position).join(' | ');
        for (const concept of ['صالون / مركز تجميل', 'صيانة وتنظيف', 'مغسلة ملابس']) {
            const positions = InternalAIGenerator
                .generatePositions({ projectInfo: { concept, city: 'الرياض' } })
                .map(p => p.position).join(' | ');
            expect(positions, concept).not.toBe(generic);
        }
    });

    it('لا انحدار: المقهى ما زال يحصل على طاقم مقهى', () => {
        const positions = SMART_FILL_HANDLERS
            .staffing({ projectInfo: { concept: 'كافيه/مقهى مختص', city: 'الرياض', areaSize: 120 } })
            .map(p => p.position).join(' | ');
        expect(positions).toMatch(/باريستا/);
    });
});

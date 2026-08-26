/**
 * فهرس «دراسات جدوى جاهزة» يحمل عدّادات معروضة للزائر (عدد كل وسم وكل تصنيف).
 * المولّد `scripts/generate_ready_studies_catalog.py` يشتقّها من الدراسات المُصدَّرة
 * فعلياً — لكن المكتبة نُظّفت يدوياً (456 ⟶ 301) بحذف دراسات من المصفوفة مباشرةً،
 * فحُدِّثت عدّادات التصنيفات ونُسيت عدّادات الوسوم.
 *
 * قياس 2026-08-26 قبل الإصلاح: 32 من 35 وسماً بعدّاد خاطئ («دراسة موسعة» يقول 445
 * والمكتبة كلها 301)، ووسم «ترفيه» يَعِد بدراسات ويُعطي «لا توجد نتائج» لأن صفر
 * دراسة تحمله.
 *
 * الحارس يثبّت الثابت لا القيم: كل عدّاد معروض = ما تحويه البيانات فعلاً.
 * فيبقى صالحاً بعد أي إضافة أو حذف لاحق، ويلتقط أي تحرير يدوي ينسى العدّادات.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const catalogPath = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/ready-studies.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

describe('فهرس الدراسات الجاهزة — العدّادات المعروضة تطابق البيانات', () => {
    it('عدّاد كل وسم يساوي عدد الدراسات التي تحمله فعلاً', () => {
        const actual = new Map();
        for (const s of catalog.studies) {
            for (const t of (s.tags || [])) actual.set(t, (actual.get(t) || 0) + 1);
        }
        const wrong = catalog.tags
            .filter((t) => t.count !== (actual.get(t.label) || 0))
            .map((t) => `${t.label}: يقول ${t.count} والفعلي ${actual.get(t.label) || 0}`);
        expect(wrong, `عدّادات وسوم لا تطابق البيانات:\n  ${wrong.join('\n  ')}`).toEqual([]);
    });

    it('لا وسم معروض بصفر دراسة — الضغط عليه يعطي «لا توجد نتائج»', () => {
        const used = new Set(catalog.studies.flatMap((s) => s.tags || []));
        const orphans = catalog.tags.filter((t) => !used.has(t.label)).map((t) => t.label);
        expect(orphans, `وسوم تَعِد بنتائج ولا تُعطيها: ${orphans.join('، ')}`).toEqual([]);
    });

    it('عدّاد كل تصنيف يساوي عدد دراساته، و total يساوي طول المصفوفة', () => {
        const wrong = catalog.categories
            .filter((c) => c.count !== catalog.studies.filter((s) => s.category === c.id).length)
            .map((c) => `${c.label}: يقول ${c.count} والفعلي ${catalog.studies.filter((s) => s.category === c.id).length}`);
        expect(wrong, `عدّادات تصنيفات لا تطابق البيانات:\n  ${wrong.join('\n  ')}`).toEqual([]);
        expect(catalog.total).toBe(catalog.studies.length);
    });

    it('كل دراسة معروضة لها وسم واحد على الأقل ورابط ملف', () => {
        const broken = catalog.studies
            .filter((s) => !(s.tags || []).length || !s.url)
            .map((s) => s.title);
        expect(broken, `دراسات بلا وسوم أو بلا رابط: ${broken.slice(0, 5).join('، ')}`).toEqual([]);
    });
});

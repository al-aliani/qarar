import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCityData, getTAMSuggestion } from '../SaudiDemographicsService.js';
import demographicsJson from '../../../data/SaudiDemographics.json';

// نتأكد أن التوليد المحلي (FALLBACK) يُستخدم — لا شبكة
beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))));
});

describe('توحيد مصدر السكان (تدقيق 2026-07-08)', () => {
    it('مسار fallback (بلا شبكة) يعيد بالضبط أرقام web/data/SaudiDemographics.json — لا نسخة يدوية منفصلة', async () => {
        // كان FALLBACK_DATA المكتوب يدوياً يختلف عن هذا الملف بنسبة 19-25% لجدة ومكة —
        // الآن كلاهما نفس الاستيراد، فلا يمكن أن ينحرفا بعضهما عن بعض مستقبلاً.
        const jeddah = await getCityData('جدة');
        expect(jeddah.population).toBe(demographicsJson.cities['جدة'].population);
        const makkah = await getCityData('مكة المكرمة');
        expect(makkah.population).toBe(demographicsJson.cities['مكة المكرمة'].population);
    });
});

describe('SaudiDemographicsService — صدق المصدر (provenance)', () => {
    it('getCityData: يفصل مصدر السكان (رسمي) عن مصدر الدخل (تقديري)', async () => {
        const c = await getCityData('الرياض');
        expect(c).toBeTruthy();
        expect(c.population).toBeGreaterThan(0);
        // السكان من GASTAT
        expect(c.populationSource).toMatch(/GASTAT|الإحصاء/);
        // الدخل تقديري صراحةً — لا يُوسم كمصدر رسمي
        expect(c.incomeSource).toMatch(/تقدير|ASSUMPTION/);
        // لم يعد هناك حقل source موحّد يوهم بأن كل شيء من GASTAT
        expect(c.source).toBeUndefined();
    });

    it('getTAMSuggestion: يعلن الدخل ونِسب الاستهلاك كتقدير لا كرقم رسمي', async () => {
        const t = await getTAMSuggestion('الرياض', 'مطعم');
        expect(t.tam).toBeGreaterThan(0);
        expect(t.incomeIsAssumption).toBe(true);
        expect(t.sectorShareIsAssumption).toBe(true);
        // الوصف يذكر «تقديري» للدخل ولا يدّعي أن الدخل من مصدر رسمي
        expect(t.description).toMatch(/تقديري/);
        // sourceLabel يفصل بوضوح
        expect(t.sourceLabel).toMatch(/تقديرية|ASSUMPTION/);
        // source الأساسي يخص السكان فقط
        expect(t.source).toMatch(/GASTAT|الإحصاء/);
    });
});

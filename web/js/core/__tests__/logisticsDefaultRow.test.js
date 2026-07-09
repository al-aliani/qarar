/**
 * تدقيق 2026-07-09: خطوة «الموارد اللوجستية» في createEmptyStudy كانت تبدأ فارغة تماماً
 * (مصفوفة logistics بلا أي صف، فقط تعليق كمثال) بخلاف ADMINISTRATIVE المجاورة التي حصلت
 * سابقاً على صف افتراضي ظاهر («إيجار المحل»، monthly:0). مستخدم مبتدئ يفتح هذه الخطوة
 * يرى جدولاً فارغاً بلا أي فكرة عمّا يُتوقع إدخاله (توصيل/نقل مبرّد لمطعم)، فقد يتخطاها
 * بالكامل ظناً منه أنها لا تنطبق على مشروعه. هذا يثبّت الإصلاح: صف افتراضي واحد ظاهر
 * بتكلفة صفر (لا رقم مُختلَق يُحقن صامتاً في المحرك) يجعل البند أول ما يُطلب إدخاله.
 */
import { describe, it, expect } from 'vitest';
import { createEmptyStudy, SECTIONS } from '../schema.js';
import { calculateStudy } from '../engine.js';

describe('صف افتراضي ظاهر في خطوة الموارد اللوجستية — لا تبدأ فارغة بلا فكرة', () => {
    it('createEmptyStudy يتضمن صف توصيل/نقل افتراضياً ظاهراً بتكلفة صفر (لا رقم مُختلَق)', () => {
        const study = createEmptyStudy();
        const rows = study[SECTIONS.LOGISTICS].logistics;
        expect(Array.isArray(rows)).toBe(true);
        // هذا هو صلب الإصلاح: قبل الإصلاح كانت rows.length === 0 دائماً.
        expect(rows.length).toBeGreaterThan(0);

        const deliveryRow = rows.find(r => /توصيل|نقل/.test(r.name));
        expect(deliveryRow).toBeTruthy();
        expect(deliveryRow.monthly).toBe(0); // لا تكلفة صامتة تُحقن على المستخدم
        expect(typeof deliveryRow.variablePercent).toBe('number');
    });

    it('الصف الافتراضي (monthly:0) لا يُغيّر أي رقم مالي في calculateStudy مقارنة بمصفوفة فارغة', () => {
        // يضمن أن الإصلاح لا يحقن تكلفة صامتة ولا يكسر calculateStudy — مصدر الحقيقة المالي الوحيد.
        const studyWithDefault = createEmptyStudy();
        const resultWithDefault = calculateStudy(studyWithDefault);

        const studyEmptyLogistics = createEmptyStudy();
        studyEmptyLogistics[SECTIONS.LOGISTICS].logistics = [];
        const resultEmpty = calculateStudy(studyEmptyLogistics);

        expect(resultWithDefault.summary?.npv ?? resultWithDefault.npv)
            .toBe(resultEmpty.summary?.npv ?? resultEmpty.npv);
    });
});

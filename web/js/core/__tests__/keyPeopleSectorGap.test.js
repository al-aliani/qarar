import { describe, it, expect } from 'vitest';
import { detectKeyPeopleSectorGap } from '../keyPeopleSectorGap.js';

function makeState({ sector, keyPeople = [] } = {}) {
    return {
        projectInfo: { sector },
        keyPeople: { keyPeople }
    };
}

describe('detectKeyPeopleSectorGap', () => {
    it('يعيد null حين يتعذّر اكتشاف قطاع المشروع (لا تخمين)', () => {
        const state = makeState({ sector: 'نشاط غير مصنّف تماماً' });
        expect(detectKeyPeopleSectorGap(state, [{ id: '1', expertName: 'خالد', specialty: 'مطاعم' }])).toBeNull();
    });

    it('يعيد null حين يوجد عضو في الفريق بخبرة مطابقة لقطاع المشروع', () => {
        const state = makeState({
            sector: 'مطعم شعبي',
            keyPeople: [{ name: 'أحمد', role: 'مدير', experience: '10 سنوات خبرة في إدارة المطاعم والمقاهي', qualifications: '' }]
        });
        expect(detectKeyPeopleSectorGap(state, [{ id: '1', expertName: 'خالد', specialty: 'مطاعم' }])).toBeNull();
    });

    it('يعيد null حين لا يوجد خبراء مسجّلون بنفس القطاع (سجل فارغ أو غير مطابق)', () => {
        const state = makeState({ sector: 'مطعم شعبي', keyPeople: [{ name: 'أحمد', role: 'مؤسس', experience: '', qualifications: '' }] });
        expect(detectKeyPeopleSectorGap(state, [])).toBeNull();
        expect(detectKeyPeopleSectorGap(state, [{ id: '1', expertName: 'سارة', specialty: 'تطوير برمجي' }])).toBeNull();
    });

    it('يعيد بطاقة الاقتراح حين لا يوجد خبرة قطاعية في الفريق ويوجد خبراء مطابقون', () => {
        const state = makeState({ sector: 'مطعم شعبي', keyPeople: [{ name: 'أحمد', role: 'مؤسس', experience: 'خبرة إدارية عامة', qualifications: '' }] });
        const templates = [
            { id: '1', expertName: 'خالد المطاعمي', specialty: 'استشارات مطاعم ومقاهي' },
            { id: '2', expertName: 'سارة', specialty: 'تطوير برمجي' }
        ];
        const gap = detectKeyPeopleSectorGap(state, templates);
        expect(gap).not.toBeNull();
        expect(gap.sectorLabel).toBe('مطاعم ومقاهي');
        expect(gap.experts).toEqual([{ id: '1', name: 'خالد المطاعمي', specialty: 'استشارات مطاعم ومقاهي' }]);
    });

    it('لا يرمي مع keyPeople/templates غير معرّفة (بلا خبراء مسجّلين → null)', () => {
        expect(detectKeyPeopleSectorGap({ projectInfo: { sector: 'مطعم' } })).toBeNull();
        expect(detectKeyPeopleSectorGap({})).toBeNull();
    });
});

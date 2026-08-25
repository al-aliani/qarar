/**
 * @vitest-environment jsdom
 *
 * انحدار 2026-08-26: إصلاح PersistenceService.listHeaders جعل فشل جلب القائمة
 * السحابية يرمي (بدل إرجاع قائمة فارغة كاذبة) — لكن المسار
 * StudyComparison.render ⟶ DataService.getAvailableStudiesForComparison
 * ⟶ ProjectManager.getAllProjects بقي بلا حراسة، فكان الاستثناء يصعد من
 * render() ويترك حاوية «مقارنة الدراسات» فارغة تماماً (innerHTML === "").
 *
 * ما أعاد المُدقِّق إنتاجه (جهاز بلا دراسات محلية + فشل السحابة):
 *   [StudyComparison.render] رمى = "تعذّر الوصول إلى دراساتك السحابية — تحقق من الاتصال وأعد المحاولة"
 *   [StudyComparison.render] محتوى الحاوية بعدها = ""
 *
 * الثابت المطلوب هنا ليس «الدالة لا ترمي» بل «المستخدم يرى رسالة»: حاوية فارغة
 * بلا استثناء ليست إصلاحاً.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StudyComparison } from '../StudyComparison.js';

vi.mock('../../services/DataService.js', () => ({
    DataService: {
        getAvailableStudiesForComparison: vi.fn(),
        compareStudies: vi.fn(),
    },
}));

import { DataService } from '../../services/DataService.js';

const CLOUD_ERROR = 'تعذّر الوصول إلى دراساتك السحابية — تحقق من الاتصال وأعد المحاولة';

function fakeStore(state = {}) {
    return { get: () => state };
}

describe('StudyComparison — فشل جلب قائمة الدراسات السحابية', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="comparisonContainer"></div>';
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    it('يعرض رسالة صادقة بدل حاوية فارغة، ولا يُصعّد الاستثناء لمستدعيه', async () => {
        DataService.getAvailableStudiesForComparison.mockRejectedValue(new Error(CLOUD_ERROR));

        const view = new StudyComparison('comparisonContainer', fakeStore({ projectInfo: { id: 'current' } }));
        await expect(view.render()).resolves.toBeUndefined();

        const container = document.getElementById('comparisonContainer');
        expect(container.innerHTML).not.toBe('');
        expect(container.querySelector('#comparisonListError')).not.toBeNull();
        expect(container.textContent).toContain(CLOUD_ERROR);
        // لا نكذب بقائمة منسدلة «فارغة» توحي بأنه لا دراسات لديه
        expect(container.querySelector('#compareStudySelect')).toBeNull();
    });

    it('زر «إعادة المحاولة» يعيد الجلب ويعرض القائمة عند عودة الاتصال', async () => {
        DataService.getAvailableStudiesForComparison
            .mockRejectedValueOnce(new Error(CLOUD_ERROR))
            .mockResolvedValueOnce([{ id: 's1', name: 'مخبز الحي', date: '2026-08-01' }]);

        const view = new StudyComparison('comparisonContainer', fakeStore({ projectInfo: { id: 'current' } }));
        await view.render();

        const retry = document.getElementById('btnRetryComparisonList');
        expect(retry).not.toBeNull();
        retry.click();
        await new Promise((r) => setTimeout(r, 0));

        expect(document.getElementById('comparisonListError')).toBeNull();
        expect(document.querySelector('#compareStudySelect option[value="s1"]').textContent).toContain('مخبز الحي');
    });
});

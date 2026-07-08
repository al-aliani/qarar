/**
 * @vitest-environment jsdom
 *
 * دفعة 4: OrgStructure.js كان يعرّف مُهرِّب HTML محلياً وناقصاً (لا يهرّب > أو ')
 * داخل renderAdvisoryBoard فقط، بينما بقية حقول النص الحر في الملف (اسم/مسؤول/
 * مسؤوليات القسم، خيار القسم الأب، عقدة المخطط الشجري كمحتوى HTML لا كسمة فقط،
 * اسم/لجان عضو مجلس الإدارة، مسؤول الالتزام، خطة السعودة) لم تكن تُهرَّب إطلاقاً.
 *
 * ملاحظة منهجية: سياق سمة القيمة (value="...") وسياق محتوى HTML (content) هما
 * سياقا حقن مختلفان فعلياً. الحمولة البسيطة "<img src=x onerror=alert(1)>" (بلا
 * علامة اقتباس) تُحقن بأمان داخل قيمة سمة مقتبَسة (لا ينتهي تحليل السمة عند < أو >)
 * سواء هُرِّبت أم لا — لذلك لا تصلح لاختبار سياق السمة. الحمولة التي تختبر سياق
 * السمة فعلياً تحتاج علامة اقتباس للهروب من السمة: '"><img src=x onerror=alert(N)>'.
 * لذلك نستخدم هذه الحمولة (مع اقتباس) لحقل اسم القسم/عضو المجلس (سياق سمة) وهي
 * تختبر أيضاً سياق المحتوى (المخطط الشجري) بنفس الفعالية. القياس الحاسم في كل
 * الحالات هو: لا يوجد عنصر <img> حقيقي انبثق فعلياً في شجرة الـDOM.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OrgStructure } from '../OrgStructure.js';

// حمولة اختراق سمة (breakout): بدون تهريب تُغلق السمة وتُدرج <img> حقيقياً في الـDOM.
// بها أيضاً تختبر سياق المحتوى (المخطط الشجري) حيث "<img ...>" وحده كافٍ للحقن.
const XSS_DEPT = '"><img src=x onerror=alert(1)>';
const XSS_BOARD = '"><img src=x onerror=alert(2)>';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {}, notify: () => {} };
}

describe('OrgStructure — تهريب النصوص الحرة + aria-label لأزرار الحذف', () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        container = document.getElementById('c');
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    function buildState() {
        return {
            orgStructure: {
                departments: [
                    { id: 'd1', name: XSS_DEPT, parentId: null, head: 'مدير عام', responsibilities: 'الإشراف' }
                ],
                boardOfDirectors: [
                    { name: XSS_BOARD, position: 'member', share: 10, independent: false, committees: 'لجنة المراجعة' }
                ],
                advisoryBoard: [
                    { name: 'مستشار عادي', role: 'خبير تطوير أعمال' }
                ],
                governance: {},
                saudization: {},
                operationalKpis: []
            },
            hr: { positions: [] },
            projectInfo: {}
        };
    }

    it('لا ينبثق عنصر <img> حقيقي في الـDOM عبر جدول الأقسام (سياق سمة) ولا عبر المخطط الشجري (سياق محتوى)', () => {
        const store = fakeStore(buildState());
        const view = new OrgStructure('c', store, () => {});
        view.render(0);

        // القياس الحاسم لأي سياق حقن: لا عنصر <img> حقيقي انبثق في شجرة الـDOM كلها
        expect(container.querySelectorAll('img').length).toBe(0);

        // جدول الأقسام (سياق سمة value="") — الحقل بقي محتوى نصياً آمناً داخل السمة
        const deptInput = container.querySelector('.dept-field[data-field="name"]');
        expect(deptInput).toBeTruthy();
        expect(deptInput.value).toBe(XSS_DEPT);
        expect(container.querySelector('.departments-table').querySelectorAll('img').length).toBe(0);

        // المخطط الشجري — اسم القسم يُرسم كمحتوى HTML وليس فقط داخل سمة
        const tree = container.querySelector('.org-chart');
        expect(tree).toBeTruthy();
        expect(tree.querySelectorAll('img').length).toBe(0);
        // إثبات أن التهريب فعلياً حدث (وليس فقط غياباً عرَضياً): تسلسل الهروب لعلامة < ظاهر
        expect(tree.innerHTML).toContain('&lt;img');
        expect(tree.innerHTML).not.toContain('<img src=x onerror=alert(1)>');
    });

    it('لا ينبثق عنصر <img> حقيقي في الـDOM عبر جدول مجلس الإدارة (اسم العضو، سياق سمة)', () => {
        const store = fakeStore(buildState());
        const view = new OrgStructure('c', store, () => {});
        view.render(0);

        const boardInput = container.querySelector('.board-field[data-field="name"]');
        expect(boardInput).toBeTruthy();
        expect(boardInput.value).toBe(XSS_BOARD);
        expect(container.querySelector('.board-container').querySelectorAll('img').length).toBe(0);
        expect(container.querySelectorAll('img').length).toBe(0);
    });

    it('أزرار حذف القسم/المستشار/عضو المجلس تحمل aria-label غير فارغ', () => {
        const store = fakeStore(buildState());
        const view = new OrgStructure('c', store, () => {});
        view.render(0);

        const removeDept = container.querySelector('.btn-remove-dept');
        const removeAdvisory = container.querySelector('.btn-remove-advisory');
        const removeBoard = container.querySelector('.btn-remove-board');

        expect(removeDept).toBeTruthy();
        expect(removeAdvisory).toBeTruthy();
        expect(removeBoard).toBeTruthy();

        [removeDept, removeAdvisory, removeBoard].forEach((btn) => {
            const label = btn.getAttribute('aria-label');
            expect(label).toBeTruthy();
            expect(label.trim().length).toBeGreaterThan(0);
        });
    });
});

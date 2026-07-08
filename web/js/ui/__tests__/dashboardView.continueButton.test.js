/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة حرجة، UX + معماري): زر «تابع من حيث توقفت» كان يظهر
 * لأي زائر جديد بلا مشاريع محفوظة — Number(null)===0 في جافاسكربت، وSTEPS[0] موجود
 * دائماً، فيتحقق شرط الظهور حتى بلا أي بيانات فعلية. الإصلاح: تحقق من وجود المفتاح
 * فعلياً + تطلّب مشروعاً محفوظاً حقيقياً (نفس عدّاد «دراساتك» المعروض بجانبه).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DashboardView } from '../DashboardView.js';

describe('DashboardView — زر تابع من حيث توقفت', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
        localStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('لا يظهر الزر لزائر جديد بلا مشاريع محفوظة حتى مع وجود فهرس خطوة قديم (Number(null)=0 bug)', async () => {
        localStorage.setItem('feas_last_step_index', '0');
        const view = new DashboardView('c', { get: () => ({}), getState: () => ({}) }, () => {});
        await view.renderList([]); // 0 مشاريع — «دراساتك: 0»
        expect(document.getElementById('btnContinueLastStep')).toBeNull();
    });

    it('يظهر الزر فعلياً حين يوجد مشروع محفوظ حقيقي وفهرس خطوة صالح', async () => {
        localStorage.setItem('feas_last_step_index', '2');
        const view = new DashboardView('c', { get: () => ({}), getState: () => ({}) }, () => {});
        await view.renderList([{ id: '1', name: 'مطعمي', updatedAt: new Date().toISOString() }]);
        expect(document.getElementById('btnContinueLastStep')).not.toBeNull();
    });
});

/**
 * @vitest-environment jsdom
 *
 * بند 4 (بانر إصدار المحرك، 2026-08-29): لوحة القرار كانت تُعرض عبر render() بمجرّد
 * زيارة خطوتها في الويزارد بلا أي تنبيه لتغيّر معادلات المحرك — إضافة لنفس المنطق
 * المشترك في utils/engineVersionNotice.js (لا نسخة محلية). يثبّت هذا الملف أيضاً
 * بلوكر «المحو الذاتي»: كانت render() تستدعي store.update('results', ...) العادية
 * لمجرّد تحديث العرض، فتُفعِّل سلسلة الحفظ الكاملة بمجرّد فتح هذه الخطوة.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('gridstack', () => ({ GridStack: { initAll: vi.fn() } }));
vi.mock('../../utils/toast.js', () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../utils/analytics.js', () => ({ trackEvent: vi.fn() }));

const { DecisionDashboard } = await import('../DecisionDashboard.js');
const { createEmptyStudy } = await import('../../core/schema.js');

/** دراسة تجتاز بوابتَي hasMinimumRevenueData/hasMinimumFinancialData بأقل بيانات ممكنة. */
function minimalViableStudy(meta) {
    const s = createEmptyStudy();
    s.projectInfo.name = 'مقهى تجريبي';
    s.revenue.streams = [{ service: 'قهوة', customersPerMonth: 200, avgPrice: 20, type: 'operating' }];
    s.hr.positions = [{ position: 'باريستا', count: 1, salary: 4000, months: 12, nationality: 'saudi' }];
    s._meta = meta;
    return s;
}

function makeStore(state) {
    return { getState: () => state, updateSectionInMemory: vi.fn(), update: vi.fn() };
}

describe('DecisionDashboard — تنبيه تغيّر إصدار المحرك + بلا محو ذاتي لبصمته', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="dd"></div>';
    });

    it('لا بانر ولا استدعاء لـstore.update() حين لا توجد بصمة محفوظة (دراسة جديدة)', async () => {
        const state = minimalViableStudy(undefined);
        const store = makeStore(state);
        const dd = new DecisionDashboard('dd', store, null);
        await dd.render();

        expect(document.getElementById('dd').innerHTML).not.toContain('engine-version-notice');
        expect(store.update).not.toHaveBeenCalled();
    });

    it('[إثبات الحارس] يعرض البانر الحقيقي حين تختلف البصمة المحفوظة، عبر render() الفعلية — لا بديل مصطنع', async () => {
        const state = minimalViableStudy({ engineVersion: 'a-version-that-will-never-match-current' });
        const store = makeStore(state);
        const dd = new DecisionDashboard('dd', store, null);
        await dd.render();

        expect(document.getElementById('dd').innerHTML).toContain('engine-version-notice');
    });

    it('تحديث results عند العرض يستخدم updateSectionInMemory لا update() — لا يُفعِّل سلسلة الحفظ لمجرّد زيارة الخطوة', async () => {
        const state = minimalViableStudy(undefined);
        const store = makeStore(state);
        const dd = new DecisionDashboard('dd', store, null);
        await dd.render();

        expect(store.updateSectionInMemory).toHaveBeenCalledWith('results', expect.any(Object));
        expect(store.update).not.toHaveBeenCalled();
    });
});

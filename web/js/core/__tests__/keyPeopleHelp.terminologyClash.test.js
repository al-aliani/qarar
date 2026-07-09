/**
 * علة مصطلحية (منخفضة، 2026-07-09): شرح خطوة «الأشخاص الرئيسون» (الفريق المؤسس/الشركاء)
 * كان يستخدم كلمة "المناصب" في STEP_HELP[idx].how — نفس الكلمة الحرفية المستخدمة في
 * DecisionDashboard.js وDashboardView.js للدلالة على موظفي الرواتب/التوظيف الفعلي (قسم HR).
 * هذا التقاطع اللفظي يوحي للمستخدم أن خطوة «الأشخاص الرئيسون» هي نفسها خطوة التوظيف،
 * بينما هي فعلياً خطوة منفصلة عن قسم الموارد البشرية (schema SECTIONS.HR / tables staffPositions).
 * هذا الاختبار يثبّت أن نص خطوة الأشخاص الرئيسين تحديداً لم يعد يستخدم "المناصب"،
 * وأن استخدام "المناصب" في سياق التوظيف (DecisionDashboard/DashboardView) يبقى كما هو.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STEP_HELP, STEPS, SECTIONS } from '../wizardSteps.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('التباس مصطلح "المناصب" بين خطوة الأشخاص الرئيسين وخطوة التوظيف', () => {
    it('شرح خطوة «الأشخاص الرئيسون» (KEY_PEOPLE) لا يستخدم كلمة "المناصب" — يتحدث عن الفريق المؤسس/الشركاء لا التوظيف', () => {
        const idx = STEPS.findIndex(s => s.id === SECTIONS.KEY_PEOPLE);
        expect(idx).toBeGreaterThan(-1);
        const help = STEP_HELP[idx];
        expect(help).toBeTruthy();
        // العلة الأصلية: 'أضف المناصب والأسماء وعقود الشراكة إن وُجدت.'
        expect(help.how).not.toMatch(/المناصب/);
        // الإصلاح يجب أن يستبدلها بمصطلح مختص بالفريق المؤسس/الشركاء
        expect(help.how).toMatch(/الفريق المؤسس|الشركاء/);
        expect(help.how).toMatch(/الأسماء/);
        expect(help.how).toMatch(/عقود الشراكة/);
    });

    it('خطوة الرواتب (الموارد البشرية) تبقى تستخدم "منصب" كما هي — لم تتأثر بإصلاح خطوة الأشخاص الرئيسين', () => {
        const payrollHelp = STEP_HELP.find(h => h && /الرواتب من أكبر التكاليف/.test(h.why || ''));
        expect(payrollHelp).toBeTruthy();
        expect(payrollHelp.how).toMatch(/منصب/);
    });

    it('استخدامات "المناصب" الخاصة بالتوظيف الفعلي في DecisionDashboard.js وDashboardView.js لم تتغيّر (لا تزال بمعنى HR/رواتب)', () => {
        const decisionDashboardPath = join(__dirname, '..', '..', 'ui', 'DecisionDashboard.js');
        const dashboardViewPath = join(__dirname, '..', '..', 'ui', 'DashboardView.js');
        const decisionDashboardSrc = readFileSync(decisionDashboardPath, 'utf8');
        const dashboardViewSrc = readFileSync(dashboardViewPath, 'utf8');

        expect(decisionDashboardSrc).toMatch(/أضف المناصب الوظيفية والرواتب/);
        expect(dashboardViewSrc).toMatch(/المناصب والرواتب/);
    });
});

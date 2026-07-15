import { describe, expect, it } from 'vitest';
import { createEmptyStudy } from '../schema.js';
import { startFullStudyFromQuick } from '../quickFeasibilityProject.js';

function createStoreWithState(state) {
    return {
        state,
        async reset() {
            this.state = createEmptyStudy();
        },
        getState() {
            return this.state;
        },
        update(section, data) {
            this.state[section] = { ...this.state[section], ...data };
        }
    };
}

describe('startFullStudyFromQuick', () => {
    it('creates a new study instead of overwriting the active study', async () => {
        const activeStudy = createEmptyStudy();
        activeStudy.projectInfo.name = 'المشروع الحالي';
        activeStudy.financing.totalInvestment = 987654;
        const previousId = activeStudy.id;
        const store = createStoreWithState(activeStudy);

        await startFullStudyFromQuick(store, {
            projectName: 'مشروع الجدوى السريعة',
            sector: 'نشاط جديد',
            city: 'جدة',
            generated: {
                execSummary: 'ملخص جديد',
                market: 'سوق جديد',
                competitors: [{ name: 'منافس جديد' }],
                risks: [{ title: 'خطر جديد' }]
            }
        });

        expect(store.getState().id).not.toBe(previousId);
        expect(store.getState().projectInfo.name).toBe('مشروع الجدوى السريعة');
        expect(store.getState().projectInfo.concept).toBe('نشاط جديد');
        expect(store.getState().projectInfo.city).toBe('جدة');
        expect(store.getState().financing.totalInvestment).not.toBe(987654);
        expect(store.getState().executiveSummary.projectOverview).toBe('ملخص جديد');
        expect(store.getState().marketing.marketAnalysis.summary).toBe('سوق جديد');
        expect(store.getState().marketing.competitors).toEqual([{ name: 'منافس جديد' }]);
        expect(store.getState().riskAnalysis.risks).toEqual([{ title: 'خطر جديد' }]);
    });

    it('uses the display sector label when quick mode passes stable engine keys', async () => {
        const store = createStoreWithState(createEmptyStudy());

        await startFullStudyFromQuick(store, {
            projectName: 'مشروع سريع',
            sector: 'restaurant',
            sectorLabel: 'مطعم / مقهى',
            city: 'سبت العلايا'
        });

        expect(store.getState().projectInfo.concept).toBe('مطعم / مقهى');
        expect(store.getState().projectInfo.concept).not.toBe('restaurant');
        expect(store.getState().projectInfo.city).toBe('سبت العلايا');
    });
});

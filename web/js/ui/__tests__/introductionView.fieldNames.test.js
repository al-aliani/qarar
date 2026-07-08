/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة حرجة، منهجية IFC/UNIDO): خطوة «تفاصيل الفكرة» [3] وخطوة
 * «مقدمة الجدوى الموحدة» [5] كانتا تحرّران نفس products/introServices بأسماء حقول
 * متضاربة (uniqueCharacteristics/uniqueFeatures، addedValue/valueAdded،
 * supportive/supporting) — فيمسح IntroductionView.collectProducts() صامتاً أي حقل
 * أُدخل عبر جدول خطوة 3 بمجرد زيارة خطوة 5 وحفظها.
 */
import { describe, it, expect } from 'vitest';
import { IntroductionView } from '../IntroductionView.js';
import { TABLE_SCHEMAS, createEmptyStudy } from '../../core/schema.js';

function fakeStore(state) {
    return { getState: () => state, get: () => state, update: () => {} };
}

describe('IntroductionView — أسماء حقول موحّدة مع TABLE_SCHEMAS (لا فقدان بيانات صامت)', () => {
    it('collectProducts يستخدم بالضبط مفاتيح TABLE_SCHEMAS.products.columns', () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const state = createEmptyStudy();
        state.projectInfo.products = [{ type: 'final', name: 'قهوة مختصة', description: 'وصف', uniqueFeatures: 'تحميص محلي', valueAdded: 'جودة عالية', customerBenefit: 'طعم مميز' }];
        const view = new IntroductionView('c', fakeStore(state), () => {});
        view.render(0);

        const collected = view.collectProducts();
        expect(collected).toHaveLength(1);
        const schemaKeys = TABLE_SCHEMAS.products.columns.map(c => c.key).sort();
        expect(Object.keys(collected[0]).sort()).toEqual(schemaKeys);
        // القيمة المُدخلة فعلياً (لا تُفقد) تظهر في القيمة المُجمَّعة من DOM
        expect(collected[0].uniqueFeatures).toBe('تحميص محلي');
        expect(collected[0].valueAdded).toBe('جودة عالية');
    });

    it('collectServices يستخدم "supporting" (لا "supportive") مطابقاً لخيارات TABLE_SCHEMAS.introServices', () => {
        document.body.innerHTML = `<div id="c"></div>`;
        const state = createEmptyStudy();
        state.projectInfo.introServices = [{ name: 'تركيب', type: 'supporting', description: 'خدمة تركيب مجانية' }];
        const view = new IntroductionView('c', fakeStore(state), () => {});
        view.render(0);

        const collected = view.collectServices();
        expect(collected[0].type).toBe('supporting');
        const validTypes = TABLE_SCHEMAS.introServices.columns.find(c => c.key === 'type').options.map(o => o.value);
        expect(validTypes).toContain(collected[0].type);
    });
});

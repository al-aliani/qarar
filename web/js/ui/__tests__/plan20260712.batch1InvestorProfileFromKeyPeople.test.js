/**
 * @vitest-environment jsdom
 *
 * خطة الاستفادة من تقرير محل الخضار (2026-07-12) — دفعة 1، بند 1.3:
 * «بيانات المالك: من «الأشخاص الرئيسيين» إلى «نبذة المستثمر»».
 *
 * الموضع الفعلي (بحث Grep، لم يكن مُمسوحاً سابقاً): AppendicesView.js («الأدلة
 * والمرفقات») — textarea#appendices-investorProfile (appendices.investorProfile)،
 * ومصدر البيانات keyPeople.keyPeople[0] (name/role/experience/qualifications).
 *
 * يثبّت هذا الملف:
 * 1) بلا أي شخص رئيسي: زر التوليد يُظهر توجيهاً بدل الفشل الصامت أو الكتابة الفارغة.
 * 2) حقل فارغ: يُعبَّأ من أول شخص رئيسي (اسم/دور/خبرة/مؤهلات) بلا أي تأكيد مطلوب.
 * 3) حقل يحوي نصاً بالفعل: يتطلب تأكيداً صريحاً (confirm) قبل الاستبدال — إلغاء
 *    التأكيد لا يمسح ما كتبه المستخدم (لا كتابة صامتة تستبدل نصاً موجوداً).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppendicesView } from '../AppendicesView.js';

function fakeStore(initialState) {
    let state = initialState;
    return {
        getState: () => state,
        get: () => state,
        update: (section, value) => { state = { ...state, [section]: value }; },
        notify: () => {}
    };
}

describe('خطة 2026-07-12 — بند 1.3: نبذة المستثمر من الأشخاص الرئيسيين', () => {
    beforeEach(() => {
        document.body.innerHTML = `<div id="c"></div>`;
    });
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('بلا أشخاص رئيسيين: لا يكتب شيئاً ويوجّه المستخدم بدل الفشل الصامت', () => {
        const store = fakeStore({ appendices: {}, keyPeople: { keyPeople: [] } });
        const view = new AppendicesView('c', store, () => {});
        view.render(0);

        const btn = document.getElementById('btn-generate-investor-profile');
        expect(btn).toBeTruthy();
        btn.click();

        expect(store.getState().appendices.investorProfile).toBeUndefined();
        expect(document.getElementById('appendices-investorProfile').value).toBe('');
    });

    it('حقل فارغ: يُعبَّأ فوراً من أول شخص رئيسي (اسم — دور. الخبرة: ... المؤهلات: ...)', () => {
        const store = fakeStore({
            appendices: {},
            keyPeople: { keyPeople: [
                { name: 'محمد العتيبي', role: 'المؤسس والمدير العام', experience: '10 سنوات في تجارة التجزئة', qualifications: 'بكالوريوس إدارة أعمال' }
            ] }
        });
        const view = new AppendicesView('c', store, () => {});
        view.render(0);

        document.getElementById('btn-generate-investor-profile').click();

        const expected = 'محمد العتيبي — المؤسس والمدير العام. الخبرة: 10 سنوات في تجارة التجزئة. المؤهلات: بكالوريوس إدارة أعمال.';
        expect(document.getElementById('appendices-investorProfile').value).toBe(expected);
        expect(store.getState().appendices.investorProfile).toBe(expected);
    });

    it('حقل يحوي نصاً بالفعل: يطلب تأكيداً؛ الإلغاء لا يمسح نص المستخدم الموجود', () => {
        const store = fakeStore({
            appendices: { investorProfile: 'نص كتبه المستخدم بنفسه سابقاً' },
            keyPeople: { keyPeople: [{ name: 'سارة القحطاني', role: 'شريكة مؤسسة' }] }
        });
        const view = new AppendicesView('c', store, () => {});
        view.render(0);

        expect(document.getElementById('appendices-investorProfile').value).toBe('نص كتبه المستخدم بنفسه سابقاً');

        vi.spyOn(window, 'confirm').mockReturnValue(false);
        document.getElementById('btn-generate-investor-profile').click();

        expect(window.confirm).toHaveBeenCalled();
        expect(document.getElementById('appendices-investorProfile').value).toBe('نص كتبه المستخدم بنفسه سابقاً');
        expect(store.getState().appendices.investorProfile).toBe('نص كتبه المستخدم بنفسه سابقاً');
    });

    it('حقل يحوي نصاً بالفعل: الموافقة الصريحة على التأكيد تستبدله بالمولَّد', () => {
        const store = fakeStore({
            appendices: { investorProfile: 'نص قديم' },
            keyPeople: { keyPeople: [{ name: 'سارة القحطاني', role: 'شريكة مؤسسة' }] }
        });
        const view = new AppendicesView('c', store, () => {});
        view.render(0);

        vi.spyOn(window, 'confirm').mockReturnValue(true);
        document.getElementById('btn-generate-investor-profile').click();

        expect(document.getElementById('appendices-investorProfile').value).toBe('سارة القحطاني — شريكة مؤسسة.');
        expect(store.getState().appendices.investorProfile).toBe('سارة القحطاني — شريكة مؤسسة.');
    });
});

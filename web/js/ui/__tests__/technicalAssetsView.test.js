/**
 * @vitest-environment jsdom
 *
 * TechnicalAssetsView: دمج بصري فوق جداول SECTIONS.TECHNICAL السبعة + أدوات مساندة
 * (عروض أسعار حقيقية، حاسبة إيجار/شراء، فجوة معدات شائعة، تقدير مرافق، جدول صيانة).
 * أهم اختبار هنا هو render() لا يرمي — نفس فئة الخلل التي عطّلت خطوات لاحقة كاملة في
 * OfferingView.js هذه الجلسة (StudyCategoryView لا يغلّف كل خطوة بـtry/catch).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    TechnicalAssetsView,
    quoteStats,
    calculateLeaseVsBuy,
    findMissingCommonEquipment,
    buildMaintenanceSchedule
} from '../TechnicalAssetsView.js';

function fakeWizard(tables = {}) {
    return { tables, renderTable: () => {} };
}

function fakeStore(initialState) {
    let state = JSON.parse(JSON.stringify(initialState));
    return {
        get: () => state,
        getState: () => state,
        update: (section, value) => { state[section] = value; },
        updatePath: (section, path, value) => {
            if (state[section] === undefined) state[section] = {};
            if (!path) { state[section] = value; return; }
            const keys = path.split('.');
            let target = state[section];
            for (let i = 0; i < keys.length - 1; i++) {
                if (!target[keys[i]]) target[keys[i]] = {};
                target = target[keys[i]];
            }
            target[keys[keys.length - 1]] = value;
        }
    };
}

describe('TechnicalAssetsView.render — لا يرمي', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="c"></div>'; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('يرسم بلا استثناء مع كل الجداول فارغة', () => {
        const store = fakeStore({ technical: {}, projectInfo: {}, logistics: {} });
        const view = new TechnicalAssetsView('c', store, null, fakeWizard());
        expect(() => view.render(0)).not.toThrow();
        expect(document.querySelector('#btnCalcLeaseVsBuy')).toBeTruthy();
        expect(document.querySelector('#maintenance-schedule-panel')).toBeTruthy();
    });

    it('يرسم بلا استثناء مع كل الجداول معبأة ببيانات', () => {
        const store = fakeStore({
            projectInfo: { areaSize: 120, concept: 'مقهى مختص' },
            technical: {
                establishmentCosts: [{ name: 'دراسة الجدوى', amount: 5000, amortizationRate: 0.20 }],
                capacityModel: [{ seats: 30, turnsPerDay: 3, daysPerMonth: 26 }],
                capacityUtilization: [{ year: 1, rate: 0.5, notes: '' }],
                buildings: [{ name: 'تشطيب', quantity: 1, price: 80000, depreciationRate: 0.05 }],
                equipment: [{ name: 'ماكينة اسبريسو احترافية', quantity: 1, price: 35000, depreciationRate: 0.15, quotes: [{ source: 'مورد أ', price: 34000, url: '', date: '' }] }],
                furniture: [{ name: 'طاولات', quantity: 1, price: 8000, depreciationRate: 0.20 }],
                locationAssessment: [{ factor: 'الكثافة السكانية', rating: 5, weight: 30 }],
                locationListings: [{ source: 'مالك أ', price: 9000, url: '', date: '' }]
            },
            logistics: { logistics: [{ name: 'كهرباء ومياه (تبريد/تكييف)', monthly: 0, variablePercent: 0.3 }] }
        });
        const view = new TechnicalAssetsView('c', store, null, fakeWizard());
        expect(() => view.render(0)).not.toThrow();
        expect(document.querySelector('#equipment-quotes-panel')?.textContent).toContain('ماكينة اسبريسو احترافية');
        expect(document.querySelector('#location-listings-panel')?.textContent).toContain('مالك أ');
    });

    it('وضع مصغّر: يقتصر على establishmentCosts/equipment/furniture فقط (بلا locationAssessment)', () => {
        const store = fakeStore({
            appSettings: { mode: 'mini' },
            projectInfo: {},
            technical: {
                equipment: [{ name: 'جهاز' }],
                locationAssessment: [{ factor: 'قرب العملاء', rating: 4 }]
            },
            logistics: {}
        });
        const view = new TechnicalAssetsView('c', store, null, fakeWizard());
        view.render(0);
        expect(document.getElementById('table-equipment')).toBeTruthy();
        expect(document.getElementById('table-locationAssessment')).toBeFalsy();
        expect(document.getElementById('location-listings-panel')).toBeFalsy();
    });
});

describe('quoteStats', () => {
    it('يُرجع null مع 0 أو 1 عرض', () => {
        expect(quoteStats([])).toBeNull();
        expect(quoteStats([{ price: 100 }])).toBeNull();
    });

    it('يحسب المتوسط والأدنى مع عرضين فأكثر', () => {
        const stats = quoteStats([{ price: 100 }, { price: 200 }, { price: 300 }]);
        expect(stats).toEqual({ avg: 200, min: 100 });
    });

    it('يتجاهل أسعاراً غير صالحة (صفر/سالب/غير رقمي)', () => {
        expect(quoteStats([{ price: 0 }, { price: -5 }, { price: 'abc' }])).toBeNull();
    });
});

describe('calculateLeaseVsBuy', () => {
    it('يفضّل الشراء حين إجمالي الإيجار أعلى', () => {
        const result = calculateLeaseVsBuy({ price: 10000, usefulLifeYears: 5, leaseMonthly: 200 });
        expect(result.buyTotal).toBe(10000);
        expect(result.leaseTotal).toBe(12000); // 200*12*5
        expect(result.cheaper).toBe('buy');
        expect(result.savings).toBe(2000);
    });

    it('يفضّل الإيجار حين إجمالي الشراء (مع تمويل) أعلى', () => {
        const result = calculateLeaseVsBuy({ price: 10000, usefulLifeYears: 5, leaseMonthly: 100, financingRatePercent: 10 });
        // buyTotal = 10000 + 10000*0.10*5 = 15000 ; leaseTotal = 100*12*5 = 6000
        expect(result.buyTotal).toBe(15000);
        expect(result.leaseTotal).toBe(6000);
        expect(result.cheaper).toBe('lease');
        expect(result.savings).toBe(9000);
    });

    it('يُرجع null بعمر افتراضي صفر أو سالب', () => {
        expect(calculateLeaseVsBuy({ price: 1000, usefulLifeYears: 0, leaseMonthly: 50 })).toBeNull();
        expect(calculateLeaseVsBuy({ price: 1000, usefulLifeYears: -2, leaseMonthly: 50 })).toBeNull();
    });
});

describe('findMissingCommonEquipment', () => {
    it('لا يُدرج بنداً موجوداً فعلاً بالاسم (تطابق كلمة) في قائمة الفجوة', () => {
        const state = {
            projectInfo: { concept: 'مقهى مختص' },
            technical: { equipment: [{ name: 'ماكينة اسبريسو احترافية' }] }
        };
        const missing = findMissingCommonEquipment(state);
        expect(missing).not.toContain('ماكينة اسبريسو احترافية');
    });

    it('يُدرج بنداً نموذجياً للقطاع غير موجود إطلاقاً', () => {
        const state = {
            projectInfo: { concept: 'مقهى مختص' },
            technical: { equipment: [{ name: 'ماكينة اسبريسو احترافية' }] }
        };
        const missing = findMissingCommonEquipment(state);
        expect(missing).toContain('ثلاجات وعرض بارد');
    });

    it('لا يرمي عند غياب بيانات equipment كلياً', () => {
        expect(() => findMissingCommonEquipment({})).not.toThrow();
    });
});

describe('buildMaintenanceSchedule', () => {
    it('يحسب العمر الافتراضي وأول استحقاق من معدل الإهلاك/الإطفاء', () => {
        const state = {
            technical: {
                establishmentCosts: [{ name: 'ديكورات', amount: 20000, amortizationRate: 0.25 }],
                equipment: [{ name: 'فرن', depreciationRate: 0.20 }],
                furniture: [{ name: 'طاولات' }] // بلا rate → الافتراضي 0.20 لدى furniture
            }
        };
        const schedule = buildMaintenanceSchedule(state);

        const est = schedule.find(s => s.name === 'ديكورات');
        expect(est.life).toBe(4); // round(1/0.25)
        expect(est.firstDueYear).toBe(5);
        expect(est.kind).toContain('إطفاء');

        const eq = schedule.find(s => s.name === 'فرن');
        expect(eq.life).toBe(5); // round(1/0.20)
        expect(eq.firstDueYear).toBe(6);
        expect(eq.kind).toContain('إحلال');

        const furn = schedule.find(s => s.name === 'طاولات');
        expect(furn.life).toBe(5);
    });

    it('يُرجع مصفوفة فارغة بلا بنود', () => {
        expect(buildMaintenanceSchedule({ technical: {} })).toEqual([]);
        expect(buildMaintenanceSchedule({})).toEqual([]);
    });
});

describe('TechnicalAssetsView — إضافة/حذف عروض أسعار المعدات', () => {
    beforeEach(() => { document.body.innerHTML = '<div id="c"></div>'; });
    afterEach(() => { document.body.innerHTML = ''; });

    it('إضافة عرضين تُظهر المتوسط والأدنى', () => {
        const store = fakeStore({
            projectInfo: {},
            technical: { equipment: [{ name: 'ماكينة اسبريسو', price: 35000 }] },
            logistics: {}
        });
        const view = new TechnicalAssetsView('c', store, null, fakeWizard());
        view.render(0);

        const fillAndAdd = (source, price) => {
            const form = document.querySelector('.quote-add-form[data-row="0"]');
            form.querySelector('[data-field="source"]').value = source;
            form.querySelector('[data-field="price"]').value = String(price);
            form.querySelector('.btn-add-quote').click();
        };

        fillAndAdd('مورد أ', '30000');
        fillAndAdd('مورد ب', '32000');

        const panelText = document.querySelector('#equipment-quotes-panel').textContent;
        expect(panelText).toContain('المتوسط');
        expect(panelText).toContain('الأدنى');
        expect(store.get().technical.equipment[0].quotes).toHaveLength(2);
    });

    it('لا يضيف عرضاً بلا مورد أو بسعر صفر', () => {
        const store = fakeStore({
            projectInfo: {},
            technical: { equipment: [{ name: 'جهاز' }] },
            logistics: {}
        });
        const view = new TechnicalAssetsView('c', store, null, fakeWizard());
        view.render(0);

        const form = document.querySelector('.quote-add-form[data-row="0"]');
        form.querySelector('[data-field="price"]').value = '1000';
        form.querySelector('.btn-add-quote').click(); // بلا اسم مورد

        expect(store.get().technical.equipment[0].quotes || []).toHaveLength(0);
    });
});

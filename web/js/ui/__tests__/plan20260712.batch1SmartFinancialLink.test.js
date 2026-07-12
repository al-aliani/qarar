/**
 * @vitest-environment jsdom
 *
 * خطة الاستفادة من تقرير محل الخضار (2026-07-12) — دفعة 1، بند 1.2:
 * «الهدف المالي SMART ↔ SOM ↔ جدول الإيرادات + سقف الطاقة».
 *
 * يثبّت هذا الملف:
 * 1) deriveRevenueFromStreams (engine.js) — مشتق موحّد بنفس صيغة عمود year1 حرفياً.
 * 2) capacityCheck (engine.js) يستخدم annualCapacity عند غياب capacityModel، والأدنى
 *    عند توفر الاثنين معاً.
 * 3) SmartGoals.js: تلميح الإيراد المحسوب للهدف المالي (اقتراح بنقرة لا تعبئة صامتة)،
 *    وشارة انحراف > 10% على بطاقة الهدف تفرّق بين قيمة متزامنة انحرفت وقيمة يدوية واعية.
 * 4) MarketAnalysis.js: تلميح فوري ملوّن بجوار SOM مقارناً بالإيراد المحسوب.
 * 5) qaChecks.js: SMART_GOAL_INCONSISTENT يُطلق فقط لهدف متزامن (manualOverride=false)
 *    منحرف > 10%، لا لقيمة يدوية واعية (manualOverride=true).
 * 6) Wizard.js: زر «اقتراح السعة من الإيرادات» (generateProductionCapacity الموصولة
 *    أخيراً) لا يكتب على productionCapacity.annualCapacity إلا بعد ضغط «تطبيق» صريح.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { deriveRevenueFromStreams, calculateStudy } from '../../core/engine.js';
import { SECTIONS, createEmptyStudy } from '../../core/schema.js';
import { runQAChecks } from '../../utils/qaChecks.js';
import { SmartGoals } from '../SmartGoals.js';
import { MarketAnalysis } from '../MarketAnalysis.js';
import { Wizard } from '../Wizard.js';

describe('خطة 2026-07-12 — بند 1.2: الهدف المالي SMART ↔ SOM ↔ جدول الإيرادات + سقف الطاقة', () => {
    describe('deriveRevenueFromStreams — مشتق موحّد', () => {
        it('يحسب year1Revenue وannualCustomers بنفس صيغة customersPerMonth×12×avgPrice', () => {
            const streams = [
                { customersPerMonth: 100, avgPrice: 50 },
                { customersPerMonth: 200, avgPrice: 30 }
            ];
            const { year1Revenue, annualCustomers } = deriveRevenueFromStreams(streams);
            // (100*12*50) + (200*12*30) = 60000 + 72000 = 132000
            expect(year1Revenue).toBe(132000);
            expect(annualCustomers).toBe(100 * 12 + 200 * 12);
        });

        it('يتعامل بأمان مع مدخلات فارغة/غير مصفوفة', () => {
            expect(deriveRevenueFromStreams(undefined)).toEqual({ year1Revenue: 0, annualCustomers: 0 });
            expect(deriveRevenueFromStreams(null)).toEqual({ year1Revenue: 0, annualCustomers: 0 });
            expect(deriveRevenueFromStreams([])).toEqual({ year1Revenue: 0, annualCustomers: 0 });
        });
    });

    describe('engine.js capacityCheck — يقرأ annualCapacity عند غياب capacityModel', () => {
        function makeStudy(overrides = {}) {
            const base = {
                [SECTIONS.PROJECT_INFO]: { name: 'بقالة', sector: 'بقالة' },
                assumptions: { projectionYears: 5, discountRate: 0.10, inflationRate: 0.02, hiddenOverheadsRate: 0 },
                [SECTIONS.TECHNICAL]: {
                    equipment: [{ name: 'معدات', price: 50000, quantity: 1 }],
                    buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: []
                },
                [SECTIONS.HR]: { positions: [{ position: 'مدير', count: 1, salary: 6000, months: 12, nationality: 'saudi' }] },
                [SECTIONS.LOGISTICS]: { logistics: [] },
                [SECTIONS.ADMINISTRATIVE]: { administrative: [{ name: 'إيجار', monthly: 10000 }] },
                [SECTIONS.MARKETING]: { campaigns: [] },
                [SECTIONS.REVENUE]: {
                    streams: [{ service: 'مبيعات', type: 'operating', customersPerMonth: 3000, avgPrice: 22, variableCostRate: 0.32, growthRate: 0.05 }]
                },
                [SECTIONS.SERVICES]: { items: [] },
                [SECTIONS.FINANCING]: { sources: {} },
                [SECTIONS.TECH_RESOURCES]: { techResources: [] },
                [SECTIONS.LEGAL]: { licenses: [] }
            };
            return { ...base, ...overrides };
        }

        it('بلا capacityModel وبلا annualCapacity: لا يوجد capacityCheck (سلوك سابق محفوظ)', () => {
            const r = calculateStudy(makeStudy());
            expect(r.capacityCheck).toBeNull();
        });

        it('annualCapacity فقط (بلا capacityModel): يُستخدم كسقف مصدره annualCapacity', () => {
            const study = makeStudy({
                [SECTIONS.TECHNICAL]: {
                    equipment: [{ name: 'معدات', price: 50000, quantity: 1 }],
                    buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [],
                    productionCapacity: { annualCapacity: 12000, unitOrMeasure: 'عميل/سنة' } // = 1000/شهر
                }
            });
            const r = calculateStudy(study);
            expect(r.capacityCheck).toBeTruthy();
            expect(r.capacityCheck.maxUnitsPerMonth).toBe(1000);
            expect(r.capacityCheck.source).toBe('annualCapacity');
            // الخطة 3000/شهر > 1000 ⇒ تجاوز
            expect(r.capacityCheck.exceeded).toBe(true);
        });

        it('عند توفر capacityModel وannualCapacity معاً: يُستخدم الأدنى (الأكثر تقييداً)', () => {
            const study = makeStudy({
                [SECTIONS.TECHNICAL]: {
                    equipment: [{ name: 'معدات', price: 50000, quantity: 1 }],
                    buildings: [], furniture: [], establishmentCosts: [], capacityUtilization: [],
                    capacityModel: [{ seats: 40, turnsPerDay: 4, daysPerMonth: 26 }], // = 4160/شهر
                    productionCapacity: { annualCapacity: 12000, unitOrMeasure: 'عميل/سنة' } // = 1000/شهر (أدنى)
                }
            });
            const r = calculateStudy(study);
            expect(r.capacityCheck.maxUnitsPerMonth).toBe(1000);
            expect(r.capacityCheck.source).toBe('both');
        });
    });

    describe('SmartGoals — تلميح الإيراد المحسوب وشارة انحراف الهدف المالي', () => {
        function fakeStore(initialState) {
            let state = initialState;
            return {
                getState: () => state,
                get: () => state,
                update: (section, value) => { state = { ...state, [section]: { ...(state[section] || {}), ...value } }; }
            };
        }

        beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
        afterEach(() => { document.body.innerHTML = ''; });

        it('يعرض تلميح الإيراد المحسوب فقط عندما تكون الفئة المختارة «مالي»', () => {
            const store = fakeStore({
                smartGoals: { goals: [] },
                revenue: { streams: [{ customersPerMonth: 100, avgPrice: 50 }] } // 60000
            });
            const view = new SmartGoals('c', store, () => {});
            view.render(0);

            const hintRow = document.getElementById('goalFinancialHintRow');
            expect(hintRow).toBeTruthy();
            expect(hintRow.style.display).not.toBe('none'); // الفئة الافتراضية 'مالي'
            expect(hintRow.textContent).toContain((60000).toLocaleString('ar-SA'));

            document.getElementById('goalCategory').value = 'operational';
            document.getElementById('goalCategory').dispatchEvent(new Event('change', { bubbles: true }));
            expect(hintRow.style.display).toBe('none');
        });

        it('زر «استخدم هذه القيمة» يعبّئ الحقل ويحفظ manualOverride=false عند الحفظ', () => {
            const store = fakeStore({
                smartGoals: { goals: [] },
                revenue: { streams: [{ customersPerMonth: 100, avgPrice: 50 }] } // 60000
            });
            const view = new SmartGoals('c', store, () => {});
            view.render(0);

            document.getElementById('goalSpecific').value = 'هدف الإيراد السنوي';
            document.getElementById('btnUseComputedRevenue').click();
            expect(document.getElementById('goalTargetValue').value).toBe('60000');

            view.addGoal();
            const goal = store.getState().smartGoals.goals[0];
            expect(goal.targetValue).toBe(60000);
            expect(goal.manualOverride).toBe(false);
        });

        it('كتابة يدوية في القيمة المستهدفة تُسجَّل manualOverride=true', () => {
            const store = fakeStore({
                smartGoals: { goals: [] },
                revenue: { streams: [{ customersPerMonth: 100, avgPrice: 50 }] }
            });
            const view = new SmartGoals('c', store, () => {});
            view.render(0);

            document.getElementById('goalSpecific').value = 'هدف طموح';
            const targetInput = document.getElementById('goalTargetValue');
            targetInput.value = '500000';
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));

            view.addGoal();
            const goal = store.getState().smartGoals.goals[0];
            expect(goal.targetValue).toBe(500000);
            expect(goal.manualOverride).toBe(true);
        });

        it('بطاقة هدف مالي متزامن (manualOverride=false) منحرف >10% تُظهر تحذيراً + زر إعادة المزامنة، وليس هدف يدوي واعٍ', () => {
            const store = fakeStore({
                smartGoals: {
                    goals: [
                        { id: 'g1', specific: 'هدف متزامن قديم', category: 'financial', targetValue: 30000, currentValue: 0, status: 'pending', manualOverride: false },
                        { id: 'g2', specific: 'هدف طموح مقصود', category: 'financial', targetValue: 500000, currentValue: 0, status: 'pending', manualOverride: true }
                    ]
                },
                revenue: { streams: [{ customersPerMonth: 100, avgPrice: 50 }] } // 60000 — كلاهما ينحرف >10%
            });
            const view = new SmartGoals('c', store, () => {});
            view.render(0);

            const html = document.getElementById('c').innerHTML;
            // الهدف المتزامن القديم: تحذير + زر إعادة مزامنة
            expect(html).toContain('لم يعد يطابق الإيراد المحسوب حالياً');
            const syncBtn = document.querySelector('.btn-sync-financial-goal[data-idx="0"]');
            expect(syncBtn).toBeTruthy();
            // الهدف اليدوي الواعي: ملاحظة محايدة فقط، بلا زر إعادة مزامنة
            expect(html).toContain('هدف طموح مقصود');
            expect(document.querySelector('.btn-sync-financial-goal[data-idx="1"]')).toBeFalsy();

            syncBtn.click();
            const updated = store.getState().smartGoals.goals.find(g => g.id === 'g1');
            expect(updated.targetValue).toBe(60000);
            expect(updated.manualOverride).toBe(false);
        });
    });

    describe('MarketAnalysis — تلميح فوري بجوار SOM', () => {
        function fakeStore(initialState) {
            let state = initialState;
            return {
                getState: () => state,
                update: (section, value) => { state = { ...state, [section]: value }; }
            };
        }

        beforeEach(() => { document.body.innerHTML = `<div id="c"></div>`; });
        afterEach(() => { document.body.innerHTML = ''; });

        it('يعرض الإيراد المحسوب ويلوّن أخضر ضمن SOM بأمان', () => {
            const store = fakeStore({
                projectInfo: {}, marketing: { competitors: [] },
                marketSizing: { som: { value: 200000 } },
                revenue: { streams: [{ customersPerMonth: 100, avgPrice: 50 }] } // 60000 << 200000
            });
            const view = new MarketAnalysis('c', store);
            view.render(0);

            const hint = document.getElementById('som-revenue-hint');
            expect(hint).toBeTruthy();
            expect(hint.textContent).toContain((60000).toLocaleString('ar-SA'));
            expect(hint.querySelector('.text-success')).toBeTruthy();
        });

        it('يلوّن أحمر عندما يتجاوز الإيراد المحسوب SOM بأكثر من 120%', () => {
            const store = fakeStore({
                projectInfo: {}, marketing: { competitors: [] },
                marketSizing: { som: { value: 10000 } },
                revenue: { streams: [{ customersPerMonth: 100, avgPrice: 50 }] } // 60000 >> 10000*1.2
            });
            const view = new MarketAnalysis('c', store);
            view.render(0);

            const hint = document.getElementById('som-revenue-hint');
            expect(hint.querySelector('.text-danger')).toBeTruthy();
        });

        it('يحدَّث فورياً أثناء الكتابة في SOM بلا إعادة رسم كاملة (لا يفقد التركيز)', () => {
            const store = fakeStore({
                projectInfo: {}, marketing: { competitors: [] },
                marketSizing: { som: { value: 10000 } },
                revenue: { streams: [{ customersPerMonth: 100, avgPrice: 50 }] }
            });
            const view = new MarketAnalysis('c', store);
            view.render(0);

            const somInput = document.getElementById('market-som');
            somInput.focus();
            somInput.value = '900000'; // أكبر بكثير من الإيراد المحسوب ⇒ يجب أن يخضرّ
            somInput.dispatchEvent(new Event('input', { bubbles: true }));

            expect(document.getElementById('som-revenue-hint').querySelector('.text-success')).toBeTruthy();
            // التركيز لم يسقط (لا render() كامل استُدعي)
            expect(document.activeElement).toBe(somInput);
        });
    });

    describe('qaChecks — SMART_GOAL_INCONSISTENT', () => {
        function baseResults(revenue) {
            return { incomeStatement: [{ revenue }] };
        }

        it('يُطلق لهدف مالي متزامن (manualOverride=false) منحرف >10% عن الإيراد المحسوب', async () => {
            const state = {
                smartGoals: { goals: [{ id: 'g1', specific: 'هدف قديم', category: 'financial', targetValue: 30000, manualOverride: false }] },
                revenue: { streams: [{ customersPerMonth: 100, avgPrice: 50 }] } // 60000
            };
            const qa = await runQAChecks(state, baseResults(60000));
            const codes = [...qa.softWarnings, ...qa.hardErrors].map(w => w.code);
            expect(codes).toContain('SMART_GOAL_INCONSISTENT');
        });

        it('لا يُطلق لهدف مالي يدوي واعٍ (manualOverride=true) حتى مع انحراف كبير', async () => {
            const state = {
                smartGoals: { goals: [{ id: 'g1', specific: 'طموح مقصود', category: 'financial', targetValue: 500000, manualOverride: true }] },
                revenue: { streams: [{ customersPerMonth: 100, avgPrice: 50 }] }
            };
            const qa = await runQAChecks(state, baseResults(60000));
            const codes = [...qa.softWarnings, ...qa.hardErrors].map(w => w.code);
            expect(codes).not.toContain('SMART_GOAL_INCONSISTENT');
        });

        it('لا يُطلق حين لا يوجد انحراف يُذكر (ضمن 10%)', async () => {
            const state = {
                smartGoals: { goals: [{ id: 'g1', specific: 'متزامن حديثاً', category: 'financial', targetValue: 61000, manualOverride: false }] },
                revenue: { streams: [{ customersPerMonth: 100, avgPrice: 50 }] } // 60000، فارق ~1.6%
            };
            const qa = await runQAChecks(state, baseResults(60000));
            const codes = [...qa.softWarnings, ...qa.hardErrors].map(w => w.code);
            expect(codes).not.toContain('SMART_GOAL_INCONSISTENT');
        });
    });

    describe('Wizard — زر «اقتراح السعة من الإيرادات» (generateProductionCapacity موصولة)', () => {
        function fakeStore(state) {
            return {
                get: () => state,
                getState: () => state,
                update: (section, data) => { state[section] = { ...state[section], ...data }; },
                updatePath: (section, path, value) => {
                    if (!path) { state[section] = value; return; }
                    const keys = path.split('.');
                    state[section] = state[section] || {};
                    let target = state[section];
                    for (let i = 0; i < keys.length - 1; i++) {
                        target[keys[i]] = target[keys[i]] || {};
                        target = target[keys[i]];
                    }
                    target[keys[keys.length - 1]] = value;
                }
            };
        }

        afterEach(() => { document.body.innerHTML = ''; });

        it('لا يكتب شيئاً قبل النقر على «تطبيق» — النقر الأول يعرض الاقتراح فقط', () => {
            const state = createEmptyStudy();
            state.revenue.streams = [{ customersPerMonth: 100, avgPrice: 50, growthRate: 0.05 }];
            const store = fakeStore(state);
            const wizard = new Wizard('c', store, {}, {
                steps: [{ id: SECTIONS.TECHNICAL, label: 'الأصول والتجهيزات', tables: [] }]
            });
            document.body.innerHTML = `<div id="c"></div>`;
            wizard.container = document.getElementById('c');
            wizard.renderStep(SECTIONS.TECHNICAL, wizard.steps[0], 0);

            const btn = document.getElementById('btnSuggestProductionCapacity');
            expect(btn).toBeTruthy();
            expect(state.technical.productionCapacity.annualCapacity).toBe(0);

            btn.click();

            // لا كتابة صامتة بعد — فقط عرض الاقتراح مع زر تطبيق صريح
            expect(state.technical.productionCapacity.annualCapacity).toBe(0);
            const applyBtn = document.getElementById('btnApplyProductionCapacity');
            expect(applyBtn).toBeTruthy();
            expect(document.getElementById('productionCapacitySuggestResult').textContent).toContain((1200).toLocaleString('ar-SA'));
        });

        it('النقر على «تطبيق» يكتب annualCapacity/unitOrMeasure المقترحَين فعلياً', () => {
            const state = createEmptyStudy();
            state.revenue.streams = [{ customersPerMonth: 100, avgPrice: 50, growthRate: 0.05 }];
            const store = fakeStore(state);
            const wizard = new Wizard('c', store, {}, {
                steps: [{ id: SECTIONS.TECHNICAL, label: 'الأصول والتجهيزات', tables: [] }]
            });
            document.body.innerHTML = `<div id="c"></div>`;
            wizard.container = document.getElementById('c');
            wizard.renderStep(SECTIONS.TECHNICAL, wizard.steps[0], 0);

            document.getElementById('btnSuggestProductionCapacity').click();
            document.getElementById('btnApplyProductionCapacity').click();

            expect(state.technical.productionCapacity.annualCapacity).toBe(1200);
            expect(state.technical.productionCapacity.unitOrMeasure).toBe('عميل/سنة');
        });
    });
});

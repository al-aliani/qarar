/**
 * @vitest-environment jsdom
 *
 * خطة الاستفادة من تقرير محل الخضار (2026-07-12) — دفعة 1، بند 1.1:
 * «محاكاة التشغيل → جدول الرواتب → السعودة».
 *
 * يثبّت هذا الملف:
 * 1) OperationalSim.runSimulation يخزّن lastResult (recommendedServers/utilization/
 *    avgWaitTime) في state.operational بعد كل تشغيل — دون أي تغيير لسلوك الإفصاح أو
 *    الاستقلالية المُثبَّتين فعلاً في batch6.operationalSimDisclosure.test.js.
 * 2) جدول الرواتب (positions) في Wizard.js يعرض شريط تلميح اختياري فقط إن وُجد
 *    lastResult، وزر «إدراج كصف مقترح» يضيف صفاً عادياً قابلاً للتعديل (لا كتابة
 *    صامتة، لا استبدال لبقية الجدول).
 * 3) السعودة (OrgStructure.js): تنبيه + زر «استخدم المحسوبة» يظهر فقط حين تختلف
 *    قيمة يدوية قديمة مُخزَّنة عن النسبة المحسوبة فعلياً من جدول الرواتب.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperationalSim } from '../OperationalSim.js';
import { Wizard } from '../Wizard.js';
import { OrgStructure } from '../OrgStructure.js';
import { SECTIONS, createEmptyStudy, TABLE_SCHEMAS } from '../../core/schema.js';

describe('خطة 2026-07-12 — بند 1.1: محاكاة التشغيل ↔ جدول الرواتب ↔ السعودة', () => {
    // ────────────────────────────────────────────────────────────────
    // 1) OperationalSim يخزّن lastResult
    // ────────────────────────────────────────────────────────────────
    describe('OperationalSim.runSimulation يخزّن lastResult في operational', () => {
        let activeView = null;
        let originalGetContext;
        beforeEach(() => {
            document.body.innerHTML = '<div id="root"></div>';
            activeView = null;
            originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = () => ({
                clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {}
            });
        });
        afterEach(() => {
            if (activeView?.simInterval) clearInterval(activeView.simInterval);
            HTMLCanvasElement.prototype.getContext = originalGetContext;
        });

        it('يخزّن recommendedServers/utilization/avgWaitTime بعد تشغيل مستقر (rho<1)', () => {
            const state = { operational: { arrivalRate: 100, serviceTime: 5, servers: 9 } };
            let saved = null;
            const store = {
                getState: () => state,
                get: () => state,
                update: (key, value) => { if (key === 'operational') saved = value; }
            };
            const view = new OperationalSim('root', store, null);
            activeView = view;
            view.render(0);
            view.runSimulation({ arrivalRate: 100, serviceTime: 5, servers: 9 });

            expect(saved).toBeTruthy();
            expect(saved.lastResult).toBeTruthy();
            expect(saved.lastResult.recommendedServers).toBeGreaterThan(0);
            expect(Number.isInteger(saved.lastResult.recommendedServers)).toBe(true);
            expect(typeof saved.lastResult.utilization).toBe('number');
            expect(typeof saved.lastResult.avgWaitTime).toBe('number');
            // لا كتابة لأي مكان آخر خارج operational (يطابق batch6.operationalSimDisclosure)
            expect(state.hr).toBeUndefined();
        });

        it('نظام غير مستقر (rho>=1): avgWaitTime يُخزَّن null لكن recommendedServers يبقى رقماً موجباً', () => {
            const state = { operational: { arrivalRate: 190, serviceTime: 5, servers: 1 } };
            let saved = null;
            const store = {
                getState: () => state,
                get: () => state,
                update: (key, value) => { if (key === 'operational') saved = value; }
            };
            const view = new OperationalSim('root', store, null);
            activeView = view;
            view.render(0);
            view.runSimulation({ arrivalRate: 190, serviceTime: 5, servers: 1 });

            expect(saved.lastResult.avgWaitTime).toBeNull();
            expect(saved.lastResult.recommendedServers).toBeGreaterThan(0);
        });
    });

    // ────────────────────────────────────────────────────────────────
    // 2) جدول الرواتب يعرض تلميح المحاكاة + زر إدراج
    // ────────────────────────────────────────────────────────────────
    describe('Wizard: شريط تلميح المحاكاة أعلى جدول الرواتب (positions)', () => {
        function fakeStore(state) {
            return {
                get: () => state,
                getState: () => state,
                update: (section, data) => { state[section] = { ...state[section], ...data }; },
                updatePath: (section, path, value) => {
                    if (!path) { state[section] = value; return; }
                    state[section] = state[section] || {};
                    state[section][path] = value;
                }
            };
        }

        afterEach(() => { document.body.innerHTML = ''; });

        it('لا يظهر أي تلميح قبل أول تشغيل للمحاكاة (operational.lastResult غير موجود)', () => {
            const state = createEmptyStudy();
            const store = fakeStore(state);
            const wizard = new Wizard('c', store, { positions: TABLE_SCHEMAS.positions }, {
                steps: [{ id: SECTIONS.HR, label: 'الفريق والرواتب', tables: ['positions'] }]
            });
            document.body.innerHTML = `<div id="c"></div>`;
            wizard.container = document.getElementById('c');
            wizard.renderStep(SECTIONS.HR, wizard.steps[0], 0);

            const tableEl = document.getElementById('table-positions');
            expect(tableEl.querySelector('[data-hint-action="insert-suggested-staff"]')).toBeFalsy();
        });

        it('يعرض التلميح بعدد الموظفين المقترح، والنقر على «إدراج كصف مقترح» يضيف صفاً عادياً قابلاً للتعديل', () => {
            const state = createEmptyStudy();
            state.operational.lastResult = { recommendedServers: 4, utilization: 0.82, avgWaitTime: 6.3 };
            const store = fakeStore(state);
            const wizard = new Wizard('c', store, { positions: TABLE_SCHEMAS.positions }, {
                steps: [{ id: SECTIONS.HR, label: 'الفريق والرواتب', tables: ['positions'] }]
            });
            document.body.innerHTML = `<div id="c"></div>`;
            wizard.container = document.getElementById('c');
            wizard.renderStep(SECTIONS.HR, wizard.steps[0], 0);

            const tableEl = document.getElementById('table-positions');
            expect(tableEl.textContent).toContain('4');
            const btn = tableEl.querySelector('[data-hint-action="insert-suggested-staff"]');
            expect(btn).toBeTruthy();

            expect(state.hr.positions.length).toBe(0);
            btn.click();

            expect(state.hr.positions.length).toBe(1);
            expect(state.hr.positions[0].count).toBe(4);
            // الصف عادي وقابل للتعديل — لا قفل ولا حذف بقية الجدول
            expect(state.hr.positions[0]).toHaveProperty('position');
            expect(state.hr.positions[0]).toHaveProperty('salary');
        });
    });

    // ────────────────────────────────────────────────────────────────
    // 3) السعودة: تنبيه القيمة اليدوية القديمة + «استخدم المحسوبة»
    // ────────────────────────────────────────────────────────────────
    describe('OrgStructure: تنبيه طغيان القيمة اليدوية على نسبة السعودة المحسوبة', () => {
        function fakeStore(state) {
            return {
                getState: () => state,
                get: () => state,
                update: (section, data) => { state[section] = { ...state[section], ...data }; },
                notify: () => {}
            };
        }

        afterEach(() => { document.body.innerHTML = ''; });

        function buildState({ currentPercentage, positions }) {
            return {
                orgStructure: {
                    departments: [], boardOfDirectors: [], advisoryBoard: [],
                    governance: {}, operationalKpis: [],
                    saudization: { currentPercentage, targetPercentage: 40 }
                },
                hr: { positions },
                projectInfo: {}
            };
        }

        it('لا تنبيه حين لا توجد قيمة يدوية مُدخلة (الحقل يتبع المحسوبة تلقائياً)', () => {
            const state = buildState({
                currentPercentage: null,
                positions: [{ count: 2, nationality: 'saudi' }, { count: 2, nationality: 'expat' }]
            });
            document.body.innerHTML = `<div id="c"></div>`;
            const view = new OrgStructure('c', fakeStore(state), () => {});
            view.render(0);

            expect(document.getElementById('btn-use-computed-saudization')).toBeFalsy();
        });

        it('لا تنبيه حين القيمة اليدوية مطابقة (أو قريبة جداً) من المحسوبة', () => {
            // محسوبة = 50% (2 من 4)، يدوية = 50%
            const state = buildState({
                currentPercentage: 50,
                positions: [{ count: 2, nationality: 'saudi' }, { count: 2, nationality: 'expat' }]
            });
            document.body.innerHTML = `<div id="c"></div>`;
            const view = new OrgStructure('c', fakeStore(state), () => {});
            view.render(0);

            expect(document.getElementById('btn-use-computed-saudization')).toBeFalsy();
        });

        it('يظهر تنبيه + زر «استخدم المحسوبة» حين تختلف القيمة اليدوية عن المحسوبة، والنقر يمسح القيمة اليدوية', () => {
            // محسوبة = 50% (2 من 4)، يدوية قديمة = 10% (طغيان)
            const state = buildState({
                currentPercentage: 10,
                positions: [{ count: 2, nationality: 'saudi' }, { count: 2, nationality: 'expat' }]
            });
            document.body.innerHTML = `<div id="c"></div>`;
            const view = new OrgStructure('c', fakeStore(state), () => {});
            view.render(0);

            const btn = document.getElementById('btn-use-computed-saudization');
            expect(btn).toBeTruthy();
            expect(document.getElementById('c').textContent).toMatch(/50%/);

            btn.click();

            // بعد النقر: القيمة اليدوية أُزيلت والحقل يعود لعرض المحسوبة (50%) بلا تنبيه
            expect(state.orgStructure.saudization.currentPercentage).toBeNull();
            expect(document.getElementById('btn-use-computed-saudization')).toBeFalsy();
            const currentInput = document.getElementById('saud-currentPct');
            expect(Number(currentInput.value)).toBe(50);
        });
    });
});

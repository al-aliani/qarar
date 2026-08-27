/**
 * @vitest-environment jsdom
 *
 * `setMode` كان يستدعي `store.set('appSettings.mode', mode)`. و`store.set(data)` تأخذ
 * وسيطاً **واحداً** وتفعل `this.state = data` ثم `save()` — فالوسيط الثاني يسقط صامتاً،
 * وحالة الدراسة كلها تصير النص `'appSettings.mode'` وتُحفَظ فوق النسخة السليمة.
 *
 * قياس 2026-08-26 على نسخة معزولة من المخزن الحيّ: 41 مفتاحاً ⟵ نص واحد، و`save()` تُستدعى.
 *
 * لم يُلاحَظ لأن المستدعي الوحيد (`Sidebar.js:513`) داخل شريط جانبي مخفي دائماً بقرار
 * متعمد. فهو لغم صامت لا عطل ظاهر — وهذا ما يجعله يستحق حارساً: العطل الظاهر يكتشفه
 * المستخدم، والصامت لا يكتشفه أحد حتى يُدمّر بيانات.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SimpleModeController } from '../SimpleModeController.js';

function makeStore() {
    const state = {
        projectInfo: { name: 'مقهى رواق', id: 'abc-123' },
        appSettings: { mode: 'advanced' },
        technical: { equipment: [{ name: 'إسبريسو', price: 85000 }] },
        revenue: { streams: [{ name: 'مشروبات', avgPrice: 24 }] },
    };
    return {
        state,
        saved: 0,
        getState() { return this.state; },
        get() { return this.state; },
        set(data) { this.state = data; this.saved++; },
        updatePath(section, path, value) {
            if (this.state[section] === undefined) this.state[section] = {};
            this.state[section][path] = value;
            this.saved++;
        },
    };
}

describe('SimpleModeController — تبديل الوضع لا يمسح الدراسة', () => {
    let store, controller;

    beforeEach(() => {
        document.body.className = '';
        try { localStorage.clear(); } catch (_) { /* بيئة بلا تخزين */ }
        store = makeStore();
        controller = new SimpleModeController(store);
    });

    it('setMode يُبقي الدراسة كائناً بكل أقسامها، لا نصاً', () => {
        const keysBefore = Object.keys(store.state).length;
        controller.setMode('quick');
        expect(
            typeof store.state,
            `حالة الدراسة صارت ${typeof store.state}: ${JSON.stringify(store.state).slice(0, 60)}`
        ).toBe('object');
        expect(Object.keys(store.state).length).toBe(keysBefore);
    });

    it('بيانات الدراسة نفسها تبقى سليمة بعد التبديل', () => {
        controller.setMode('quick');
        expect(store.state.projectInfo?.name).toBe('مقهى رواق');
        expect(store.state.technical?.equipment?.[0]?.price).toBe(85000);
        expect(store.state.revenue?.streams?.[0]?.avgPrice).toBe(24);
    });

    it('الوضع الجديد يُكتب فعلاً في موضعه الصحيح', () => {
        controller.setMode('quick');
        expect(store.state.appSettings?.mode).toBe('quick');
    });

    it('التبديل ذهاباً وإياباً لا يُراكم تلفاً', () => {
        controller.setMode('quick');
        controller.setMode('advanced');
        expect(typeof store.state).toBe('object');
        expect(store.state.appSettings?.mode).toBe('advanced');
        expect(store.state.projectInfo?.name).toBe('مقهى رواق');
    });
});

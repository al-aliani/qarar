/**
 * utils/engineVersionNotice.js — منطق موحّد (single source) لتنبيه بصمة إصدار المحرك،
 * مستخرَج من ProjectOverviewView (بند 4، 2026-08-29) كي تستخدمه أيضاً ShareView وExportMenu
 * وDecisionDashboard وExecutiveSummary بلا نسخ متفرقة من نفس فحص المقارنة.
 *
 * يثبّت أيضاً بند 5: النص السابق كان يدّعي أن إعادة الحفظ "تُثبّت" الأرقام — ادّعاء غير
 * صحيح (لا تجميد نتائج فعلي في هذه المرحلة). النص الجديد صادق بشأن ما يفعله الحفظ فعلياً.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../core/engine.js', () => ({ ENGINE_VERSION: 'v-current' }));

const { isEngineVersionStale, renderEngineVersionNotice, ENGINE_VERSION_NOTICE_TEXT } =
    await import('../engineVersionNotice.js');

describe('isEngineVersionStale', () => {
    it('false حين لا توجد بصمة محفوظة أصلاً (لا أساس مقارنة)', () => {
        expect(isEngineVersionStale({})).toBe(false);
        expect(isEngineVersionStale({ _meta: {} })).toBe(false);
        expect(isEngineVersionStale(null)).toBe(false);
    });

    it('false حين تطابق البصمة المحفوظة الإصدار الحالي', () => {
        expect(isEngineVersionStale({ _meta: { engineVersion: 'v-current' } })).toBe(false);
    });

    it('true حين تختلف البصمة المحفوظة عن الإصدار الحالي', () => {
        expect(isEngineVersionStale({ _meta: { engineVersion: 'v-old' } })).toBe(true);
    });
});

describe('renderEngineVersionNotice', () => {
    it('"" حين لا يلزم تنبيه', () => {
        expect(renderEngineVersionNotice({})).toBe('');
        expect(renderEngineVersionNotice({ _meta: { engineVersion: 'v-current' } })).toBe('');
    });

    it('يعرض عنصر HTML بصنف engine-version-notice حين يلزم تنبيه', () => {
        const html = renderEngineVersionNotice({ _meta: { engineVersion: 'v-old' } });
        expect(html).toContain('class="engine-version-notice"');
        expect(html).toContain('role="note"');
    });

    it('[بند 5] لا يدّعي أن الحفظ "يُثبّت" الأرقام — ادّعاء كاذب كان في النص القديم', () => {
        expect(ENGINE_VERSION_NOTICE_TEXT).not.toContain('لتثبيت النسخة الحالية');
        expect(ENGINE_VERSION_NOTICE_TEXT).not.toMatch(/تثبيت النسخة/);
    });

    it('[بند 5] يوضّح أن الحفظ لا يجمّد أي رقم، وأن كل عرض/تصدير يُعيد الحساب حياً', () => {
        expect(ENGINE_VERSION_NOTICE_TEXT).toContain('لا "تُثبّت" أي رقم');
        expect(ENGINE_VERSION_NOTICE_TEXT).toMatch(/يُعيد حساب الأرقام حياً/);
    });
});

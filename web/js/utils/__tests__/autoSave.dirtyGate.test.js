/**
 * تدقيق 2026-08-24: AutoSave كان يستدعي store.save() كل 30 ثانية بلا فحص وجود
 * تغييرات فعلية، فيُكرَّر تسجيل PersistenceService.log(ACTIONS.SAVE) ويمتلئ سجل
 * الأنشطة بعشرات السطور المتطابقة. store._dirty الموجودة أصلاً في store.js
 * (تُرفع عند أي تعديل حالة، تُخفض بعد حفظ ناجح) تمنع الآن التكة الفارغة.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoSave } from '../autoSave.js';

describe('AutoSave — بوابة store._dirty قبل استدعاء save()', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('لا يستدعي store.save() إن كانت _dirty=false وقت تنفيذ التكة', () => {
        const store = { _dirty: false, save: vi.fn() };
        const autoSave = new AutoSave(store);
        autoSave.save();
        vi.advanceTimersByTime(1000);
        expect(store.save).not.toHaveBeenCalled();
    });

    it('يستدعي store.save() إن كانت _dirty=true وقت تنفيذ التكة', () => {
        const store = { _dirty: true, save: vi.fn() };
        const autoSave = new AutoSave(store);
        autoSave.save();
        vi.advanceTimersByTime(1000);
        expect(store.save).toHaveBeenCalledTimes(1);
    });
});

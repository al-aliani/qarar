/**
 * @vitest-environment jsdom
 *
 * سلوك الوصول المشترك للنوافذ (utils/modalA11y.js). كان هذا المنطق مكرَّراً يدوياً
 * في 14 نافذة فسقطت بنود منه: 8 نوافذ لم تُعِد التركيز للزر الفاتح، و6 بلا حبس
 * تركيز، و2 بلا role="dialog". هذه الاختبارات تحرس المساعد الموحّد الذي حلّ محلها.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { attachModalA11y } from '../modalA11y.js';

function buildPage() {
    document.body.innerHTML = `
        <main id="pageMain">
            <button id="opener">افتح</button>
        </main>
        <div id="overlay" class="modal-overlay">
            <div class="modal-card">
                <h3 id="dlgTitle">عنوان النافذة</h3>
                <button id="btnClose">إغلاق</button>
                <input id="field" type="text">
                <button id="btnSave">حفظ</button>
            </div>
        </div>`;
    return {
        opener: document.getElementById('opener'),
        overlay: document.getElementById('overlay'),
        close: document.getElementById('btnClose'),
        field: document.getElementById('field'),
        save: document.getElementById('btnSave')
    };
}

/** Tab لا ينقل التركيز فعلياً في jsdom، فنُرسل الحدث ونفحص المعالج نفسه. */
function pressTab({ shift = false } = {}) {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(event);
    return event;
}

function pressEscape() {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(event);
    return event;
}

describe('attachModalA11y — سمات ARIA', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('يضبط role="dialog" و aria-modal و aria-labelledby على البطاقة لا على الـoverlay', () => {
        const page = buildPage();
        const handle = attachModalA11y({
            container: page.overlay,
            dialog: '.modal-card',
            labelledBy: 'dlgTitle'
        });
        const card = page.overlay.querySelector('.modal-card');

        expect(card.getAttribute('role')).toBe('dialog');
        expect(card.getAttribute('aria-modal')).toBe('true');
        expect(card.getAttribute('aria-labelledby')).toBe('dlgTitle');
        expect(page.overlay.hasAttribute('role')).toBe(false);
        handle.release();
    });

    it('لوحة غير حاجبة (modal:false): role="dialog" بلا aria-modal', () => {
        const page = buildPage();
        const handle = attachModalA11y({
            container: page.overlay,
            dialog: '.modal-card',
            modal: false,
            label: 'لوحة جانبية'
        });
        const card = page.overlay.querySelector('.modal-card');

        expect(card.getAttribute('role')).toBe('dialog');
        expect(card.hasAttribute('aria-modal')).toBe(false);
        expect(card.getAttribute('aria-label')).toBe('لوحة جانبية');
        handle.release();
    });
});

describe('attachModalA11y — التركيز الأولي وحبسه', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('عند الفتح ينتقل التركيز إلى داخل النافذة', () => {
        const page = buildPage();
        page.opener.focus();
        expect(document.activeElement).toBe(page.opener);

        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card', initialFocus: '#field' });

        expect(document.activeElement).toBe(page.field);
        expect(page.overlay.contains(document.activeElement)).toBe(true);
        handle.release();
    });

    it('بلا initialFocus: يركّز أول عنصر قابل للتركيز داخل النافذة', () => {
        const page = buildPage();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card' });
        expect(document.activeElement).toBe(page.close);
        handle.release();
    });

    it('Tab على آخر عنصر يعود لأوّله ولا يخرج من النافذة', () => {
        const page = buildPage();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card', initialFocus: '#btnSave' });
        expect(document.activeElement).toBe(page.save);

        const event = pressTab();

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(page.close);
        handle.release();
    });

    it('Shift+Tab على أول عنصر يلتف لآخره', () => {
        const page = buildPage();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card', initialFocus: '#btnClose' });

        const event = pressTab({ shift: true });

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(page.save);
        handle.release();
    });

    it('إن خرج التركيز عن النافذة (نقر على الخلفية) يُعيده Tab إلى الداخل', () => {
        const page = buildPage();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card' });
        page.opener.focus();
        expect(document.activeElement).toBe(page.opener);

        const event = pressTab();

        expect(event.defaultPrevented).toBe(true);
        expect(page.overlay.contains(document.activeElement)).toBe(true);
        handle.release();
    });

    it('العناصر المخفية (display:none) لا تدخل دورة التركيز', () => {
        const page = buildPage();
        // زر الحفظ آخر عنصر في التوصيف؛ بإخفائه يصير الحقل هو الأخير فعلياً،
        // فـTab منه يجب أن يلتف لأول عنصر لا أن يمرّ إلى زر مخفي.
        page.save.style.display = 'none';
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card', initialFocus: '#field' });

        const event = pressTab();

        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(page.close);
        handle.release();
    });

    it('لوحة غير حاجبة لا تحبس Tab إطلاقاً', () => {
        const page = buildPage();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card', modal: false, initialFocus: '#btnSave' });

        const event = pressTab();

        expect(event.defaultPrevented).toBe(false);
        handle.release();
    });
});

describe('attachModalA11y — Escape', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('Escape يستدعي onEscape', () => {
        const page = buildPage();
        const onEscape = vi.fn();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card', onEscape });

        pressEscape();

        expect(onEscape).toHaveBeenCalledTimes(1);
        handle.release();
    });

    it('بلا onEscape (نافذة إلزامية عمداً): Escape لا يفعل شيئاً', () => {
        const page = buildPage();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card' });

        expect(() => pressEscape()).not.toThrow();
        handle.release();
    });

    it('Escape يصل للنافذة العليا فقط حين تتراكب نافذتان', () => {
        const page = buildPage();
        const onFirst = vi.fn();
        const onSecond = vi.fn();
        const first = attachModalA11y({ container: page.overlay, dialog: '.modal-card', onEscape: onFirst });

        const second = document.createElement('div');
        second.innerHTML = '<div class="modal-card"><button id="topBtn">موافق</button></div>';
        document.body.appendChild(second);
        const top = attachModalA11y({ container: second, dialog: '.modal-card', onEscape: onSecond });

        pressEscape();
        expect(onSecond).toHaveBeenCalledTimes(1);
        expect(onFirst).not.toHaveBeenCalled();

        top.release();
        pressEscape();
        expect(onFirst).toHaveBeenCalledTimes(1);
        first.release();
    });

    it('SweetAlert مفتوح فوق النافذة: المساعد يتنحّى عن Escape و Tab', () => {
        const page = buildPage();
        const onEscape = vi.fn();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card', initialFocus: '#btnSave', onEscape });

        const swal = document.createElement('div');
        swal.className = 'swal2-container';
        swal.innerHTML = '<button id="swalOk">نعم</button>';
        document.body.appendChild(swal);

        pressEscape();
        expect(onEscape).not.toHaveBeenCalled();

        const tab = pressTab();
        expect(tab.defaultPrevented).toBe(false);

        swal.remove();
        pressEscape();
        expect(onEscape).toHaveBeenCalledTimes(1);
        handle.release();
    });
});

describe('attachModalA11y — إعادة التركيز عند الإغلاق', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('يُعيد التركيز للزر الذي فتح النافذة', () => {
        const page = buildPage();
        page.opener.focus();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card' });
        expect(document.activeElement).not.toBe(page.opener);

        page.overlay.remove();
        handle.release();

        expect(document.activeElement).toBe(page.opener);
    });

    it('إن أُزيل الزر الفاتح من DOM أثناء الفتح: يرجع لمنطقة المحتوى لا يترك التركيز ضائعاً', () => {
        const page = buildPage();
        page.opener.focus();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card' });

        page.opener.remove();      // إعادة رسم الصفحة أزالت الزر الفاتح
        page.overlay.remove();
        handle.release();

        expect(document.activeElement).toBe(document.getElementById('pageMain'));
        expect(document.activeElement).not.toBe(document.body);
    });

    it('يستخدم restoreFocusTo البديل حين يختفي الفاتح', () => {
        const page = buildPage();
        page.opener.focus();
        const handle = attachModalA11y({
            container: page.overlay,
            dialog: '.modal-card',
            restoreFocusTo: '#fallbackBtn'
        });
        const fallback = document.createElement('button');
        fallback.id = 'fallbackBtn';
        document.getElementById('pageMain').appendChild(fallback);

        page.opener.remove();
        page.overlay.remove();
        handle.release();

        expect(document.activeElement).toBe(fallback);
    });

    it('release لا يُعيد التركيز حين يُطلب صراحةً عدم إعادته', () => {
        const page = buildPage();
        page.opener.focus();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card', initialFocus: '#field' });

        handle.release({ restoreFocus: false });

        expect(document.activeElement).toBe(page.field);
    });

    it('بعد release تتوقف كل المستمعات (Escape لا يُستدعى بعد الإغلاق)', () => {
        const page = buildPage();
        const onEscape = vi.fn();
        const handle = attachModalA11y({ container: page.overlay, dialog: '.modal-card', onEscape });

        handle.release();
        handle.release();     // إغلاق مزدوج لا يكسر شيئاً
        pressEscape();

        expect(onEscape).not.toHaveBeenCalled();
    });
});

describe('attachModalA11y — مؤقّت focusDelay', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });
    afterEach(() => { vi.useRealTimers(); });

    it('release قبل انقضاء focusDelay يُلغي المؤقّت فلا يُستدعى focus بعده إطلاقاً', () => {
        const page = buildPage();
        page.opener.focus();
        const handle = attachModalA11y({
            container: page.overlay,
            dialog: '.modal-card',
            initialFocus: '#field',
            focusDelay: 30
        });
        const fieldFocus = vi.spyOn(page.field, 'focus');
        const closeFocus = vi.spyOn(page.close, 'focus');

        handle.release();
        vi.advanceTimersByTime(200);

        expect(fieldFocus).not.toHaveBeenCalled();
        expect(closeFocus).not.toHaveBeenCalled();
    });

    it('release({restoreFocus:false}) يُلغي المؤقّت أيضاً رغم خروجه المبكر', () => {
        const page = buildPage();
        page.opener.focus();
        const handle = attachModalA11y({
            container: page.overlay,
            dialog: '.modal-card',
            initialFocus: '#field',
            focusDelay: 30
        });
        const fieldFocus = vi.spyOn(page.field, 'focus');

        handle.release({ restoreFocus: false });
        vi.advanceTimersByTime(200);

        expect(fieldFocus).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(page.opener);
    });

    it('بلا release مبكر: التركيز الأولي يقع بعد انقضاء focusDelay لا قبله', () => {
        const page = buildPage();
        page.opener.focus();
        const handle = attachModalA11y({
            container: page.overlay,
            dialog: '.modal-card',
            initialFocus: '#field',
            focusDelay: 30
        });

        expect(document.activeElement).toBe(page.opener);
        vi.advanceTimersByTime(30);
        expect(document.activeElement).toBe(page.field);

        handle.release();
    });

    it('ترتيب الاستعادة: release يُعيد التركيز للفاتح ولا يخطفه المؤقّت بعدها', () => {
        const page = buildPage();
        page.opener.focus();
        const handle = attachModalA11y({
            container: page.overlay,
            dialog: '.modal-card',
            initialFocus: '#field',
            focusDelay: 30
        });

        // النافذة تبقى في DOM لحظة الإغلاق (حركة الاختفاء)، فالمؤقّت المتسرّب
        // قادر فعلاً على خطف التركيز إليها بعد أن أعادته release للفاتح.
        handle.release();
        expect(document.activeElement).toBe(page.opener);

        vi.advanceTimersByTime(200);
        expect(document.activeElement).toBe(page.opener);
    });
});

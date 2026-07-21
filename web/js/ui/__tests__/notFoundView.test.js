/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundView } from '../NotFoundView.js';

describe('NotFoundView', () => {
    beforeEach(() => {
        document.body.innerHTML = '<main id="host"></main>';
    });

    it('يعرض الرسالة الافتراضية للرابط غير المعروف', async () => {
        await new NotFoundView('host').render();

        expect(document.querySelector('h2').textContent).toBe('الصفحة غير موجودة');
        expect(document.querySelector('p').textContent).toContain('الرابط الذي فتحته غير صحيح');
    });

    it('يسمح برسالة انتقال واضحة للمسارات القديمة', async () => {
        const onHome = vi.fn();
        await new NotFoundView('host', {
            title: 'مراكز التشغيل لم تعد صفحة مستقلة',
            message: 'تم توزيع أدواتها داخل لوحة الدراسة.',
            onHome
        }).render();

        expect(document.querySelector('h2').textContent).toBe('مراكز التشغيل لم تعد صفحة مستقلة');
        expect(document.querySelector('p').textContent).toContain('تم توزيع أدواتها');
        document.querySelector('#btnNotFoundHome').click();
        expect(onHome).toHaveBeenCalledTimes(1);
    });

    it('يهرّب العنوان والرسالة المخصصة قبل إدخالهما في HTML', async () => {
        await new NotFoundView('host', {
            title: '<img src=x onerror=alert(1)>',
            message: '<script>alert(1)</script>'
        }).render();

        expect(document.querySelector('#host img')).toBeNull();
        expect(document.querySelector('#host script')).toBeNull();
        expect(document.querySelector('h2').textContent).toContain('<img');
        expect(document.querySelector('p').textContent).toContain('<script>');
    });
});

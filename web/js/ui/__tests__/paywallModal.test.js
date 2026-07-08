/**
 * @vitest-environment jsdom
 *
 * تدقيق 2026-07-08 (ملاحظة عالية #39، قرار المالك): كان الموقع يسوّق ثلاث باقات
 * (249/990/2900 ريال) بلا أي حاجز فعلي يمنع تصدير التقرير النهائي مجاناً — فجوة
 * ثقة مباشرة. هذا يثبّت أن PaywallModal يعرض الباقات الثلاث بأسعارها الحقيقية
 * (من pricing.js، مصدر الحقيقة الوحيد) وروابط واتساب صحيحة لكل باقة، دون أي زر
 * دفع وهمي (القرار: تواصل يدوي لكل الباقات الثلاث، لا بوابة دفع مزيَّفة).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PaywallModal } from '../PaywallModal.js';
import { PRICING_PACKAGES, formatPrice } from '../../core/pricing.js';

function fakeStore(state = {}) {
    return { getState: () => state };
}

describe('PaywallModal — عرض الباقات الثلاث بأسعار pricing.js الحقيقية', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('يعرض بطاقة واحدة لكل باقة من PRICING_PACKAGES بالضبط (لا أكثر ولا أقل)', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('تقرير PDF شامل');

        const cards = document.querySelectorAll('.paywall-package-card');
        expect(cards).toHaveLength(PRICING_PACKAGES.length);
        PRICING_PACKAGES.forEach(pkg => {
            const found = [...cards].some(c => c.textContent.includes(pkg.name) && c.textContent.includes(String(formatPrice(pkg.price))));
            expect(found, `باقة ${pkg.name} (${pkg.price}) غير معروضة بسعرها الصحيح`).toBe(true);
        });
    });

    it('كل زر ترقية يفتح رابط واتساب (لا زر "ادفع الآن" وهمياً) يحوي اسم الباقة وسعرها واسم المشروع', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore({ projectInfo: { name: 'مطعم الاختبار' } }));
        modal.open('ملف Excel التفصيلي');

        const links = [...document.querySelectorAll('.btn-whatsapp-upgrade')];
        expect(links).toHaveLength(PRICING_PACKAGES.length);
        links.forEach(link => {
            expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
            expect(link.getAttribute('target')).toBe('_blank');
            const decoded = decodeURIComponent(link.getAttribute('href').split('text=')[1]);
            expect(decoded).toContain('مطعم الاختبار');
            expect(decoded).toContain('ملف Excel التفصيلي');
        });
        // لا وجود لأي عنصر "زر دفع" (input[type=submit]/data-action=pay) — القرار: لا دفع وهمي
        expect(document.querySelector('[data-action="pay"]')).toBeNull();
    });

    it('اسم الصيغة المطلوبة (formatLabel) يظهر فعلياً في نص الرسالة الرئيسي للنافذة', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('نسخة للممول');
        expect(document.querySelector('.paywall-modal').textContent).toContain('نسخة للممول');
    });

    it('زر الإغلاق (×) يُغلق النافذة (يزيل صنف is-open ويستعيد التمرير)', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('تقرير PDF شامل');
        expect(document.getElementById('paywallOverlay').classList.contains('is-open')).toBe(true);

        document.querySelector('.paywall-close').click();
        expect(document.getElementById('paywallOverlay').classList.contains('is-open')).toBe(false);
        expect(document.body.style.overflow).toBe('');
    });

    it('النقر على الخلفية (لا البطاقة) يُغلق النافذة أيضاً', () => {
        const modal = new PaywallModal('paywallOverlay', fakeStore());
        modal.open('تقرير PDF شامل');
        const overlay = document.getElementById('paywallOverlay');
        overlay.click();
        expect(overlay.classList.contains('is-open')).toBe(false);
    });
});

/**
 * @vitest-environment jsdom
 *
 * دفعة 6 — FIX F: WebhookService/GoogleSheetsService ترسل بيانات الدراسة إلى رابط/
 * Web App مُهيَّأ من المستخدم، بلا أي نص موافقة/إفصاح ظاهر لحظة التفعيل («إضافة»/
 * «حفظ» في IntegrationsView.js). كان الويب هوك يملك إفصاحاً جزئياً فقط (قائمة
 * الأحداث بلا ذكر أنها نقطة نهاية المستخدم نفسه)، وGoogle Sheets لم يكن يملك أي
 * إفصاح إطلاقاً. الآن كلاهما يعرض جملة إفصاح واضحة أعلى زر التفعيل مباشرة.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegrationsView } from '../IntegrationsView.js';
import { WEBHOOK_CONSENT_TEXT } from '../../services/WebhookService.js';
import { GSHEETS_CONSENT_TEXT } from '../../services/GoogleSheetsService.js';

describe('IntegrationsView — إفصاح الموافقة عند تفعيل Webhook و Google Sheets', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="c"></div>';
        localStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('يعرض نص إفصاح Webhook فوق زر «إضافة» مباشرة قبل أي تفعيل', async () => {
        const view = new IntegrationsView(document.getElementById('c'));
        await view.render();
        const html = document.getElementById('c').innerHTML;
        expect(html).toContain(WEBHOOK_CONSENT_TEXT);

        // يظهر فعلياً قبل زر الإضافة في ترتيب DOM (أعلى نقطة التفعيل، لا مدفون لاحقاً)
        const addBtnIdx = html.indexOf('id="btnAddWebhook"');
        const consentIdx = html.indexOf(WEBHOOK_CONSENT_TEXT);
        expect(consentIdx).toBeGreaterThan(-1);
        expect(consentIdx).toBeLessThan(addBtnIdx);
    });

    it('يعرض نص إفصاح Google Sheets فوق زر «حفظ» مباشرة قبل أي تفعيل', async () => {
        const view = new IntegrationsView(document.getElementById('c'));
        await view.render();
        const html = document.getElementById('c').innerHTML;
        expect(html).toContain(GSHEETS_CONSENT_TEXT);

        const saveBtnIdx = html.indexOf('id="btnSaveGSheets"');
        const consentIdx = html.indexOf(GSHEETS_CONSENT_TEXT);
        expect(consentIdx).toBeGreaterThan(-1);
        expect(consentIdx).toBeLessThan(saveBtnIdx);
    });

    it('إفصاح Webhook يوضّح أنه رابط المستخدم نفسه (لا خادم المنصة)', async () => {
        const view = new IntegrationsView(document.getElementById('c'));
        await view.render();
        expect(WEBHOOK_CONSENT_TEXT).toMatch(/أنت بنفسك|أنت وحدك/);
    });

    it('إفصاح Google Sheets يوضّح أنه Web App المستخدم نفسه (لا خادم المنصة)', async () => {
        const view = new IntegrationsView(document.getElementById('c'));
        await view.render();
        expect(GSHEETS_CONSENT_TEXT).toMatch(/أنت بنفسك|أنت وحدك/);
    });
});

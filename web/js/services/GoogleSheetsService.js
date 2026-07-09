/**
 * Google Sheets Integration
 * المرحلة 4+ (معيار مهم)
 * تصدير دراسة الجدوى إلى Google Sheets
 */

/**
 * تدقيق أمني/إفصاح (دفعة 6): نص الموافقة/الإفصاح المعروض في واجهة التفعيل
 * (IntegrationsView) لحظة حفظ رابط Google Sheets — لم يكن هناك أي إفصاح سابقاً.
 * يوضّح أن الرابط Web App اختاره المستخدم بنفسه، وأن مؤشرات دراسته الفعلية
 * سترسل إليه تلقائياً عند كل عملية تصدير.
 */
export const GSHEETS_CONSENT_TEXT =
  'عند الحفظ، سيتم إرسال مؤشرات دراستك (الإيرادات، صافي الربح، NPV/IRR، التدفقات النقدية) تلقائياً ' +
  'إلى Web App الذي أعددته أنت بنفسك في Google Apps Script — نقطة نهاية تتحكم بها أنت وحدك — ' +
  'عند كل عملية تصدير إلى Google Sheets. تأكد من صحة الرابط وأنه يخصك قبل الحفظ.';

/**
 * تصدير إلى Google Sheets باستخدام Google Apps Script Web App
 * يتطلب إعداد Google Apps Script endpoint منفصل
 */
export async function exportToGoogleSheets(studyData, results) {
    // Web App URL (يجب إعداده من Google Apps Script)
    const webAppUrl = localStorage.getItem('GOOGLE_SHEETS_WEB_APP_URL');
    
    if (!webAppUrl) {
        return {
            ok: false,
            error: 'يرجى إعداد Google Sheets Web App URL أولاً'
        };
    }

    try {
        const payload = {
            projectName: studyData.projectInfo?.name || 'دراسة جدوى',
            date: new Date().toISOString(),
            indicators: {
                npv: results.indicators?.npv || 0,
                irr: (results.indicators?.irr || 0) * 100,
                payback: results.indicators?.paybackPeriod ?? results.indicators?.payback ?? null,
                roi: (results.indicators?.roi || 0) * 100
            },
            capex: results.capex?.total || 0,
            opex: results.opex?.totalAnnual || 0,
            incomeStatement: (results.incomeStatement || []).slice(0, 5).map(y => ({
                year: y.year,
                revenue: y.revenue || 0,
                netIncome: y.netIncome || 0,
                cashFlow: y.cashFlow || 0
            }))
        };

        const response = await fetch(webAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

/**
 * فتح مربع حوار لإعداد Google Sheets
 */
export function showGoogleSheetsSetup() {
    const url = localStorage.getItem('GOOGLE_SHEETS_WEB_APP_URL') || '';
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
    
    modal.innerHTML = `
        <div style="background:var(--c-bg-card);border-radius:12px;padding:24px;max-width:600px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
            <h3 style="margin:0 0 16px 0;">📊 إعداد Google Sheets</h3>
            <p style="font-size:14px;color:var(--c-text-muted);margin-bottom:16px;">
                لربط المنصة بـ Google Sheets، اتبع الخطوات التالية:
            </p>
            <p style="font-size:12px;color:var(--c-text-muted);background:var(--c-bg-app);border-radius:6px;padding:8px;margin-bottom:16px;">
                ⚠️ ${GSHEETS_CONSENT_TEXT}
            </p>
            <ol style="font-size:13px;color:var(--c-text-muted);margin-bottom:20px;padding-right:20px;">
                <li>افتح <a href="https://script.google.com" target="_blank">Google Apps Script</a></li>
                <li>أنشئ مشروع جديد والصق الكود التالي</li>
                <li>انشر كـ Web App واحصل على URL</li>
                <li>الصق URL أدناه</li>
            </ol>
            <textarea readonly style="width:100%;height:120px;font-size:11px;font-family:monospace;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:8px;margin-bottom:16px;">
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FeasSimulator') || ss.insertSheet('FeasSimulator');
  const data = JSON.parse(e.postData.contents);
  sheet.appendRow([data.projectName, data.date, data.indicators.npv, data.indicators.irr]);
  return ContentService.createTextOutput(JSON.stringify({status: 'success'}));
}</textarea>
            <div class="form-group">
                <label style="font-size:13px;margin-bottom:4px;display:block;">Web App URL:</label>
                <input type="url" id="inpGSheetsUrl" value="${url}" placeholder="https://script.google.com/macros/s/.../exec" style="width:100%;padding:10px;border:1px solid var(--c-border);border-radius:8px;">
            </div>
            <div style="display:flex;gap:8px;margin-top:16px;">
                <button id="btnSaveGSheets" class="btn btn--primary flex-1">حفظ</button>
                <button id="btnCancelGSheets" class="btn btn--ghost flex-1">إلغاء</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btnSaveGSheets').addEventListener('click', () => {
        const url = modal.querySelector('#inpGSheetsUrl').value.trim();
        if (url) {
            localStorage.setItem('GOOGLE_SHEETS_WEB_APP_URL', url);
            import('../utils/toast.js').then(({ toast }) => {
                toast.success('تم حفظ إعدادات Google Sheets');
            });
        }
        document.body.removeChild(modal);
    });

    modal.querySelector('#btnCancelGSheets').addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) document.body.removeChild(modal);
    });
}

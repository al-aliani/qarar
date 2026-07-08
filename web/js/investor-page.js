// نقطة دخول صفحة عرض المستثمر (investor.html) — مُخرَجة من inline script
// كي تُطبَّق سياسة CSP صارمة (script-src 'self' بلا unsafe-inline).
import { InvestorDashboard, getPitchFromStorage } from './ui/InvestorDashboard.js';

function getPayloadFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const dataB64 = params.get('data');

  if (dataB64) {
    try {
      // فك base64 مع دعم UTF-8 (النص عربي) — atob وحده يعطي بايتات latin1 فتظهر الحروف مشوّهة
      const bin = atob(dataB64.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      const json = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(json);
    } catch (e) {
      console.warn('Invalid data param:', e);
      return null;
    }
  }

  if (token) {
    return getPitchFromStorage(token);
  }

  return null;
}

const payload = getPayloadFromUrl();
const dashboard = new InvestorDashboard('pitchRoot', null, { standalone: true });
dashboard.render(payload);

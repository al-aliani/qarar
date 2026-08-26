/**
 * تدقيق 2026-08-26 (SWEEP_CONFIRMED.md — مسارات billing/downloads/support غير محمية):
 * routeToView في app.js يلفّ home/category/step بـrunProtectedRoute (AuthGuard.protect)
 * لكن الفروع الثلاثة #/billing و#/downloads و#/support كانت تستدعي معالجاتها مباشرة
 * (renderBillingRoute/renderDownloadsRoute/renderSupportRoute) بلا أي بوابة مصادقة —
 * زائر غير مسجَّل يفتح الرابط مباشرة ويرى الشاشة كاملة (البوابة الداخلية في الشاشات
 * نفسها كانت معطَّلة عمداً في BillingHistoryView.js/SupportTicketsView.js).
 *
 * app.js ملف IIFE ضخم غير معياري (لا exports) يُشغَّل داخل DOMContentLoaded — لا يمكن
 * استيراده وتنفيذ routeToView مباشرة في اختبار وحدة. نتبع هنا نمط الاختبار المعتمد فعلاً
 * في هذا المشروع لملف app.js (انظر authConsolidation.deadCodePurge.test.js): تفكيك جسم
 * كل فرع من فروع الموجّه عبر مطابقة الأقواس، والتأكد أن استدعاء المعالج يمرّ فعلياً عبر
 * runProtectedRoute(...) — بنفس آلية فروع home/category/step المحمية أصلاً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appJsPath = join(__dirname, '..', '..', 'app.js');
const src = readFileSync(appJsPath, 'utf8');

// يستخرج جسم فرع `else if (route.startsWith('<routeName>')) { ... }` عبر مطابقة الأقواس
// (لا regex غير-جشع هش أمام أي أقواس متداخلة داخل الجسم).
function routeBranchBody(routeName) {
  const marker = `route.startsWith('${routeName}')`;
  const markerIdx = src.indexOf(marker);
  expect(markerIdx, `لم يُعثر على فرع الموجّه لـ '${routeName}' في app.js`).toBeGreaterThan(-1);
  const braceStart = src.indexOf('{', markerIdx);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  expect(i, `لم يُغلَق جسم فرع '${routeName}' بقوس صحيح`).toBeLessThan(src.length);
  return src.slice(braceStart, i + 1);
}

describe('routeToView — حماية مسارات billing/downloads/support بتسجيل الدخول (app.js)', () => {
  const cases = [
    { routeName: 'billing', renderFn: 'renderBillingRoute' },
    { routeName: 'downloads', renderFn: 'renderDownloadsRoute' },
    { routeName: 'support', renderFn: 'renderSupportRoute' },
  ];

  it.each(cases)(
    'فرع #/$routeName يستدعي $renderFn عبر runProtectedRoute — لا مباشرة',
    ({ routeName, renderFn }) => {
      const body = routeBranchBody(routeName);

      // العيب المُبلَّغ عنه بالضبط: استدعاء مباشر بلا أي بوابة مصادقة.
      const directCallPattern = new RegExp(`await\\s+${renderFn}\\s*\\(\\s*\\)\\s*;`);
      expect(body).not.toMatch(directCallPattern);

      // الإصلاح المطلوب: نفس آلية home/category/step — تمرير عبر runProtectedRoute.
      const guardedCallPattern = new RegExp(
        `runProtectedRoute\\(\\s*\\(\\)\\s*=>\\s*${renderFn}\\(\\)\\s*\\)`
      );
      expect(body).toMatch(guardedCallPattern);
    }
  );

  it('فروع home/category/step المرجعية لا تزال محمية (لم يتأثر السلوك المرجعي بالتعديل)', () => {
    const homeIdx = src.indexOf("route === '' || route === 'home' || HOME_PANEL_ROUTES[route]");
    expect(homeIdx).toBeGreaterThan(-1);
    const stepIdx = src.indexOf("route.startsWith('step/')");
    expect(stepIdx).toBeGreaterThan(-1);
    const between = src.slice(homeIdx, stepIdx);
    // كلا الفرعين (home وcategory) يستدعيان runProtectedRoute مرتين على الأقل ضمن هذا المدى
    const matches = between.match(/runProtectedRoute\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

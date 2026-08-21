/**
 * دفعة 6 — اختبارات تأكيد محتوى ملفات إعداد (ليست وحدات JS) على غرار
 * web/js/core/__tests__/rlsDeployment.guard.test.js: قراءة الملف الحقيقي والتحقق
 * من محتواه نصياً/عبر تحليل YAML فعلي، بدل اختبار وظيفي كامل (غير ممكن لملفات إعداد).
 *
 * FIX B: vercel.json's CSP img-src كانت مفتوحة بالكامل على أي نطاق https:‎ (غير
 * متسقة مع script-src المحصور بدقة)، وStrict-Transport-Security كانت غائبة تماماً
 * رغم أن web/SECURITY.md نفسه يوثّق هذه الفجوة صراحة.
 *
 * FIX E: .github/workflows/supabase-migrations.yml's كانت تُخطي خطوة نشر RLS بصمت
 * (echo عادي) حين تغيب أسرار Supabase — الآن تستخدم ‎::warning::‎ فتظهر بوضوح في
 * ملخص تشغيل Actions وفحوصات الـPR بدل أن تُدفن في سجلات الخطوة.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as loadYaml } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');

// تدقيق 2026-08-21: vercel.json تحوّل من صيغة "headers" الحديثة إلى صيغة "routes"
// الكلاسيكية (Vercel لا يسمح بخلط routes مع headers/redirects/rewrites بنفس الملف —
// لازم عند إضافة إعادة توجيه www→apex ضمن نفس التهيئة). الرؤوس الفعلية لم تتغيّر
// جوهرياً، فقط مكانها بالملف — الآن كائن headers داخل عنصر routes بمسار '^/(.*)$'
// (وليس المسار الوحيد بهذا src؛ يُميَّز بوجود مفتاح headers فعلاً، لا بمجرد المطابقة).
function readHeadersBlock() {
    const configPath = resolve(REPO_ROOT, 'vercel.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    // أكثر من عنصر routes بنفس src="^/(.*)$" (إعادة توجيه www + كتلة الرؤوس الأمنية) —
    // نميّز كتلة الرؤوس بوجود Content-Security-Policy تحديداً، لا مجرد وجود headers.
    const route = config.routes.find(r => r.headers && r.headers['Content-Security-Policy']);
    return { config, headers: route?.headers };
}

describe('FIX B — vercel.json: تضييق img-src + إضافة HSTS', () => {
    it('img-src لم يعد مفتوحاً على https:‎ العام (يقتصر على self وdata: ونطاقات محدَّدة صراحة)', () => {
        const configPath = resolve(REPO_ROOT, 'vercel.json');
        expect(existsSync(configPath)).toBe(true);
        const { headers } = readHeadersBlock();
        expect(headers).toBeTruthy();
        const csp = headers['Content-Security-Policy'];
        expect(csp).toBeTruthy();
        const imgSrcMatch = csp.match(/img-src\s+([^;]+);?/);
        expect(imgSrcMatch).toBeTruthy();
        const imgSrcValue = imgSrcMatch[1].trim();
        // لا يوجد "https:" مفتوح (فحص عبر أجزاء الكلمات كي لا يطابق https:// كجزء من نطاق مذكور صراحة)
        const tokens = imgSrcValue.split(/\s+/);
        expect(tokens).not.toContain('https:');
        expect(tokens).toContain("'self'");
        expect(tokens).toContain('data:');
    });

    it('يتضمن Strict-Transport-Security (HSTS) في نفس كتلة الرؤوس', () => {
        const { headers } = readHeadersBlock();
        const hsts = headers['Strict-Transport-Security'];
        expect(hsts).toBeTruthy();
        expect(hsts).toMatch(/max-age=\d+/);
        expect(hsts).toMatch(/includeSubDomains/);
    });

    it('باقي رؤوس الأمان الأساسية ما زالت موجودة (لا انحدار جانبي)', () => {
        const { headers } = readHeadersBlock();
        const keys = Object.keys(headers);
        expect(keys).toContain('X-Frame-Options');
        expect(keys).toContain('X-Content-Type-Options');
        expect(keys).toContain('Referrer-Policy');
        expect(keys).toContain('Content-Security-Policy');
    });
});

describe('FIX E — supabase-migrations.yml: تحذير CI مرئي (::warning::) بدل echo عادي', () => {
    it('خطوة فحص الأسرار تستخدم تحذير Actions مرئياً (::warning:: أو ::error::) لا echo عادياً فقط', () => {
        const workflowPath = resolve(REPO_ROOT, '.github/workflows/supabase-migrations.yml');
        expect(existsSync(workflowPath)).toBe(true);
        const raw = readFileSync(workflowPath, 'utf8');
        const doc = loadYaml(raw);
        const job = doc.jobs['db-migrations'];
        expect(job).toBeTruthy();

        const checkStep = job.steps.find(s => s.id === 'check_secrets');
        expect(checkStep).toBeTruthy();
        expect(checkStep.run).toMatch(/::(warning|error)::/);

        // يبقى تخطياً آمناً (لا فشل بناء) — configured=false يُكتب فقط، لا exit 1
        expect(checkStep.run).toMatch(/configured=false/);
        expect(checkStep.run).not.toMatch(/exit\s+1/);
    });

    it('نص التحذير يوضّح أن RLS قد لا تكون مفعّلة فعلياً على المشروع الحقيقي', () => {
        const workflowPath = resolve(REPO_ROOT, '.github/workflows/supabase-migrations.yml');
        const raw = readFileSync(workflowPath, 'utf8');
        const doc = loadYaml(raw);
        const checkStep = doc.jobs['db-migrations'].steps.find(s => s.id === 'check_secrets');
        const warningLine = checkStep.run.split('\n').find(l => l.includes('::warning::') || l.includes('::error::'));
        expect(warningLine).toBeTruthy();
        expect(warningLine).toMatch(/RLS|أسرار|Supabase/);
    });

    it('خطوة النشر الفعلية مشروطة بتحقق الأسرار (لا تُشغَّل بلا تأكد)', () => {
        const workflowPath = resolve(REPO_ROOT, '.github/workflows/supabase-migrations.yml');
        const raw = readFileSync(workflowPath, 'utf8');
        const doc = loadYaml(raw);
        const steps = doc.jobs['db-migrations'].steps;
        const pushStep = steps.find(s => typeof s.run === 'string' && s.run.includes('supabase db push'));
        expect(pushStep).toBeTruthy();
        expect(pushStep.if).toMatch(/configured/);
    });
});

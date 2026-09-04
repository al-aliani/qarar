/**
 * تدقيق 2026-09-04 (رحلة عميل حقيقية + تدقيق أمني متوازٍ): خانة «إخفاء البيانات
 * المالية الحساسة» في مشاركة الدراسة كانت قائمة سوداء من 7 مفاتيح، اثنان منها
 * ('opex' و'capex') ليسا مفتاحَي قسم أصلاً — فكانت تُخفي 5 أقسام من 31 وتُرسل
 * 26 قسماً كاملة إلى حامل الرابط المجهول، وفيها قوائم مالية كاملة وزكاة وتقييم
 * ونقطة تعادل وتكاليف مرافق شهرية.
 *
 * هذا الحارس يمنع الانتكاس بطريقتين:
 *   1) يثبّت أن الدالة تستخدم قائمة بيضاء (jsonb_object_agg + key = any(array[...]))
 *      لا طرح مفاتيح ('-')، لأن القائمة السوداء تنكسر صامتاً عند إضافة أي قسم جديد.
 *   2) يقرأ SECTIONS الفعلية من schema.js ويتحقق أن كل قسم يحمل تفصيلاً مالياً
 *      غير مذكور في القائمة البيضاء — فأي قسم مالي يُضاف مستقبلاً ويُسرَّب يُسقِط الاختبار.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SECTIONS } from '../schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATION_PATH = resolve(
    REPO_ROOT,
    'supabase/migrations/20260904000000_share_hide_sensitive_whitelist.sql'
);

/** الأقسام التي تحمل مبالغ/رواتب/تكاليف تفصيلية — لا يجوز أن يمرّ أيٌّ منها عند الإخفاء. */
const FINANCIAL_SECTION_KEYS = [
    'hr', 'technical', 'financing', 'administrative', 'marketing', 'logistics',
    'techResources', 'services', 'keyPeople', 'orgStructure', 'legal',
    'financialStatements', 'zakatTax', 'breakEven', 'valuation', 'monteCarlo',
    'scenarios', 'actuals', 'operational', 'decisionDashboard',
];

function readMigration() {
    return readFileSync(MIGRATION_PATH, 'utf8');
}

/** الشيفرة وحدها بلا تعليقات `--` — التعليق التوثيقي يقتبس النمط القديم عمداً. */
function readMigrationCode() {
    return readMigration()
        .split('\n')
        .filter(line => !/^\s*--/.test(line))
        .join('\n');
}

/** يستخرج مفاتيح القائمة البيضاء من array[...] داخل الترحيل. */
function whitelistedKeys(sql) {
    const m = sql.match(/=\s*any\s*\(\s*array\s*\[([\s\S]*?)\]\s*\)/i);
    expect(m, 'القائمة البيضاء array[...] غير موجودة في الترحيل').toBeTruthy();
    return [...m[1].matchAll(/'([A-Za-z_]+)'/g)].map(x => x[1]);
}

describe('مشاركة الدراسة: إخفاء البيانات الحساسة يعمل بقائمة بيضاء خادمية', () => {
    it('الترحيل موجود ويعيد تعريف get_study_by_share_token', () => {
        expect(existsSync(MIGRATION_PATH)).toBe(true);
        const sql = readMigration();
        expect(sql).toMatch(/create\s+or\s+replace\s+function\s+public\.get_study_by_share_token/i);
        expect(sql).toMatch(/security\s+definer/i);
        expect(sql).toMatch(/set\s+search_path\s*=\s*public/i);
    });

    it('يستخدم قائمة بيضاء لا طرح مفاتيح — القائمة السوداء تنكسر صامتاً عند إضافة قسم', () => {
        const sql = readMigration();
        expect(sql).toMatch(/jsonb_object_agg/i);
        expect(sql).toMatch(/jsonb_each\s*\(\s*s\.data\s*\)/i);
        // لا طرح مفاتيح من data (النمط القديم: s.data - 'hr' - 'technical' ...)
        expect(readMigrationCode()).not.toMatch(/s\.data\s*-\s*'/);
    });

    it('لا يمرّ أي قسم يحمل تفصيلاً مالياً في القائمة البيضاء', () => {
        const allowed = whitelistedKeys(readMigration());
        const leaked = FINANCIAL_SECTION_KEYS.filter(k => allowed.includes(k));
        expect(leaked, `أقسام مالية مسموح بها في المشاركة المُخفاة: ${leaked.join(', ')}`).toEqual([]);
    });

    it('كل مفتاح في القائمة البيضاء قسم حقيقي في SECTIONS — لا مفاتيح وهمية كـopex/capex', () => {
        const allowed = whitelistedKeys(readMigration());
        const realSections = Object.values(SECTIONS);
        const phantom = allowed.filter(k => !realSections.includes(k));
        expect(phantom, `مفاتيح غير موجودة في SECTIONS (حذفها/سماحها بلا أثر): ${phantom.join(', ')}`).toEqual([]);
    });

    it('يُبقي ما تحتاجه شاشة العرض فعلاً كي لا تتحوّل المشاركة لصفحة فارغة', () => {
        const allowed = whitelistedKeys(readMigration());
        // ShareView.js يقرأ هذه الأقسام مباشرةً
        expect(allowed).toContain('projectInfo');
        expect(allowed).toContain('marketSizing');
        expect(allowed).toContain('revenue');
    });

    it('الحالة الافتراضية (hide_sensitive=false) تُرجع data كاملة بلا تصفية', () => {
        const sql = readMigration();
        expect(sql).toMatch(/else\s+s\.data/i);
    });
});

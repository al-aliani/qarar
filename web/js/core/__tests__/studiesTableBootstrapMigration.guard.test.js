/**
 * دفعة 7 (2026-08-27، نظافة قاعدة البيانات): جدول public.studies (المخطط
 * الكنسي في docs/supabase_setup.sql) لم يكن له أي CREATE TABLE مقابل في
 * supabase/migrations — كان موجوداً حياً فقط لأنه أُنشئ يدوياً مرة واحدة عبر
 * لصق ذلك الملف في Supabase Dashboard. بيئة جديدة (CI مستقبلية) تُعيد بناء
 * القاعدة من supabase/migrations فقط كانت ستفشل فوراً عند أول ترحيل يفترض
 * وجود الجدول ضمناً (20260708090000_enable_rls_studies.sql).
 *
 * هذا يثبّت: (أ) الملف الجديد موجود ويُنشئ الجدول فعلياً بالمخطط الكامل،
 * (ب) تاريخه يسبق أول ترحيل مُتتبَّع في هذا المستودع بأكمله (لا فقط
 * enable_rls_studies.sql تحديداً) — الشرط الحقيقي كي ينفَّذ أولاً على أي
 * بيئة جديدة، (ج) لا يعتمد على أي دالة معرَّفة في ترحيل لاحق زمنياً (وإلا
 * فشل هو نفسه على بيئة جديدة بنفس فئة العطل الذي يُصلحه).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'supabase/migrations');
const BOOTSTRAP_FILENAME = '20260708080000_studies_table_bootstrap.sql';

describe('ترحيل تأسيس جدول public.studies', () => {
    it('الملف موجود ويُنشئ الجدول فعلياً بكل الأعمدة الكنسية (docs/supabase_setup.sql)', () => {
        const path = resolve(MIGRATIONS_DIR, BOOTSTRAP_FILENAME);
        expect(existsSync(path)).toBe(true);
        const sql = readFileSync(path, 'utf8');

        expect(sql).toMatch(/create table if not exists public\.studies/i);
        ['id', 'user_id', 'title', 'description', 'sector', 'status', 'data', 'thumbnail_url', 'is_template', 'last_calculated_at', 'created_at', 'updated_at']
            .forEach((col) => expect(sql).toMatch(new RegExp(`\\b${col}\\b`, 'i')));

        // نفس قيد status الحي فعلياً (PersistenceService.js._saveCloud يتجنّب كتابة
        // status صراحة "لتفادي مخالفة قيد CHECK" — القيد أدناه هو ذلك القيد نفسه).
        expect(sql).toMatch(/check\s*\(\s*status\s+in\s*\('draft',\s*'active',\s*'completed',\s*'archived'\)\s*\)/i);

        expect(sql).toMatch(/create index if not exists idx_studies_user_id/i);
        expect(sql).toMatch(/create index if not exists idx_studies_status/i);
        expect(sql).toMatch(/create index if not exists idx_studies_updated_at/i);
    });

    it('تاريخه (اسم الملف) يسبق أول ترحيل مُتتبَّع في المستودع بأكمله — شرط تنفيذه أولاً على بيئة جديدة', () => {
        const allMigrationFiles = readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith('.sql'))
            .sort(); // الترتيب الأبجدي = الزمني (بادئة yyyymmddhhmmss)

        const bootstrapIndex = allMigrationFiles.indexOf(BOOTSTRAP_FILENAME);
        expect(bootstrapIndex).toBeGreaterThanOrEqual(0);
        expect(bootstrapIndex).toBe(0); // يجب أن يكون أول ملف في الترتيب الأبجدي/الزمني بأكمله

        const enableRlsIndex = allMigrationFiles.indexOf('20260708090000_enable_rls_studies.sql');
        expect(enableRlsIndex).toBeGreaterThan(bootstrapIndex);
    });

    it('لا يعتمد على أي دالة مُعرَّفة فقط في ترحيل لاحق زمنياً (تعريف update_updated_at ذاتي الاكتفاء)', () => {
        const sql = readFileSync(resolve(MIGRATIONS_DIR, BOOTSTRAP_FILENAME), 'utf8');
        // create or replace هنا يعني: بغض النظر عن ترتيب التنفيذ الفعلي مقابل
        // 20260717000000_profiles_and_phone.sql (المعرِّف الآخر لنفس الدالة)، هذا
        // الملف يعرّف الدالة بنفسه قبل استخدامها — لا اعتماد ضمني على ملف آخر.
        expect(sql).toMatch(/create or replace function public\.update_updated_at\s*\(\s*\)/i);
        const functionDefIndex = sql.search(/create or replace function public\.update_updated_at/i);
        const triggerUseIndex = sql.search(/create trigger update_studies_updated_at/i);
        expect(functionDefIndex).toBeGreaterThan(-1);
        expect(triggerUseIndex).toBeGreaterThan(functionDefIndex); // التعريف قبل الاستخدام داخل نفس الملف
    });

    it('لا يستخدم uuid_generate_v4 فعلياً كدالة تنفَّذ (يتطلب امتداد uuid-ossp غير مُتتبَّع) — gen_random_uuid فقط، مطابقةً لبقية الترحيلات', () => {
        const sql = readFileSync(resolve(MIGRATIONS_DIR, BOOTSTRAP_FILENAME), 'utf8');
        // استبعاد سطور التعليق (--) قبل الفحص: الملف يذكر uuid_generate_v4 داخل تعليق
        // يشرح سبب تجنّبها — الفحص هنا يخص الاستخدام الفعلي كدالة تُنفَّذ فقط.
        const executableSql = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
        expect(executableSql).not.toMatch(/uuid_generate_v4/i);
        expect(sql).toMatch(/default gen_random_uuid\(\)/i);
    });

    it('[إثبات الحارس] العطل الأصلي: بلا هذا الملف، لا CREATE TABLE لـpublic.studies في أي ترحيل مُتتبَّع', () => {
        const allSql = readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith('.sql') && f !== BOOTSTRAP_FILENAME)
            .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8'))
            .join('\n');
        expect(allSql).not.toMatch(/create table if not exists public\.studies\s*\(/i);
    });
});

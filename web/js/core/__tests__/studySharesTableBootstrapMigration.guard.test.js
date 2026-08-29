/**
 * (2026-08-29، نفس فئة الفجوة المُصلَحة سابقاً لجدول public.studies —
 * studiesTableBootstrapMigration.guard.test.js): جدول public.study_shares
 * (المخطط الكنسي في docs/supabase_setup.sql) لم يكن له أي CREATE TABLE مقابل
 * في supabase/migrations — كان موجوداً حياً فقط لأنه أُنشئ يدوياً مرة واحدة
 * عبر لصق ذلك الملف في Supabase Dashboard. كل ترحيل مُتتبَّع يمسّ هذا الجدول
 * (20260714020000_share_tokens.sql وستة أخرى بعده) يفترض وجوده ضمناً عبر
 * "alter table public.study_shares ..." بلا أي "create table" سابق. بيئة
 * جديدة (CI مستقبلية) تُعيد بناء القاعدة من supabase/migrations فقط كانت
 * ستفشل فوراً عند أول تلك الترحيلات.
 *
 * هذا يثبّت: (أ) الملف الجديد موجود ويُنشئ الجدول فعلياً بنفس أعمدة المخطط
 * الكنسي حرفياً (مقارنة حقل-بحقل لا فحص وجود سطحي)، (ب) هو الوحيد الذي ينشئ
 * هذا الجدول (لا تكرار)، (ج) تاريخه (اسم الملف) يسبق فعلياً كل ترحيل لاحق
 * يفترض وجود الجدول عبر ALTER TABLE، ويقع بعد ترحيل تأسيس public.studies
 * (اعتماد مفتاح أجنبي حقيقي)، (د) لا يُعرِّف RLS أو سياسات وصول — عمداً،
 * لتفادي تكرارها بنفس الأسماء المعرَّفة أصلاً في docs/supabase_setup.sql
 * (كان سيفشل "policy already exists" على الإنتاج الحي).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'supabase/migrations');
const CANONICAL_PATH = resolve(REPO_ROOT, 'docs/supabase_setup.sql');
const BOOTSTRAP_FILENAME = '20260714015000_study_shares_table_bootstrap.sql';
const STUDIES_BOOTSTRAP_FILENAME = '20260708080000_studies_table_bootstrap.sql';

function embeddedTimestamp(filename) {
    const match = filename.match(/^(\d{14})_/);
    if (!match) throw new Error(`اسم ترحيل بلا ختم زمني بادئ (yyyymmddhhmmss_): ${filename}`);
    return Number(match[1]);
}

/**
 * يستخرج نص جسم "CREATE TABLE ... public.study_shares ( ... )" فقط (بين
 * القوسين المتوازنَين)، متسامحاً مع حالة الأحرف والمسافات — يتعامل بشكل صحيح
 * مع أقواس متداخلة داخل تعريفات الأعمدة (مثل REFERENCES ...(id) أو CHECK(...)).
 */
function extractTableBody(sql) {
    const re = /create table if not exists public\.study_shares\s*\(/i;
    const m = sql.match(re);
    if (!m) return null;
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    for (; i < sql.length && depth > 0; i++) {
        if (sql[i] === '(') depth++;
        else if (sql[i] === ')') depth--;
    }
    return sql.slice(start, i - 1);
}

/** يقسّم جسم الجدول إلى تعريفات أعمدة مستقلة عبر الفواصل ذات المستوى الأعلى فقط. */
function splitTopLevelColumns(body) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of body) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) {
            parts.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    if (current.trim()) parts.push(current);
    return parts.map((p) => p.trim()).filter(Boolean);
}

function normalize(str) {
    return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

function columnDefsByName(sql) {
    const body = extractTableBody(sql);
    if (body === null) return null;
    const defs = new Map();
    for (const part of splitTopLevelColumns(body)) {
        const name = part.split(/\s+/)[0].toLowerCase();
        defs.set(name, normalize(part));
    }
    return defs;
}

describe('ترحيل تأسيس جدول public.study_shares', () => {
    const canonicalSql = readFileSync(CANONICAL_PATH, 'utf8');
    const bootstrapPath = resolve(MIGRATIONS_DIR, BOOTSTRAP_FILENAME);

    it('الملف موجود ويُنشئ الجدول فعلياً', () => {
        expect(existsSync(bootstrapPath)).toBe(true);
        const sql = readFileSync(bootstrapPath, 'utf8');
        expect(sql).toMatch(/create table if not exists public\.study_shares/i);
    });

    it('مقارنة حقل-بحقل: نفس مجموعة أعمدة المخطط الكنسي (docs/supabase_setup.sql) بالضبط، بنفس الترتيب', () => {
        const canonicalCols = columnDefsByName(canonicalSql);
        const bootstrapCols = columnDefsByName(readFileSync(bootstrapPath, 'utf8'));

        expect(canonicalCols).not.toBeNull();
        expect(bootstrapCols).not.toBeNull();

        // نفس مجموعة الأسماء بالضبط — لا عمود ناقص ولا عمود زائد لم يُقرَّه المصدر الكنسي.
        expect([...bootstrapCols.keys()]).toEqual([...canonicalCols.keys()]);

        for (const [name, canonicalDef] of canonicalCols) {
            const bootstrapDef = bootstrapCols.get(name);
            expect(bootstrapDef, `العمود "${name}" غير موجود في ترحيل التأسيس`).toBeDefined();

            if (name === 'id') {
                // انحراف موثَّق ومقصود (كما في studies bootstrap تماماً): gen_random_uuid()
                // بدل uuid_generate_v4() لتفادي الاعتماد على امتداد uuid-ossp غير
                // مُتتبَّع في أي ترحيل آخر بهذا المستودع.
                expect(canonicalDef).toMatch(/default uuid_generate_v4\(\)/);
                expect(bootstrapDef).toMatch(/default gen_random_uuid\(\)/);
                expect(canonicalDef.replace('uuid_generate_v4()', 'gen_random_uuid()')).toBe(bootstrapDef);
            } else {
                // بقية الأعمدة يجب أن تطابق المصدر الكنسي حرفياً (بعد تطبيع الحالة والمسافات).
                expect(bootstrapDef).toBe(canonicalDef);
            }
        }
    });

    it('يُنشئ نفس الفهرسين الكنسيين (idx_study_shares_study_id، idx_study_shares_email)', () => {
        const sql = readFileSync(bootstrapPath, 'utf8');
        expect(sql).toMatch(/create index if not exists idx_study_shares_study_id on public\.study_shares\s*\(\s*study_id\s*\)/i);
        expect(sql).toMatch(/create index if not exists idx_study_shares_email on public\.study_shares\s*\(\s*shared_with_email\s*\)/i);
    });

    it('لا يُعرِّف RLS أو أي سياسة وصول — عمداً، لتفادي تكرار سياسات docs/supabase_setup.sql المعرَّفة أصلاً بأسماء محدَّدة', () => {
        const sql = readFileSync(bootstrapPath, 'utf8');
        // نتأكد أولاً أن docs/supabase_setup.sql فعلاً يُعرِّف هذه السياسات بأسماء
        // محدَّدة — الشرط الذي يبرِّر عدم تكرارها هنا (لو أُعيد تكرارها بنفس الاسم
        // على الإنتاج الحي حيث السياسة موجودة أصلاً، تفشل الهجرة بـ"already exists").
        expect(canonicalSql).toMatch(/create policy "study owners can manage shares" on public\.study_shares/i);
        expect(canonicalSql).toMatch(/create policy "shared users can view their shares" on public\.study_shares/i);
        expect(canonicalSql).toMatch(/alter table public\.study_shares enable row level security/i);

        expect(sql).not.toMatch(/create policy/i);
        expect(sql).not.toMatch(/enable row level security/i);
    });

    it('هو الملف الوحيد الذي ينشئ هذا الجدول (لا تكرار CREATE TABLE عبر الترحيلات)', () => {
        const others = readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith('.sql') && f !== BOOTSTRAP_FILENAME)
            .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8'))
            .join('\n');
        expect(others).not.toMatch(/create table (if not exists )?public\.study_shares\s*\(/i);
    });

    it('ترتيب حقيقي: تاريخه يسبق فعلياً كل ترحيل لاحق يمسّ الجدول عبر ALTER TABLE (ليس فقط تأكيد ترتيب افتراضي)', () => {
        const bootstrapTs = embeddedTimestamp(BOOTSTRAP_FILENAME);
        const allFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));

        const dependentAlterFiles = allFiles.filter((f) => {
            if (f === BOOTSTRAP_FILENAME) return false;
            const sql = readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8');
            return /alter table public\.study_shares\b/i.test(sql);
        });

        // إثبات أن الفحص فعلاً يجد الترحيلات الحقيقية المعتمِدة (وليس قائمة فارغة
        // تمرّ صامتة بلا معنى).
        expect(dependentAlterFiles.length).toBeGreaterThanOrEqual(4);
        expect(dependentAlterFiles).toContain('20260714020000_share_tokens.sql');
        expect(dependentAlterFiles).toContain('20260718010001_share_growth_and_tracking.sql');
        expect(dependentAlterFiles).toContain('20260721110000_share_hide_sensitive.sql');
        expect(dependentAlterFiles).toContain('20260721130000_share_export_check_expand.sql');

        for (const f of dependentAlterFiles) {
            expect(embeddedTimestamp(f), `${f} يمسّ study_shares عبر ALTER TABLE لكن تاريخه لا يسبق ترحيل التأسيس`)
                .toBeGreaterThan(bootstrapTs);
        }
    });

    it('يقع بعد ترحيل تأسيس public.studies (اعتماد مفتاح أجنبي حقيقي: study_id يشير إلى public.studies)', () => {
        expect(embeddedTimestamp(BOOTSTRAP_FILENAME)).toBeGreaterThan(embeddedTimestamp(STUDIES_BOOTSTRAP_FILENAME));
    });

    it('[إثبات الحارس] العطل الأصلي: بلا هذا الملف، لا CREATE TABLE لـpublic.study_shares في أي ترحيل مُتتبَّع', () => {
        const allSql = readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith('.sql') && f !== BOOTSTRAP_FILENAME)
            .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8'))
            .join('\n');
        expect(allSql).not.toMatch(/create table (if not exists )?public\.study_shares\s*\(/i);
    });
});

/**
 * دفعة 7 (2026-08-27، نظافة قاعدة البيانات): templates/STUDIES_TABLE_AND_POLICIES.sql
 * يفترض عمود owner_id وقيم status مختلفة ('final' بدل 'completed') وعمود
 * template_slug غير موجود إطلاقاً في جدول public.studies الحي — لكن
 * BETA_LAUNCH.md وdocs/PERSISTENCE_FLOW.md يُشيران إليه كأنه مصدر إعداد
 * الجدول. تشغيله ضد الإنتاج الحي كان سيُنفِّذ ALTER TABLE...ADD COLUMN
 * IF NOT EXISTS فعلياً (يُعدِّل المخطط الحي جزئياً) قبل أن يفشل لاحقاً بخطأ
 * "column owner_id does not exist" عند إنشاء السياسات — لا يفشل بأمان
 * من البداية. هذا يثبّت وجود ترويسة تحذيرية بارزة تمنع تشغيله سهواً.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../');
const TEMPLATE_PATH = resolve(REPO_ROOT, 'templates/STUDIES_TABLE_AND_POLICIES.sql');

describe('templates/STUDIES_TABLE_AND_POLICIES.sql — ترويسة تحذيرية بارزة', () => {
    it('يبدأ الملف بتحذير صريح "مهجور" قبل أي SQL قابل للتنفيذ', () => {
        const content = readFileSync(TEMPLATE_PATH, 'utf8');
        const firstNonEmptyLines = content.split('\n').slice(0, 5).join('\n');

        expect(firstNonEmptyLines).toMatch(/مهجور/);
        expect(content).toMatch(/لا تُشغِّل هذا الملف/);
        expect(content).toMatch(/supabase\/migrations/); // يوجّه للمصدر الصحيح
    });

    it('يذكر التعارض المحدد فعلياً (owner_id مقابل user_id) لا تحذيراً عاماً غامضاً', () => {
        const content = readFileSync(TEMPLATE_PATH, 'utf8');
        expect(content).toMatch(/owner_id/);
        expect(content).toMatch(/user_id/);
    });

    it('لم يُحذَف الملف أو محتواه الأصلي (يبقى للسياق التاريخي فقط)', () => {
        const content = readFileSync(TEMPLATE_PATH, 'utf8');
        expect(content).toMatch(/create table if not exists public\.studies/i);
        expect(content).toMatch(/create policy studies_select_own/i);
    });
});

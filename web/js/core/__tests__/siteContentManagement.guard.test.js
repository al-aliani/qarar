import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = process.cwd();

describe('site content management deployment contract', () => {
    it('يشمل الجداول وRLS والنسخ ومكتبة الصور', () => {
        const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20260917010000_site_content_management.sql'), 'utf8');
        expect(sql).toContain('create table if not exists public.site_pages');
        expect(sql).toContain('alter table public.site_pages enable row level security');
        expect(sql).toContain('capture_site_content_revision');
        expect(sql).toContain("'site-media'");
        expect(sql).toContain('public.is_admin(auth.uid())');
    });

    it('يربط الرئيسية والصفحات الديناميكية بوقت التشغيل', () => {
        const landing = fs.readFileSync(path.join(root, 'web/landing.html'), 'utf8');
        const vite = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
        expect(landing).toContain('data-cms-text="hero.title"');
        expect(landing).toContain('site-content-runtime.js');
        expect(vite).toContain("cmsPage: resolve(__dirname, 'web/page.html')");
        expect(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).toContain('^/p/([a-z0-9-]+)$');
    });
});

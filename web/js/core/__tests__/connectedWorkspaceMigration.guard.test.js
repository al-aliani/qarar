import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20260917043844_connected_workspace.sql'), 'utf8');

describe('connected workspace migration', () => {
    it('ينشئ مصادر الربط الخمسة مع RLS', () => {
        for (const table of ['external_parties', 'work_requests', 'supplier_quotes', 'review_suggestions', 'project_tasks']) {
            expect(sql).toContain(`create table if not exists public.${table}`);
            expect(sql).toContain(`alter table public.${table} enable row level security`);
        }
    });

    it('adds an auditable request lifecycle and participant messaging', () => {
        const lifecycle = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20260917144116_operational_lifecycle.sql'), 'utf8');
        for (const table of ['external_party_members', 'work_request_events', 'work_request_messages']) {
            expect(lifecycle).toContain(`public.${table}`);
        }
        expect(lifecycle).toContain('advance_work_request');
        expect(lifecycle).toContain('record_work_request_change');
        expect(lifecycle).toContain('enable row level security');
    });

    it('حسم اقتراح الخبير واعتماد العرض يمران عبر RPC محمية', () => {
        expect(sql).toContain('function public.decide_review_suggestion');
        expect(sql).toContain('function public.accept_supplier_quote');
        expect(sql).toContain('revoke all on function public.decide_review_suggestion');
        expect(sql).toContain('revoke all on function public.accept_supplier_quote');
    });

    it('يمنع تغيير اقتراح الخبير مباشرة من العميل', () => {
        expect(sql).not.toContain('grant select, insert, update on public.review_suggestions');
        expect(sql).not.toContain('owners_decide_suggestions');
    });
});

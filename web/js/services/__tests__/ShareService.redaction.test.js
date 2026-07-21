import { describe, it, expect, vi } from 'vitest';

const single = vi.fn(async () => ({
    data: {
        title: 'Study', sector: 'Retail', permission: 'view',
        data: {
            projectInfo: { name: 'Public study', city: 'Riyadh', email: 'owner@example.com', phone: '0500000000' },
            financing: { iban: 'SA00', amount: 1000 },
            metadata: { accessToken: 'secret-token' },
        },
    },
    error: null,
}));
const rpc = vi.fn(() => ({ single }));
vi.mock('../../../supabaseClient.js', () => ({
    getSupabaseClient: vi.fn(async () => ({ ok: true, supabase: { rpc } })),
    getAuthUser: vi.fn(async () => ({ user: null })),
}));

describe('public share redaction', () => {
    it('removes direct contact, banking and token fields while preserving public values', async () => {
        const { getSharedStudy } = await import('../ShareService.js');
        const result = await getSharedStudy('share-token');
        expect(result.data.projectInfo.name).toBe('Public study');
        expect(result.data.projectInfo.city).toBe('Riyadh');
        expect(result.data.projectInfo.email).toBeUndefined();
        expect(result.data.projectInfo.phone).toBeUndefined();
        expect(result.data.financing.iban).toBeUndefined();
        expect(result.data.financing.amount).toBe(1000);
        expect(result.data.metadata.accessToken).toBeUndefined();
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn(),
            signOut: vi.fn()
        }
    }))
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: mocks.createClient
}));

function stubBrowserRuntime() {
    vi.stubGlobal('location', { hostname: 'localhost', reload: vi.fn() });
    vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => ''),
        setItem: vi.fn(),
        removeItem: vi.fn()
    });
}

describe('Supabase local development safety', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        mocks.createClient.mockClear();
        stubBrowserRuntime();
    });

    it('blocks the embedded production defaults in local development', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

        const { getSupabaseClient, getSupabaseConfigStatus } = await import('../../../supabaseClient.js');
        const status = getSupabaseConfigStatus();
        const result = await getSupabaseClient();

        expect(status.usingDefaultConfig).toBe(true);
        expect(status.blockedInDev).toBe(true);
        expect(result.ok).toBe(false);
        expect(result.blockedInDev).toBe(true);
        expect(result.supabase).toBeNull();
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it('requires an explicit override to use the embedded defaults in development', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', '');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
        vi.stubEnv('VITE_ALLOW_DEFAULT_SUPABASE_IN_DEV', 'true');

        const { getSupabaseClient } = await import('../../../supabaseClient.js');
        const result = await getSupabaseClient();

        expect(result.ok).toBe(true);
        expect(mocks.createClient).toHaveBeenCalledTimes(1);
    });
});

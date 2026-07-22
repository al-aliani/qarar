/**
 * Edge Function: check-name-availability
 * فحص إرشادي لتوفر نطاق .sa ومقابض إنستغرام/إكس لأسماء تجارية مقترحة (حتى 5
 * لكل طلب). المنطق القابل للاختبار في ../_shared/nameAvailability.ts — هذا
 * الملف فقط يربطه بمعالج HTTP + تحقق جلسة المستخدم (نفس نمط create-checkout).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkOneCandidate } from '../_shared/nameAvailability.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';

function jsonResponse(req: Request, body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    });
}

Deno.serve(async (req: Request) => {
    const preflight = handlePreflight(req);
    if (preflight) return preflight;
    if (req.method !== 'POST') return jsonResponse(req, { error: 'method_not_allowed' }, 405);

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return jsonResponse(req, { error: 'missing_auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    if (userError || !userData?.user) return jsonResponse(req, { error: 'invalid_session' }, 401);

    let body: { candidates?: unknown };
    try {
        body = await req.json();
    } catch {
        return jsonResponse(req, { error: 'invalid_body' }, 400);
    }

    const candidates = Array.isArray(body?.candidates) ? body.candidates.slice(0, 5) : [];
    if (!candidates.length) return jsonResponse(req, { error: 'no_candidates' }, 400);

    const results = await Promise.all(
        candidates.map((n: unknown) => checkOneCandidate(String(n || '').trim()))
    );
    return jsonResponse(req, { results });
});

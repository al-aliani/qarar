/**
 * Edge Function: places-nearby
 * وسيط خادمي لـ Google Places Nearby Search — المفتاح (GOOGLE_PLACES_API_KEY)
 * يبقى على الخادم فقط، لا يصل العميل إطلاقاً. يُرجع عدداً مُشتقّاً فقط (count)
 * امتثالاً لشروط استخدام Google Places (لا تخزين/إعادة صرف لقائمة الأماكن
 * الخام — أسماء/تقييمات/عناوين). المنطق القابل للاختبار (بناء رابط الاستعلام +
 * تحليل الاستجابة) في ../_shared/placesNearby.ts — هذا الملف فقط يربطه بمعالج
 * HTTP + تحقق جلسة المستخدم (نفس نمط check-name-availability/whatsapp-otp-send).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildNearbySearchUrl, parsePlacesCount } from '../_shared/placesNearby.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';

function jsonResponse(req: Request, body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
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
        global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    if (userError || !userData?.user) return jsonResponse(req, { error: 'invalid_session' }, 401);

    let body: { lat?: unknown; lng?: unknown; radiusMeters?: unknown };
    try {
        body = await req.json();
    } catch {
        return jsonResponse(req, { error: 'invalid_body' }, 400);
    }

    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return jsonResponse(req, { error: 'invalid_coords' }, 400);
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) return jsonResponse(req, { error: 'not_configured' }, 503);

    const url = buildNearbySearchUrl(lat, lng, Number(body?.radiusMeters), apiKey);

    try {
        const res = await fetch(url);
        if (!res.ok) return jsonResponse(req, { error: 'places_request_failed' }, 502);
        const json = await res.json();
        const count = parsePlacesCount(json);
        if (count === null) return jsonResponse(req, { error: 'places_response_invalid' }, 502);
        return jsonResponse(req, { count });
    } catch (e) {
        console.error('[places-nearby] Google Places request failed:', e);
        return jsonResponse(req, { error: 'places_request_failed' }, 502);
    }
});

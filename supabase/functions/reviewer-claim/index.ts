/**
 * Edge Function: reviewer-claim
 * مراجع يدّعي طلباً من الطابور. تسابق (race) بين مراجعَين على نفس الطلب
 * يُحسَم بشرط WHERE review_status='queued' داخل التحديث نفسه (ذرّي على
 * مستوى الصف في Postgres) — لا حاجة لقفل منفصل: أول تحديث ينجح يغيّر
 * review_status فيصبح شرط الثاني كاذباً فيُرجع صفر صفوف.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyReviewer } from '../_shared/reviewerAuth.ts';
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { insertNotification } from '../_shared/notify.ts';

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const auth = await verifyReviewer(userClient, adminClient, jwt);
  if (!auth.ok) return jsonResponse(req, auth.errorBody, auth.errorStatus);

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'invalid_json_body' }, 400);
  }
  if (!body.orderId) return jsonResponse(req, { error: 'missing_order_id' }, 400);

  const { data, error } = await adminClient
    .from('orders')
    .update({ reviewer_id: auth.reviewerId, review_status: 'in_review' })
    .eq('id', body.orderId)
    .eq('tier', 'reviewed')
    .eq('status', 'paid')
    .eq('review_status', 'queued')
    .select('id, user_id, study_id');

  if (error) {
    console.error('[reviewer-claim] update failed:', error);
    return jsonResponse(req, { error: 'claim_failed' }, 500);
  }
  if (!data || data.length === 0) {
    return jsonResponse(req, { error: 'already_claimed_or_not_found' }, 409);
  }

  // إعلام العميل ببدء المراجعة — لا يُسقط استجابة claim إن فشل (انظر notify.ts).
  await insertNotification(
    adminClient,
    {
      userId: data[0].user_id,
      type: 'review',
      title: 'بدأت مراجعة دراستك',
      body: 'بدأ أحد خبرائنا مراجعة دراستك المدفوعة، وستصلك النتيجة قريباً.',
      studyId: data[0].study_id,
    },
    'reviewer-claim'
  );

  return jsonResponse(req, { orderId: body.orderId, reviewStatus: 'in_review' });
});

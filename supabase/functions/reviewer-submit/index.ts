/**
 * Edge Function: reviewer-submit
 * إنهاء مراجعة طلب مُدّعى من نفس المراجع (تحقق ملكية الادّعاء إلزامي — لا
 * يكفي أن يكون المستدعي مراجعاً نشطاً، يجب أن يكون هو مَن ادّعى هذا الطلب
 * تحديداً). عند decision='certified' يُولَّد رقم شهادة عبر
 * generate_certificate_id() (تسلسل SQL، انظر الترحيل) قبل الكتابة.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyReviewer } from '../_shared/reviewerAuth.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

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
  if (!auth.ok) return jsonResponse(auth.errorBody, auth.errorStatus);

  let body: { orderId?: string; decision?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json_body' }, 400);
  }
  if (!body.orderId) return jsonResponse({ error: 'missing_order_id' }, 400);
  if (body.decision !== 'certified' && body.decision !== 'rejected') {
    return jsonResponse({ error: 'invalid_decision' }, 400);
  }

  let certificateId: string | null = null;
  if (body.decision === 'certified') {
    const { data: certData, error: certError } = await adminClient.rpc('generate_certificate_id');
    if (certError || !certData) {
      console.error('[reviewer-submit] certificate id generation failed:', certError);
      return jsonResponse({ error: 'certificate_generation_failed' }, 500);
    }
    certificateId = certData as string;
  }

  const { data, error } = await adminClient
    .from('orders')
    .update({
      review_status: body.decision,
      reviewer_notes: body.notes || null,
      reviewed_at: new Date().toISOString(),
      certificate_id: certificateId,
    })
    .eq('id', body.orderId)
    .eq('reviewer_id', auth.reviewerId)
    .eq('review_status', 'in_review')
    .select('id');

  if (error) {
    console.error('[reviewer-submit] update failed:', error);
    return jsonResponse({ error: 'submit_failed' }, 500);
  }
  if (!data || data.length === 0) {
    return jsonResponse({ error: 'not_your_claim_or_not_in_review' }, 409);
  }

  return jsonResponse({ orderId: body.orderId, reviewStatus: body.decision, certificateId });
});

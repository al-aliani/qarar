/**
 * Edge Function: reviewer-submit
 * إنهاء مراجعة طلب مُدّعى من نفس المراجع (تحقق ملكية الادّعاء إلزامي — لا
 * يكفي أن يكون المستدعي مراجعاً نشطاً، يجب أن يكون هو مَن ادّعى هذا الطلب
 * تحديداً). عند decision='certified' يُولَّد رقم شهادة عبر
 * generate_certificate_id() (تسلسل SQL، انظر الترحيل) قبل الكتابة.
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

  let body: { orderId?: string; decision?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { error: 'invalid_json_body' }, 400);
  }
  if (!body.orderId) return jsonResponse(req, { error: 'missing_order_id' }, 400);
  if (body.decision !== 'certified' && body.decision !== 'rejected') {
    return jsonResponse(req, { error: 'invalid_decision' }, 400);
  }
  // تدقيق أمني 2026-08-21: notes بلا تحقق نوع/طول سابقاً — يسمح بتخزين سلاسل ضخمة
  // (إساءة تخزين)، وأي واجهة تعرض هذا الحقل مستقبلاً بلا تهريب مخرجات تصبح عرضة لـXSS.
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string' || body.notes.length > 2000) {
      return jsonResponse(req, { error: 'invalid_notes' }, 400);
    }
  }

  let certificateId: string | null = null;
  if (body.decision === 'certified') {
    const { data: certData, error: certError } = await adminClient.rpc('generate_certificate_id');
    if (certError || !certData) {
      console.error('[reviewer-submit] certificate id generation failed:', certError);
      return jsonResponse(req, { error: 'certificate_generation_failed' }, 500);
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
    .select('id, user_id, study_id');

  if (error) {
    console.error('[reviewer-submit] update failed:', error);
    return jsonResponse(req, { error: 'submit_failed' }, 500);
  }
  if (!data || data.length === 0) {
    return jsonResponse(req, { error: 'not_your_claim_or_not_in_review' }, 409);
  }

  // إعلام العميل بانتهاء المراجعة — لا يُسقط استجابة submit إن فشل (انظر notify.ts).
  // نص الرفض يشير إلى ReviewStatusBadge/ExportMenu.js التي تعرض reviewer_notes فعلياً.
  const notifyBody =
    body.decision === 'certified'
      ? `حصلت دراستك على شهادة اعتماد رقم ${certificateId} من مراجع خبير.`
      : 'أعاد المراجع دراستك مع ملاحظات — راجعها الآن في صفحة تصدير الدراسة.';
  await insertNotification(
    adminClient,
    {
      userId: data[0].user_id,
      type: 'review',
      title: body.decision === 'certified' ? 'اعتُمدت دراستك من مراجع خبير' : 'أعاد المراجع دراستك مع ملاحظات',
      body: notifyBody,
      studyId: data[0].study_id,
    },
    'reviewer-submit'
  );

  return jsonResponse(req, { orderId: body.orderId, reviewStatus: body.decision, certificateId });
});

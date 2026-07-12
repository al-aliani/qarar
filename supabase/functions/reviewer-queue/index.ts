/**
 * Edge Function: reviewer-queue
 * تُستدعى من ReviewerDashboardView.js لعرض قائمتين: الطابور غير المُدّعى
 * («queued») وقائمة "قيد المراجعة عندي" (مُدّعاة من نفس المراجع). تستخدم
 * service_role (يتجاوز RLS) لذا يجب أن تكرّر هنا يدوياً نفس شرط سياسة
 * "orders_select_reviewer_queue" — الاعتماد على RLS وحده هنا خطأ، لأن
 * service_role لا يخضع له إطلاقاً.
 *
 * عمداً: لا تُرجع studies.data (حمولة الدراسة الكاملة) — عنوان وقطاع فقط،
 * إبقاءً على هذه النقطة خفيفة؛ فتح دراسة بعينها يقرأ studies.data مباشرة من
 * العميل عبر سياسة RLS الجديدة (studies_select_reviewer) بعد الادّعاء.
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

  const { data: orders, error } = await adminClient
    .from('orders')
    .select('id, study_id, study_uuid, review_status, reviewer_id, created_at, paid_at')
    .eq('tier', 'reviewed')
    .eq('status', 'paid')
    .or(`review_status.eq.queued,reviewer_id.eq.${auth.reviewerId}`)
    .order('paid_at', { ascending: true });

  if (error) {
    console.error('[reviewer-queue] orders select failed:', error);
    return jsonResponse({ error: 'query_failed' }, 500);
  }

  const studyUuids = (orders || [])
    .map((o: { study_uuid: string | null }) => o.study_uuid)
    .filter((id: string | null): id is string => Boolean(id));

  let studiesById: Record<string, { title: string; sector: string | null }> = {};
  if (studyUuids.length > 0) {
    const { data: studies } = await adminClient
      .from('studies')
      .select('id, title, sector')
      .in('id', studyUuids);
    studiesById = Object.fromEntries(
      (studies || []).map((s: { id: string; title: string; sector: string | null }) => [s.id, { title: s.title, sector: s.sector }])
    );
  }

  const items = (orders || []).map((o: {
    id: string; study_id: string | null; study_uuid: string | null;
    review_status: string; reviewer_id: string | null; created_at: string; paid_at: string | null;
  }) => ({
    orderId: o.id,
    studyId: o.study_id,
    studyTitle: o.study_uuid ? studiesById[o.study_uuid]?.title || null : null,
    sector: o.study_uuid ? studiesById[o.study_uuid]?.sector || null : null,
    reviewStatus: o.review_status,
    claimedByMe: o.reviewer_id === auth.reviewerId,
    createdAt: o.created_at,
    paidAt: o.paid_at,
  }));

  return jsonResponse({
    queue: items.filter((i) => i.reviewStatus === 'queued'),
    myClaims: items.filter((i) => i.claimedByMe),
  });
});

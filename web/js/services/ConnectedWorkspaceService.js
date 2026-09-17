import { getSupabaseClient, getAuthUser } from '../../supabaseClient.js';

async function clientAndUser() {
    const [{ supabase, ok, error }, { user }] = await Promise.all([getSupabaseClient(), getAuthUser()]);
    if (!ok || !supabase || !user) return { ok: false, error: error || 'سجّل الدخول أولاً.' };
    return { ok: true, supabase, user };
}

export async function listConnectedWorkspace(studyId) {
    const ctx = await clientAndUser();
    if (!ctx.ok || !studyId) return { ...ctx, data: null };
    const [requests, quotes, suggestions, tasks, versions] = await Promise.all([
        ctx.supabase.from('work_requests').select('id,request_type,title,details,status,party_id,assigned_to,due_at,next_action,result,created_at,updated_at').eq('study_id', studyId).order('created_at', { ascending: false }),
        ctx.supabase.from('supplier_quotes').select('id,request_id,party_id,section_key,item_key,item_label,amount_sar,vat_included,valid_until,attachment_url,accepted_at,created_at').eq('study_id', studyId).order('created_at', { ascending: false }),
        ctx.supabase.from('review_suggestions').select('id,field_path,old_value,proposed_value,rationale,status,created_at').eq('study_id', studyId).order('created_at', { ascending: false }),
        ctx.supabase.from('project_tasks').select('id,source_type,source_key,title,details,status,priority,due_date,completed_at,created_at').eq('study_id', studyId).order('created_at', { ascending: false }),
        ctx.supabase.from('study_versions').select('id,version_number,change_summary,created_at').eq('study_id', studyId).order('version_number', { ascending: false }).limit(20)
    ]);
    const failure = [requests, quotes, suggestions, tasks, versions].find(result => result.error);
    if (failure) return { ok: false, error: failure.error.message };
    return { ok: true, data: { requests: requests.data || [], quotes: quotes.data || [], suggestions: suggestions.data || [], tasks: tasks.data || [], versions: versions.data || [] } };
}

export async function listParties(type = null) {
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    let query = supabase.from('external_parties').select('id,party_type,name,description,sectors,cities,website_url,logo_url,average_response_hours').eq('active', true).order('name');
    if (type) query = query.eq('party_type', type);
    const result = await query;
    return result.error ? { ok: false, error: result.error.message } : { ok: true, data: result.data || [] };
}

export async function createWorkRequest(input) {
    const ctx = await clientAndUser();
    if (!ctx.ok) return ctx;
    const payload = {
        user_id: ctx.user.id,
        study_id: input.studyId || null,
        party_id: input.partyId || null,
        request_type: input.requestType,
        title: String(input.title || '').trim(),
        details: String(input.details || '').trim() || null
    };
    if (!payload.title) return { ok: false, error: 'عنوان الطلب مطلوب.' };
    const { data, error } = await ctx.supabase.from('work_requests').insert(payload).select().single();
    return error ? { ok: false, error: error.message } : { ok: true, data };
}

export async function syncDecisionTasks(studyId, actions = []) {
    const ctx = await clientAndUser();
    if (!ctx.ok || !studyId) return ctx;
    const rows = actions.map(item => ({
        study_id: studyId,
        user_id: ctx.user.id,
        source_type: 'decision',
        source_key: item.id,
        title: item.title,
        details: item.description || null,
        priority: item.priority || 'medium'
    }));
    if (!rows.length) return { ok: true, data: [] };
    const { data, error } = await ctx.supabase.from('project_tasks').upsert(rows, { onConflict: 'study_id,source_type,source_key', ignoreDuplicates: true }).select();
    return error ? { ok: false, error: error.message } : { ok: true, data: data || [] };
}

export async function updateTaskStatus(taskId, status) {
    const ctx = await clientAndUser();
    if (!ctx.ok) return ctx;
    const patch = { status, completed_at: status === 'done' ? new Date().toISOString() : null };
    const { data, error } = await ctx.supabase.from('project_tasks').update(patch).eq('id', taskId).select().single();
    return error ? { ok: false, error: error.message } : { ok: true, data };
}

export async function createStudyVersion(studyId, studyData, summary) {
    const ctx = await clientAndUser();
    if (!ctx.ok || !studyId) return ctx;
    const { data: latest } = await ctx.supabase.from('study_versions').select('version_number').eq('study_id', studyId).order('version_number', { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await ctx.supabase.from('study_versions').insert({
        study_id: studyId,
        version_number: Number(latest?.version_number || 0) + 1,
        data: studyData,
        change_summary: summary,
        created_by: ctx.user.id
    }).select().single();
    return error ? { ok: false, error: error.message } : { ok: true, data };
}

export async function decideSuggestion(id, status) {
    const ctx = await clientAndUser();
    if (!ctx.ok) return ctx;
    const { data, error } = await ctx.supabase.rpc('decide_review_suggestion', { target_id: id, next_status: status });
    return error ? { ok: false, error: error.message } : { ok: true, data };
}

export async function acceptSupplierQuote(id) {
    const ctx = await clientAndUser();
    if (!ctx.ok) return ctx;
    const { data, error } = await ctx.supabase.rpc('accept_supplier_quote', { target_id: id });
    return error ? { ok: false, error: error.message } : { ok: true, data };
}

export async function adminListConnectedOperations() {
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const [requests, parties] = await Promise.all([
        supabase.from('work_requests').select('id,request_type,title,status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('external_parties').select('id,party_type,name,verification_status,active,created_at').order('created_at', { ascending: false }).limit(100)
    ]);
    const failure = requests.error || parties.error;
    return failure ? { ok: false, error: failure.message } : { ok: true, data: { requests: requests.data || [], parties: parties.data || [] } };
}

export async function adminUpdateWorkRequest(id, status) {
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const result = await supabase.from('work_requests').update({ status }).eq('id', id).select('id').single();
    return result.error ? { ok: false, error: result.error.message } : { ok: true };
}

export async function listRequestThread(requestId) {
    const ctx = await clientAndUser();
    if (!ctx.ok) return ctx;
    const [events, messages] = await Promise.all([
        ctx.supabase.from('work_request_events').select('id,event_type,from_status,to_status,details,created_at').eq('request_id', requestId).order('created_at'),
        ctx.supabase.from('work_request_messages').select('id,sender_id,body,attachment_url,created_at').eq('request_id', requestId).order('created_at')
    ]);
    const failure = events.error || messages.error;
    return failure ? { ok: false, error: failure.message } : { ok: true, data: { events: events.data || [], messages: messages.data || [] } };
}

export async function sendRequestMessage(requestId, body, attachmentUrl = null) {
    const ctx = await clientAndUser();
    if (!ctx.ok) return ctx;
    const result = await ctx.supabase.from('work_request_messages').insert({ request_id: requestId, sender_id: ctx.user.id, body: String(body || '').trim() || null, attachment_url: attachmentUrl }).select().single();
    return result.error ? { ok: false, error: result.error.message } : { ok: true, data: result.data };
}

export async function advanceWorkRequest(id, status, nextAction = null) {
    const ctx = await clientAndUser();
    if (!ctx.ok) return ctx;
    const result = await ctx.supabase.rpc('advance_work_request', { target_id: id, next_status: status, requested_next_action: nextAction });
    return result.error ? { ok: false, error: result.error.message } : { ok: true, data: result.data };
}

export async function listAssignedRequests() {
    const ctx = await clientAndUser();
    if (!ctx.ok) return ctx;
    const result = await ctx.supabase.from('work_requests').select('id,user_id,study_id,request_type,title,details,status,due_at,next_action,created_at').eq('assigned_to', ctx.user.id).order('created_at', { ascending: false });
    return result.error ? { ok: false, error: result.error.message } : { ok: true, data: result.data || [] };
}

export async function submitSupplierQuote(request, quote) {
    const ctx = await clientAndUser();
    if (!ctx.ok) return ctx;
    const payload = { request_id: request.id, study_id: request.study_id, user_id: request.user_id, party_id: quote.partyId || null, section_key: quote.sectionKey, item_key: quote.itemKey || null, item_label: quote.itemLabel, amount_sar: Number(quote.amount), vat_included: !!quote.vatIncluded, valid_until: quote.validUntil || null };
    const result = await ctx.supabase.from('supplier_quotes').insert(payload).select().single();
    if (result.error) return { ok: false, error: result.error.message };
    await advanceWorkRequest(request.id, 'offered', 'مراجعة العرض واعتماده أو رفضه');
    return { ok: true, data: result.data };
}

export async function adminCreateParty(party) {
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const result = await supabase.from('external_parties').insert(party).select('id').single();
    return result.error ? { ok: false, error: result.error.message } : { ok: true, data: result.data };
}

export async function adminUpdateParty(id, patch) {
    const { supabase, ok, error } = await getSupabaseClient();
    if (!ok || !supabase) return { ok: false, error };
    const result = await supabase.from('external_parties').update(patch).eq('id', id).select('id').single();
    return result.error ? { ok: false, error: result.error.message } : { ok: true };
}

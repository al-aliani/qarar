import { getSupabaseClient } from '../../supabaseClient.js';

async function client() {
    const result = await getSupabaseClient();
    if (!result.ok || !result.supabase) throw new Error(result.error || 'Supabase غير مهيأ');
    return result.supabase;
}

async function run(operation) {
    try {
        const data = await operation(await client());
        return { ok: true, data };
    } catch (error) {
        return { ok: false, error: error?.message || 'تعذّر تنفيذ العملية' };
    }
}

export const listPages = () => run(async (db) => {
    const { data, error } = await db.from('site_pages').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
});

export const getPublishedPage = (slug) => run(async (db) => {
    const { data, error } = await db.from('site_pages').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
    if (error) throw error;
    return data;
});

export const savePage = (page) => run(async (db) => {
    const payload = { ...page };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.created_by;
    delete payload.updated_by;
    if (payload.status === 'published') payload.published_at = new Date().toISOString();
    const query = page.id
        ? db.from('site_pages').update(payload).eq('id', page.id)
        : db.from('site_pages').insert({ ...payload, created_by: (await db.auth.getUser()).data.user?.id || null });
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
});

export const deletePage = (id) => run(async (db) => {
    const { error } = await db.from('site_pages').delete().eq('id', id);
    if (error) throw error;
    return true;
});

export const listNavigation = () => run(async (db) => {
    const { data, error } = await db.from('site_navigation').select('*').order('location').order('sort_order');
    if (error) throw error;
    return data || [];
});

export const saveNavigation = (item) => saveEntity('site_navigation', item);
export const deleteNavigation = (id) => deleteEntity('site_navigation', id);

export const listPartners = (admin = true) => run(async (db) => {
    let query = db.from('site_partners').select('*').order('sort_order');
    if (!admin) query = query.eq('enabled', true);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
});

export const savePartner = (item) => saveEntity('site_partners', item);
export const deletePartner = (id) => deleteEntity('site_partners', id);

async function saveEntity(table, item) {
    return run(async (db) => {
        const payload = { ...item };
        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;
        const query = item.id ? db.from(table).update(payload).eq('id', item.id) : db.from(table).insert(payload);
        const { data, error } = await query.select().single();
        if (error) throw error;
        return data;
    });
}

async function deleteEntity(table, id) {
    return run(async (db) => {
        const { error } = await db.from(table).delete().eq('id', id);
        if (error) throw error;
        return true;
    });
}

export const listRevisions = (entityType, entityId) => run(async (db) => {
    const { data, error } = await db.from('site_content_revisions').select('*')
        .eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return data || [];
});

export const uploadMedia = (file) => run(async (db) => {
    if (!file?.type?.startsWith('image/')) throw new Error('اختر ملف صورة صالحاً');
    if (file.size > 5 * 1024 * 1024) throw new Error('حجم الصورة يجب ألا يتجاوز 5MB');
    const extension = String(file.name || '').split('.').pop().replace(/[^a-z0-9]/gi, '').toLowerCase() || 'webp';
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const { error } = await db.storage.from('site-media').upload(path, file, { cacheControl: '31536000', upsert: false });
    if (error) throw error;
    return db.storage.from('site-media').getPublicUrl(path).data.publicUrl;
});

export const listMedia = () => run(async (db) => {
    const { data: folders, error: folderError } = await db.storage.from('site-media').list('', { limit: 100, sortBy: { column: 'name', order: 'desc' } });
    if (folderError) throw folderError;
    const rows = [];
    for (const folder of folders || []) {
        if (folder.id) { rows.push(folder); continue; }
        const { data, error } = await db.storage.from('site-media').list(folder.name, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
        if (error) throw error;
        rows.push(...(data || []).filter((file) => file.id).map((file) => ({ ...file, path: `${folder.name}/${file.name}` })));
    }
    return rows.map((file) => ({ ...file, path: file.path || file.name, url: db.storage.from('site-media').getPublicUrl(file.path || file.name).data.publicUrl }));
});

export const deleteMedia = (path) => run(async (db) => {
    const { error } = await db.storage.from('site-media').remove([path]);
    if (error) throw error;
    return true;
});

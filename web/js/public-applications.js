import { getSupabaseClient } from '../supabaseClient.js';
import { trackEvent } from './utils/analytics.js';

trackEvent('public_page_view', { page: window.location.pathname.split('/').pop() || 'index.html' });

const form = document.querySelector('[data-public-application]');
if (form) {
    const status = form.querySelector('[data-form-status]');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submit = form.querySelector('button[type="submit"]');
        const values = Object.fromEntries(new FormData(form).entries());
        if (values.website) return;
        status.textContent = '';
        submit.disabled = true;
        submit.textContent = 'جاري الإرسال...';
        const { supabase, ok } = await getSupabaseClient();
        if (!ok || !supabase) {
            status.textContent = 'تعذر الاتصال حاليًا. حاول مرة أخرى لاحقًا.';
            submit.disabled = false; submit.textContent = 'إرسال الطلب'; return;
        }
        const { error } = await supabase.from('public_applications').insert({
            application_type: form.dataset.publicApplication,
            full_name: String(values.full_name || '').trim(),
            phone: String(values.phone || '').trim(),
            email: String(values.email || '').trim() || null,
            sector: String(values.sector || '').trim(),
            summary: String(values.summary || '').trim()
        });
        if (error) status.textContent = 'لم يتم إرسال الطلب. تحقق من البيانات وحاول مجددًا.';
        else {
            trackEvent('public_application_submitted', { application_type: form.dataset.publicApplication || 'unknown' });
            status.textContent = 'تم استلام طلبك بنجاح، وسنتواصل معك بعد مراجعته.';
            form.reset();
        }
        submit.disabled = false; submit.textContent = 'إرسال الطلب';
    });
}

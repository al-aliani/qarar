import { getSupabaseClient } from '../supabaseClient.js';
import { trackEvent } from './utils/analytics.js';
import { monitoring } from './utils/monitoring.js';

trackEvent('public_page_view', { page: window.location.pathname.split('/').pop() || 'index.html' });

const SUBMIT_LABEL = 'إرسال طلب مبدئي للمراجعة';

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
            submit.disabled = false; submit.textContent = SUBMIT_LABEL; return;
        }
        // دفعة 3 (2026-08-27، طبقة Rate limiting): الإدراج المباشر من المتصفح كان بلا
        // أي حدّ معدّل خادمي — استُبدل بدالة Edge وسيطة (submit-application) تطبّق حدّ
        // معدّل بمعرّف IP وتتحقق من honeypot خادمياً أيضاً؛ الإدراج المباشر أُغلق في
        // migration 20260827030000 (لا صلاحية insert مباشرة لـanon/authenticated بعد الآن).
        const { data, error } = await supabase.functions.invoke('submit-application', {
            body: {
                website: values.website, // honeypot — الدالة تتحقق منه خادمياً أيضاً
                application_type: form.dataset.publicApplication,
                full_name: String(values.full_name || '').trim(),
                phone: String(values.phone || '').trim(),
                email: String(values.email || '').trim() || null,
                sector: String(values.sector || '').trim(),
                summary: String(values.summary || '').trim()
            }
        });
        if (error) {
            // تدقيق حي 2026-07-22: كان الخطأ الفعلي (مثال: قيد phone بطول 9-20 حرفاً في
            // public_applications.sql) يُبتلَع بصمت — رسالة عامة واحدة لكل سبب فشل ممكن،
            // بلا أي أثر يساعد على التشخيص لاحقاً.
            monitoring.captureException(error, { applicationType: form.dataset.publicApplication });
            status.textContent = 'لم يتم إرسال الطلب. تحقق من البيانات وحاول مجددًا.';
        }
        else if (data?.error === 'rate_limited') {
            status.textContent = 'عدد المحاولات تجاوز الحد المسموح مؤقتاً. حاول مرة أخرى لاحقاً.';
        }
        else {
            trackEvent('public_application_submitted', { application_type: form.dataset.publicApplication || 'unknown' });
            status.textContent = 'تم استلام طلبك بنجاح، وسنتواصل معك بعد مراجعته.';
            form.reset();
        }
        submit.disabled = false; submit.textContent = SUBMIT_LABEL;
    });
}


/**
 * Email Service
 * Handles sharing feasibility studies via email.
 * Uses mailto for now, can be upgraded to EmailJS or backend API.
 */

export class EmailService {
    /**
     * Send study via email (mailto fallback)
     * @param {string} email - Recipient email
     * @param {string} subject - Email subject
     * @param {string} body - Email body
     */
    static sendMailTo(email, subject, body) {
        const mailtoLink = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
        return { success: true };
    }

    /**
     * Generate shareable text for a study.
     * @param {object} project - Project data
     * @returns {string} - Formatted text
     */
    static generateShareText(project) {
        const name = project.projectInfo?.name || 'مشروع جديد';
        const npv = project.decision?.npv || 0;
        const irr = project.decision?.irr || 0;

        return `مرحباً،
        
أود مشاركة دراسة الجدوى الخاصة بمشروع "${name}" معك.

المؤشرات الرئيسية:
- صافي القيمة الحالية (NPV): ${npv.toLocaleString()} ريال
- معدل العائد الداخلي (IRR): ${Math.round(irr * 100)}%

يمكنك الاطلاع على التفاصيل الكاملة في المرفقات أو المنصة.

تحياتي،`;
    }
}

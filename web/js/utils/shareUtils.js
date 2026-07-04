/**
 * WhatsApp Share Utility
 * Allows users to share study summary via WhatsApp
 */

export function shareViaWhatsApp(studyData, results) {
    try {
        const projectName = studyData.projectInfo?.name || 'دراسة الجدوى';
        const npv = results?.indicators?.npv || 0;
        const irr = results?.indicators?.irr || 0;
        const decision = results?.decision || 'قيد المراجعة';

        // Format numbers
        const formatNumber = (num) => {
            if (typeof num !== 'number') return '--';
            return new Intl.NumberFormat('ar-SA').format(Math.round(num));
        };

        // Create message
        const message = `
🎯 *${projectName}*

📊 نتائج دراسة الجدوى:

💰 صافي القيمة الحالية (NPV): ${formatNumber(npv)} ريال
📈 معدل العائد الداخلي (IRR): ${((irr || 0) * 100).toFixed(1)}%

✅ القرار: *${decision}*

تم إنشاء هذا التقرير باستخدام محاكي الجدوى
    `.trim();

        // URL encode
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

        // Open WhatsApp
        window.open(whatsappUrl, '_blank');

        return true;
    } catch (error) {
        console.error('WhatsApp share error:', error);
        return false;
    }
}

/**
 * Share study link (for future cloud version)
 */
export function shareStudyLink(studyId) {
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/study/${studyId}`;
    const message = `شاهد دراسة الجدوى الخاصة بي: ${shareUrl}`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
}

/**
 * إنشاء رابط لوحة المستثمر (Pitch View) — للقراءة فقط، قابل للمشاركة
 * يحفظ ملخص الدراسة في localStorage ويرجع رابطاً يحتوي على token
 * @param {Object} state - حالة الدراسة (store.getState())
 * @param {Object} results - نتيجة calculateStudy(state)
 * @returns {Promise<{ url: string, token: string } | null>}
 */
export async function generateInvestorLink(state, results) {
    try {
        const { buildPitchPayload, savePitchToStorage } = await import('../ui/InvestorDashboard.js');
        const payload = buildPitchPayload(state, results);
        if (!payload) return null;
        const token = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        if (!savePitchToStorage(token, payload)) return null;
        const origin = window.location.origin;
        const pathname = window.location.pathname;
        const basePath = pathname.endsWith('.html') ? pathname.replace(/[^/]+$/, '') : pathname.replace(/\/?$/, '');
        const investorPath = basePath ? `${basePath.replace(/\/$/, '')}/investor.html` : 'investor.html';
        const url = `${origin}${investorPath.startsWith('/') ? '' : '/'}${investorPath}?token=${token}`;
        return { url, token };
    } catch (error) {
        console.error('generateInvestorLink:', error);
        return null;
    }
}

/**
 * QR Code Generator for sharing study links
 * توليد رمز QR لمشاركة رابط الدراسة
 * المكتبة: qrcode (MIT License)
 */

import QRCode from 'qrcode';

/**
 * توليد رمز QR كـ data URL (للعرض في img)
 * @param {string} url - الرابط المراد ترميزه
 * @param {object} options - خيارات (مثل margin, width)
 * @returns {Promise<string>} data URL للصورة
 */
export async function generateQRDataURL(url, options = {}) {
    try {
        const opts = {
            margin: 2,
            width: 256,
            color: { dark: '#000000', light: '#ffffff' },
            ...options
        };
        return await QRCode.toDataURL(url, opts);
    } catch (err) {
        console.error('QR generation failed:', err);
        throw err;
    }
}

/**
 * تحميل رمز QR كملف PNG
 * @param {string} url - الرابط
 * @param {string} filename - اسم الملف (مثل: دراسة_جدوى_QR.png)
 */
export async function downloadQRAsPNG(url, filename = 'دراسة_جدوى_QR.png') {
    try {
        const dataUrl = await generateQRDataURL(url);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.click();
    } catch (err) {
        console.error('QR download failed:', err);
        throw err;
    }
}

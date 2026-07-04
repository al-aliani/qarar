/**
 * FounderCardGenerator.js
 * يولد "بطاقة رائد الأعمال" (Founder Card) للمشاركة الاجتماعية.
 * يستخدم Canvas لرسم بطاقة جذابة (Spotify Wrapped Style) تحتوي على:
 * - اسم المشروع والنشاط
 * - المدينة
 * - عبارة "أنا أطلق مشروعي..."
 * - شعار المنصة + QR Code (وهمي أو رابط)
 */

export class FounderCardGenerator {
    constructor(containerId, store) {
        this.containerId = containerId;
        this.store = store;
        this.canvas = null;
    }

    render(project) {
        const root = document.getElementById(this.containerId);
        if (!root) return;

        const info = project.projectInfo || {};
        const name = info.name || 'مشروعي';
        const concept = info.concept || 'مشروع جديد';
        const city = info.city || 'السعودية';

        root.innerHTML = `
            <div class="founder-card-modal fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
                <div class="relative bg-gray-900 rounded-2xl border border-gold/30 p-6 max-w-lg w-full text-center shadow-2xl">
                    <button class="btn-close absolute top-4 left-4 text-white hover:text-red-500 text-xl">&times;</button>
                    
                    <h3 class="text-xl font-bold text-gold mb-4">🚀 بطاقة رائد الأعمال</h3>
                    <p class="text-sm text-muted mb-6">شارك حلمك مع العالم! هذه البطاقة مصممة للنشر واجتذاب الدعم.</p>
                    
                    <div class="canvas-wrapper flex justify-center mb-6 overflow-hidden rounded-xl border border-white/10">
                        <canvas id="founderCardCanvas" width="800" height="1000" style="max-width: 100%; height: auto;"></canvas>
                    </div>

                    <div class="actions flex gap-3 justify-center">
                        <button id="btnDownloadCard" class="btn btn--primary flex items-center gap-2">
                            📥 تحميل الصورة
                        </button>
                        <button id="btnShareTwitter" class="btn btn--secondary flex items-center gap-2">
                            🐦 مشاركة
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.canvas = document.getElementById('founderCardCanvas');
        this.drawCard(name, concept, city);

        // Bind events
        root.querySelector('.btn-close').addEventListener('click', () => {
            root.innerHTML = ''; // Close/Clear
        });

        root.querySelector('#btnDownloadCard').addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = `founder-card-${Date.now()}.png`;
            link.href = this.canvas.toDataURL('image/png');
            link.click();
        });

        root.querySelector('#btnShareTwitter').addEventListener('click', () => {
            const text = `أنا أطلق مشروعي "${name}" في ${city}! 🚀\nادعوا لي بالتوفيق 🙏\n#ريادة_أعمال #السعودية \nتم التخطيط عبر منصة الجدوى`;
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        });
    }

    drawCard(name, concept, city) {
        if (!this.canvas) return;
        const ctx = this.canvas.getContext('2d');
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 1. Background (Gradient Dark + Modern Noise/Pattern)
        const grd = ctx.createLinearGradient(0, 0, w, h);
        grd.addColorStop(0, '#1a1a1a');
        grd.addColorStop(1, '#000000');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);

        // Decorative Circles (Spotify Wrapped ish)
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#D4AF37'; // Gold
        ctx.beginPath();
        ctx.arc(w, 0, 400, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#4CAF50'; // Green
        ctx.beginPath();
        ctx.arc(0, h, 300, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // 2. Text Content
        ctx.textAlign = 'center';

        // "I am launching..." Header
        ctx.font = 'bold 40px "Tajawal", "Segoe UI", sans-serif'; // Fallback fonts
        ctx.fillStyle = '#e5e7eb'; // Gray-200
        ctx.fillText('أنا أطلق مشروعي...', w / 2, 150);

        // Project Name (Big Gold)
        ctx.font = 'bold 80px "Tajawal", sans-serif';
        ctx.fillStyle = '#D4AF37';
        ctx.fillText(name, w / 2, 300);

        // Concept & City
        ctx.font = '50px "Tajawal", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${concept}`, w / 2, 400);

        ctx.font = '40px "Tajawal", sans-serif';
        ctx.fillStyle = '#9ca3af'; // Gray-400
        ctx.fillText(`📍 ${city}`, w / 2, 480);

        // Divider
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w / 4, 550);
        ctx.lineTo(w * 3 / 4, 550);
        ctx.stroke();

        // Quote/Stats
        ctx.font = 'italic 36px "Tajawal", serif';
        ctx.fillStyle = '#ffffff';
        const msg = "ادعوا لي بالتوفيق! 🙏";
        ctx.fillText(msg, w / 2, 650);

        // 3. Footer / Branding
        ctx.fillStyle = '#111';
        ctx.fillRect(0, h - 150, w, 150);

        // Fake Logo Text
        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#D4AF37';
        ctx.textAlign = 'right';
        ctx.fillText('الجدوى.com', w - 50, h - 60);

        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('خططت مستقبلي بذكاء', w - 50, h - 30);

        // QR Code Placeholder
        ctx.fillStyle = 'white';
        ctx.fillRect(50, h - 130, 110, 110);
        ctx.fillStyle = 'black';
        ctx.fillRect(60, h - 120, 90, 90); // Dummy QR
    }
}


import { EmailService } from '../services/EmailService.js';
import { toast } from '../utils/toast.js';

export class EmailModal {
    constructor(project) {
        this.project = project;
        this.container = null;
    }

    open() {
        this.container = document.createElement('div');
        this.container.className = 'modal-overlay is-open';

        this.container.innerHTML = `
            <div class="modal-card max-w-lg">
                <div class="modal-header">
                    <h3>✉️ مشاركة الدراسة عبر البريد</h3>
                    <button class="btn-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group mb-4">
                        <label class="block text-sm font-bold mb-2">البريد الإلكتروني للمستلم</label>
                        <input type="email" id="emailTo" class="input w-full" placeholder="name@example.com">
                    </div>
                    <div class="form-group mb-4">
                        <label class="block text-sm font-bold mb-2">الرسالة</label>
                        <textarea id="emailBody" class="input w-full h-32">${EmailService.generateShareText(this.project)}</textarea>
                    </div>
                </div>
                <div class="modal-footer flex justify-end gap-2">
                    <button class="btn btn--ghost btn-cancel">إلغاء</button>
                    <button class="btn btn--primary btn-send">إرسال 🚀</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
        this._bindEvents();
    }

    close() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    _bindEvents() {
        const closeBtn = this.container.querySelector('.btn-close');
        const cancelBtn = this.container.querySelector('.btn-cancel');
        const sendBtn = this.container.querySelector('.btn-send');

        const close = () => this.close();

        closeBtn.addEventListener('click', close);
        cancelBtn.addEventListener('click', close);

        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) close();
        });

        sendBtn.addEventListener('click', () => {
            const email = this.container.querySelector('#emailTo').value;
            const body = this.container.querySelector('#emailBody').value; // Updated body from textarea
            const subject = `دراسة جدوى: ${this.project.projectInfo?.name || 'مشروع'}`;

            if (!email) {
                toast.error('الرجاء إدخال البريد الإلكتروني');
                return;
            }

            EmailService.sendMailTo(email, subject, body);
            toast.success('تم فتح تطبيق البريد للإرسال');
            close();
        });
    }
}

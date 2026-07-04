# دليل التكامل والميزات المتقدمة

**الغرض:** تنفيذ ميزات التكامل الخارجي والتحليلات  
**تاريخ:** يناير 2026

---

## 1. Google Analytics 4 (GA4) Integration

### 1.1 الإعداد الأولي

#### خطوة 1: إنشاء حساب GA4

1. اذهب إلى [Google Analytics](https://analytics.google.com/)
2. أنشئ حساباً جديداً
3. أنشئ Property بنوع "Web"
4. احصل على **Measurement ID** (مثال: `G-XXXXXXXXXX`)

#### خطوة 2: تثبيت GA4 في التطبيق

في `web/index.html`:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### 1.2 إنشاء Analytics Service

في `web/js/utils/analytics.js`:

```javascript
/**
 * Analytics Service
 * تتبع الأحداث والسلوك في المنصة
 */

export class Analytics {
  static initialized = false;

  /**
   * تفعيل التتبع
   */
  static init(measurementId, userConsent = false) {
    if (this.initialized) return;

    // التحقق من موافقة المستخدم
    if (!userConsent && !this.checkUserConsent()) {
      console.log('[Analytics] User consent required');
      return;
    }

    // تحميل GA4
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    script.onload = () => {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() { dataLayer.push(arguments); };
      gtag('js', new Date());
      gtag('config', measurementId, {
        cookie_flags: 'SameSite=None;Secure',
        anonymize_ip: true,  // إخفاء IP للخصوصية
        allow_google_signals: false  // إيقاف الإعلانات
      });

      this.initialized = true;
      console.log('[Analytics] Initialized');
    };
  }

  /**
   * تحقق من موافقة المستخدم (GDPR)
   */
  static checkUserConsent() {
    const consent = localStorage.getItem('analytics_consent');
    return consent === 'true';
  }

  /**
   * حفظ موافقة المستخدم
   */
  static setUserConsent(allowed) {
    localStorage.setItem('analytics_consent', allowed.toString());
    if (allowed && !this.initialized) {
      // إعادة تحميل الصفحة أو تفعيل GA4 مباشرة
      window.location.reload();
    }
  }

  /**
   * تتبع حدث
   */
  static trackEvent(eventName, params = {}) {
    if (!this.initialized || typeof gtag === 'undefined') {
      console.log('[Analytics] Not initialized, skipping event:', eventName);
      return;
    }

    gtag('event', eventName, {
      ...params,
      timestamp: new Date().toISOString()
    });

    console.log('[Analytics] Event tracked:', eventName, params);
  }

  /**
   * تتبع صفحة
   */
  static trackPageView(pageName, additionalParams = {}) {
    this.trackEvent('page_view', {
      page_title: pageName,
      page_location: window.location.href,
      ...additionalParams
    });
  }

  /**
   * تتبع إنشاء دراسة
   */
  static trackStudyCreated(sector, template) {
    this.trackEvent('study_created', {
      sector,
      template: template || 'blank',
      event_category: 'engagement'
    });
  }

  /**
   * تتبع إكمال خطوة
   */
  static trackStepCompleted(stepNumber, stepName, timeSpent) {
    this.trackEvent('step_completed', {
      step_number: stepNumber,
      step_name: stepName,
      time_spent_seconds: timeSpent,
      event_category: 'progress'
    });
  }

  /**
   * تتبع التصدير
   */
  static trackExport(format, studySize = 'medium') {
    this.trackEvent(`export_${format.toLowerCase()}`, {
      format,
      study_size: studySize,
      event_category: 'conversion'
    });
  }

  /**
   * تتبع استخدام AI
   */
  static trackAISuggestionUsed(suggestionType) {
    this.trackEvent('ai_suggestion_used', {
      suggestion_type: suggestionType,
      event_category: 'ai_interaction'
    });
  }

  /**
   * تتبع مشاركة (QR Code)
   */
  static trackShare(method = 'qr') {
    this.trackEvent('share', {
      method,
      content_type: 'feasibility_study',
      event_category: 'engagement'
    });
  }

  /**
   * تتبع نسخ مشروع
   */
  static trackStudyDuplicated(originalStudyId) {
    this.trackEvent('study_duplicated', {
      original_study_id: originalStudyId,
      event_category: 'engagement'
    });
  }

  /**
   * تتبع الأخطاء
   */
  static trackError(errorMessage, errorContext = {}) {
    this.trackEvent('error', {
      error_message: errorMessage,
      ...errorContext,
      event_category: 'error'
    });
  }

  /**
   * تتبع الوقت المستغرق
   */
  static trackTiming(name, value, category = 'performance') {
    this.trackEvent('timing_complete', {
      name,
      value,
      event_category: category
    });
  }

  /**
   * تتبع تسجيل الدخول
   */
  static trackLogin(method = 'email') {
    this.trackEvent('login', {
      method,
      event_category: 'authentication'
    });
  }

  /**
   * تتبع التسجيل
   */
  static trackSignUp(method = 'email') {
    this.trackEvent('sign_up', {
      method,
      event_category: 'authentication'
    });
  }

  /**
   * تتبع القرار الاستثماري
   */
  static trackInvestmentDecision(decision, npv, irr) {
    this.trackEvent('investment_decision', {
      decision, // GO, NO-GO, REVISE
      npv_range: this.getNPVRange(npv),
      irr_range: this.getIRRRange(irr),
      event_category: 'conversion'
    });
  }

  // ================== مساعدات ==================

  static getNPVRange(npv) {
    if (npv < 0) return 'negative';
    if (npv < 100000) return '0-100k';
    if (npv < 500000) return '100k-500k';
    if (npv < 1000000) return '500k-1m';
    return '1m+';
  }

  static getIRRRange(irr) {
    if (irr < 0) return 'negative';
    if (irr < 10) return '0-10';
    if (irr < 20) return '10-20';
    if (irr < 30) return '20-30';
    return '30+';
  }
}
```

### 1.3 التكامل في التطبيق

#### في `web/app.js`:

```javascript
import { Analytics } from './js/utils/analytics.js';

// عند تحميل التطبيق
document.addEventListener('DOMContentLoaded', () => {
  // التحقق من موافقة المستخدم
  if (!Analytics.checkUserConsent()) {
    showCookieConsentBanner();
  } else {
    Analytics.init('G-XXXXXXXXXX', true);
  }
});

function showCookieConsentBanner() {
  const banner = document.createElement('div');
  banner.className = 'cookie-consent-banner';
  banner.innerHTML = `
    <div class="cookie-consent-content">
      <p>نستخدم التحليلات لتحسين تجربتك. هل توافق على تفعيل التتبع؟</p>
      <div class="cookie-consent-actions">
        <button id="accept-analytics">موافق</button>
        <button id="reject-analytics">رفض</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('accept-analytics').onclick = () => {
    Analytics.setUserConsent(true);
    banner.remove();
  };

  document.getElementById('reject-analytics').onclick = () => {
    Analytics.setUserConsent(false);
    banner.remove();
  };
}
```

#### في مكونات الواجهة:

```javascript
// في Wizard.js
nextStep() {
  const timeSpent = Date.now() - this.stepStartTime;
  Analytics.trackStepCompleted(
    this.currentStep,
    this.steps[this.currentStep].name,
    Math.floor(timeSpent / 1000)
  );
  // ...
}

// في ExportOptions.js
async exportPDF() {
  Analytics.trackExport('PDF');
  // ...
}

// في ShareModal.js
show(studyId) {
  Analytics.trackShare('qr');
  // ...
}

// في DecisionDashboard.js
displayDecision(decision, kpis) {
  Analytics.trackInvestmentDecision(decision, kpis.npv, kpis.irr);
  // ...
}
```

### 1.4 CSS لـ Cookie Consent Banner

في `web/css/cookie-consent.css`:

```css
.cookie-consent-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(30, 64, 175, 0.95);
  backdrop-filter: blur(10px);
  padding: 20px;
  z-index: 9999;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

.cookie-consent-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.cookie-consent-content p {
  margin: 0;
  color: white;
  font-size: 14px;
}

.cookie-consent-actions {
  display: flex;
  gap: 10px;
}

.cookie-consent-actions button {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

#accept-analytics {
  background: #10B981;
  color: white;
}

#accept-analytics:hover {
  background: #059669;
}

#reject-analytics {
  background: transparent;
  color: white;
  border: 1px solid white;
}

#reject-analytics:hover {
  background: rgba(255, 255, 255, 0.1);
}
```

---

## 2. إرسال بالبريد مباشرة (EmailJS)

### 2.1 إعداد EmailJS

#### خطوة 1: إنشاء حساب

1. اذهب إلى [EmailJS](https://www.emailjs.com/)
2. سجّل حساباً جديداً (مجاني - 200 إيميل/شهر)
3. اربط حساب البريد (Gmail/Outlook)
4. أنشئ Email Template
5. احصل على:
   - **Service ID**: `service_xxxxxx`
   - **Template ID**: `template_xxxxxx`
   - **Public Key**: `YOUR_PUBLIC_KEY`

#### خطوة 2: تثبيت EmailJS

في `web/index.html`:

```html
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
<script type="text/javascript">
  (function(){
    emailjs.init("YOUR_PUBLIC_KEY");
  })();
</script>
```

### 2.2 إنشاء Email Service

في `web/js/services/EmailService.js`:

```javascript
/**
 * Email Service
 * إرسال التقارير بالبريد الإلكتروني
 */

export class EmailService {
  static SERVICE_ID = 'service_xxxxxx';
  static TEMPLATE_ID = 'template_xxxxxx';

  /**
   * إرسال ملخص الدراسة بالبريد
   */
  static async sendSummary(recipientEmail, studyData, senderMessage = '') {
    try {
      const templateParams = {
        to_email: recipientEmail,
        from_name: 'منصة دراسات الجدوى',
        project_name: studyData.projectInfo?.projectName || 'دراسة جدوى',
        summary: this.generateSummaryText(studyData),
        sender_message: senderMessage || 'مرفق ملخص دراسة الجدوى',
        dashboard_link: `${window.location.origin}/view/${studyData.id}`
      };

      const response = await emailjs.send(
        this.SERVICE_ID,
        this.TEMPLATE_ID,
        templateParams
      );

      console.log('Email sent:', response.status, response.text);
      return { success: true, messageId: response.text };
    } catch (error) {
      console.error('Email error:', error);
      return { success: false, error: error.text || error.message };
    }
  }

  /**
   * إرسال تقرير PDF بالبريد (مع مرفق)
   */
  static async sendPDFReport(recipientEmail, studyData, pdfBlob, senderMessage = '') {
    try {
      // تحويل PDF إلى Base64
      const base64PDF = await this.blobToBase64(pdfBlob);
      
      const templateParams = {
        to_email: recipientEmail,
        from_name: 'منصة دراسات الجدوى',
        project_name: studyData.projectInfo?.projectName || 'دراسة جدوى',
        sender_message: senderMessage || 'مرفق تقرير دراسة الجدوى الكامل',
        attachment: {
          name: `${studyData.projectInfo?.projectName || 'دراسة'}_تقرير.pdf`,
          content: base64PDF
        }
      };

      const response = await emailjs.send(
        this.SERVICE_ID,
        'template_with_attachment',
        templateParams
      );

      return { success: true, messageId: response.text };
    } catch (error) {
      console.error('Email with attachment error:', error);
      return { success: false, error: error.text || error.message };
    }
  }

  /**
   * توليد نص ملخص للإرسال
   */
  static generateSummaryText(studyData) {
    const project = studyData.projectInfo || {};
    const kpis = studyData.financialResults?.kpis || {};

    return `
📊 اسم المشروع: ${project.projectName || 'غير محدد'}
📍 القطاع: ${project.sector || 'غير محدد'}

💰 المؤشرات المالية:
- صافي القيمة الحالية (NPV): ${(kpis.npv || 0).toLocaleString('ar-SA')} ريال
- معدل العائد الداخلي (IRR): ${(kpis.irr || 0).toFixed(1)}%
- فترة الاسترداد: ${(kpis.paybackPeriod || 0).toFixed(1)} سنة
- العائد على الاستثمار: ${(kpis.roi || 0).toFixed(1)}%

📋 التوصية: ${studyData.recommendation?.decision || 'غير محدد'}

للاطلاع على التفاصيل الكاملة، قم بزيارة المنصة.
    `.trim();
  }

  /**
   * تحويل Blob إلى Base64
   */
  static blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * التحقق من صلاحية البريد الإلكتروني
   */
  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  /**
   * التحقق من حد الإرساليات اليومية
   */
  static checkDailyLimit() {
    const today = new Date().toDateString();
    const storedData = localStorage.getItem('email_daily_limit');
    
    if (!storedData) {
      localStorage.setItem('email_daily_limit', JSON.stringify({ date: today, count: 0 }));
      return { allowed: true, remaining: 5 };
    }

    const data = JSON.parse(storedData);
    
    // إعادة تعيين العداد في يوم جديد
    if (data.date !== today) {
      localStorage.setItem('email_daily_limit', JSON.stringify({ date: today, count: 0 }));
      return { allowed: true, remaining: 5 };
    }

    // التحقق من الحد
    const limit = 5; // للمستخدم المجاني
    const remaining = limit - data.count;
    
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining)
    };
  }

  /**
   * تحديث عداد الإرساليات
   */
  static incrementDailyCount() {
    const today = new Date().toDateString();
    const storedData = localStorage.getItem('email_daily_limit');
    const data = storedData ? JSON.parse(storedData) : { date: today, count: 0 };
    
    data.count += 1;
    localStorage.setItem('email_daily_limit', JSON.stringify(data));
  }
}
```

### 2.3 UI Modal للإرسال

في `web/js/ui/EmailModal.js`:

```javascript
import { EmailService } from '../services/EmailService.js';
import { Analytics } from '../utils/analytics.js';

export class EmailModal {
  constructor() {
    this.modal = null;
  }

  show(studyData) {
    // التحقق من الحد اليومي
    const limitCheck = EmailService.checkDailyLimit();
    
    if (!limitCheck.allowed) {
      alert('لقد وصلت إلى الحد الأقصى للإرساليات اليومية (5 إيميلات). حاول غداً.');
      return;
    }

    // بناء modal
    this.modal = document.createElement('div');
    this.modal.className = 'email-modal-overlay';
    this.modal.innerHTML = `
      <div class="email-modal">
        <div class="email-modal-header">
          <h3>إرسال الدراسة بالبريد</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="email-modal-body">
          <p class="email-limit-info">
            📧 متبقي ${limitCheck.remaining} إرساليات اليوم
          </p>
          
          <div class="form-group">
            <label>بريد المستلم *</label>
            <input type="email" id="recipient-email" placeholder="example@email.com" required>
          </div>

          <div class="form-group">
            <label>نوع المحتوى</label>
            <select id="content-type">
              <option value="summary">ملخص تنفيذي</option>
              <option value="full">تقرير كامل (PDF)</option>
            </select>
          </div>

          <div class="form-group">
            <label>رسالة إضافية (اختياري)</label>
            <textarea id="sender-message" rows="3" placeholder="أضف رسالة شخصية..."></textarea>
          </div>

          <div class="email-actions">
            <button class="send-email-btn" id="send-email-btn">
              <span class="btn-text">إرسال</span>
              <span class="btn-loading" style="display: none;">جاري الإرسال...</span>
            </button>
            <button class="cancel-btn">إلغاء</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents(studyData);
  }

  bindEvents(studyData) {
    // إغلاق
    this.modal.querySelector('.close-btn').onclick = () => this.close();
    this.modal.querySelector('.cancel-btn').onclick = () => this.close();
    
    // إرسال
    const sendBtn = this.modal.querySelector('#send-email-btn');
    sendBtn.onclick = async () => {
      const email = this.modal.querySelector('#recipient-email').value.trim();
      const contentType = this.modal.querySelector('#content-type').value;
      const message = this.modal.querySelector('#sender-message').value.trim();

      // التحقق
      if (!email) {
        alert('الرجاء إدخال بريد المستلم');
        return;
      }

      if (!EmailService.validateEmail(email)) {
        alert('البريد الإلكتروني غير صحيح');
        return;
      }

      // عرض loading
      sendBtn.disabled = true;
      this.modal.querySelector('.btn-text').style.display = 'none';
      this.modal.querySelector('.btn-loading').style.display = 'inline';

      try {
        let result;
        
        if (contentType === 'summary') {
          result = await EmailService.sendSummary(email, studyData, message);
        } else {
          // توليد PDF أولاً
          const pdfExporter = new PDFExporter(studyData);
          const pdfBlob = await pdfExporter.generateBlob();
          result = await EmailService.sendPDFReport(email, studyData, pdfBlob, message);
        }

        if (result.success) {
          EmailService.incrementDailyCount();
          Analytics.trackEvent('email_sent', { content_type: contentType });
          alert('✅ تم الإرسال بنجاح!');
          this.close();
        } else {
          alert(`❌ فشل الإرسال: ${result.error}`);
        }
      } catch (error) {
        alert(`❌ حدث خطأ: ${error.message}`);
      } finally {
        sendBtn.disabled = false;
        this.modal.querySelector('.btn-text').style.display = 'inline';
        this.modal.querySelector('.btn-loading').style.display = 'none';
      }
    };
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
```

### 2.4 EmailJS Template

في لوحة EmailJS، أنشئ template بهذا المحتوى:

```
الموضوع: {{project_name}} - دراسة جدوى

مرحباً،

{{from_name}} يشاركك دراسة جدوى لمشروع: {{project_name}}

رسالة المرسل:
{{sender_message}}

ملخص الدراسة:
{{summary}}

للاطلاع على التفاصيل الكاملة:
{{dashboard_link}}

---
هذا البريد مرسل من منصة دراسات الجدوى
```

---

## 3. سجل تسجيلات الدخول (Login History)

### 3.1 إعداد جدول Supabase

```sql
-- جدول جلسات المستخدم
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  login_at TIMESTAMP DEFAULT NOW(),
  logout_at TIMESTAMP DEFAULT NULL,
  device_type TEXT, -- desktop, mobile, tablet
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  location_city TEXT,
  location_country TEXT,
  user_agent TEXT
);

-- Index للأداء
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_login_at ON user_sessions(login_at DESC);

-- Row Level Security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- المستخدم يرى جلساته فقط
CREATE POLICY "Users can view own sessions"
ON user_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- السماح بالإدراج عند تسجيل الدخول
CREATE POLICY "Allow insert on login"
ON user_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### 3.2 تسجيل الجلسة عند الدخول

في `web/js/services/AuthService.js`:

```javascript
import UAParser from 'ua-parser-js';

export class AuthService {
  /**
   * تسجيل دخول
   */
  static async login(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // تسجيل الجلسة
      await this.logSession(data.user.id);

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * تسجيل جلسة جديدة
   */
  static async logSession(userId) {
    try {
      // تحليل User Agent
      const parser = new UAParser();
      const ua = parser.getResult();

      // جلب معلومات الموقع (اختياري - عبر API خارجي)
      const locationData = await this.getLocationData();

      // إدراج السجل
      const { error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          device_type: this.getDeviceType(ua),
          browser: `${ua.browser.name} ${ua.browser.version}`,
          os: `${ua.os.name} ${ua.os.version}`,
          ip_address: locationData?.ip || 'unknown',
          location_city: locationData?.city || null,
          location_country: locationData?.country || null,
          user_agent: navigator.userAgent
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to log session:', error);
      // لا نوقف تسجيل الدخول حتى لو فشل تسجيل الجلسة
    }
  }

  /**
   * تحديد نوع الجهاز
   */
  static getDeviceType(ua) {
    if (ua.device.type === 'mobile') return 'mobile';
    if (ua.device.type === 'tablet') return 'tablet';
    return 'desktop';
  }

  /**
   * جلب بيانات الموقع الجغرافي (اختياري)
   */
  static async getLocationData() {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return {
        ip: data.ip,
        city: data.city,
        country: data.country_name
      };
    } catch (error) {
      console.error('Failed to get location:', error);
      return null;
    }
  }

  /**
   * جلب سجل الجلسات
   */
  static async getLoginHistory(limit = 10) {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, sessions: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * إنهاء كل الجلسات الأخرى
   */
  static async logoutAllOtherSessions() {
    try {
      // في Supabase Auth، لا يمكن إنهاء الجلسات يدوياً
      // لكن يمكنك تسجيل logout_at في الجدول
      
      const { error } = await supabase
        .from('user_sessions')
        .update({ logout_at: new Date().toISOString() })
        .is('logout_at', null)
        .neq('id', 'current_session_id'); // يجب حفظ session_id الحالي

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

### 3.3 صفحة عرض سجل الدخول

في `web/js/ui/SecuritySettingsView.js`:

```javascript
import { AuthService } from '../services/AuthService.js';

export class SecuritySettingsView {
  constructor() {
    this.container = null;
  }

  async render() {
    const result = await AuthService.getLoginHistory();

    if (!result.success) {
      return `<p>خطأ في جلب السجل: ${result.error}</p>`;
    }

    const sessions = result.sessions || [];

    return `
      <div class="security-settings">
        <h2>🔒 الأمان والخصوصية</h2>
        
        <div class="section">
          <h3>سجل تسجيلات الدخول</h3>
          <p>آخر 10 جلسات</p>
          
          ${sessions.length === 0 ? 
            '<p>لا توجد جلسات محفوظة</p>' :
            sessions.map(session => this.renderSession(session)).join('')
          }
        </div>

        <div class="section">
          <h3>إدارة الجلسات</h3>
          <button class="logout-all-btn">إنهاء كل الجلسات الأخرى</button>
          <p class="help-text">سيُطلب منك تسجيل الدخول مرة أخرى على الأجهزة الأخرى</p>
        </div>
      </div>
    `;
  }

  renderSession(session) {
    const loginDate = new Date(session.login_at);
    const isActive = !session.logout_at;

    return `
      <div class="session-item ${isActive ? 'active' : 'inactive'}">
        <div class="session-icon">
          ${this.getDeviceIcon(session.device_type)}
        </div>
        <div class="session-info">
          <div class="session-device">
            <strong>${session.browser}</strong> على ${session.os}
          </div>
          <div class="session-details">
            <span>📅 ${loginDate.toLocaleString('ar-SA')}</span>
            ${session.location_city ? `<span>📍 ${session.location_city}, ${session.location_country}</span>` : ''}
            <span>🌐 ${this.maskIP(session.ip_address)}</span>
          </div>
        </div>
        <div class="session-status">
          ${isActive ? '<span class="badge active">نشط</span>' : '<span class="badge inactive">منتهي</span>'}
        </div>
      </div>
    `;
  }

  getDeviceIcon(deviceType) {
    switch (deviceType) {
      case 'mobile': return '📱';
      case 'tablet': return '📲';
      default: return '💻';
    }
  }

  maskIP(ip) {
    if (!ip || ip === 'unknown') return 'غير معروف';
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.***`;
  }

  bindEvents() {
    const logoutAllBtn = document.querySelector('.logout-all-btn');
    if (logoutAllBtn) {
      logoutAllBtn.onclick = async () => {
        if (!confirm('هل أنت متأكد من إنهاء كل الجلسات الأخرى؟')) {
          return;
        }

        const result = await AuthService.logoutAllOtherSessions();
        
        if (result.success) {
          alert('✅ تم إنهاء كل الجلسات الأخرى');
          this.refresh();
        } else {
          alert(`❌ فشل: ${result.error}`);
        }
      };
    }
  }
}
```

---

## 4. Zapier Integration (Webhooks)

### 4.1 إعداد Webhooks Service

في `web/js/services/WebhookService.js`:

```javascript
/**
 * Webhook Service
 * إرسال أحداث إلى Zapier وخدمات خارجية
 */

export class WebhookService {
  static webhooks = [];

  /**
   * تسجيل webhook جديد
   */
  static registerWebhook(url, events = []) {
    this.webhooks.push({ url, events });
    this.saveToStorage();
  }

  /**
   * إزالة webhook
   */
  static removeWebhook(url) {
    this.webhooks = this.webhooks.filter(wh => wh.url !== url);
    this.saveToStorage();
  }

  /**
   * تشغيل webhook عند حدث معين
   */
  static async triggerEvent(eventName, eventData = {}) {
    const relevantWebhooks = this.webhooks.filter(wh =>
      wh.events.length === 0 || wh.events.includes(eventName)
    );

    const promises = relevantWebhooks.map(wh =>
      this.sendWebhook(wh.url, eventName, eventData)
    );

    await Promise.allSettled(promises);
  }

  /**
   * إرسال HTTP POST إلى webhook
   */
  static async sendWebhook(url, eventName, eventData) {
    try {
      const payload = {
        event: eventName,
        timestamp: new Date().toISOString(),
        data: eventData
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log(`[Webhook] Event sent: ${eventName} to ${url}`);
      return { success: true };
    } catch (error) {
      console.error(`[Webhook] Failed to send ${eventName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * حفظ webhooks في localStorage
   */
  static saveToStorage() {
    localStorage.setItem('webhooks', JSON.stringify(this.webhooks));
  }

  /**
   * تحميل webhooks من localStorage
   */
  static loadFromStorage() {
    const stored = localStorage.getItem('webhooks');
    if (stored) {
      this.webhooks = JSON.parse(stored);
    }
  }
}

// تحميل عند بدء التطبيق
WebhookService.loadFromStorage();
```

### 4.2 أمثلة استخدام Webhooks

```javascript
// عند إنشاء دراسة جديدة
WebhookService.triggerEvent('study.created', {
  study_id: study.id,
  project_name: study.projectInfo.projectName,
  sector: study.projectInfo.sector
});

// عند اكتمال الدراسة
WebhookService.triggerEvent('study.completed', {
  study_id: study.id,
  project_name: study.projectInfo.projectName,
  npv: study.financialResults.kpis.npv,
  decision: study.recommendation.decision
});

// عند تصدير تقرير
WebhookService.triggerEvent('report.exported', {
  study_id: study.id,
  format: 'pdf',
  exported_at: new Date().toISOString()
});
```

### 4.3 UI لإدارة Webhooks

في `web/js/ui/IntegrationsView.js`:

```javascript
import { WebhookService } from '../services/WebhookService.js';

export class IntegrationsView {
  render() {
    return `
      <div class="integrations-view">
        <h2>🔗 التكاملات الخارجية</h2>
        
        <div class="integration-section">
          <h3>Zapier Webhooks</h3>
          <p>اربط المنصة بـ 5000+ تطبيق عبر Zapier</p>
          
          <div class="webhook-form">
            <input type="url" id="webhook-url" placeholder="https://hooks.zapier.com/...">
            <button class="add-webhook-btn">إضافة Webhook</button>
          </div>

          <div class="webhooks-list">
            ${WebhookService.webhooks.map(wh => `
              <div class="webhook-item">
                <span>${wh.url}</span>
                <button class="remove-webhook-btn" data-url="${wh.url}">حذف</button>
              </div>
            `).join('')}
          </div>

          <div class="webhook-events">
            <h4>الأحداث المدعومة:</h4>
            <ul>
              <li>study.created - عند إنشاء دراسة جديدة</li>
              <li>study.completed - عند اكتمال الدراسة</li>
              <li>report.exported - عند تصدير تقرير</li>
              <li>decision.go - عند قرار GO</li>
              <li>decision.nogo - عند قرار NO-GO</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    document.querySelector('.add-webhook-btn').onclick = () => {
      const url = document.querySelector('#webhook-url').value.trim();
      
      if (!url.startsWith('https://')) {
        alert('الرجاء إدخال رابط صحيح (يجب أن يبدأ بـ https://)');
        return;
      }

      WebhookService.registerWebhook(url, []);
      alert('✅ تم إضافة Webhook بنجاح');
      this.refresh();
    };

    document.querySelectorAll('.remove-webhook-btn').forEach(btn => {
      btn.onclick = () => {
        const url = btn.dataset.url;
        WebhookService.removeWebhook(url);
        this.refresh();
      };
    });
  }
}
```

---

## 5. Notion Integration (أولوية منخفضة)

### 5.1 التثبيت

```bash
npm install @notionhq/client --save
```

### 5.2 OAuth Flow

الربط بـ Notion يتطلب OAuth flow معقد. للتبسيط، يمكن:

1. **الخيار الأسهل**: تصدير Markdown ثم نسخه يدوياً إلى Notion
2. **الخيار المتقدم**: بناء تكامل رسمي بـ Notion API (يتطلب OAuth + Backend)

**التوصية:** تأجيل هذه الميزة حتى يطلبها المستخدمون بكثرة.

---

## 6. ملخص الأولويات

| الميزة | الأولوية | الوقت المقدر | الحالة |
|-------|----------|---------------|--------|
| Google Analytics | ⭐⭐⭐⭐ | 1-2 أيام | 📋 |
| إرسال بالبريد | ⭐⭐⭐⭐ | 2-3 أيام | 📋 |
| سجل الدخول | ⭐⭐⭐ | 2 أيام | 📋 |
| Zapier Webhooks | ⭐⭐ | 2 أيام | 📋 |
| Notion Integration | ⭐ | 3-4 أيام | ❌ مؤجل |

---

**الخطوة التالية:** ابدأ بتنفيذ Google Analytics وتتبع الأحداث الأساسية.

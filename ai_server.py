import http.server
import socketserver
import json
import os
import random
import time
from collections import defaultdict

# --- Engines Integration ---
from market_engine import MarketEngine
from experience_engine import ExperienceEngine

market_engine = MarketEngine()
experience_engine = ExperienceEngine()
# ---------------------------

PORT = 8080
DIRECTORY = "web"

# Rate Limiting: Track requests per IP
_rate_limit_store = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # 60 seconds
RATE_LIMIT_MAX_REQUESTS = 30  # 30 requests per minute per IP

def check_rate_limit(client_ip):
    """Check if client has exceeded rate limit"""
    now = time.time()
    # Clean old entries
    _rate_limit_store[client_ip] = [
        req_time for req_time in _rate_limit_store[client_ip]
        if now - req_time < RATE_LIMIT_WINDOW
    ]
    
    # Check limit
    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    
    # Add current request
    _rate_limit_store[client_ip].append(now)
    return True

class AIRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        origin = self.headers.get('Origin', '')
        allowed_origins = ['http://localhost:5173', 'http://localhost:3000', 'https://yourdomain.com', 'http://127.0.0.1:5173']
        # For development, allow localhost
        if origin.startswith('http://localhost') or origin.startswith('http://127.0.0.1'):
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()

    def do_GET(self):
        # Redirect /web or /web/ to root /
        if self.path.startswith('/web'):
            self.send_response(301)
            self.send_header('Location', '/')
            self.end_headers()
            return

        super().do_GET()

    def do_POST(self):
        if self.path == '/api/generate':
            self.handle_ai_generation()
        elif self.path == '/api/market/defaults':
            self.handle_market_defaults()
        elif self.path == '/api/experience/suggest':
            self.handle_experience_suggest()
        else:
            self.send_error(404, "Not Found")

    def _send_json_response(self, data):
        """Helper to send JSON response with CORS"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        
        origin = self.headers.get('Origin', '')
        # Simple dev config
        if origin.startswith('http://localhost') or origin.startswith('http://127.0.0.1'):
            self.send_header('Access-Control-Allow-Origin', origin)
            
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def handle_market_defaults(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data)
        
        sector = data.get('sector', 'general')
        city = data.get('city', 'Riyadh')
        area = data.get('area', 100)
        
        result = market_engine.get_defaults(sector, city, area)
        self._send_json_response(result)

    def handle_experience_suggest(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data)
        
        field = data.get('field', '')
        sector = data.get('sector', 'general')
        city = data.get('city', '')
        
        result = experience_engine.suggest_value(field, sector, city)
        self._send_json_response(result)

    def handle_ai_generation(self):
        # Rate Limiting Check
        client_ip = self.client_address[0]
        if not check_rate_limit(client_ip):
            self.send_response(429)  # Too Many Requests
            self.send_header('Content-type', 'application/json')
            self.send_header('Retry-After', str(RATE_LIMIT_WINDOW))
            origin = self.headers.get('Origin', '')
            allowed_origins = ['http://localhost:5173', 'http://localhost:3000', 'https://yourdomain.com']
            if origin in allowed_origins:
                self.send_header('Access-Control-Allow-Origin', origin)
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': 'Rate limit exceeded',
                'message': f'Maximum {RATE_LIMIT_MAX_REQUESTS} requests per {RATE_LIMIT_WINDOW} seconds'
            }).encode('utf-8'))
            return
        
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data)
            prompt_type = data.get('type')
            project_info = data.get('projectInfo', {})
            
            # Simulate AI Generation
            response_data = self.generate_text(prompt_type, project_info)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            # Security: Restrict CORS to known origins (update with your domain)
            origin = self.headers.get('Origin', '')
            allowed_origins = ['http://localhost:5173', 'http://localhost:3000', 'https://yourdomain.com']
            if origin in allowed_origins:
                self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            # response_data can be string or dict/list
            self.wfile.write(json.dumps({'content': response_data}).encode('utf-8'))
            
        except Exception as e:
            self.send_error(500, str(e))

    def generate_text(self, prompt_type, info):
        # A simple "Heuristic AI" to demonstrate value without API keys
        if prompt_type == 'summary':
            prompt_type = 'executive_summary'
        name = info.get('name', 'المشروع')
        city = info.get('city', 'المدينة')
        
        if prompt_type == 'executive_summary':
            return f"""
ملخص تنفيذي لمشروع {name}:

يهدف مشروع {name} إلى تقديم خدمات متميزة في مدينة {city}، مستهدفاً الفجوة الحالية في السوق المحلي. رؤيتنا هي أن نصبح الخيار الأول للعملاء من خلال تقديم جودة عالية وأسعار تنافسية.

أهم النقاط:
1. موقع مقترح في {city} يُختار وفق قرب العملاء وتكلفة الإيجار.
2. فريق عمل تُحدَّد كفاءته حسب متطلبات النشاط.
3. الجدوى المالية (فترة الاسترداد، صافي القيمة الحالية، معدل العائد) تُحتسب من مدخلات المستخدم في النموذج المالي — راجع لوحة المؤشرات.
"""
        elif prompt_type == 'marketing_strategy':
            return f"""
استراتيجية التسويق المقترحة لـ {name}:

1. التسويق الرقمي: التركيز على منصات التواصل الاجتماعي (تيك توك، انستقرام) واستهداف سكان {city}.
2. العروض الافتتاحية: تقديم خصم 20% للأسبوع الأول لجذب الزوار.
3. الشراكات: التعاون مع المؤثرين المحليين في {city}.
4. ولاء العملاء: إطلاق برنامج نقاط لضمان تكرار الزيارة.
"""
        elif prompt_type in ('swot', 'analysis'):
             # Return JSON; AIWriter sends type='analysis' للمقترح التلقائي (AI)
             return {
                "strengths": [f"موقع في {city} قابل للاختيار وفق القرب من العملاء", "مرونة في تحديد كفاءة الفريق حسب النشاط"],
                "weaknesses": ["علامة تجارية جديدة تحتاج بناء وعي", "ميزانية تسويق محدودة في البداية"],
                "opportunities": ["إمكانية التوسع لفروع جديدة", "شراكات محتملة مع مورّدين/موزّعين"],
                "threats": ["دخول منافسين جدد", "تغيرات تنظيمية محتملة"]
             }
             
        elif prompt_type == 'consultant_review':
             # Generate a narrative based on insights
             insights = project_info.get('insights', [])
             if not insights:
                 return "بناءً على الأرقام الحالية، يبدو المشروع في حالة صحية ممتازة. المؤشرات المالية تقع ضمن النطاق الطبيعي للصناعة. يُنصح بالتركيز الآن على خطة التسويق لضمان تحقيق المبيعات المستهدفة."
             
             # Construct advice based on specific issues
             advice = "بعد مراجعة دراسة الجدوى، إليك ملخص لأهم الملاحظات الاستراتيجية:\n\n"
             for item in insights:
                 advice += f"- **{item.get('category', 'تنبيه')}**: {item.get('message')}\n"
                 advice += f"  *التوصية:* {item.get('action')}\n\n"
             
             advice += "نصيحتي لك: معالجة هذه النقاط قبل البدء في التنفيذ لتقليل المخاطرة."
             return advice

        elif prompt_type == 'legal_advice':
             return {
                 "legalForm": "شركة ذات مسؤولية محدودة",
                 "licenses": [
                     { "name": "رخصة تجارية (بلدية)", "price": 2000, "notes": "إلزامي - يختلف حسب المساحة" },
                     { "name": "سجل تجاري (رئيسي)", "price": 500, "notes": "صلاحية سنة واحدة" },
                     { "name": "اشتراك الغرفة التجارية", "price": 800, "notes": "حسب فئة السجل" },
                     { "name": "رخصة سلامة (دفاع مدني)", "price": 1500, "notes": "قد تتطلب عقود صيانة" },
                     { "name": "رسوم تأسيس عقد الشركة", "price": 1200, "notes": "توثيق وزارة العدل" },
                     { "name": "تسجيل العلامة التجارية", "price": 7500, "notes": "اختياري (حماية 10 سنوات)" }
                 ]
             }

        elif prompt_type == 'suggest_segments':
            return [
                 { "name": "الشباب (18-25)", "demographics": "طلاب وموظفين جدد", "needs": "أسعار مناسبة، خدمة سريعة", "size": 500000, "priority": "primary" },
                 { "name": "العائلات", "demographics": "دخل متوسط إلى مرتفع", "needs": "جودة، أجواء مريحة", "size": 300000, "priority": "secondary" },
                 { "name": "الشركات", "demographics": "طلبات غداء عمل", "needs": "فواتير ضريبية، توصيل دقيق", "size": 100000, "priority": "tertiary" }
            ]

        elif prompt_type == 'suggest_campaigns':
            return [
                 { "name": "حملة الافتتاح", "type": "capital", "amount": 15000, "monthly": 0, "notes": "تشمل مشاهير وتغطيات" },
                 { "name": "إعلانات ممولة (انستقرام)", "type": "operating", "amount": 0, "monthly": 2000, "notes": "استهداف جغرافي" },
                 { "name": "توزيع منشورات", "type": "capital", "amount": 3000, "monthly": 0, "notes": "في الأحياء المجاورة" }
            ]

        elif prompt_type == 'suggest_revenue':
            return [
                 { "service": "بيع مباشر (داخل الفرع)", "customersPerMonth": 1500, "avgPrice": 45, "growthRate": 0.05 },
                 { "service": "تطبيقات التوصيل", "customersPerMonth": 800, "avgPrice": 50, "growthRate": 0.10 },
                 { "service": "طلبات خارجية (Pickup)", "customersPerMonth": 400, "avgPrice": 40, "growthRate": 0.03 }
            ]

        elif prompt_type == 'competitors':
            return [
                { "name": "المنافس الأول", "marketShare": 30, "strengths": "شهرة واسعة", "weaknesses": "أسعار مرتفعة", "advantage": "الانتشار" },
                { "name": "المنافس الثاني", "marketShare": 15, "strengths": "جودة عالية", "weaknesses": "خدمة عملاء بطيئة", "advantage": "الجودة" },
                { "name": "المنافس الثالث", "marketShare": 10, "strengths": "سعر منخفض", "weaknesses": "جودة منخفضة", "advantage": "السعر" }
            ]

        elif prompt_type == 'timeline':
            return [
                { "name": "استخراج التراخيص", "category": "legal", "startMonth": 1, "duration": 2 },
                { "name": "استئجار الموقع", "category": "technical", "startMonth": 2, "duration": 1 },
                { "name": "أعمال الديكور والتجهيز", "category": "technical", "startMonth": 3, "duration": 3 },
                { "name": "توظيف الكادر", "category": "hr", "startMonth": 4, "duration": 2 },
                { "name": "شراء المعدات", "category": "technical", "startMonth": 5, "duration": 1 },
                { "name": "الحملة التسويقية", "category": "marketing", "startMonth": 6, "duration": 1 },
                { "name": "الافتتاح التجريبي", "category": "launch", "startMonth": 6, "duration": 1 }
            ]

        elif prompt_type == 'pitch_script':
            # توليد نص Pitch Script (1–2 دقيقة) للمستثمرين بالـ AI
            indicators = info.get('indicators') or info.get('kpis') or {}
            npv = indicators.get('npv') or 0
            irr = indicators.get('irr') or 0
            payback = indicators.get('paybackPeriod') or indicators.get('payback') or 0
            roi = indicators.get('roi') or 0
            desc = info.get('description') or 'خدمات متميزة'
            concept = info.get('concept') or desc
            sector = info.get('sector') or 'القطاع'
            return f"""سكربت العرض التقديمي (Pitch) — {name}
مدة مقترحة: 1–2 دقيقة

[الافتتاحية — 15 ثانية]
مرحباً، أنا هنا لأقدم لكم فرصة استثمارية واضحة: مشروع «{name}» في {city}. نحن نقدم {desc}، ونستهدف فجوة حقيقية في السوق.

[المشكلة والحل — 25 ثانية]
المشكلة التي نعالجها: عدم وجود عرض يوفّر {concept} بجودة عالية وسعر مناسب في نطاقنا. حلنا يقوم على {concept} مع فريق محترف وموقع استراتيجي في {city}.

[السوق والفرصة — 20 ثانية]
• السوق المستهدف: {city} والمناطق المحيطة.
• القطاع: {sector}.
• لدينا خطة واضحة للوصول إلى العملاء وتحقيق النمو.

[الأرقام الرئيسية — 25 ثانية]
• صافي القيمة الحالية (NPV): {npv:,.0f} ريال.
• معدل العائد الداخلي (IRR): {(irr * 100) if irr else 0:.1f}%.
• فترة الاسترداد: {payback:.1f} سنوات.
• العائد على الاستثمار (ROI): {(roi * 100) if roi else 0:.0f}%.

[الإغلاق — 15 ثانية]
نطلب منكم الشراكة معنا لتحقيق هذه الرؤية. شكراً لكم، وأنا جاهز لأسئلتكم."""

        return "لم يتم تحديد نوع المحتوى."

print(f"🧠 AI Server running at http://localhost:{PORT}")
print(f"📂 Serving directory: ./{DIRECTORY}")

with socketserver.TCPServer(("", PORT), AIRequestHandler) as httpd:
    httpd.serve_forever()

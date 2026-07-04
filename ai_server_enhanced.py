"""
Internal Brain Server for Feasibility Study Platform
Fully offline Expert System & Mathematical Optimization.
No external APIs. 100% Privacy. 
"""

import http.server
import socketserver
import json
import os
import time
from datetime import datetime
from collections import defaultdict
import random

# Import local modules
try:
    from knowledge_base import KnowledgeBase
    kb = KnowledgeBase()
    KB_AVAILABLE = True
except ImportError:
    print("[WARN] KnowledgeBase module not found.")
    KB_AVAILABLE = False

try:
    from optimizer import ProjectOptimizer
    optimizer = ProjectOptimizer()
    OPTIMIZER_AVAILABLE = True
except ImportError:
    print("[WARN] Optimizer module not found.")
    OPTIMIZER_AVAILABLE = False

try:
    from financial_auditor import FinancialAuditor
    auditor = FinancialAuditor()
    AUDITOR_AVAILABLE = True
except ImportError:
    print("[WARN] FinancialAuditor module not found.")
    AUDITOR_AVAILABLE = False

try:
    from business_rules import BusinessRulesEngine
    biz_engine = BusinessRulesEngine()
    BIZ_ENGINE_AVAILABLE = True
except ImportError:
    print("[WARN] BusinessRulesEngine not found.")
    BIZ_ENGINE_AVAILABLE = False

try:
    from item_engine import ItemEngine
    item_engine = ItemEngine()
    ITEM_ENGINE_AVAILABLE = True
except ImportError:
    item_engine = None
    ITEM_ENGINE_AVAILABLE = False
    print("[WARN] ItemEngine module not found.")

try:
    from market_engine import MarketEngine
    market_engine = MarketEngine()
    MARKET_ENGINE_AVAILABLE = True
except ImportError:
    market_engine = None
    MARKET_ENGINE_AVAILABLE = False
    print("[WARN] MarketEngine module not found.")

try:
    from experience_engine import ExperienceEngine
    experience_engine = ExperienceEngine()
    EXPERIENCE_ENGINE_AVAILABLE = True
except ImportError:
    experience_engine = None
    EXPERIENCE_ENGINE_AVAILABLE = False
    print("[WARN] ExperienceEngine module not found.")

PORT = int(os.environ.get("PORT", "8080"))
DIRECTORY = os.environ.get("DIRECTORY", "web")
# في الإنتاج: ضع نطاقك (مثال: https://your-domain.com) لتقييد CORS
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
IS_PRODUCTION = os.environ.get("FEASIBILITY_ENV") == "production"
LOG_REQUESTS = IS_PRODUCTION or os.environ.get("LOG_REQUESTS", "").lower() in ("1", "true", "yes")

# Rate Limiting: أقسى في الإنتاج
_rate_limit_store = defaultdict(list)
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX_REQUESTS = 100 if not IS_PRODUCTION else 30

def _log_request(method, path, client_ip, status_code=200):
    if LOG_REQUESTS:
        ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        print(f"[{ts}] {method} {path} {client_ip} {status_code}")

def check_rate_limit(client_ip):
    now = time.time()
    _rate_limit_store[client_ip] = [req for req in _rate_limit_store[client_ip] if now - req < RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    _rate_limit_store[client_ip].append(now)
    return True

class ExpertLogicHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/web'):
            self.send_response(301)
            self.send_header('Location', '/')
            self.end_headers()
            return
        if self.path.startswith('/api'):
            if self.path.startswith('/api/market/defaults'):
                self.handle_market_defaults()
                return
            self.send_error(404, "Not Found")
            return

        local_path = self.translate_path(self.path)
        if os.path.isdir(local_path):
            index_path = os.path.join(local_path, 'index.html')
            if os.path.exists(index_path):
                self.path = os.path.join(self.path.rstrip('/'), 'index.html')
                return super().do_GET()

        if not os.path.exists(local_path) and '.' not in os.path.basename(local_path):
            self.path = '/index.html'
            return super().do_GET()

        super().do_GET()

    def do_POST(self):
        if LOG_REQUESTS:
            _log_request("POST", self.path, self.client_address[0], "-")
        if self.path == '/api/generate':
            self.handle_logic_generation()
        elif self.path == '/api/optimize':
            self.handle_optimization()
        elif self.path == '/api/audit':
            self.handle_audit()
        elif self.path == '/api/simulate':
            self.handle_simulation()
        elif self.path == '/api/market_analysis':
            self.handle_market_analysis()
        elif self.path == '/api/consult_history':
            self.handle_history_consultation()
        else:
            self.send_error(404, "Not Found")

    def _send_json(self, data):
        if LOG_REQUESTS:
            _log_request("POST", self.path, self.client_address[0], 200)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _read_json_body(self):
        """قراءة جسم الطلب كـ JSON مرة واحدة — يقلل التكرار ويمنع الأخطاء."""
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length <= 0:
                return None
            raw = self.rfile.read(length)
            return json.loads(raw.decode('utf-8')) if raw else None
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            return None

    def handle_market_analysis(self):
        data = self._read_json_body() or {}
        if not MARKET_ENGINE_AVAILABLE or market_engine is None:
            self._send_json({"error": "Market Engine unavailable"})
            return
        city = data.get('city', '')
        sector = data.get('sector', '')
        result = market_engine.analyze_market(city, sector)
        self._send_json(result)

    def handle_market_defaults(self):
        """GET /api/market/defaults?sector=X&city=Y&area=Z&budget=W — قيم افتراضية للمسار السريع (Express Mode)."""
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        sector = (qs.get('sector') or [''])[0]
        city = (qs.get('city') or [''])[0]
        area = int((qs.get('area') or ['100'])[0]) if (qs.get('area')) else 100
        budget = int((qs.get('budget') or ['0'])[0]) if (qs.get('budget')) else 0
        if not MARKET_ENGINE_AVAILABLE or market_engine is None:
            self._send_json({"error": "Market Engine unavailable", "defaults": {}})
            return
        defaults = market_engine.get_defaults(sector, city, area)
        if sector and city:
            try:
                analysis = market_engine.analyze_market(city, sector)
                defaults["market"] = analysis.get("metrics", {})
                defaults["analysis"] = analysis.get("analysis", "")
            except Exception:
                pass
        if budget:
            defaults["budget"] = budget
        self._send_json(defaults)

    def handle_history_consultation(self):
        data = self._read_json_body() or {}
        if not EXPERIENCE_ENGINE_AVAILABLE or experience_engine is None:
            self._send_json({"error": "Experience Engine unavailable"})
            return
        sector = data.get('sector', '')
        budget = data.get('budget', 0)
        result = experience_engine.consult_history(sector, budget)
        self._send_json(result)

    def handle_simulation(self):
        data = self._read_json_body() or {}
        if not OPTIMIZER_AVAILABLE:
            self._send_json({"error": "Optimizer unavailable"})
            return
        mode = data.get('mode', 'monte_carlo')
        if mode == 'sensitivity':
            result = optimizer.analyze_sensitivity(data)
        else:
            result = optimizer.run_simulation(data)
        self._send_json(result)

    def handle_audit(self):
        data = self._read_json_body() or {}
        if not AUDITOR_AVAILABLE:
            self._send_json({"error": "Auditor unavailable"})
            return
        flags = auditor.audit_project(data)
        self._send_json({"flags": flags})

    def handle_optimization(self):
        data = self._read_json_body() or {}
        if not OPTIMIZER_AVAILABLE:
            self._send_json({"error": "Optimizer unavailable"})
            return
        mode = data.get('mode', 'standard')
        if mode == 'reverse':
            target_margin = data.get('target_margin', 0.20)
            result = optimizer.reverse_engineer_price(data, target_margin)
            self._send_json(result)
        elif mode == 'staffing':
            result = optimizer.optimize_staffing(data)
            self._send_json(result)
        elif mode == 'breakeven':
            result = optimizer.analyze_breakeven(data)
            self._send_json(result)
        else:
            result = optimizer.optimize(data)
            self._send_json(result)

    def handle_logic_generation(self):
        data = self._read_json_body() or {}
        prompt_type = data.get('type')
        project_info = data.get('projectInfo', {})
        context = data.get('context', {})
        response_content = self.generate_expert_report(prompt_type, project_info, context)
        self._send_json({'content': response_content})

    def generate_expert_report(self, prompt_type, info, context):
        """
        The Core Logic Engine. 
        Instead of asking an LLM, we build the text based on rules.
        """
        name = info.get('name', 'المشروع المقترح')
        city = info.get('city', info.get('location', 'المملكة العربية السعودية'))
        
        if prompt_type == 'executive_summary':
            return self._build_executive_summary(name, city, context)
            
        elif prompt_type == 'marketing_strategy':
            return self._build_marketing_strategy(name, city, context)
            
        elif prompt_type == 'swot':
            return self._build_swot(name, city, context)

        elif prompt_type == 'operations_plan':
            return self._build_operations_plan(name, city, context)
            
        elif prompt_type == 'advisor':
             return self._build_advisor_report(info, context)

        # Fallback for tables (campaigns, etc.) - keep them somewhat random but logical
        return self._build_table_data(prompt_type, info)

    def _build_executive_summary(self, name, city, context):
        # Extract Key Metrics
        kpis = context.get('kpis', {})
        npv = kpis.get('npv', 0)
        roi = kpis.get('roi', 0)
        payback = kpis.get('paybackPeriod', 0)
        total_capex = context.get('financials', {}).get('capex', {}).get('total', 0)
        
        # Logic 1: Assessment
        viability = "مجدي اقتصادياً" if npv > 0 else "يتطلب مراجعة دقيقة"
        
        # Logic 2: Performance Tier
        if roi > 25:
             perf_desc = "أداء مالي استثنائي يتفوق على متوسط السوق."
        elif roi > 15:
             perf_desc = "أداء مالي جيد ومستقر."
        else:
             perf_desc = "أداء مالي محافظ يتطلب إدارة دقيقة للتكاليف."

        # Draft the text
        text = f"""# الملخص التنفيذي - {name}

## نظرة عامة
تم إعداد دراسة الجدوى لمشروع **{name}** في مدينة **{city}**، بهدف تقديم خدمات متميزة تلبي احتياجات السوق المحلي. بناءً على التحليل المالي والفني، يظهر المشروع كفرصة استثمارية واعدة.

## المؤشرات المالية الرئيسية
بناءً على التقديرات المالية، يحقق المشروع المؤشرات التالية:
*   **حجم الاستثمار التأسيسي:** {total_capex:,.0f} ريال سعودي.
*   **صافي القيمة الحالية (NPV):** {npv:,.0f} ريال. ({viability})
*   **فترة الاسترداد المتوقعة:** {payback:.1f} سنوات.
*   **العائد على الاستثمار (ROI):** {roi:.1f}%.

## الرؤية الاستراتيجية
{perf_desc} تظهر التوقعات قدرة المشروع على تغطية تكاليفه التشغيلية وتحقيق نمو مستدام. يعتمد نجاح المشروع بشكل رئيسي على كفاءة الخطة التشغيلية والالتزام بميزانية التسويق المقررة.

## التوصية النهائية
بناءً على المعطيات الحالية، **{viability}**. نوصي بالبدء في إجراءات التأسيس مع التركيز على بناء قاعدة عملاء قوية في الأشهر الستة الأولى.
"""
        return text

    def _build_marketing_strategy(self, name, city, context):
        # Determine strict strategy based on budget
        marketing_budget = context.get('financials', {}).get('opex', {}).get('marketing', 0)
        
        if marketing_budget > 10000:
             strategy_tier = "Heavy Digital"
             channels = "- حملات ممولة على منصات التواصل (Snapchat, TikTok)\n- التعاون مع 3-5 مؤثرين محليين\n- إعلانات Google Maps"
        elif marketing_budget > 3000:
             strategy_tier = "Balanced"
             channels = "- إعلانات Instagram و Facebook الموجهة\n- توزيع منشورات في الحي\n- برنامج ولاء للعملاء"
        else:
             strategy_tier = "Guerrilla / Organic"
             channels = "- التركيز على المحتوى المجاني (Reels/Shorts)\n- العروض الخاصة والخصومات\n- الاعتماد على التسويق الشفهي (Word of Mouth)"

        return f"""# استراتيجية التسويق - {name}

## المنهجية: {strategy_tier}
نظراً للميزانية المرصودة وطبيعة السوق في {city}، سنعتمد استراتيجية تركز على الوصول المباشر للعملاء بأقل تكلفة استحواذ (CAC).

## القنوات المقترحة
{channels}

## خطة المحتوى
1. **المرحلة الأولى (الوعي):** التركيز على القيمة المضافة وما يميز {name} عن المنافسين.
2. **المرحلة الثانية (التفاعل):** مسابقات وعروض تفاعلية لجذب العملاء للتجربة الأولى.
3. **المرحلة الثالثة (الولاء):** بطاقات ولاء وعروض خاصة للعملاء المتكررين.

## الميزانية التقديرية
- التسويق الرقمي: 60%
- صناعة المحتوى: 25%
- عروض وترويج: 15%
"""

    def _build_operations_plan(self, name, city, context):
        return f"""# الخطة التشغيلية - {name}

## 1. الهيكل الإداري
تم تصميم الهيكل ليكون رشيقاً (Lean) في المرحلة الأولى لتقليل التكاليف الثابتة. يتركز العمل على ضمان الجودة وسرعة الخدمة.

## 2. سياسة الجودة
- تطبيق معايير صارمة في اختيار المواد الخام.
- تدريب الموظفين لمدة لا تقل عن أسبوعين قبل الافتتاح.
- نظام مراجعة دوري (أسبوعي) لملاحظات العملاء.

## 3. سلاسل الإمداد
- الاعتماد على موردين محليين في {city} لتقليل تكاليف النقل وضمان سرعة التوريد.
- الحفاظ على مخزون أمان يكفي لمدة 15 يوماً لتجنب انقطاع المنتجات.

## 4. خطة المخاطر التشغيلية
- **تعطل المعدات:** التعاقد مع شركة صيانة بعقود سنوية.
- **نقص العمالة:** تجهيز قائمة بموظفين بنظام الساعات في أوقات الذروة.
"""

    def _build_swot(self, name, city, context):
        # Logic-driven SWOT based on inputs? 
        # For now, we use a robust general template that fits most small businesses in Saudi Arabia.
        return {
            "strengths": [
                f"موقع استراتيجي في {city}",
                "هيكل تكاليف مرن ومنخفض",
                "إدارة مباشرة من الملاك",
                "سرعة اتخاذ القرار"
            ],
            "weaknesses": [
                "علامة تجارية جديدة غير معروفة",
                "ميزانية تسويق محدودة مقارنة بالكبار",
                "حساسية عالية لتغيرات الأسعار"
            ],
            "opportunities": [
                "النمو السكاني والعمراني في المنطقة",
                "التحول الرقمي وتطبيقات التوصيل",
                "إمكانية التوسع لخدمات إضافية"
            ],
            "threats": [
                "دخول منافسين جدد بنفس النشاط",
                "ارتفاع تكاليف الإيجار والخدمات",
                "تغير تفضيلات المستهلكين بسرعة"
            ]
        }
        
    def _build_advisor_report(self, info, context):
        # Used for specific advice queries
        return "النظام الذكي: يرجى استخدام القوائم المالية للحصول على تحليل دقيق. (Internal Logic)"

    def _build_table_data(self, type, info):
        # Centralized logic routing; fallback for table suggestions (campaigns, etc.)
        if not BIZ_ENGINE_AVAILABLE:
            return []

        if type == 'suggest_equipment':
            return biz_engine.generate_items('equipment', info)
        elif type == 'suggest_furniture':
            return biz_engine.generate_items('furniture', info) # Warning: Furniture logic needs check if included in new engine or merged
        elif type == 'suggest_staff':
            return biz_engine.generate_items('staff', info)
        elif type == 'suggest_licenses':
            return biz_engine.get_licenses(info.get('sector', '') or info.get('concept', ''))
        elif type == 'suggest_campaigns':
            return biz_engine.get_marketing_plan(info.get('sector', '') or info.get('concept', ''))
            
        return [] 
 

print(f"[AI] Internal Logic Brain running at http://localhost:{PORT}")
print(f"[AI] Mode: OFFLINE (No External APIs)")
if OPTIMIZER_AVAILABLE: print("[AI] Mathematical Optimizer: Active")

with socketserver.TCPServer(("", PORT), ExpertLogicHandler) as httpd:
    httpd.serve_forever()

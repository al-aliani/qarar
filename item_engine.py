"""
Smart Item Engine (The Inventory Brain)
Generates sector-specific assets, equipment, and staff based on project rules.
"""
import random

class ItemEngine:
    def __init__(self):
        # Database of Assets per Sector
        self.sectors = {
            "cafe": {
                "equipment": [
                    {"name": "ماكينة اسبريسو احترافية (2 جروب)", "price_range": (15000, 25000), "usage": "1 per 50sqm"},
                    {"name": "طاحونة قهوة إلكترونية", "price_range": (3000, 5000), "usage": "1 per machine"},
                    {"name": "ثلاجة عرض حلويات", "price_range": (4000, 8000), "usage": "1 per 40sqm"},
                    {"name": "خلاط عصائر صناعي", "price_range": (1500, 3000), "usage": "1 per branch"},
                    {"name": "نظام تنقية مياه (فلتر)", "price_range": (2000, 4000), "usage": "1 per branch"},
                    {"name": "صانعة ثلج", "price_range": (3000, 6000), "usage": "1 per branch"}
                ],
                "furniture": [
                    {"name": "طاولة (خشب/رخام)", "price_range": (400, 800), "usage": "area / 4"},
                    {"name": "كرسي مريح", "price_range": (150, 400), "usage": "tables * 3"},
                    {"name": "كنبة (Booths)", "price_range": (1500, 3000), "usage": "area / 20"},
                    {"name": "إضاءة ديكورية (معلقة)", "price_range": (200, 500), "usage": "area / 10"},
                    {"name": "كاونتر خدمة (تفصيل)", "price_range": (8000, 15000), "usage": "1 per branch"}
                ],
                "staff": [
                    {"position": "باريستا", "salary": 4500, "count_rule": "area / 30", "is_variable": True},
                    {"position": "مشرف فرع", "salary": 6000, "count_rule": "1 per branch", "is_variable": False},
                    {"position": "عامل خدمة", "salary": 3000, "count_rule": "area / 50", "is_variable": True}
                ]
            },
            "restaurant": {
                "equipment": [
                    {"name": "فرن غاز صناعي (4 عيون)", "price_range": (5000, 9000), "usage": "1 per 30sqm kitchen"},
                    {"name": "ثلاجة تجميد عمودية", "price_range": (4500, 7000), "usage": "2 per branch"},
                    {"name": "طاولة تحضير ستانلس", "price_range": (800, 1500), "usage": "1 per 10sqm kitchen"},
                    {"name": "غسالة صحون صناعية", "price_range": (8000, 14000), "usage": "1 per branch"},
                    {"name": "نظام شفط ودكت (Hood)", "price_range": (10000, 20000), "usage": "1 per branch"}
                ],
                "furniture": [
                    {"name": "طاولة طعام", "price_range": (500, 1000), "usage": "area / 3"},
                    {"name": "كرسي طعام", "price_range": (200, 500), "usage": "tables * 4"},
                    {"name": "ديكور جداري", "price_range": (300, 700), "usage": "area / 15"}
                ],
                "staff": [
                    {"position": "شيف رئيسي", "salary": 8000, "count_rule": "1 per branch", "is_variable": False},
                    {"position": "مساعد طاهي", "salary": 4000, "count_rule": "area / 40", "is_variable": True},
                    {"position": "ويتر (مقدم طعام)", "salary": 3000, "count_rule": "area / 20", "is_variable": True},
                    {"position": "غاسل صحون", "salary": 2500, "count_rule": "1 per 50sqm", "is_variable": True}
                ]
            },
            "retail": {
                "equipment": [
                    {"name": "جهاز كاشير متكامل (POS)", "price_range": (4000, 7000), "usage": "1 per 50sqm"},
                    {"name": "بوابة إنذار ضد السرقة", "price_range": (3000, 5000), "usage": "1 per door"},
                    {"name": "نظام كاميرات مراقبة", "price_range": (2000, 5000), "usage": "1 per 40sqm"}
                ],
                "furniture": [
                    {"name": "أرفف عرض (جدارية)", "price_range": (500, 1000), "usage": "area / 5"},
                    {"name": "جوندولا عرض (وسطية)", "price_range": (800, 1500), "usage": "area / 10"},
                    {"name": "كاونتر محاسبة", "price_range": (3000, 6000), "usage": "1 per 50sqm"}
                ],
                "staff": [
                    {"position": "مدير معرض", "salary": 7000, "count_rule": "1 per branch", "is_variable": False},
                    {"position": "بائع", "salary": 4000, "count_rule": "area / 40", "is_variable": True},
                    {"position": "حارس أمن", "salary": 3500, "count_rule": "1 per branch", "is_variable": False}
                ]
            },
            "service": { # Salons, Spas
                "equipment": [
                    {"name": "كرسي حلاقة/تجميل هيدروليك", "price_range": (2000, 5000), "usage": "area / 15"},
                    {"name": "عربة أدوات", "price_range": (300, 600), "usage": "1 per chair"},
                    {"name": "جهاز تعقيم", "price_range": (1000, 2000), "usage": "1 per 3 chairs"}
                ],
                "furniture": [
                    {"name": "كنب انتظار", "price_range": (2000, 4000), "usage": "1 per 30sqm"},
                    {"name": "مرايا جدارية (كبيرة)", "price_range": (500, 1500), "usage": "area / 10"}
                ],
                "staff": [
                    {"position": "أخصائي/حلاق", "salary": 5000, "count_rule": "chairs * 1", "is_variable": True},
                    {"position": "موظف استقبال", "salary": 4000, "count_rule": "1 per branch", "is_variable": False}
                ]
            },
            # Default fallback
            "general": {
                "equipment": [{"name": "أجهزة كمبيوتر", "price_range": (2500, 4000), "usage": "staff / 2"}],
                "furniture": [{"name": "أثاث مكتبي", "price_range": (3000, 6000), "usage": "1 per branch"}],
                "staff": [{"position": "موظف عام", "salary": 3000, "count_rule": "area / 50", "is_variable": False}]
            }
        }

    def generate_items(self, item_type, project_info):
        """
        Generate contextual items based on project sector and size.
        item_type: 'equipment', 'furniture', 'staff'
        """
        name = project_info.get('name', '')
        desc = project_info.get('description', '')
        
        # 1. Detect Sector
        sector = self._detect_sector(name, desc)
        
        # 2. Get Rules
        rules = self.sectors.get(sector, self.sectors['general']).get(item_type, [])
        if not rules: # Fallback
            rules = self.sectors['general'].get(item_type, [])

        # 3. Determine Scale (Area)
        # Try to find 'area' or assume standard size based on sector
        area = self._estimate_area(project_info, sector)
        
        results = []
        for item in rules:
            qty = self._calculate_quantity(item.get('usage', '1'), area)
            if qty > 0:
                # Handle Price vs Salary
                price = 0
                if 'price_range' in item:
                    price = int(random.uniform(*item['price_range']))
                elif 'salary' in item:
                    price = item['salary'] # For staff, we might use salary as 'price' placeholder or keep separate
                
                entry = {
                    "name": item.get('name') or item.get('position'),
                    "quantity": qty if item_type != 'staff' else None, # Staff uses 'count'
                    "count": qty if item_type == 'staff' else None,
                    "price": price if item_type != 'staff' else None,
                    "salary": item.get('salary') if item_type == 'staff' else None,
                    "isVariable": item.get('is_variable', False),
                    "notes": f"Estimated for {area} sqm"
                }
                # Clean up None keys
                results.append({k: v for k, v in entry.items() if v is not None})
                
        return results

    def _detect_sector(self, name, desc):
        text = (name + " " + desc).lower()
        if any(w in text for w in ['cafe', 'coffee', 'قهوة', 'كوفي', 'مقهى']): return 'cafe'
        if any(w in text for w in ['restaurant', 'food', 'مطعم', 'وجبات', 'برجر', 'شاورما']): return 'restaurant'
        if any(w in text for w in ['shop', 'store', 'retail', 'محل', 'معرض', 'بقالة', 'تموينات']): return 'retail'
        if any(w in text for w in ['salon', 'barber', 'spa', 'حلاقة', 'صالون', 'مشغل', 'مغسلة']): return 'service'
        return 'general'

    def _estimate_area(self, info, sector):
        # Default areas if not found
        defaults = {'cafe': 80, 'restaurant': 150, 'retail': 100, 'service': 60, 'general': 100}
        return defaults.get(sector, 100)

    def _calculate_quantity(self, rule, area):
        if isinstance(rule, int): return rule
        
        # Simple parser for rules like "area / 30" or "1 per branch"
        qty = 1
        try:
            if 'area' in rule:
                divisor = int(rule.split('/')[-1].strip())
                qty = max(1, int(area / divisor))
            elif 'per branch' in rule:
                qty = 1
            # Add more complex parsing if needs (e.g. based on tables/chairs)
        except:
            qty = 1
        return qty

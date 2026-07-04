"""
Business Rules Engine (The Central Knowledge Brain)
Combines Inventory, Compliance, and Marketing Intelligence.
"""
import random

class BusinessRulesEngine:
    def __init__(self):
        # Master Database of Sectors
        self.sectors = {
            "cafe": {
                "licenses": [
                    {"name": "رخصة بلدية (نشاط تجاري)", "cost": 2000, "is_annual": True},
                    {"name": "تصريح الدفاع المدني", "cost": 1500, "is_annual": True},
                    {"name": "شهادات صحية للعاملين", "cost": 500, "is_annual": True},
                    {"name": "تصريح الموسيقى (اختياري)", "cost": 5000, "is_annual": True}
                ],
                "marketing": [
                    {"channel": "Instagram / TikTok", "focus": "Visuals", "budget_share": 0.40},
                    {"channel": "Google Maps", "focus": "SEO & Reviews", "budget_share": 0.10},
                    {"channel": "Influencers", "focus": "Launch Hype", "budget_share": 0.30},
                    {"channel": "Loyalty Program", "focus": "Retention", "budget_share": 0.20}
                ],
                "equipment": [
                    {"name": "ماكينة اسبريسو احترافية (2 جروب)", "price_range": (15000, 25000), "usage": "1 per 50sqm"},
                    {"name": "طاحونة قهوة إلكترونية", "price_range": (3000, 5000), "usage": "1 per machine"},
                    {"name": "ثلاجة عرض حلويات", "price_range": (4000, 8000), "usage": "1 per 40sqm"},
                    {"name": "صانعة ثلج", "price_range": (3000, 6000), "usage": "1 per branch"}
                ],
                "staff": [
                    {"position": "باريستا", "salary": 4500, "count_rule": "area / 30"},
                    {"position": "مشرف فرع", "salary": 6000, "count_rule": "1 per branch"},
                    {"position": "عامل خدمة", "salary": 3000, "count_rule": "area / 50"}
                ]
            },
            "restaurant": {
                "licenses": [
                    {"name": "رخصة بلدية (مطعم)", "cost": 3000, "is_annual": True},
                    {"name": "تصريح الدفاع المدني (عالي الخطورة)", "cost": 2500, "is_annual": True},
                    {"name": "شهادات صحية", "cost": 500, "is_annual": True},
                    {"name": "سجل تجاري", "cost": 200, "is_annual": True}
                ],
                "marketing": [
                    {"channel": "Delivery Apps (HungerStation/Jahez)", "focus": "Sales", "budget_share": 0.30},
                    {"channel": "Instagram Foodies", "focus": "Taste Appeal", "budget_share": 0.30},
                    {"channel": "Local Ads (Snapchat)", "focus": "Geo-targeting", "budget_share": 0.40}
                ],
                "equipment": [
                    {"name": "فرن غاز صناعي", "price_range": (5000, 9000), "usage": "1 per branch"},
                    {"name": "ثلاجة تجميد", "price_range": (4500, 7000), "usage": "2 per branch"},
                    {"name": "غسالة صحون صناعية", "price_range": (8000, 14000), "usage": "1 per branch"}
                ],
                "staff": [
                    {"position": "شيف رئيسي", "salary": 8000, "count_rule": "1 per branch"},
                    {"position": "مساعد طاهي", "salary": 4000, "count_rule": "area / 40"}
                ]
            },
            "retail": {
                "licenses": [
                    {"name": "رخصة بلدية", "cost": 1500, "is_annual": True},
                    {"name": "سجل تجاري", "cost": 200, "is_annual": True},
                    {"name": "اشتراك العنوان الوطني", "cost": 500, "is_annual": True}
                ],
                "marketing": [
                    {"channel": "Snapchat Ads", "focus": "Product Demo", "budget_share": 0.50},
                    {"channel": "Google Shopping", "focus": "Search Intent", "budget_share": 0.30},
                    {"channel": "SMS/Email", "focus": "Offers", "budget_share": 0.20}
                ],
                "equipment": [
                    {"name": "جهاز كاشير POS", "price_range": (4000, 7000), "usage": "1 per 50sqm"},
                    {"name": "بوابة إنذار", "price_range": (3000, 5000), "usage": "1 per door"}
                ],
                "staff": [
                    {"position": "مدير معرض", "salary": 7000, "count_rule": "1 per branch"},
                    {"position": "بائع", "salary": 4000, "count_rule": "area / 40"}
                ]
            },
            "general": {
                "licenses": [{"name": "رخصة بلدية", "cost": 1000, "is_annual": True}],
                "marketing": [{"channel": "Social Media", "focus": "General", "budget_share": 1.0}],
                "equipment": [{"name": "أجهزة مكتبية", "price_range": (2000, 4000), "usage": "1 per staff"}],
                "staff": [{"position": "موظف", "salary": 4000, "count_rule": "area / 50"}]
            }
        }

    def get_licenses(self, sector_name):
        sector = self._detect_sector(sector_name)
        return self.sectors.get(sector, self.sectors['general'])['licenses']

    def get_marketing_plan(self, sector_name):
        sector = self._detect_sector(sector_name)
        return self.sectors.get(sector, self.sectors['general'])['marketing']

    def generate_items(self, item_type, project_info):
        # Compatibility with old ItemEngine usage
        name = project_info.get('name', '')
        desc = project_info.get('description', '')
        sector = self._detect_sector(name + " " + desc)
        
        # Estimate Area
        area = 100 # Default
        
        rules = self.sectors.get(sector, self.sectors['general']).get(item_type, [])
        if not rules: return []

        results = []
        for item in rules:
            qty = self._calculate_quantity(item.get('usage', '1'), area)
            if qty > 0:
                price = 0
                if 'price_range' in item:
                    price = int(random.uniform(*item['price_range']))
                elif 'salary' in item:
                    price = item['salary']
                
                results.append({
                    "name": item.get('name') or item.get('position'),
                    "quantity": qty if item_type != 'staff' else None,
                    "count": qty if item_type == 'staff' else None,
                    "price": price,
                    "salary": item.get('salary') if item_type == 'staff' else None
                })
        return results

    def _detect_sector(self, text):
        text = str(text).lower()
        if any(w in text for w in ['cafe', 'coffee', 'قهوة', 'كوفي']): return 'cafe'
        if any(w in text for w in ['restaurant', 'food', 'مطعم', 'اكل']): return 'restaurant'
        if any(w in text for w in ['shop', 'retail', 'محل', 'تجزئة']): return 'retail'
        return 'general'

    def _calculate_quantity(self, rule, area):
        try:
            if 'area' in rule:
                divisor = int(rule.split('/')[-1].strip())
                return max(1, int(area / divisor))
            elif 'per branch' in rule: 
                return 1
            elif 'per machine' in rule:
                return 1 # Simplified
            elif 'per door' in rule:
                return 1
            return 1
        except:
            return 1

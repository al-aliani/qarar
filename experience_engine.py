"""
Experience Engine (The Memory Brain)
Stores and recalls successful project cases to provide data-driven advice.
"""
import json
import os

DATA_FILE = "data/experience_db.json"

class ExperienceEngine:
    def __init__(self):
        self.db = self._load_db()

    def _load_db(self):
        if not os.path.exists("data"):
            os.makedirs("data")
        
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return []
        return []

    def consult_history(self, sector, budget):
        """
        Find similar past projects and extract wisdom.
        Returns: Average metrics and a specific 'Best Case' example.
        """
        sector = str(sector).lower()
        budget = float(budget or 0)
        
        # Filter relevant cases
        # 1. Match Sector (loose match)
        relevant = [c for c in self.db if sector in c.get('sector', '').lower()]
        
        if not relevant:
            # Fallback to general category if specific not found
            if any(x in sector for x in ['cafe', 'coffee', 'food']): 
                relevant = [c for c in self.db if c.get('category') == 'F&B']
            elif any(x in sector for x in ['shop', 'retail']): 
                relevant = [c for c in self.db if c.get('category') == 'Retail']

        if not relevant:
            return {
                "found": False,
                "message": f"لا توجد مشاريع سابقة في الأرشيف لنشاط '{sector}'. كن أنت قصة النجاح الأولى!"
            }

        # 2. Find closest budget match
        # Sort by distance to budget
        relevant.sort(key=lambda x: abs(x.get('budget', 0) - budget))
        
        closest_case = relevant[0]
        
        # Calculate Averages
        avg_margin = sum([c.get('margin', 0) for c in relevant]) / len(relevant)
        avg_marketing = sum([c.get('marketing_percent', 0) for c in relevant]) / len(relevant)
        
        return {
            "found": True,
            "count": len(relevant),
            "avg_margin": avg_margin,
            "avg_marketing": avg_marketing,
            "best_case": closest_case,
            "wisdom": f"بناءً على {len(relevant)} مشاريع سابقة مشابهة، متوسط هامش الربح الناجح هو {avg_margin*100:.1f}%. المشاريع الناجحة تخصص عادةً {avg_marketing*100:.1f}% من الميزانية للتسويق."
        }

    def suggest_value(self, field, sector, city=None):
        """
        Suggests a single magic value (Rent, Salary, etc.)
        Uses historical data if available, otherwise heuristic rules.
        """
        # 1. Try DB first (Mocking simple DB scan for now)
        # In a real DB, we would query: SELECT AVG(field) FROM cases WHERE sector=...
        
        # 2. Fallbacks (Heuristics) - Logic Brain
        sector = str(sector).lower()
        is_premium = "premium" in sector or "luxury" in sector
        
        if field == "rent_annual":
             # Range 800 - 2000 per sqm
             base = 1500 if "cafe" in sector or "rest" in sector else 1000
             if city and "riyadh" in city.lower(): base *= 1.2
             return { "value": base, "unit": "SAR/sqm", "reason": "متوسط السوق في منطقتك" }
             
        elif field == "salary_total":
             # Est. 20-30% of revenue or fixed range
             return { "value": 35000, "unit": "SAR/month", "reason": "تقدير أولي لفريق عمل صغير (4-5 أفراد)" }
             
        elif field == "electricity_monthly":
             # Approx 30-50 SAR per sqm/month for F&B
             return { "value": 2500, "unit": "SAR/month", "reason": "تقدير بناءً على المساحة المتوقعة (100م²)" }
             
        elif field == "marketing_monthly":
             # 5% of expected revenue
             return { "value": 2000, "unit": "SAR/month", "reason": "ميزانية تشغيلية للحملات الرقمية" }

        return { "value": 0, "reason": "لا يتوفر تقدير حالياً" }

    def save_case(self, case_data):
        """
        Save a new success story to the DB.
        """
        self.db.append(case_data)
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.db, f, ensure_ascii=False, indent=2)

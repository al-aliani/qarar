"""
Market Analyst Engine (The Market Brain)
Calculates TAM, SAM, SOM based on real Saudi city data and sector benchmarks.
"""

class MarketEngine:
    def __init__(self):
        # 1. City Population Database (Approx 2024-2025 estimates)
        self.cities = {
            "Riyadh": {"pop": 7_500_000, "purchasing_power": 1.2}, # High PP
            "Jeddah": {"pop": 4_600_000, "purchasing_power": 1.1},
            "Dammam": {"pop": 1_300_000, "purchasing_power": 1.15},
            "Mecca": {"pop": 2_100_000, "purchasing_power": 0.9}, # Seasonality high
            "Medina": {"pop": 1_500_000, "purchasing_power": 0.9},
            "Khobar": {"pop": 600_000, "purchasing_power": 1.3}, # Very High PP
            "Tabuk": {"pop": 650_000, "purchasing_power": 0.9},
            "Hail": {"pop": 400_000, "purchasing_power": 0.85},
            "Abha": {"pop": 450_000, "purchasing_power": 0.9},
            "Jizan": {"pop": 350_000, "purchasing_power": 0.8},
            "General": {"pop": 1_000_000, "purchasing_power": 1.0} # Fallback
        }

        # 2. Sector Benchmarks
        # - penetration: What % of population uses this service?
        # - annual_spend: How much do they spend per year (SAR)?
        self.sectors = {
            "cafe": {"penetration": 0.65, "annual_spend": 1800}, # ~150 SAR/mo
            "restaurant": {"penetration": 0.85, "annual_spend": 3600}, # ~300 SAR/mo
            "retail": {"penetration": 0.90, "annual_spend": 2400}, # ~200 SAR/mo
            "service": {"penetration": 0.40, "annual_spend": 1200}, # Barber/Salon
            "tech": {"penetration": 0.20, "annual_spend": 5000},
            "industrial": {"penetration": 0.05, "annual_spend": 50000}, # B2B Niche
            "general": {"penetration": 0.50, "annual_spend": 1500}
        }

    def analyze_market(self, city_name, sector_name):
        """
        Calculate TAM, SAM, SOM for a given City and Sector.
        Returns detailed breakdown.
        """
        # 1. Resolve City & Sector
        city_key = self._find_city(city_name)
        sector_key = self._find_sector(sector_name)
        
        city_data = self.cities.get(city_key, self.cities["General"])
        sector_data = self.sectors.get(sector_key, self.sectors["general"])
        
        # 2. Core Variables
        population = city_data["pop"]
        pp_factor = city_data["purchasing_power"]
        
        penetration = sector_data["penetration"]
        annual_spend = sector_data["annual_spend"]
        
        # 3. Calculate TAM (Total Addressable Market)
        # Definition: Total market demand for product/service in the region.
        # TAM = Pop * Penetration * Spend * PurchasingPower
        tam_value = population * penetration * annual_spend * pp_factor
        
        # 4. Calculate SAM (Serviceable Available Market)
        # Definition: The segment you can actually reach (e.g. Geographically or Demographically).
        # Heuristic: 20% of TAM for a single branch/startup in a large city is too high, 
        # usually SAM is the "Niche" or "Zone". 
        # For a digital startup, SAM might be 40%. For a physical shop, maybe 5% of city.
        # Let's assume a "Catchment Area" logic. 
        # A typical district has ~50k-100k people. 
        # SAM = (District Pop / City Pop) * TAM
        # Defaulting to ~5% of city for SAM (Serviceable area or segment)
        sam_ratio = 0.05 
        sam_value = tam_value * sam_ratio
        
        # 5. Calculate SOM (Serviceable Obtainable Market)
        # Definition: What you can capture (Market Share).
        # Heuristic: Startups capture 1-5% of SAM in early years.
        som_ratio = 0.03 # 3% Market Share of the target area
        som_value = sam_value * som_ratio
        
        # Formatting for readability (Billions/Millions)
        def fmt(val):
            if val > 1_000_000_000: return f"{val/1_000_000_000:.2f} مليار ريال"
            if val > 1_000_000: return f"{val/1_000_000:.2f} مليون ريال"
            return f"{val:,.0f} ريال"

        return {
            "city": city_key,
            "sector": sector_key,
            "population": population,
            "metrics": {
                "tam": {"value": tam_value, "label": fmt(tam_value), "desc": "إجمالي حجم السوق المتاح (TAM)"},
                "sam": {"value": sam_value, "label": fmt(sam_value), "desc": "السوق المتاح للخدمة (SAM - نظاقك الجغرافي)"},
                "som": {"value": som_value, "label": fmt(som_value), "desc": "الحصة السوقية المتوقعة (SOM - حصتك)"}
            },
            "analysis": f"في مدينة {city_key} (عدد السكان {population/1_000_000:.1f} مليون)، يقدر حجم سوق قطاع ({sector_key}) بحوالي {fmt(tam_value)} سنوياً. حصتك المستهدفة (SOM) تقدر بـ {fmt(som_value)}."
        }

    def get_defaults(self, sector_name, city_name, area_sqm=100):
        """
        Returns default values for Express Mode based on market intelligence.
        """
        city_key = self._find_city(city_name)
        sector_key = self._find_sector(sector_name)
        
        city_data = self.cities.get(city_key, self.cities["General"])
        sector_data = self.sectors.get(sector_key, self.sectors["general"])
        
        # Purchasing Factor (High cost cities = higher rent/salaries)
        pp_factor = city_data["purchasing_power"]
        
        # 1. Rent (Annual per Sqm)
        # Base rents approx: Retail > Cafe > Service
        base_rent_map = {
            "cafe": 1200,
            "restaurant": 1500,
            "retail": 1000,
            "service": 800,
            "tech": 600, # Office
            "industrial": 300,
            "general": 900
        }
        base_rent = base_rent_map.get(sector_key, 900)
        rent_per_sqm = base_rent * pp_factor
        
        # 2. Fitout Cost (Per Sqm)
        # Fitout approx: Restaurant > Cafe > Retail > Office
        fitout_map = {
            "cafe": 2500,
            "restaurant": 3500,
            "retail": 1800,
            "service": 1200,
            "tech": 1000,
            "industrial": 1500,
            "general": 1500
        }
        fitout_per_sqm = fitout_map.get(sector_key, 1500) * pp_factor

        # 3. Salaries (Monthly)
        # Slight variation by city cost of living
        salary_factor = 1.0 + (pp_factor - 1.0) * 0.5 # Dampen the effect
        manager_salary = 6000 * salary_factor
        staff_salary = 3500 * salary_factor
        
        return {
            "rent_per_sqm": round(rent_per_sqm, -1), # Round to nearest 10
            "fitout_per_sqm": round(fitout_per_sqm, -1),
            "salaries": {
                "manager": round(manager_salary, -100),
                "staff": round(staff_salary, -100)
            },
            "marketing": {
                "initial": 10000 * pp_factor,
                "monthly": 1500 * pp_factor
            },
            "source": f"Average market rates for {sector_key.title()} in {city_key}"
        }

    def _find_city(self, text):
        text = str(text).lower()
        for k in self.cities.keys():
            if k.lower() in text: return k
            # Arabization checks
            if k == "Riyadh" and "رياض" in text: return k
            if k == "Jeddah" and "جدة" in text: return k
            if k == "Dammam" and "دمام" in text: return k
            if k == "Mecca" and ("مكة" in text or "makkah" in text): return k
            if k == "Medina" and ("مدينة" in text or "madinah" in text): return k
            if k == "Tabuk" and "تبوك" in text: return k
            if k == "Hail" and ("حائل" in text or "hail" in text): return k
            if k == "Abha" and ("أبها" in text or "abha" in text): return k
            if k == "Jizan" and ("جازان" in text or "jizan" in text): return k
            if k == "Khobar" and ("خبر" in text or "khobar" in text): return k
        return "General"

    def _find_sector(self, text):
        text = str(text).lower()
        if any(w in text for w in ['cafe', 'coffee', 'قهوة', 'كوفي']): return 'cafe'
        if any(w in text for w in ['restaurant', 'food', 'مطعم', 'اكل']): return 'restaurant'
        if any(w in text for w in ['shop', 'retail', 'محل', 'تجزئة']): return 'retail'
        if any(w in text for w in ['salon', 'service', 'خدم', 'صالون']): return 'service'
        return 'general'

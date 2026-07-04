"""
Virtual CFO Module (Financial Auditor)
Part of the Internal Brain Logic Engine.
"""

class FinancialAuditor:
    def __init__(self):
        pass

    def audit_project(self, data):
        """
        Perform a Deep Financial Audit on the project data.
        Returns a list of 'Flags' (Warnings/Critiques).
        """
        flags = []
        
        inputs = data.get('inputs', {})
        financials = data.get('financials', {})
        
        # 1. Growth Consistency Check
        # Does revenue grow while marketing usage stays flat or decreases?
        # (This is a common error in feasibility studies)
        revenue_streams = inputs.get('revenue', {}).get('revenueStreams', [])
        marketing_budget = inputs.get('marketing', {}).get('monthlyAdBudget', 0)
        
        growth_rates = [s.get('growthRate', 0) for s in revenue_streams]
        avg_growth = sum(growth_rates) / len(growth_rates) if growth_rates else 0
        
        if avg_growth > 0.15 and marketing_budget < 2000:
            flags.append({
                "severity": "high",
                "title": "نمو غير مدعوم بالتسويق",
                "message": f"تتوقع نمواً بنسبة {avg_growth*100:.1f}% سنوياً، ولكن ميزانية التسويق ({marketing_budget} ريال) منخفضة جداً. النمو يتطلب وقوداً تسويقياً."
            })

        # 2. Staffing Sufficiency Check
        # Revenue per employee ratio
        # A rough heuristic: If Revenue > 2M and Staff < 3, that's impossible.
        total_revenue_y1 = financials.get('revenueProjection', [{}])[0].get('total', 0)
        hr_positions = inputs.get('hr', {}).get('positions', [])
        total_staff = sum([p.get('count', 0) for p in hr_positions])
        
        if total_revenue_y1 > 1000000 and total_staff < 2:
            flags.append({
                "severity": "medium",
                "title": "نقص حاد في القوى العاملة",
                "message": f"تتوقع إيرادات تفوق مليون ريال بـ {total_staff} موظف فقط. تكاليف التشغيل قد تكون أقل من الواقع."
            })

        # 3. Cash Buffer Health (Burn Rate)
        # Do they have enough cash to survive 6 months of 0 sales?
        total_opex_y1 = financials.get('opex', {}).get('total', 0)
        monthly_burn = total_opex_y1 / 12
        initial_cash = financials.get('capex', {}).get('workingCapital', 0) # Often hidden in working capital
        
        # Heuristic: If Working Capital input is missing, check capex breakdown
        if initial_cash == 0:
             # Try to find it in cost items
             pass # Logic for another time
             
        if monthly_burn > 0 and (initial_cash / monthly_burn) < 3:
             flags.append({
                "severity": "high",
                "title": "مخاطر السيولة النقدية",
                "message": f"رأس المال العامل يكفي لتغطية {initial_cash/monthly_burn:.1f} أشهر فقط. يُنصح بأن يغطي 6 أشهر على الأقل."
            })

        # 4. Profitability Reality Check
        # Is the Net Profit Margin unrealistic? (> 40% for retail is suspicious)
        npv = financials.get('indicators', {}).get('npv', 0)
        roi = financials.get('indicators', {}).get('roi', 0)
        
        if roi > 80:
             flags.append({
                "severity": "medium",
                "title": "عائد استثمار مرتفع جداً",
                "message": f"نسبة العائد المتوقع ({roi}%) عالية جداً وغير معتادة في معظم القطاعات التقليدية. راجع تقديرات الإيرادات."
            })

        if not flags:
            flags.append({
                "severity": "success",
                "title": "تدقيق مالي سليم",
                "message": "لم يتم العثور على أخطاء منطقية واضحة في الافتراضات المالية."
            })
            
        return flags

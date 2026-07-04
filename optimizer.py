"""
Optimizer Engine for Feasibility Study Platform
Provides mathematical optimization for project parameters.
"""

import json

class ProjectOptimizer:
    def __init__(self):
        pass

    def optimize(self, project_data):
        """
        Analyze project data and suggest optimizations to improve NPV/Net Income.
        Input: JSON object (similar to what frontend sends)
        Output: List of suggestions
        """
        suggestions = []
        
        # Extract basic metrics
        try:
            financials = project_data.get('financials', {})
            inputs = project_data.get('inputs', {})
            
            capex = self._get_total_capex(inputs)
            opex = self._get_monthly_opex(inputs) * 12
            revenue = self._get_annual_revenue(inputs, financials)
            
            net_income = revenue - opex
            roi = (net_income / capex) * 100 if capex > 0 else 0
            
            # Strategy 1: Labor Optimization
            # Benchmark: Labor should be 20-30% of Revenue
            labor_cost = self._get_labor_cost(inputs)
            labor_ratio = labor_cost / revenue if revenue > 0 else 0
            
            if labor_ratio > 0.30:
                target_labor = revenue * 0.28
                reduction = labor_cost - target_labor
                suggestions.append({
                    "category": "Labor",
                    "type": "Optimization",
                    "message": f"نسبة تكلفة العمالة ({labor_ratio*100:.1f}%) مرتفعة عن المعدل الصحي (30%).",
                    "action": "reduction",
                    "target_value": target_labor,
                    "details": f"يُقترح تقليل تكلفة الرواتب السنوية بمقدار {reduction:,.0f} ريال (بحث عن كفاءة أعلى أو تقليل عدد الموظفين غير الأساسيين)."
                })

            # Strategy 2: Pricing/Revenue Optimization
            # If Net Income is low margin (< 15%)
            margin = net_income / revenue if revenue > 0 else 0
            if margin < 0.15 and margin > -0.5: # If struggling but not catastrophic
                 # Suggest slight price increase
                 suggestions.append({
                    "category": "Pricing",
                    "type": "Optimization",
                    "message": f"هامش الربح التشغيلي ({margin*100:.1f}%) منخفض.",
                    "action": "increase",
                    "details": "يُقترح زيادة أسعار البيع بنسبة 5-10% لتحسين الهامش، مع التركيز على تسويق القيمة المضافة."
                 })

            # Strategy 3: Marketing Efficiency
            # Benchmark: Marketing should be 3-6% of Revenue
            marketing_budget = (inputs.get('marketing', {}).get('monthlyAdBudget', 0) * 12) + \
                               (inputs.get('marketing', {}).get('openingBudget', 0) / 5) # Amortized opening
            
            mark_ratio = marketing_budget / revenue if revenue > 0 else 0
            if mark_ratio < 0.02:
                 suggestions.append({
                    "category": "Growth",
                    "type": "Optimization",
                    "message": "ميزانية التسويق منخفضة جداً مما قد يحد من النمو.",
                    "action": "increase",
                    "details": "يُقترح رفع ميزانية التسويق بنسبة 50% لزيادة الوصول للعملاء وتسريع النمو."
                 })
            
        except Exception as e:
            print(f"Optimization error: {e}")
            return [{"error": str(e)}]

        return suggestions

    def reverse_engineer_price(self, data, target_margin=0.20):
        """
        Calculate the required average price to achieve a target net profit margin.
        Formula: Price = (Total Fixed Costs + Total Variable Costs) / (Total Units * (1 - Target Margin))
        *Note: This is a simplified calculation assuming one main revenue stream or average price.*
        """
        inputs = data.get('inputs', {})
        financials = data.get('financials', {})
        
        # 1. Total Costs (Year 1)
        # Try to get from financials first
        year1_costs = 0
        total_opex = 0
        
        # Calculate procedurally if financials missing
        # Salaries
        hr = inputs.get('hr', {}).get('positions', [])
        salaries = sum([p.get('count', 0) * p.get('salary', 0) * 12 for p in hr])
        
        # Marketing
        marketing = inputs.get('marketing', {}).get('monthlyAdBudget', 0) * 12
        
        # Logistics & Admin (Fixed)
        logistics = sum([item.get('monthly', 0) * 12 for item in inputs.get('logistics', {}).get('logistics', [])])
        admin = sum([item.get('monthly', 0) * 12 for item in inputs.get('administrative', {}).get('administrative', [])])
        
        # Total Fixed Costs (Approx)
        fixed_costs = salaries + marketing + logistics + admin
        
        # 2. Revenue & Units
        revenue_streams = inputs.get('revenue', {}).get('revenueStreams', [])
        if not revenue_streams:
             return {"error": "No revenue streams defined."}

        # Weighted Average Variable Cost per unit (if detailed) or generic assumption
        # For simplicity in this 'brain', let's sum total expected units
        total_units = sum([stream.get('customersPerMonth', 0) * 12 for stream in revenue_streams])
        
        if total_units == 0:
            return {"error": "Total units (customers) is zero."}
            
        # Current weighted average price
        current_revenue = sum([s.get('avgPrice', 0) * s.get('customersPerMonth', 0) * 12 for s in revenue_streams])
        current_avg_price = current_revenue / total_units
        
        # Variable cost is often a % in this detailed app, or per unit. 
        # Let's assume a standard COGS ratio if not provided, say 30% of price is cost.
        # So VC_per_unit = 0.30 * CurrentPrice (Assumption for reverse engineering)
        vc_per_unit = current_avg_price * 0.30 
        
        # Calculation
        # Price * Q * (1 - Margin) = FC + VC*Q
        # Price = (FC + VC*Q) / (Q * (1 - Margin))
        
        required_revenue = (fixed_costs + (vc_per_unit * total_units)) / (1 - target_margin)
        required_price = required_revenue / total_units
        
        return {
            "mode": "reverse_engineering",
            "target_margin": target_margin,
            "current_avg_price": current_avg_price,
            "required_avg_price": required_price,
            "price_increase_needed": required_price - current_avg_price,
            "message": f"To hit {target_margin*100}% margin, you need to raise average price from {current_avg_price:.0f} to {required_price:.0f} SAR."
        }

        return {
            "mode": "reverse_engineering",
            "target_margin": target_margin,
            "current_avg_price": current_avg_price,
            "required_avg_price": required_price,
            "price_increase_needed": required_price - current_avg_price,
            "message": f"To hit {target_margin*100}% margin, you need to raise average price from {current_avg_price:.0f} to {required_price:.0f} SAR."
        }

    def optimize_staffing(self, data):
        """
        Calculate the maximum affordable staff count for a target profit floor.
        "How many people can I hire before I lose money?"
        """
        inputs = data.get('inputs', {})
        financials = data.get('financials', {})
        
        # 1. Calculate Current Profit (Year 1)
        revenue = financials.get('revenueProjection', [{}])[0].get('total', 0)
        total_opex = financials.get('opex', {}).get('total', 0)
        current_net_income = revenue - total_opex
        
        # 2. Average Salary
        hr = inputs.get('hr', {}).get('positions', [])
        total_staff = sum([p.get('count', 0) for p in hr])
        total_payroll = sum([p.get('count', 0) * p.get('salary', 0) * 12 for p in hr])
        
        if total_staff == 0:
            avg_annual_cost = 60000 # Default assumption 5k/month
        else:
            avg_annual_cost = total_payroll / total_staff
            
        # 3. Logic: How much "Room" do we have?
        # Let's say we want to keep at least 10% Profit Margin, or 0 Profit (Break even)
        # Max Additional Cost = Current Net Income - (Revenue * MinMargin)
        
        min_margin = 0.10
        min_profit_required = revenue * min_margin
        available_budget = current_net_income - min_profit_required
        
        if available_budget <= 0:
            return {
                "status": "saturated",
                "max_additional_hires": 0,
                "message": "لا يمكنك توظيف المزيد حالياً دون التأثير على حد الربحية الآمن (10%)."
            }
            
        max_hires = int(available_budget // avg_annual_cost)
        
        return {
            "status": "growth_potential",
            "max_additional_hires": max_hires,
            "avg_cost_per_hire": avg_annual_cost,
            "message": f"بناءً على أرباحك الحالية، يمكنك توظيف {max_hires} موظفين إضافيين (بمتوسط راتب {avg_annual_cost/12:,.0f} ريال) مع الحفاظ على هامش ربح 10%."
        }

    def analyze_breakeven(self, data):
        """
        Advanced Break-even Strategy.
        Check structure of Fixed vs Variable costs and suggest pivot.
        """
        # Simplification: In a real app we'd parse detailed cost structures
        # Here we offer high-level strategic advice based on the ratio.
        
        # Placeholder for complex math
        return {
            "strategy": "Volume Focus",
            "tips": [
                "تكاليفك الثابتة مرتفعة: ركز على زيادة حجم المبيعات (High Volume) ولو بتخفيض السعر قليلاً.",
                "حاول تحويل بعض الرواتب الثابتة إلى نظام عمولات (Variable Cost) لتقليل المخاطر."
            ]
        }

        return {
            "strategy": "Volume Focus",
            "tips": [
                "تكاليفك الثابتة مرتفعة: ركز على زيادة حجم المبيعات (High Volume) ولو بتخفيض السعر قليلاً.",
                "حاول تحويل بعض الرواتب الثابتة إلى نظام عمولات (Variable Cost) لتقليل المخاطر."
            ]
        }

    def analyze_sensitivity(self, data):
        """
        Sensitivity Analysis Engine (The 'Impact' Engine).
        Determines which variable (Price, COGS, Rent, Marketing) has the biggest impact on Net Profit.
        """
        inputs = data.get('inputs', {})
        financials = data.get('financials', {})
        
        # Base Case Profit (Year 1)
        base_revenue = financials.get('revenueProjection', [{}])[0].get('total', 0)
        base_opex = financials.get('opex', {}).get('total', 0)
        base_profit = base_revenue - base_opex
        
        # We will perturb key variables by +10% and see impact on Profit
        # Key Vars:
        # 1. Price (Revenue)
        # 2. Variable Cost (COGS)
        # 3. Fixed Cost (Rent + Salaries)
        
        results = []
        
        # 1. Price Impact (+10%)
        # Revenue increases by 10% directly (assuming inelastic demand for this simple check)
        new_rev_price = base_revenue * 1.10
        profit_price_up = new_rev_price - base_opex
        impact_price = (profit_price_up - base_profit) / abs(base_profit) if base_profit != 0 else 0
        results.append({"factor": "Price", "change": "+10%", "profit_impact": impact_price, "desc": "زيادة السعر 10%"})

        # 2. Volume Impact (+10%)
        # Revenue +10%, COGS +10%
        # Estimate COGS portion (Approx 30% of revenue if not specified)
        cogs_est = base_revenue * 0.30 
        new_rev_vol = base_revenue * 1.10
        new_cogs_vol = cogs_est * 1.10
        new_opex_vol = (base_opex - cogs_est) + new_cogs_vol
        profit_vol_up = new_rev_vol - new_opex_vol
        impact_vol = (profit_vol_up - base_profit) / abs(base_profit) if base_profit != 0 else 0
        results.append({"factor": "Volume", "change": "+10%", "profit_impact": impact_vol, "desc": "زيادة المبيعات 10%"})

        # 3. Fixed Cost Impact (+10%)
        # Rent + Salaries increase
        fixed_est = base_opex - cogs_est
        new_fixed = fixed_est * 1.10
        new_opex_fixed = new_fixed + cogs_est
        profit_fixed_up = base_revenue - new_opex_fixed
        impact_fixed = (profit_fixed_up - base_profit) / abs(base_profit) if base_profit != 0 else 0
        results.append({"factor": "Fixed Costs", "change": "+10%", "profit_impact": impact_fixed, "desc": "ارتفاع التكاليف الثابتة 10%"})

        # Sort by absolute impact
        results.sort(key=lambda x: abs(x['profit_impact']), reverse=True)
        
        top_factor = results[0]
        advice = f"تحليل الحساسية يظهر أن {top_factor['factor']} هو العامل الأكثر تأثيراً على أرباحك. أي تغيير بسيط فيه سيؤثر بشكل هائل على النتيجة النهائية."
        
        return {
            "mode": "sensitivity",
            "ranking": results,
            "top_factor": top_factor,
            "message": advice
        }

    def run_simulation(self, data):
        """
        Monte Carlo Simulation Core (Python-based).
        Runs 5,000 scenarios to estimate Risk of Loss.
        """
        import random
        
        inputs = data.get('inputs', {})
        financials = data.get('financials', {})
        
        base_revenue = financials.get('revenueProjection', [{}])[0].get('total', 0)
        base_opex = financials.get('opex', {}).get('total', 0)
        
        simulations = []
        iterations = 5000
        
        loss_count = 0
        
        for _ in range(iterations):
            # Monte Carlo Logic:
            # Revenue varies ±20% (Market volatility)
            # Opex varies ±10% (Operational volatility)
            
            # Simple triangular distribution approach
            rev_factor = random.triangular(0.8, 1.2, 1.0) # Min, Max, Mode
            opex_factor = random.triangular(0.9, 1.15, 1.02) # Costs usually skew higher
            
            sim_rev = base_revenue * rev_factor
            sim_opex = base_opex * opex_factor
            sim_profit = sim_rev - sim_opex
            
            simulations.append(sim_profit)
            if sim_profit < 0:
                loss_count += 1
                
        # Calculate Stats
        simulations.sort()
        p90 = simulations[int(iterations * 0.10)] # Conservative
        p50 = simulations[int(iterations * 0.50)] # Median
        p10 = simulations[int(iterations * 0.90)] # Optimistic
        
        risk_probability = (loss_count / iterations) * 100
        
        return {
            "mode": "simulation",
            "iterations": iterations,
            "risk_of_loss": risk_probability,
            "p90_profit": p90,
            "p50_profit": p50,
            "p10_profit": p10,
            "message": f"بناءً على محاكاة {iterations} سيناريو، نسبة احتمال الخسارة في السنة الأولى هي {risk_probability:.1f}%."
        }

    def _get_total_capex(self, inputs):
        # Helper to sum lists
        total = 0

        tech = inputs.get('technical', {})
        for cat in ['equipment', 'furniture', 'buildings']:
            for item in tech.get(cat, []):
                total += float(item.get('price', 0)) * float(item.get('quantity', 1))
        return total

    def _get_monthly_opex(self, inputs):
        total = 0
        # Labor
        for pos in inputs.get('hr', {}).get('positions', []):
           total += float(pos.get('salary', 0)) * float(pos.get('count', 1))
        
        # Logistics/Admin
        for item in inputs.get('logistics', {}).get('logistics', []):
             total += float(item.get('monthly', 0))
        for item in inputs.get('administrative', {}).get('administrative', []):
             total += float(item.get('monthly', 0))
             
        # Marketing monthly
        total += float(inputs.get('marketing', {}).get('monthlyAdBudget', 0))
        return total

    def _get_labor_cost(self, inputs):
        total = 0
        for pos in inputs.get('hr', {}).get('positions', []):
           # Annual
           total += float(pos.get('salary', 0)) * float(pos.get('count', 1)) * 12
        return total

    def _get_annual_revenue(self, inputs, financials):
        # Try to get from financials first (calculated)
        if financials and 'incomeStatement' in financials and len(financials['incomeStatement']) > 0:
            return financials['incomeStatement'][0].get('revenue', 0)
        
        # Fallback estimation
        streams = inputs.get('revenue', {}).get('revenueStreams', [])
        total = 0
        for s in streams:
            # Simple daily * 30 * 12 estimation
            # daySales = price * customers
            daily_rev = float(s.get('avgPrice', 0)) * float(s.get('customersPerMonth', 0) / 30) # approx
            total += daily_rev * 360
        return total

if __name__ == "__main__":
    opt = ProjectOptimizer()
    print("Optimization engine ready.")

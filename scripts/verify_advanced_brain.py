"""
Verification Script for Internal Logic Brain (Advanced)
Tests Virtual CFO (Audit) and Staffing Optimization
"""
import sys
import os
import json

# Add verify module path
sys.path.append(os.getcwd())

def test_financial_auditor():
    print("\n--- Testing Virtual CFO (Financial Auditor) ---")
    try:
        from financial_auditor import FinancialAuditor
        auditor = FinancialAuditor()
        
        # Scenario: Flawed Project
        # High growth (50%) but LOW marketing (1000/mo)
        # Revenue > 1M but only 1 employee
        sample_data = {
            "inputs": {
                "marketing": {"monthlyAdBudget": 1000},
                "revenue": {
                    "revenueStreams": [
                        {"growthRate": 0.50, "customersPerMonth": 1000, "avgPrice": 100} # 1.2M Revenue
                    ]
                },
                "hr": {"positions": [{"count": 1, "salary": 2000}]}
            },
            "financials": {
                "revenueProjection": [{"total": 1200000}], # Year 1
                "opex": {"total": 50000}, # Very low opex
                "capex": {"workingCapital": 10000}, # Only 10k cash
                "indicators": {"npv": 500000, "roi": 120} # Suspiciously high ROI
            }
        }
        
        flags = auditor.audit_project(sample_data)
        
        print(f"Found {len(flags)} Flags:")
        for flag in flags:
            print(f"[{flag['severity'].upper()}] {flag['title']}: {flag['message']}")
            
        # We expect at least 3 flags: Marketing, Staffing, ROI/Cash
        if len(flags) >= 3:
            print("✅ Auditor Logic Verified.")
        else:
            print("⚠️ Auditor missed some obvious errors.")

    except Exception as e:
        print(f"❌ Auditor Test Failed: {e}")

def test_staffing_optimizer():
    print("\n--- Testing Staffing Optimizer ---")
    try:
        from optimizer import ProjectOptimizer
        opt = ProjectOptimizer()
        
        # Scenario: Profitable Project
        # Revenue: 2,000,000
        # Opex: 1,000,000
        # Net Income: 1,000,000
        # Staff: 5 people @ 10k/mo = 600k/yr payroll
        # Goal: Keep 10% Margin (200k profit)
        # Available for Hiring: 1M - 200k = 800k
        # Cost per new hire: ~120k/yr (10k/mo)
        # Max Hires = 800k / 120k ~= 6.6 -> 6 employees
        
        sample_data = {
            "inputs": {
                "hr": {"positions": [{"count": 5, "salary": 10000}]}
            },
            "financials": {
                "revenueProjection": [{"total": 2000000}],
                "opex": {"total": 1000000}
            }
        }
        
        result = opt.optimize_staffing(sample_data)
        
        print(f"Max Additional Hires: {result['max_additional_hires']}")
        print(f"Message: {result['message']}")
        
        if result['max_additional_hires'] in [6, 7]:
            print("✅ Staffing Math Verified.")
        else:
            print("⚠️ Staffing Math seems off.")

    except Exception as e:
        print(f"❌ Staffing Test Failed: {e}")

if __name__ == "__main__":
    test_financial_auditor()
    test_staffing_optimizer()

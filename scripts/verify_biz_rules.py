"""
Verification Script for Business Rules Engine
Tests Compliance and Marketing Logic
"""
import sys
import os
import json

sys.path.append(os.getcwd())

def test_biz_rules():
    print("\n--- Testing Business Rules Engine ---")
    try:
        from business_rules import BusinessRulesEngine
        eng = BusinessRulesEngine()
        
        # Test 1: Licenses for Cafe
        print("\n[Scenario: Licenses for Cafe]")
        lics = eng.get_licenses("coffee shop")
        for l in lics:
            print(f"- {l['name']} ({l['cost']} SAR)")
        
        if any("موسيقى" in l['name'] for l in lics):
             print("✅ Cafe Licenses Verified (Music permit found).")
        else:
             print("⚠️ Check License Logic.")

        # Test 2: Marketing for Retail
        print("\n[Scenario: Marketing for Abaya Shop]")
        mkt = eng.get_marketing_plan("Abaya Retail")
        for m in mkt:
            print(f"- {m['channel']}: {m['focus']} (Share: {m['budget_share']*100}%)")
            
        if any("Snapchat" in m['channel'] for m in mkt):
             print("✅ Retail Marketing Verified (Snapchat found).")

    except Exception as e:
        print(f"❌ Biz Engine Test Failed: {e}")

if __name__ == "__main__":
    test_biz_rules()

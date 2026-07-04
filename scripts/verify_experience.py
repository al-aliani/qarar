"""
Verification Script for Experience Engine
Tests Historical Consultation
"""
import sys
import os
import json

sys.path.append(os.getcwd())

def test_experience():
    print("\n--- Testing Experience Brain ---")
    try:
        from experience_engine import ExperienceEngine
        eng = ExperienceEngine()
        
        # Scenario 1: Coffee Shop
        print("\n[Scenario: Coffee Shop Budget 300k]")
        res1 = eng.consult_history("coffee shop", 300000)
        
        if res1['found']:
            print(f"Found {res1['count']} similar cases.")
            print(f"Wisdom: {res1['wisdom']}")
            print(f"Best Match: {res1['best_case']['name']} (Budget: {res1['best_case']['budget']})")
            print(f"Success Factor: {res1['best_case']['success_factor']}")
            
            if "Specialty Coffee" in res1['best_case']['name'] or "Cozy" in res1['best_case']['name']:
                 print("✅ Retrieved Verified Coffee Case.")
        else:
             print("⚠️ No history found for Coffee.")

        # Scenario 2: Unknown Sector
        print("\n[Scenario: Spaceship Factory]")
        res2 = eng.consult_history("spaceship factory", 9000000)
        print(f"Message: {res2.get('message')}")
        if not res2['found']:
            print("✅ Correctly handled unknown sector.")

    except Exception as e:
        print(f"❌ Experience Engine Test Failed: {e}")

if __name__ == "__main__":
    test_experience()

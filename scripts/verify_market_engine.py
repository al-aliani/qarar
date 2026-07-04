"""
Verification Script for Market Intelligence Engine
Tests TAM/SAM/SOM Logic for Saudi Cities
"""
import sys
import os
import json

sys.path.append(os.getcwd())

def test_market():
    print("\n--- Testing Market Analyst Engine ---")
    try:
        from market_engine import MarketEngine
        eng = MarketEngine()
        
        # Test 1: Coffee in Riyadh
        print("\n[Scenario: Coffee in Riyadh]")
        res1 = eng.analyze_market("الرياض", "coffee shop")
        print(f"City: {res1['city']} (Pop: {res1['population']:,})")
        print(f"Sector: {res1['sector']}")
        print(f"TAM: {res1['metrics']['tam']['label']}")
        print(f"SAM: {res1['metrics']['sam']['label']}")
        print(f"Analysis: {res1['analysis']}")
        
        if "Riyadh" in res1['city'] and res1['metrics']['tam']['value'] > 1_000_000_000:
             print("✅ Riyadh Logic Verified.")
        else:
             print("⚠️ Riyadh Logic issue.")

        # Test 2: Burger in Tabuk
        print("\n[Scenario: Restaurant in Tabuk]")
        res2 = eng.analyze_market("تبوك", "مطعم برجر")
        print(f"City: {res2['city']} (Pop: {res2['population']:,})")
        print(f"TAM: {res2['metrics']['tam']['label']}")
        
        if "Tabuk" in res2['city'] and res2['metrics']['tam']['value'] < res1['metrics']['tam']['value']:
             print("✅ Local City Logic Verified (Tabuk < Riyadh).")
        else:
             print("⚠️ City Scaling issue.")

    except Exception as e:
        print(f"❌ Market Engine Test Failed: {e}")

if __name__ == "__main__":
    test_market()

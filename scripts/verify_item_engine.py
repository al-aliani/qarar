"""
Verification Script for Smart Item Engine
Tests Generation of Equipment, Furniture, and Staff
"""
import sys
import os
import json

sys.path.append(os.getcwd())

def test_items():
    print("\n--- Testing Smart Item Engine ---")
    try:
        from item_engine import ItemEngine
        eng = ItemEngine()
        
        # Scenario 1: Coffee Shop (Small)
        print("\n[Scenario: Coffee Shop]")
        cafe_info = {"name": "Specialty Coffee", "description": "مقهى مختص يقدم اسبريسو"}
        
        eq = eng.generate_items('equipment', cafe_info)
        print(f"Equipment ({len(eq)} items):")
        for i in eq: print(f"- {i['name']} (Qty: {i['quantity']}, Price: {i['price']})")
        
        if any("اسبريسو" in i['name'] for i in eq):
            print("✅ Detected Cafe Context (Espresso Machine found).")
        else:
            print("⚠️ Failed to detect Cafe context.")

        # Scenario 2: Restaurant (Large)
        print("\n[Scenario: Restaurant]")
        rest_info = {"name": "Big Burger", "description": "مطعم وجبات سريعة"}
        # Mocking logic that might depend on area if we passed it, currently uses defaults
        
        st = eng.generate_items('staff', rest_info)
        print(f"Staff ({len(st)} roles):")
        for i in st: print(f"- {i['name']} (Count: {i['count']}, Salary: {i['salary']})")
        
        if any("شيف" in i['name'] or "طاهي" in i['name'] for i in st):
             print("✅ Detected Restaurant Context (Chef found).")
        else:
             print("⚠️ Failed to detect Restaurant context.")

    except Exception as e:
        print(f"❌ Item Engine Test Failed: {e}")

if __name__ == "__main__":
    test_items()

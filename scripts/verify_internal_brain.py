"""
Verification Script for Internal Logic Brain
"""
import sys
import os
import json

# Add verify module path
sys.path.append(os.getcwd())

def test_expert_logic():
    print("\n--- Testing Expert Logic Generator ---")
    try:
        from ai_server_enhanced import ExpertLogicHandler
        # We can't easily instantiate the handler without a request, 
        # so we will test the underlying method if we can access it, 
        # or just import the class and test a standalone version of the logic if we separated it.
        # Actually, let's just make a mock request to the running server or 
        # instantiate the handler logic directly if possible. 
        # For simplicity in this script, let's duplicate the logic check or 
        # use requests to hit localhost if running. 
        
        # Better: Let's test the server response via requests if it's running, 
        # or just test the Optimizer directly since that's the "Brain".
        pass 
    except Exception as e:
        print(f"❌ Logic Test Failed: {e}")

def test_reverse_engineering():
    print("\n--- Testing Mathematical Brain (Reverse Engineering) ---")
    try:
        from optimizer import ProjectOptimizer
        opt = ProjectOptimizer()
        
        # Scenario: 
        # Fixed Costs: 100,000
        # Target Margin: 20%
        # Units: 10,000
        # VC per unit: 10 (Derived from current price of 33 roughly)
        
        sample_data = {
            "inputs": {
                "hr": {"positions": [{"count": 1, "salary": 5000}]}, # 60k/yr
                "marketing": {"monthlyAdBudget": 1000}, # 12k/yr
                "logistics": {"logistics": [{"monthly": 2000}]}, # 24k/yr
                "administrative": {"administrative": [{"monthly": 333.33}]}, # ~4k/yr
                # Total Fixed ~= 100k
                
                "revenue": {
                    "revenueStreams": [
                        {"customersPerMonth": 833.33, "avgPrice": 30} # ~10k units/yr
                    ]
                }
            },
            "financials": {} 
        }
        
        # Current Price = 30
        # Current Revenue = 300,000
        # Fixed Costs = 100,000
        # VC (assumed 30% of price) = 9 * 10,000 = 90,000
        # Total Cost = 190,000
        # Profit = 110,000
        # Margin = 110k / 300k = 36%
        
        # Let's ask for 50% Margin!
        # Target Margin = 0.50
        # Price = (FC + VC*Q) / (Q * (1 - 0.5))
        # Price = (100k + 90k) / (10k * 0.5)
        # Price = 190k / 5k = 38
        
        result = opt.reverse_engineer_price(sample_data, target_margin=0.50)
        
        print(f"Goal: 50% Profit Margin")
        print(f"Current Price: {result['current_avg_price']:.2f}")
        print(f"Required Price: {result['required_avg_price']:.2f}")
        print(f"Message: {result['message']}")
        
        if 37 < result['required_avg_price'] < 39:
            print("✅ Calculation Verified Correctly.")
        else:
            print("⚠️ Calculation seems off.")

    except Exception as e:
        print(f"❌ Optimizer Test Failed: {e}")

if __name__ == "__main__":
    test_reverse_engineering()

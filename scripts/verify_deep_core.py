"""
Verification Script for Deep Core Engines
Tests Sensitivity Analysis and Monte Carlo Simulation
"""
import sys
import os
import json

# Add verify module path
sys.path.append(os.getcwd())

def test_deep_core():
    print("\n--- Testing Deep Core Engines ---")
    try:
        from optimizer import ProjectOptimizer
        opt = ProjectOptimizer()
        
        # Scenario: 
        # Revenue: 1,000,000
        # Opex: 800,000 (Fixed: 500k, Variable: 300k)
        # Profit: 200,000
        # We expect PRICE to be very sensitive because it adds purely to bottom line.
        
        sample_data = {
            "financials": {
                "revenueProjection": [{"total": 1000000}], # Year 1
                "opex": {"total": 800000}
            },
            "inputs": {} # Minimal needed for these specific engines
        }
        
        # 1. Test Sensitivity
        print("\n[Sensitivity Analysis]")
        sens = opt.analyze_sensitivity(sample_data)
        top = sens['top_factor']
        print(f"Top Factor: {top['factor']} (Impact: {top['profit_impact']*100:.1f}%)")
        print(f"Message: {sens['message']}")
        
        if top['factor'] == 'Price':
            print("✅ Sensitivity Logic Verified (Price is King).")
        else:
            print(f"⚠️ Unexpected top factor: {top['factor']}")

        # 2. Test Monte Carlo
        print("\n[Monte Carlo Simulation]")
        # Force a risky scenario: Revenue 1M, Opex 950k (Base profit 50k, very thin)
        # Volatility should push this into loss frequently.
        risky_data = {
            "financials": {
                "revenueProjection": [{"total": 1000000}],
                "opex": {"total": 950000}
            }
        }
        
        sim = opt.run_simulation(risky_data)
        print(f"Iterations: {sim['iterations']}")
        print(f"Risk of Loss: {sim['risk_of_loss']:.1f}%")
        print(f"P50 Profit: {sim['p50_profit']:,.0f}")
        
        if sim['risk_of_loss'] > 20: 
            print("✅ Monte Carlo Verified (Risk correctly identified).")
        else:
             print(f"⚠️ Risk seems too low ({sim['risk_of_loss']}%) for such a thin margin.")

    except Exception as e:
        print(f"❌ Deep Core Test Failed: {e}")

if __name__ == "__main__":
    test_deep_core()

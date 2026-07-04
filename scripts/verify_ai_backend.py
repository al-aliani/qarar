"""
Verification Script for AI Components
"""
import sys
import os

# Add verify module path
sys.path.append(os.getcwd())

def test_knowledge_base():
    print("\n--- Testing Knowledge Base ---")
    try:
        from knowledge_base import KnowledgeBase
        kb = KnowledgeBase()
        results = kb.search("تراخيص الدفاع المدني")
        if len(results) > 0:
            print(f"✅ KB Search Successful. Found {len(results)} results.")
            print(f"   Top result: {results[0]['source']} (Score: {results[0]['score']})")
        else:
            print("⚠️ KB Search returned no results (might be expected if no docs match).")
    except Exception as e:
        print(f"❌ KB Test Failed: {e}")

def test_optimizer():
    print("\n--- Testing Optimizer ---")
    try:
        from optimizer import ProjectOptimizer
        opt = ProjectOptimizer()
        
        # Sample Data: High labor cost scenario
        sample_data = {
            "inputs": {
                "hr": {
                    "positions": [
                        {"position": "Manager", "count": 1, "salary": 15000},
                        {"position": "Staff", "count": 10, "salary": 4000}
                    ]
                },
                "marketing": {"monthlyAdBudget": 1000, "openingBudget": 5000},
                "revenue": {
                    "revenueStreams": [
                        {"avgPrice": 50, "customersPerMonth": 1000} # Revenue ~ 600,000/yr
                    ]
                },
                "logistics": {"logistics": []},
                "administrative": {"administrative": []},
                "technical": {"equipment": [], "furniture": [], "buildings": []}
            },
            "financials": {} 
        }
        
        # Revenue = 50 * 1000 * 12 = 600,000
        # Labor = (15000 + 40000) * 12 = 660,000
        # Labor is > 100% of revenue -> Should suggest reduction
        
        suggestions = opt.optimize(sample_data)
        if len(suggestions) > 0:
            print(f"✅ Optimizer produced {len(suggestions)} suggestions.")
            for s in suggestions:
                print(f"   - {s['category']}: {s['message']} -> {s['action']}")
        else:
            print("⚠️ Optimizer produced no suggestions (unexpected for this bad scenario).")

    except Exception as e:
        print(f"❌ Optimizer Test Failed: {e}")

if __name__ == "__main__":
    test_knowledge_base()
    test_optimizer()

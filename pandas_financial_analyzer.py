import pandas as pd
import json

class FinancialAnalyzer:
    """
    A Pandas-powered engine to calculate core feasibility metrics.
    Replaces manual loops and complex excel parsing.
    """
    
    def __init__(self, data_source: pd.DataFrame):
        self.df = data_source
        
    @classmethod
    def from_csv(cls, file_path: str):
        df = pd.read_csv(file_path)
        return cls(df)
        
    @classmethod
    def from_excel(cls, file_path: str, sheet_name: str = 0):
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        return cls(df)

    def calculate_roi(self, initial_investment_col, net_profit_col):
        """Calculate Return on Investment"""
        total_investment = self.df[initial_investment_col].sum()
        total_profit = self.df[net_profit_col].sum()
        
        if total_investment == 0:
            return 0
            
        roi = (total_profit / total_investment) * 100
        return round(roi, 2)
        
    def generate_summary(self):
        """Generate a fast statistical summary to be sent to frontend"""
        summary = self.df.describe().to_dict()
        return json.dumps(summary, indent=4)

if __name__ == "__main__":
    print("Pandas Financial Analyzer initialized. Ready for integration.")

import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser

class FeasibilityAIReader:
    """
    Uses LangChain to process documents and generate structured AI insights
    for feasibility studies.
    """
    
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0.2, api_key=self.api_key)
        
    def extract_key_metrics(self, raw_text: str):
        """Extracts core financial and market metrics from unstructured text."""
        
        template = """
        You are an expert financial analyst reviewing a feasibility study.
        Extract the following information from the text:
        - Expected Initial Investment
        - Target Audience
        - Estimated ROI
        
        Text: {text}
        
        Format your response as valid JSON.
        """
        
        prompt = PromptTemplate(
            template=template,
            input_variables=["text"],
        )
        
        chain = prompt | self.llm | JsonOutputParser()
        
        try:
            return chain.invoke({"text": raw_text})
        except Exception as e:
            return {"error": str(e)}

if __name__ == "__main__":
    print("LangChain Feasibility Reader initialized. Ready for integration.")

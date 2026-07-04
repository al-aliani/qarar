"""
Knowledge Base Module for Feasibility Study Platform
Indexes local documents and provides context for AI queries (RAG).
Uses simple keyword matching and text scoring to avoid heavy dependencies.
"""

import os
import glob
import re
from collections import defaultdict

DOCS_DIR = "docs"
ASSETS_DIR = "assets"

class KnowledgeBase:
    def __init__(self):
        self.documents = []
        self.index_documents()

    def index_documents(self):
        """Read and index all relevant documents from docs and assets"""
        print("[KB] Indexing Knowledge Base...")
        self.documents = []
        
        # extensions to look for
        extensions = ['*.md', '*.txt', '*.json']
        
        for ext in extensions:
            # Search in docs
            for filepath in glob.glob(os.path.join(DOCS_DIR, ext)):
                self._add_doc(filepath)
            
            # Search in assets
            for filepath in glob.glob(os.path.join(ASSETS_DIR, ext)):
                self._add_doc(filepath)
        
        print(f"[KB] Indexed {len(self.documents)} documents.")

    def _add_doc(self, filepath):
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                # Basic chunking: split by headers or double newlines to make retrieval more precise
                # For now, we store the whole content but will score snippets
                self.documents.append({
                    'path': filepath,
                    'name': os.path.basename(filepath),
                    'content': content
                })
        except Exception as e:
            print(f"[WARN] Could not read {filepath}: {e}")

    def search(self, query, top_k=3):
        """
        Search for relevant document segments based on query.
        Returns top_k most relevant snippets.
        """
        if not query:
            return []

        # Simple scoring mechanism
        query_terms = set(re.findall(r'\w+', query.lower()))
        results = []

        for doc in self.documents:
            score = 0
            content_lower = doc['content'].lower()
            
            # Count term overlap
            for term in query_terms:
                if len(term) < 3: continue # Skip short words
                score += content_lower.count(term)
            
            if score > 0:
                # Extract relevant snippet
                snippet = self._extract_snippet(doc['content'], query_terms)
                results.append({
                    'source': doc['name'],
                    'score': score,
                    'snippet': snippet
                })

        # Sort by score descending
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    def _extract_snippet(self, content, query_terms, context_window=200):
        """Extract a text window around the most relevant part"""
        content_lower = content.lower()
        best_pos = -1
        max_matches = 0
        
        # Sliding window rough approximation or just find first cluster of terms
        # Let's find the first occurrence of the rarest term or just the first term
        # Better: find a window with max term density.
        
        # Simplified: Find first occurrence of any query term
        first_pos = len(content)
        for term in query_terms:
            if len(term) < 3: continue
            pos = content_lower.find(term)
            if pos != -1 and pos < first_pos:
                first_pos = pos
        
        if first_pos == len(content):
            return content[:context_window] + "..."

        start = max(0, first_pos - context_window // 2)
        end = min(len(content), first_pos + context_window * 3 // 2)
        
        snippet = content[start:end].replace('\n', ' ')
        return "..." + snippet + "..."

# Usage test
if __name__ == "__main__":
    kb = KnowledgeBase()
    res = kb.search("تراخيص الدفاع المدني")
    for r in res:
        print(f"Score: {r['score']} - Source: {r['source']}")
        print(f"Snippet: {r['snippet']}\n")

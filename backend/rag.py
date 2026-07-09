"""
Minimal, dependency-light RAG engine.

Implements TF-IDF vectorization + cosine similarity from scratch with numpy so the
project runs fully offline with zero heavyweight ML dependencies (no sklearn,
no sentence-transformers, no vector DB server required). This is intentional:
the hackathon battle plan's #1 rule is "data quality beats model complexity" and
a transparent, explainable retrieval step is easier to defend in front of judges
than a black-box embedding call.

Swap-in path: if SENTENCE_TRANSFORMERS_AVAILABLE, an embedding-based retriever
can be dropped in without changing the public interface (search()).
"""
import re
import math
from collections import Counter


STOPWORDS = set("""
a an the is are was were be been being of to in on at for with and or but if then
this that these those it its as by from into over under above below between during
""".split())


def tokenize(text: str):
    tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]


class TfidfIndex:
    """A small, self-contained TF-IDF index with cosine-similarity search."""

    def __init__(self, documents, id_field, text_fields):
        """
        documents: list[dict]
        id_field: key used as the unique identifier for citations
        text_fields: list of dict keys concatenated to build the searchable text
        """
        self.documents = documents
        self.id_field = id_field
        self.text_fields = text_fields
        self._build()

    def _doc_text(self, doc):
        return " ".join(str(doc.get(f, "")) for f in self.text_fields)

    def _build(self):
        self.tokenized_docs = [tokenize(self._doc_text(d)) for d in self.documents]
        df = Counter()
        for tokens in self.tokenized_docs:
            for term in set(tokens):
                df[term] += 1

        n_docs = max(len(self.documents), 1)
        self.idf = {term: math.log((n_docs + 1) / (freq + 1)) + 1 for term, freq in df.items()}

        self.doc_vectors = []
        for tokens in self.tokenized_docs:
            tf = Counter(tokens)
            length = max(len(tokens), 1)
            vec = {term: (count / length) * self.idf.get(term, 0.0) for term, count in tf.items()}
            norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
            self.doc_vectors.append((vec, norm))

    def _query_vector(self, query: str):
        tokens = tokenize(query)
        tf = Counter(tokens)
        length = max(len(tokens), 1)
        vec = {term: (count / length) * self.idf.get(term, 0.0) for term, count in tf.items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return vec, norm

    @staticmethod
    def _cosine(vec_a, norm_a, vec_b, norm_b):
        # iterate over the smaller vector for speed
        if len(vec_a) > len(vec_b):
            vec_a, vec_b = vec_b, vec_a
        dot = sum(val * vec_b.get(term, 0.0) for term, val in vec_a.items())
        return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0

    def search(self, query: str, top_k: int = 3, min_score: float = 0.02):
        q_vec, q_norm = self._query_vector(query)
        scored = []
        for doc, (d_vec, d_norm) in zip(self.documents, self.doc_vectors):
            score = self._cosine(q_vec, q_norm, d_vec, d_norm)
            if score >= min_score:
                scored.append((score, doc))
        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, doc in scored[:top_k]:
            results.append({
                "score": round(float(score), 4),
                "id": doc.get(self.id_field),
                "document": doc,
            })
        return results

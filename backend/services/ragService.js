const faiss = require("faiss-node");
const { embedTexts } = require("./embeddingService");

class RAGStore {
  constructor() {
    this.docs = [];
    this.embeddings = null;
    this.index = null;
    this.useDense = true;
  }

  async buildIndex(docs) {
    this.docs = docs;
    try {
      const texts = docs.map((d) => d.text);
      const embs = await embedTexts(texts);

      const N = embs.length;
      const D = embs[0].length;
      const flat = new Float32Array(N * D);
      for (let i = 0; i < N; i++) flat.set(embs[i], i * D);

      this.embeddings = flat;

      const index = new faiss.IndexFlatIP(D);
      index.add(flat);
      this.index = index;
      this.useDense = true;
    } catch (err) {
      this.useDense = false;
      this.index = null;
      this.embeddings = null;
      console.warn(
        "RAG dense embeddings unavailable, using lexical fallback:",
        err?.message || err,
      );
    }
  }

  async query(queryText, { k = 5, bm25Weight = 0.4, denseWeight = 0.6 } = {}) {
    if (!this.docs.length) return [];

    const denseScores = {};
    if (this.useDense && this.index) {
      try {
        const [qEmb] = await embedTexts([queryText]);
        const qVec = new Float32Array(qEmb);
        const kSearch = Math.min(k * 4, this.docs.length);
        const distances = new Float32Array(kSearch);
        const labels = new Int32Array(kSearch);
        this.index.search(qVec, kSearch, distances, labels);

        for (let i = 0; i < kSearch; i++) {
          const docIdx = labels[i];
          if (docIdx < 0) continue;
          denseScores[docIdx] = distances[i];
        }
      } catch (err) {
        this.useDense = false;
        console.warn(
          "RAG dense query unavailable, using lexical fallback:",
          err?.message || err,
        );
      }
    }

    const qTokens = tokenSet(queryText);
    const bm25Scores = {};
    this.docs.forEach((doc, idx) => {
      const overlap = intersectSize(qTokens, tokenSet(doc.text));
      if (overlap > 0) bm25Scores[idx] = overlap;
    });

    const scored = this.docs.map((doc, idx) => {
      const d = this.useDense ? denseScores[idx] || 0 : 0;
      const b = bm25Scores[idx] || 0;
      return {
        ...doc,
        score: this.useDense ? bm25Weight * b + denseWeight * d : b,
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, k);
  }
}

function tokenSet(text) {
  return new Set(String(text).toLowerCase().split(/\W+/).filter(Boolean));
}
function intersectSize(a, b) {
  let c = 0;
  for (const t of a) if (b.has(t)) c++;
  return c;
}

module.exports = { RAGStore };

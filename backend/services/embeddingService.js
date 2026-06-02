const fetch = require("node-fetch");

const EMBEDDING_URL =
  process.env.EMBEDDING_URL ||
  process.env.GROQ_EMBEDDING_URL ||
  process.env.OPENAI_EMBEDDING_URL ||
  "https://api.groq.com/openai/v1/embeddings";

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ||
  process.env.GROQ_EMBEDDING_MODEL ||
  process.env.OPENAI_EMBEDDING_MODEL ||
  "text-embedding-3-small";

function getEmbeddingApiKey() {
  return (
    process.env.GROQ_API_KEY ||
    process.env.GROQAPIKEY ||
    process.env.GROQ_APIKEY ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENAIAPIKEY
  );
}

async function embedTexts(texts) {
  const apiKey = getEmbeddingApiKey();
  if (!apiKey) {
    throw new Error(
      "Missing embedding API key. Set GROQ_API_KEY (preferred).",
    );
  }

  const res = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || "Embedding failed");
  return json.data.map((d) => d.embedding);
}

module.exports = { embedTexts };

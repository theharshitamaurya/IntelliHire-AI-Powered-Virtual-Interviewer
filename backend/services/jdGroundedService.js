const Groq = require("groq-sdk");
const JDHistory = require("../models/JDHistory");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || process.env.GROQAPIKEY,
});

const MODEL =
  process.env.GROQ_MODEL || process.env.GROQMODEL || "llama-3.1-8b-instant";
const { RAGStore } = require("./ragService");
const { callGroqJson } = require("./llmService");

async function generateQuestionsWithCoverage({ jdText, resumeText }) {
  const maxQuestions = 5;
  const parsed = await extractJDMetadata(jdText);
  const skills = parsed.skills || [];

  const corpus = [
    { id: "jd-main", source: "jd", text: jdText },
    ...skills.map((s, i) => ({
      id: `skill-${i}`,
      source: "jd-skill",
      text: s,
    })),
  ];
  if (resumeText) {
    corpus.push({ id: "resume-main", source: "resume", text: resumeText });
  }
  const store = new RAGStore();
  await store.buildIndex(corpus);

  const questions = [];
  const seen = new Set();
  for (const skill of skills) {
    if (questions.length >= maxQuestions) break;

    const retrieved = await store.query(skill, { k: 4 });
    const evidence = retrieved
      .map(
        (c, idx) => `[#${idx}] [source=${c.source}] [id=${c.id}]\n${c.text}\n`,
      )
      .join("\n\n");

    const systemPrompt = `
You are generating interview questions grounded in the job description and resume.
You MUST output STRICT JSON array of 2-3 questions for the target skill.

Each question must have:
- "id": short unique id
- "text": question text
- "difficulty": "easy" | "medium" | "hard"
- "skills": array of 1-3 skill tags (include the current skill)
- "category": high-level tag ("system-design", "behavioral", "coding", etc.)
`;

    const userPrompt = `
JOB SKILL:
${skill}

RETRIEVED EVIDENCE:
${evidence}

CONSTRAINTS:
- At least one question should be medium or hard.
- Phrase questions so they clearly relate to this company's role.
- Avoid redundancy with previous questions in this JD (assume you don't know them; we'll filter later).
`;

    const { parsed } = await callGroqJson(systemPrompt, userPrompt);
    const candidates = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.questions)
        ? parsed.questions
        : [];

    for (const q of candidates) {
      const text = String(q?.text || "").trim();
      if (!text) continue;

      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      questions.push({
        id: q.id,
        text,
        difficulty: q.difficulty,
        skills: q.skills,
        category: q.category,
      });
      if (questions.length >= maxQuestions) break;
    }
  }

  return {
    jd: parsed,
    questions: questions.slice(0, maxQuestions),
  };
}

/**
 * Extract structured JD metadata using LLM
 * @param {string} jdText - Raw job description text
 * @returns {Promise<Object>} - { company, skills, context, title }
 */
async function extractJDMetadata(jdText) {
  const systemPrompt = `You are a job description analyzer. Extract structured information from the job description.

Return ONLY valid JSON with these exact keys:
{
  "company": "company name or Unknown if not found",
  "title": "job title/role",
  "skills": ["skill1", "skill2", ... exactly 8 skills],
  "context": "one-sentence company/role context summary",
  "experienceLevel": "intern" | "junior" | "mid" | "senior" | "lead"
}

Rules:
- Extract EXACTLY 8 key technical or domain skills
- If fewer than 8 skills found, include relevant general skills
- Keep each skill concise (1-3 words)
- Context should be max 100 characters`;

  const userPrompt = `Job Description:\n\n${jdText.slice(0, 3000)}`;

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const result = JSON.parse(completion.choices[0].message.content);

    const metadata = {
      company: result.company || "Unknown",
      title: result.title || "Unspecified Role",
      skills: Array.isArray(result.skills) ? result.skills.slice(0, 8) : [],
      context: result.context || "Job opportunity",
      experienceLevel: result.experienceLevel || "unspecified",
    };

    while (metadata.skills.length < 8) {
      metadata.skills.push("General Competency");
    }
    metadata.skills = metadata.skills.slice(0, 8);

    console.log("✅ JD Metadata extracted:", metadata);
    return metadata;
  } catch (error) {
    console.error("❌ JD metadata extraction failed:", error.message);
    throw new Error("Failed to extract JD metadata: " + error.message);
  }
}

/**
 * Health check for JD service
 */
async function healthCheck() {
  try {
    const testJD =
      "We are hiring a Senior Software Engineer with expertise in React, Node.js, and AWS.";
    const metadata = await extractJDMetadata(testJD);
    return metadata.skills.length === 8;
  } catch (error) {
    console.error("JD Service health check failed:", error.message);
    return false;
  }
}

module.exports = {
  generateQuestionsWithCoverage,
  extractJDMetadata,
  healthCheck,
};

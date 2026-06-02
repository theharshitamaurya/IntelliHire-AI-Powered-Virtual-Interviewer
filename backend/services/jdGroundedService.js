const Groq = require("groq-sdk");
const JDHistory = require("../models/JDHistory");
const QuestionBank = require("../models/QuestionBank");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || process.env.GROQAPIKEY,
});

const MODEL =
  process.env.GROQ_MODEL || process.env.GROQMODEL || "llama-3.1-8b-instant";
const { embedTexts } = require("./embeddingService");
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
 * Generate role-specific interview questions
 * @param {Object} jdMetadata - { company, title, skills, context, experienceLevel }
 * @param {number} questionCount - Number of questions to generate (default: 5)
 * @returns {Promise<Array>} - Array of question objects
 */

async function generateQuestions(jdMetadata, questionCount = 5) {
  const { company, title, skills, context, experienceLevel } = jdMetadata;

  const systemPrompt = `You are an expert technical interviewer. Generate role-specific interview questions.

Return ONLY valid JSON with this exact structure:
{
  "questions": [
    {
      "questionText": "the question",
      "difficulty": "easy" | "medium" | "hard",
      "category": "technical" | "behavioral" | "hr" | "systemdesign",
      "relatedSkills": ["skill1", "skill2"],
      "idealPoints": "what a good answer should cover"
    }
  ]
}

Requirements:
- Generate exactly ${questionCount} questions
- Mix categories: technical (50%), behavioral (30%), system design (20%)
- Difficulty should match ${experienceLevel} level
- Each question should test 1-3 of these skills: ${skills.join(", ")}
- Keep questions realistic and specific to ${title} at ${company}`;

  const userPrompt = `Generate ${questionCount} interview questions for:
Role: ${title}
Company: ${company}
Context: ${context}
Skills: ${skills.join(", ")}
Level: ${experienceLevel}`;

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawText = completion?.choices?.[0]?.message?.content || "";
    let response;

    try {
      response = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("❌ Groq returned non-JSON for questions. Raw:", rawText);
      throw new Error("LLM returned non-JSON output for questions");
    }

    let questions = Array.isArray(response?.questions)
      ? response.questions
      : null;

    if (!questions && response && typeof response === "object") {
      const firstArray = Object.values(response).find((v) => Array.isArray(v));
      if (Array.isArray(firstArray)) questions = firstArray;
    }

    if (!Array.isArray(questions)) {
      console.error("❌ Questions JSON shape unexpected. Parsed:", response);
      throw new Error("LLM did not return questions array");
    }

    questions = questions.slice(0, questionCount).map((q, idx) => ({
      questionText:
        q?.questionText || q?.question || q?.text || `Question ${idx + 1}`,
      difficulty: ["easy", "medium", "hard"].includes(q?.difficulty)
        ? q.difficulty
        : "medium",

      category: normalizeQuestionCategory(q?.category),

      relatedSkills: Array.isArray(q?.relatedSkills)
        ? q.relatedSkills
        : skills.slice(0, 2),
      idealPoints: q?.idealPoints || "Demonstrate understanding and experience",
    }));

    console.log(`✅ Generated ${questions.length} questions`);
    return questions;
  } catch (error) {
    console.error("❌ Question generation failed:", error.message);
    throw new Error("Failed to generate questions: " + error.message);
  }
}
function normalizeQuestionCategory(input) {
  const allowed = QuestionBank?.schema?.path("category")?.enumValues || [
    "technical",
    "behavioral",
    "hr",
    "general",
  ];

  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  const allowedMap = new Map(allowed.map((v) => [norm(v), v]));

  const key = norm(input);

  let canonical = key;
  if (canonical.includes("system")) canonical = "systemdesign";
  if (canonical.includes("behav")) canonical = "behavioral";
  if (canonical === "humanresources") canonical = "hr";

  return (
    allowedMap.get(canonical) ||
    allowedMap.get(key) ||
    (allowedMap.get("general") ?? allowed[0])
  );
}

/**
 * Full JD-grounded pipeline
 * @param {string} jdText - Raw job description text
 * @param {string} resumeText - Optional resume text for personalization
 * @returns {Promise<Object>} - { jd, questions }
 */
async function processJobDescription(jdText, resumeText = null) {
  console.log("🚀 Starting JD-grounded pipeline...");

  const metadata = await extractJDMetadata(jdText);

  const jdEntry = new JDHistory({
    jobTitle: metadata.title,
    company: metadata.company,
    requiredSkills: metadata.skills,
    experienceLevel: metadata.experienceLevel,
    companyContext: metadata.context,
    description: jdText,
    source: "generated",
    timestamp: new Date(),
  });

  await jdEntry.save();
  console.log("💾 JD saved to database:", jdEntry._id);

  let generatedQuestions;
  try {
    generatedQuestions = await generateQuestions(metadata, 5);
  } catch (err) {
    await JDHistory.findByIdAndDelete(jdEntry._id);
    throw err;
  }

  const questionDocs = [];
  try {
    for (const q of generatedQuestions) {
      const questionEntry = new QuestionBank({
        questionText: q.questionText,
        difficulty: q.difficulty,
        relatedSkills: q.relatedSkills,
        jdId: jdEntry._id,
        category: normalizeQuestionCategory(q.category),
        idealPoints: q.idealPoints,
        source: "generated",
        timestamp: new Date(),
      });

      await questionEntry.save();
      questionDocs.push(questionEntry);
      console.log("💾 Question saved:", questionEntry._id);
    }
  } catch (err) {
    await QuestionBank.deleteMany({ jdId: jdEntry._id });
    await JDHistory.findByIdAndDelete(jdEntry._id);
    throw err;
  }

  console.log("✅ JD-grounded pipeline complete");

  return {
    jd: jdEntry,
    questions: questionDocs,
    metadata,
  };
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
  generateQuestions,
  processJobDescription,
  healthCheck,
};

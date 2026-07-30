"use strict";

const Groq = require("groq-sdk");

const apiKey =
  process.env.GROQ_API_KEY || process.env.GROQAPIKEY || process.env.GROQ_APIKEY;

if (!apiKey) {
  throw new Error("Missing Groq API key. Set GROQ_API_KEY (preferred).");
}

const groq = new Groq({ apiKey });

const MODEL =
  process.env.GROQ_MODEL || process.env.GROQMODEL || "llama-3.1-8b-instant";

const MAX_TOKENS = Number(
  process.env.GROQ_MAX_TOKENS || process.env.GROQMAXTOKENS || 1000,
);
const TEMPERATURE = Number(
  process.env.GROQ_TEMPERATURE || process.env.GROQTEMPERATURE || 0.3,
);

function safeParseJson(s) {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s.trim());
  } catch {
    return null;
  }
}

async function healthCheck() {
  try {
    await groq.chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 10,
      messages: [{ role: "user", content: "ping" }],
    });
    return true;
  } catch (e) {
    console.error("LLM healthCheck failed:", e?.message || e);
    return false;
  }
}

async function callGroqJson(
  system,
  user,
  { temperature = TEMPERATURE, maxTokens = MAX_TOKENS } = {},
) {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const content = completion?.choices?.[0]?.message?.content || "";
  const parsed = safeParseJson(content);
  return { parsed, raw: content, usage: completion?.usage || null };
}

function clampScore(n, fallback = 70) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function normalizeEvaluation(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};

  const overall =
    obj.overallScore ??
    obj.overallscore ??
    obj.overall_score ??
    obj.score ??
    obj.finalScore ??
    obj.final_score;

  const strengths = Array.isArray(obj.strengths)
    ? obj.strengths.map(String).filter(Boolean)
    : [];

  const improvements = Array.isArray(obj.improvements)
    ? obj.improvements.map(String).filter(Boolean)
    : Array.isArray(obj.areasForImprovement)
      ? obj.areasForImprovement.map(String).filter(Boolean)
      : Array.isArray(obj.areas_for_improvement)
        ? obj.areas_for_improvement.map(String).filter(Boolean)
        : [];

  const feedback =
    (typeof obj.feedback === "string" && obj.feedback.trim()) ||
    (typeof obj.detailedFeedback === "string" && obj.detailedFeedback.trim()) ||
    (typeof obj.detailed_feedback === "string" &&
      obj.detailed_feedback.trim()) ||
    (typeof obj.commentary === "string" && obj.commentary.trim()) ||
    "No feedback provided.";

  const readCompetency = (...vals) => {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n)) return clampScore(n, 50);
    }
    return null;
  };

  const competencies = {
    technical: readCompetency(
      obj?.competencies?.technical,
      obj?.technical,
      obj?.techDepth,
    ),
    clarity: readCompetency(obj?.competencies?.clarity, obj?.clarity),
    confidence: readCompetency(
      obj?.competencies?.confidence,
      obj?.confidence,
    ),
    conciseness: readCompetency(
      obj?.competencies?.conciseness,
      obj?.conciseness,
      obj?.brevity,
    ),
    engagement: readCompetency(
      obj?.competencies?.engagement,
      obj?.engagement,
      obj?.energy,
    ),
  };

  const filledCompetencies = {
    technical: competencies.technical ?? clampScore(overall, 70),
    clarity: competencies.clarity ?? clampScore(overall, 70),
    confidence: competencies.confidence ?? clampScore(overall, 70),
    conciseness: competencies.conciseness ?? clampScore(overall, 70),
    engagement: competencies.engagement ?? clampScore(overall, 70),
  };

  return {
    overallScore: clampScore(overall, 75),
    strengths,
    improvements,
    feedback,
    competencies: filledCompetencies,
  };
}

async function generatePracticeQuestions(
  topic,
  count = 3,
  persona = "technical",
) {
  try {
    const t = String(topic || "").trim();
    const n = Math.max(1, Math.min(10, Number(count) || 3));
    if (!t) {
      return { success: false, error: "Missing topic.", questions: [] };
    }

    const systemPrompt = `
You generate interview practice questions.
Return ONLY valid JSON in this shape:
{
  "questions": [
    { "id": "q1", "question": "....", "difficulty": "easy|medium|hard" }
  ]
}
Rules:
- Exactly ${n} questions.
- Questions must be relevant to: "${t}"
- Persona style: "${persona}"
- No markdown, no extra keys.
`.trim();

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: systemPrompt }],
    });

    const content = completion?.choices?.[0]?.message?.content || "";
    const parsed = safeParseJson(content);

    const arr = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const questions = arr
      .slice(0, n)
      .map((q, i) => {
        if (typeof q === "string") {
          return { id: `q${i + 1}`, question: q, difficulty: "medium" };
        }
        return {
          id: String(q?.id || `q${i + 1}`),
          question: String(q?.question || q?.text || "").trim(),
          difficulty: ["easy", "medium", "hard"].includes(q?.difficulty)
            ? q.difficulty
            : "medium",
        };
      })
      .filter((q) => q.question);

    return { success: true, questions };
  } catch (err) {
    return {
      success: false,
      status: err?.status || 400,
      error: err?.error?.message || err?.message || String(err),
      questions: [],
    };
  }
}

/**
 * Evaluate interview response using Groq LLM
 * @param {string} transcript - User's interview response
 * @param {string} question - Interview question
 * @param {Object|null} jobDescription - JD context (optional), e.g. { title, skills, company, description }
 * @returns {Promise<{success:boolean, evaluation:Object, usage?:Object, error?:string, raw?:any}>}
 */
async function evaluateResponse(transcript, question, jobDescription = null) {
  try {
    const t = String(transcript || "").trim();
    const q = String(question || "").trim();

    if (!t || !q) {
      return {
        success: false,
        error: "Missing transcript or question.",
        evaluation: {
          overallScore: 70,
          strengths: ["Response provided"],
          improvements: [
            "Provide both a question and a transcript for evaluation.",
          ],
          feedback: "Evaluation skipped due to missing inputs.",
        },
      };
    }

    let systemPrompt =
      "You are an expert interview evaluator.\n" +
      "Analyze the candidate response for:\n" +
      "1) Relevance to the question\n" +
      "2) Clarity and structure (STAR method if applicable)\n" +
      "3) Technical accuracy\n" +
      "4) Communication effectiveness\n\n" +
      "Return ONLY valid JSON with keys:\n" +
      '{ "overallScore": number(0-100), "strengths": string[], "improvements": string[], "feedback": string, "competencies": { "technical": number(0-100), "clarity": number(0-100), "confidence": number(0-100), "conciseness": number(0-100), "engagement": number(0-100) } }';

    if (jobDescription && typeof jobDescription === "object") {
      const title =
        jobDescription.title ||
        jobDescription.jobTitle ||
        jobDescription.role ||
        "";
      const company = jobDescription.company || "";
      const skills =
        jobDescription.skills || jobDescription.requiredSkills || "";
      const desc =
        jobDescription.description || jobDescription.originalText || "";

      systemPrompt +=
        "\n\nJob Description Context:\n" +
        (title ? `Title: ${String(title).slice(0, 200)}\n` : "") +
        (company ? `Company: ${String(company).slice(0, 200)}\n` : "") +
        (skills ? `Skills: ${String(skills).slice(0, 600)}\n` : "") +
        (desc ? `Description: ${String(desc).slice(0, 1500)}\n` : "");
    }

    const userPrompt = `Question:\n${q}\n\n` + `Candidate Response:\n${t}\n`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion?.choices?.[0]?.message?.content;
    const parsed = safeParseJson(content);

    if (!parsed) {
      return {
        success: false,
        error: "LLM returned non-JSON output.",
        evaluation: {
          overallScore: 70,
          strengths: ["Response provided"],
          improvements: ["Could not parse evaluation output."],
          feedback:
            "Evaluation service returned an unexpected format. Please try again.",
        },
        raw: { content },
        usage: completion?.usage || null,
      };
    }

    const evaluation = normalizeEvaluation(parsed);

    return {
      success: true,
      evaluation,
      usage: completion?.usage || null,
      raw: parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || String(error),
      evaluation: {
        overallScore: 70,
        strengths: ["Response provided"],
        improvements: ["Could not evaluate fully due to service error."],
        feedback:
          "Evaluation service temporarily unavailable. Please try again.",
      },
    };
  }
}

module.exports = {
  callGroqJson,
  evaluateResponse,
  healthCheck,
  generatePracticeQuestions,
};

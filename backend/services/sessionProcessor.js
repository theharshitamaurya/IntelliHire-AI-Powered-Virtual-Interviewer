const JDHistory = require("../models/JDHistory");
const QuestionBank = require("../models/QuestionBank");

const VOICEWEIGHT = 0.5;
const FACIALWEIGHT = 0.5;

function clamp100(x) {
  /* same as today */
}
function normalizeScore(x) {
  /* same as today */
}

function normalizeSkills(skills) {
  if (!skills) return [];
  if (Array.isArray(skills))
    return skills.map((s) => String(s).trim()).filter(Boolean);
  return String(skills)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function buildSessionBase(payload) {
  const { source } = payload;

  if (source === "jd") {
    const { jdId, questionId } = payload;
    const jd = await JDHistory.findById(jdId);
    if (!jd) throw new Error("Invalid JD reference");

    const question = await QuestionBank.findById(questionId);
    if (!question) throw new Error("Invalid Question reference");

    return {
      source: "jd",
      jdId,
      questionId,
      role: jd.jobTitle || jd.role,
      difficulty: question.difficulty,
      skills: normalizeSkills(question.relatedSkills || question.skills),
    };
  }

  return {
    source: "practice",
    role: payload.role || null,
    difficulty: payload.difficulty || "medium",
    skills: normalizeSkills(payload.skills),
  };
}

function computeFusion({ voiceanalysis = {}, facialanalysis = {} }) {
  const voiceScore = normalizeScore(
    voiceanalysis.confidence ?? voiceanalysis.overallVoiceScore ?? 0,
  );
  const facialScore = normalizeScore(
    facialanalysis.engagement ?? facialanalysis.overallFacialScore ?? 0,
  );
  const overallscore = clamp100(
    VOICEWEIGHT * voiceScore + FACIALWEIGHT * facialScore,
  );

  return {
    voiceScore,
    facialScore,
    overallscore,
    fusion: { VOICEWEIGHT, FACIALWEIGHT },
  };
}

module.exports = { buildSessionBase, computeFusion };

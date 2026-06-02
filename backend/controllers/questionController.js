const QuestionBank = require("../models/QuestionBank");
const JDHistory = require("../models/JDHistory");

async function getJDQuestionMetrics(req, res) {
  const { jdId } = req.params;
  const jd = await JDHistory.findById(jdId);
  if (!jd) return res.status(404).json({ error: "JD not found" });

  const qs = await QuestionBank.find({ jdId });

  const skills = jd.requiredSkills || jd.skills || [];
  const skillSet = new Set(skills.map((s) => s.toLowerCase()));

  const coverage = {};
  for (const s of skillSet) coverage[s] = 0;

  for (const q of qs) {
    (q.relatedSkills || []).forEach((s) => {
      const key = s.toLowerCase();
      if (coverage[key] !== undefined) coverage[key] += 1;
    });
  }

  const texts = qs.map((q) => q.question.trim().toLowerCase());
  const seen = new Set();
  let duplicates = 0;
  for (const t of texts) {
    if (seen.has(t)) duplicates++;
    else seen.add(t);
  }

  const diffCounts = { easy: 0, medium: 0, hard: 0 };
  qs.forEach((q) => {
    if (diffCounts[q.difficulty] !== undefined) diffCounts[q.difficulty]++;
  });

  res.json({
    jdId,
    totalQuestions: qs.length,
    skillCoverage: coverage,
    redundancyCount: duplicates,
    difficultyHistogram: diffCounts,
  });
}

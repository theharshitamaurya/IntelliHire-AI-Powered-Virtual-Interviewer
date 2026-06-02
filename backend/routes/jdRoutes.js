const express = require("express");
const router = express.Router();
const JDHistory = require("../models/JDHistory");
const QuestionBank = require("../models/QuestionBank");
const jdGroundedService = require("../services/jdGroundedService");

function normalizeQuestionCategory(input) {
  const raw = String(input || "")
    .toLowerCase()
    .trim();

  if (!raw) return "general";
  if (raw === "system-design" || raw === "system design")
    return "system_design";
  if (raw.includes("system")) return "system_design";
  if (raw.includes("behav")) return "behavioral";
  if (raw === "human resources" || raw === "human-resources") return "hr";

  const allowed = ["technical", "behavioral", "hr", "system_design", "general"];
  return allowed.includes(raw) ? raw : "general";
}

router.post("/generate", async (req, res) => {
  const { jdText, resumeText } = req.body;

  if (!jdText || jdText.trim().length < 50) {
    return res.status(400).json({ error: "JD must be at least 50 characters" });
  }

  try {
    const { jd, questions } = await jdGroundedService.generateQuestionsWithCoverage({
      jdText,
      resumeText,
    });

    const jdDoc = await JDHistory.create({
      jobTitle: jd.title,
      company: jd.company,
      requiredSkills: jd.skills,
      context: jd.context,
      rawText: jdText,
      resumeText: resumeText || null,
      source: "generated",
    });

    const qDocs = await QuestionBank.insertMany(
      questions.map((q) => ({
        jdId: jdDoc._id,
        question: q.text,
        difficulty: q.difficulty,
        relatedSkills: q.skills,
        category: normalizeQuestionCategory(q.category),
        source: "generated",
      })),
    );

    res.json({
      jd: { ...jd, id: jdDoc._id },
      questions: qDocs.map((d) => ({
        id: d._id,
        text: d.question,
        difficulty: d.difficulty,
        category: d.category,
        skills: d.relatedSkills,
      })),
    });
  } catch (err) {
    console.error("JD generate error", err);
    res.status(500).json({ error: err.message || "JD generation failed" });
  }
});

router.post("/", async (req, res, next) => {
  try {
    const jd = await JDHistory.create(req.body);
    return res.status(201).json(jd);
  } catch (err) {
    return next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const jds = await JDHistory.find().sort({ timestamp: -1 });
    return res.json(jds);
  } catch (err) {
    return next(err);
  }
});

router.delete("/", async (req, res, next) => {
  try {
    const deletedJds = await JDHistory.deleteMany({});
    const deletedQuestions = await QuestionBank.deleteMany({});
    return res.json({
      message: "All JD history deleted",
      deletedJDs: deletedJds.deletedCount || 0,
      deletedQuestions: deletedQuestions.deletedCount || 0,
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const jd = await JDHistory.findById(req.params.id);
    if (!jd) {
      return res.status(404).json({ message: "JD not found" });
    }

    const questions = await QuestionBank.find({ jdId: req.params.id });
    return res.json({ jd, questions });
  } catch (err) {
    return next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const jd = await JDHistory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!jd) {
      return res.status(404).json({ message: "JD not found" });
    }

    return res.json(jd);
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const jd = await JDHistory.findByIdAndDelete(req.params.id);
    if (!jd) {
      return res.status(404).json({ message: "JD not found" });
    }
    return res.json({ message: "JD deleted successfully" });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

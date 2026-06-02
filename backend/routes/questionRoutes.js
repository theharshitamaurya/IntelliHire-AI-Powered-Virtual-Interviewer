const express = require("express");
const router = express.Router();
const QuestionBank = require("../models/QuestionBank");
const llmService = require("../services/llmService");

router.post("/evaluate-practice", async (req, res, next) => {
  try {
    const { question, answer, persona } = req.body;

    if (!question || !answer) {
      return res
        .status(400)
        .json({ success: false, error: "Missing question or answer." });
    }

    const result = await llmService.evaluateResponse(answer, question, null);

    if (!result.success) {
      const status = result.status || 400;
      return res.status(status).json(result);
    }

    return res.json({ success: true, evaluation: result.evaluation });
  } catch (err) {
    next(err);
  }
});

router.post("/generate-practice", async (req, res) => {
  const { topic, count, persona } = req.body || {};
  const result = await llmService.generatePracticeQuestions(
    topic,
    count,
    persona,
  );
  if (!result.success) return res.status(500).json(result);
  return res.json(result);
});

router.post("/", async (req, res, next) => {
  try {
    const question = await QuestionBank.create(req.body);
    res.status(201).json(question);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { difficulty, category, skill } = req.query;

    const filter = {};
    if (difficulty) filter.difficulty = difficulty;
    if (category) filter.category = category;
    if (skill) filter.skills = skill;

    const questions = await QuestionBank.find(filter).sort({
      timestamp: -1,
    });

    res.json(questions);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const question = await QuestionBank.findById(req.params.id);
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    res.json(question);
  } catch (err) {
    next(err);
  }
});

router.delete("/", async (req, res, next) => {
  try {
    const deleted = await QuestionBank.deleteMany({});
    res.json({
      message: "All questions deleted successfully",
      deletedCount: deleted.deletedCount || 0,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const question = await QuestionBank.findByIdAndDelete(req.params.id);
    if (!question)
      return res.status(404).json({ message: "Question not found" });

    res.json({ message: "Question deleted successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

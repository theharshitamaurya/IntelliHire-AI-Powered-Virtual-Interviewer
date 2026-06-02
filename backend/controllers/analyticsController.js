const statisticsService = require("../services/statisticsService");
const InterviewResult = require("../models/InterviewResult");

async function compareSession(req, res) {
  try {
    const { sessionId } = req.params;
    const results =
      await statisticsService.compareSessionToPopulation(sessionId);

    return res.json({
      message: "Statistical comparison complete",
      ...results,
    });
  } catch (error) {
    console.error("[AnalyticsController] Comparison error:", error.message);

    if (error.message && error.message.includes("No results")) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (error.message && error.message.includes("Insufficient")) {
      return res
        .status(400)
        .json({ error: "Insufficient data", message: error.message });
    }

    return res.status(500).json({ error: "Analysis failed" });
  }
}

async function getPercentile(req, res) {
  try {
    const { sessionId } = req.params;

    const candidateResults = await InterviewResult.find({ sessionid: sessionId });
    if (!candidateResults || candidateResults.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const candidateAvg =
      candidateResults.reduce((sum, r) => sum + (r.overallscore || 0), 0) /
      candidateResults.length;

    const allScores = await InterviewResult.find({
      sessionid: { $ne: sessionId },
      overallscore: { $exists: true },
    }).select("overallscore");

    const populationScores = allScores
      .map((r) => r.overallscore)
      .filter((v) => typeof v === "number" && Number.isFinite(v));

    const percentile = statisticsService.calculatePercentile(
      candidateAvg,
      populationScores,
    );

    return res.json({
      sessionId,
      averageScore: candidateAvg,
      percentile: Number(percentile).toFixed(1),
      interpretation: `Scored better than ${Number(percentile).toFixed(
        0,
      )}% of candidates`,
    });
  } catch (error) {
    console.error("[AnalyticsController] Percentile error:", error.message);
    return res.status(500).json({ error: "Percentile calculation failed" });
  }
}

async function getUserTrend(req, res) {
  try {
    const { userId } = req.params;
    const trend = await statisticsService.analyzeTrend(userId);

    return res.json({
      userId,
      ...trend,
    });
  } catch (error) {
    console.error("[AnalyticsController] Trend error:", error.message);
    return res.status(500).json({ error: "Trend analysis failed" });
  }
}

module.exports = {
  compareSession,
  getPercentile,
  getUserTrend,
};

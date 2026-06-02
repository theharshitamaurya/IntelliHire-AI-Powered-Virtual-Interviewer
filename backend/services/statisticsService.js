/**
 * Statistical Analysis Service
 * Implements Welch's t-test for candidate performance comparison
 */

const jStat = require("jstat");
const mongoose = require("mongoose");
const InterviewResult = require("../models/InterviewResult");

/**
 * Perform Welch's t-test comparing candidate scores to population
 * Welch's t-test formula:
 * t = (X̄₁ - X̄₂) / √(s₁²/n₁ + s₂²/n₂)
 *
 * @param {Array<number>} candidateScores - Candidate's scores
 * @param {Array<number>} populationScores - Benchmark scores
 * @returns {Object} Statistical test results
 */
function welchTTest(candidateScores, populationScores) {
  const n1 = candidateScores.length;
  const n2 = populationScores.length;

  const mean1 = jStat.mean(candidateScores);
  const mean2 = jStat.mean(populationScores);

  const variance1 = jStat.variance(candidateScores, true);
  const variance2 = jStat.variance(populationScores, true);

  const tStatistic =
    (mean1 - mean2) / Math.sqrt(variance1 / n1 + variance2 / n2);

  const df =
    Math.pow(variance1 / n1 + variance2 / n2, 2) /
    (Math.pow(variance1 / n1, 2) / (n1 - 1) +
      Math.pow(variance2 / n2, 2) / (n2 - 1));

  const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(tStatistic), df));

  const tCritical = jStat.studentt.inv(0.975, df);
  const standardError = Math.sqrt(variance1 / n1 + variance2 / n2);
  const meanDifference = mean1 - mean2;

  const confidenceInterval = {
    lower: meanDifference - tCritical * standardError,
    upper: meanDifference + tCritical * standardError,
  };

  const isSignificant = pValue < 0.05;

  const effectSize = meanDifference / Math.sqrt((variance1 + variance2) / 2);

  return {
    candidateMean: mean1,
    populationMean: mean2,
    meanDifference,
    tStatistic,
    degreesOfFreedom: df,
    pValue,
    confidenceInterval,
    isSignificant,
    effectSize,
    interpretation: interpretResults(mean1, mean2, pValue, effectSize),
    sampleSizes: { candidate: n1, population: n2 },
  };
}

/**
 * Interpret statistical results in plain English
 */
function interpretResults(candidateMean, populationMean, pValue, effectSize) {
  let performance = "";
  let significance = "";
  let magnitude = "";

  if (candidateMean > populationMean) performance = "above average";
  else if (candidateMean < populationMean) performance = "below average";
  else performance = "average";

  if (pValue < 0.001) significance = "highly significant (p < 0.001)";
  else if (pValue < 0.01) significance = "very significant (p < 0.01)";
  else if (pValue < 0.05) significance = "significant (p < 0.05)";
  else significance = "not statistically significant (p ≥ 0.05)";

  const absEffect = Math.abs(effectSize);
  if (absEffect < 0.2) magnitude = "negligible";
  else if (absEffect < 0.5) magnitude = "small";
  else if (absEffect < 0.8) magnitude = "medium";
  else magnitude = "large";

  return {
    summary: `Candidate performed ${performance} compared to population (${significance})`,
    performance,
    significance,
    effectMagnitude: magnitude,
    recommendation: generateRecommendation(
      candidateMean,
      populationMean,
      pValue,
      effectSize,
    ),
  };
}

/**
 * Generate actionable recommendation based on statistics
 */
function generateRecommendation(
  candidateMean,
  populationMean,
  pValue,
  effectSize,
) {
  if (pValue >= 0.05) {
    return "Performance is comparable to average candidates. No strong evidence of difference.";
  }

  if (candidateMean > populationMean) {
    if (effectSize > 0.8) {
      return "Strong candidate. Performance significantly exceeds benchmark. Recommend for advancement.";
    } else if (effectSize > 0.5) {
      return "Above-average candidate. Shows measurable strengths compared to peers.";
    }
    return "Slightly above average. Consider other evaluation criteria for final decision.";
  }

  if (effectSize < -0.8) {
    return "Performance significantly below benchmark. May require additional training or assessment.";
  } else if (effectSize < -0.5) {
    return "Below-average performance. Consider areas for improvement before advancement.";
  }
  return "Slightly below average. Review specific weak areas and provide targeted feedback.";
}

/**
 * Compare candidate's session performance to global benchmarks
 * @param {string} sessionId - Candidate's session ID
 * @returns {Promise<Object>} Comparison results with Welch's t-test
 */
async function compareSessionToPopulation(sessionId) {
  try {
    const candidateResults = await InterviewResult.find({ sessionid: sessionId });

    if (!candidateResults.length) {
      throw new Error("No results found for session");
    }

    const candidateScores = candidateResults
      .map((r) => r.overallscore)
      .filter((v) => typeof v === "number" && Number.isFinite(v));

    const populationResults = await InterviewResult.find({
      sessionid: { $ne: sessionId },
      overallscore: { $exists: true, $ne: null },
    }).limit(1000);

    const populationScores = populationResults
      .map((r) => r.overallscore)
      .filter((v) => typeof v === "number" && Number.isFinite(v));

    if (populationScores.length < 30) {
      throw new Error(
        "Insufficient population data for statistical comparison (minimum 30 required)",
      );
    }

    const testResults = welchTTest(candidateScores, populationScores);

    return {
      success: true,
      candidate: {
        sessionId,
        responseCount: candidateScores.length,
        meanScore: testResults.candidateMean,
        scores: candidateScores,
      },
      population: {
        sampleSize: populationScores.length,
        meanScore: testResults.populationMean,
      },
      statistics: testResults,
    };
  } catch (error) {
    console.error("[StatisticsService] Comparison failed:", error.message);
    throw error;
  }
}

/**
 * Get performance percentile rank
 * @param {number} score - Candidate's score
 * @param {Array<number>} populationScores - All population scores
 * @returns {number} Percentile (0-100)
 */
function calculatePercentile(score, populationScores) {
  const nums = (populationScores || [])
    .filter((v) => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);

  if (!nums.length) return 0;

  const rank = nums.filter((s) => s <= score).length;
  return (rank / nums.length) * 100;
}

/**
 * Calculate trend over multiple sessions (longitudinal analysis)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Trend analysis
 */
async function analyzeTrend(userId) {
  const sessions = await InterviewResult.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: "$sessionid",
        avgScore: { $avg: "$overallscore" },
        date: { $min: "$recordedat" },
      },
    },
    { $sort: { date: 1 } },
  ]);

  if (sessions.length < 2) {
    return { trend: "insufficient_data" };
  }

  const scores = sessions
    .map((s) => s.avgScore)
    .filter((v) => typeof v === "number" && Number.isFinite(v));

  if (scores.length < 2) {
    return { trend: "insufficient_data" };
  }

  const xMean = (scores.length - 1) / 2;
  const yMean = jStat.mean(scores);

  let numerator = 0;
  let denominator = 0;

  scores.forEach((y, x) => {
    numerator += (x - xMean) * (y - yMean);
    denominator += Math.pow(x - xMean, 2);
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;

  return {
    trend: slope > 0 ? "improving" : slope < 0 ? "declining" : "stable",
    slope,
    sessions: sessions.length,
    scores,
  };
}

module.exports = {
  welchTTest,
  compareSessionToPopulation,
  calculatePercentile,
  analyzeTrend,
};

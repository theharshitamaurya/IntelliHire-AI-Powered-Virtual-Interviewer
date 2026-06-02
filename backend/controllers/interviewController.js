const InterviewResult = require("../models/InterviewResult");
const { callPythonAnalyzer } = require("../services/pythonAnalyzer");
const llmService = require("../services/llmService");
const JDHistory = require("../models/JDHistory");
const QuestionBank = require("../models/QuestionBank");
const { RAGStore } = require("../services/ragService");
const { runTeacherEvaluationWithRAG } = require("../services/llmService");
const { computeFusion } = require("../services/sessionProcessor");

function computeAutoGroundingMetrics(retrieved, grounding) {
  if (!grounding?.citations?.length || !retrieved?.length) {
    return {
      groundednessScore: 0,
      citationPrecision: 0,
      citationRecall: 0,
    };
  }

  const byId = {};
  for (const c of retrieved) byId[c.id] = c;

  let cited = 0;
  let correct = 0;
  const uniqueGold = new Set();
  const citedGold = new Set();

  for (const c of grounding.citations) {
    for (const id of c.chunkIds || []) {
      cited++;
      const chunk = byId[id];
      if (chunk && chunk.score > 0.3) {
        correct++;
        if (id.startsWith("jd-skill-")) citedGold.add(id);
      }
    }
  }

  const citationPrecision = cited ? correct / cited : 0;
  const citationRecall = uniqueGold.size ? citedGold.size / uniqueGold.size : 0;

  const simScores = [];
  for (const c of grounding.citations) {
    for (const id of c.chunkIds || []) {
      const ch = byId[id];
      if (ch) simScores.push(ch.score);
    }
  }
  const avgSim =
    simScores.length > 0
      ? simScores.reduce((a, b) => a + b, 0) / simScores.length
      : 0;

  const groundednessScore = 0.5 * citationPrecision + 0.5 * avgSim;

  return { groundednessScore, citationPrecision, citationRecall };
}

async function submitInterviewHandler(req, res) {
  const payload = req.body;

  const fusion = computeFusion({
    voiceanalysis: payload.voiceanalysis,
    facialanalysis: payload.facialanalysis,
  });

  const { evalResult, retrieved } = await evaluateWithRAG(payload);

  const metrics = computeAutoGroundingMetrics(retrieved, evalResult.grounding);

  const result = await InterviewResult.create({
    question: payload.question,
    transcription: payload.transcription,
    voiceanalysis: payload.voiceanalysis,
    facialanalysis: payload.facialanalysis,
    additionalMetrics: payload.additionalMetrics || {},
    teacherEvaluation: evalResult,
    overallScore: fusion.overallscore,
    grounding: {
      retrievedChunks: retrieved,
      citations: evalResult.grounding?.citations || [],
      metrics,
    },
  });

  res.json({ ok: true, resultId: result._id });
}

async function evaluateWithRAG(interviewPayload) {
  const { jdId, questionId, transcription } = interviewPayload;

  const jd = jdId ? await JDHistory.findById(jdId) : null;
  const question = questionId ? await QuestionBank.findById(questionId) : null;

  const corpus = [];

  if (jd) {
    corpus.push({
      id: `jd-main`,
      source: "jd",
      text: jd.rawText || jd.fullText || jd.jobDescription || "",
    });
    (jd.requiredSkills || []).forEach((s, i) =>
      corpus.push({
        id: `jd-skill-${i}`,
        source: "jd",
        text: s,
      }),
    );
  }

  if (question) {
    corpus.push({
      id: `q-${question._id}`,
      source: "rubric",
      text: question.question || question.text,
    });
    (question.rubricPoints || []).forEach((r, i) =>
      corpus.push({
        id: `rubric-${question._id}-${i}`,
        source: "rubric",
        text: r,
      }),
    );
  }

  if (jd?.resumeText) {
    corpus.push({
      id: `resume-main`,
      source: "resume",
      text: jd.resumeText,
    });
  }

  const store = new RAGStore();
  await store.buildIndex(corpus);

  const query = transcription;
  const topK = await store.query(query, { k: 6 });

  const evalResult = await runTeacherEvaluationWithRAG({
    question: question?.question || question?.text || "",
    answer: transcription,
    retrieved: topK,
  });

  return { evalResult, retrieved: topK };
}

class AdvancedInterviewAnalyzer {
  constructor() {
    this.analysisMetrics = {
      confidence: { weight: 0.25, threshold: 70 },
      clarity: { weight: 0.25, threshold: 75 },
      engagement: { weight: 0.25, threshold: 65 },
      professionalism: { weight: 0.25, threshold: 80 },
    };
  }

  analyzeContent(transcription, keywords = [], questionType = "general") {
    if (!transcription || transcription.length === 0) {
      return this.getDefaultContentAnalysis();
    }

    const words = transcription.toLowerCase().split(/\s+/);
    const sentences = transcription
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);

    const keywordScore = this.calculateKeywordRelevance(
      transcription,
      keywords,
    );
    const wordCount = words.length;
    const avgWordsPerSentence = wordCount / (sentences.length || 1);
    const vocabularyDiversity = new Set(words).size / (words.length || 1);
    const starScore = this.detectSTARStructure(transcription);
    const professionalScore = this.detectProfessionalTerminology(transcription);
    const sentimentScore = this.analyzeSentiment(transcription);
    const coherenceScore = this.assessCoherence(transcription);

    const contentQualityScore = this.calculateContentQualityScore({
      keywordScore,
      wordCount,
      avgWordsPerSentence,
      vocabularyDiversity,
      starScore,
      professionalScore,
      sentimentScore,
      coherenceScore,
    });

    return {
      keywordRelevance: keywordScore,
      wordCount,
      sentenceCount: sentences.length,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      vocabularyDiversity: Math.round(vocabularyDiversity * 1000) / 10,
      starMethodScore: starScore,
      professionalTerminologyScore: professionalScore,
      sentimentScore,
      coherenceScore,
      overallContentScore: contentQualityScore,
    };
  }

  calculateKeywordRelevance(text, keywords) {
    if (!keywords || keywords.length === 0) return 50;

    const textLower = text.toLowerCase();
    let relevanceScore = 0;

    keywords.forEach((keyword) => {
      const keywordLower = keyword.toLowerCase();
      if (textLower.includes(keywordLower)) {
        relevanceScore += 100 / keywords.length;
      } else {
        const similarity = this.calculateStringSimilarity(
          textLower,
          keywordLower,
        );
        if (similarity > 0.6) {
          relevanceScore += (similarity * 100) / keywords.length;
        }
      }
    });

    return Math.min(100, Math.round(relevanceScore));
  }

  detectSTARStructure(text) {
    const starIndicators = {
      situation: [
        "situation",
        "context",
        "background",
        "when",
        "where",
        "scenario",
      ],
      task: [
        "task",
        "responsibility",
        "goal",
        "objective",
        "needed",
        "required",
      ],
      action: [
        "action",
        "did",
        "implemented",
        "executed",
        "performed",
        "approach",
        "strategy",
      ],
      result: [
        "result",
        "outcome",
        "achieved",
        "accomplished",
        "success",
        "impact",
        "benefit",
      ],
    };

    const textLower = text.toLowerCase();
    let starScore = 0;

    Object.keys(starIndicators).forEach((component) => {
      const indicators = starIndicators[component];
      const componentScore = indicators.filter((indicator) =>
        textLower.includes(indicator),
      ).length;

      if (componentScore > 0) {
        starScore += 25;
      }
    });

    return Math.min(100, starScore);
  }

  detectProfessionalTerminology(text) {
    const professionalTerms = [
      "project",
      "management",
      "leadership",
      "strategy",
      "implementation",
      "analysis",
      "development",
      "optimization",
      "collaboration",
      "innovation",
      "methodology",
      "framework",
      "stakeholder",
      "deliverable",
      "milestone",
      "objective",
      "initiative",
      "process",
      "workflow",
      "efficiency",
      "performance",
      "metrics",
      "evaluation",
      "assessment",
      "improvement",
      "solution",
      "challenge",
      "opportunity",
      "responsibility",
      "achievement",
    ];

    const words = text.toLowerCase().split(/\s+/);
    const professionalCount = words.filter((word) =>
      professionalTerms.includes(word),
    ).length;

    const professionalRatio = professionalCount / words.length;
    return Math.min(100, Math.round(professionalRatio * 500));
  }

  analyzeSentiment(text) {
    const positiveWords = [
      "achieve",
      "success",
      "improve",
      "excellent",
      "great",
      "good",
      "positive",
      "effective",
      "efficient",
      "innovative",
      "creative",
      "solution",
      "opportunity",
      "growth",
      "development",
      "progress",
      "accomplishment",
      "benefit",
      "value",
    ];

    const negativeWords = [
      "problem",
      "difficult",
      "challenge",
      "issue",
      "failure",
      "mistake",
      "error",
      "wrong",
      "bad",
      "poor",
      "negative",
      "struggle",
      "concern",
    ];

    const words = text.toLowerCase().split(/\s+/);
    const positiveCount = words.filter((word) =>
      positiveWords.includes(word),
    ).length;
    const negativeCount = words.filter((word) =>
      negativeWords.includes(word),
    ).length;

    const sentimentRatio = (positiveCount - negativeCount) / words.length;
    return Math.max(0, Math.min(100, 50 + sentimentRatio * 500));
  }

  assessCoherence(text) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length < 2) return 50;

    const transitionWords = [
      "however",
      "therefore",
      "furthermore",
      "moreover",
      "consequently",
      "additionally",
      "meanwhile",
      "subsequently",
      "nevertheless",
      "thus",
      "first",
      "second",
      "third",
      "finally",
      "then",
      "next",
      "also",
      "because",
      "since",
      "although",
      "while",
      "whereas",
      "in addition",
      "for example",
    ];

    const textLower = text.toLowerCase();
    const transitionCount = transitionWords.filter((word) =>
      textLower.includes(word),
    ).length;

    const coherenceScore = Math.min(
      100,
      (transitionCount / sentences.length) * 200,
    );
    return Math.round(coherenceScore);
  }

  calculateContentQualityScore(metrics) {
    const {
      keywordScore,
      wordCount,
      avgWordsPerSentence,
      vocabularyDiversity,
      starScore,
      professionalScore,
      sentimentScore,
      coherenceScore,
    } = metrics;

    let wordCountScore = 0;
    if (wordCount < 20) {
      wordCountScore = wordCount * 2.5;
    } else if (wordCount <= 150) {
      wordCountScore = 50 + (wordCount - 20) * 0.38;
    } else if (wordCount <= 250) {
      wordCountScore = 100;
    } else {
      wordCountScore = Math.max(50, 100 - (wordCount - 250) * 0.1);
    }

    const overallScore =
      keywordScore * 0.25 +
      wordCountScore * 0.15 +
      vocabularyDiversity * 0.15 +
      starScore * 0.15 +
      professionalScore * 0.15 +
      sentimentScore * 0.1 +
      coherenceScore * 0.05;

    return Math.round(Math.max(0, Math.min(100, overallScore)));
  }

  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  getDefaultContentAnalysis() {
    return {
      keywordRelevance: 0,
      wordCount: 0,
      sentenceCount: 0,
      avgWordsPerSentence: 0,
      vocabularyDiversity: 0,
      starMethodScore: 0,
      professionalTerminologyScore: 0,
      sentimentScore: 50,
      coherenceScore: 0,
      overallContentScore: 0,
    };
  }
}

const aiAnalyzer = new AdvancedInterviewAnalyzer();

function calculateFusedScore({ contentScore, audioScore, videoScore }) {
  const weights = {
    content: 0.4,
    audio: 0.3,
    video: 0.3,
  };

  const overallScore =
    weights.content * contentScore +
    weights.audio * audioScore +
    weights.video * videoScore;

  return Math.round(Math.max(0, Math.min(100, overallScore)));
}

exports.createResult = async (req, res) => {
  try {
    const session = req.session || null;
    const jobDescriptionFromMiddleware = req.jobDescription || null;

    const {
      transcription,
      keywords: keywordsRaw,
      questiontype = "general",
      sessionduration = 0,
      additionalmetrics: additionalmetricsRaw,

      questionId,

      role,
      difficulty,
      skills,
      useLLM,

      jobDescription: jobDescriptionFromClient,
    } = req.body;

    if (!transcription || typeof transcription !== "string") {
      return res.status(400).json({ error: "Missing transcription" });
    }

    const source = req.body?.source || "live";
    if (source === "jd" && !questionId) {
      return res.status(400).json({ error: "Missing questionId" });
    }

    let questionText = null;

    if (
      jobDescriptionFromMiddleware &&
      Array.isArray(jobDescriptionFromMiddleware.questions)
    ) {
      const q = jobDescriptionFromMiddleware.questions.find(
        (x) => String(x.id) === String(questionId),
      );

      if (!q) {
        return res
          .status(400)
          .json({ error: "Question not found in job description" });
      }

      questionText = q.text || q.questionText || q.question || null;
    }

    if (!questionText) {
      questionText = req.body.question || "";
    }
    if (!questionText) {
      return res.status(400).json({
        error: "Missing question",
        message: "Question text is required",
      });
    }

    let keywords = [];
    try {
      keywords = keywordsRaw ? JSON.parse(keywordsRaw) : [];
    } catch {
      keywords = [];
    }

    let additionalmetrics;
    try {
      if (!additionalmetricsRaw) {
        additionalmetrics = undefined;
      } else if (typeof additionalmetricsRaw === "string") {
        additionalmetrics = JSON.parse(additionalmetricsRaw);
      } else if (typeof additionalmetricsRaw === "object") {
        additionalmetrics = additionalmetricsRaw;
      } else {
        additionalmetrics = undefined;
      }
    } catch {
      additionalmetrics = undefined;
    }

        const audioPath = req.file?.path || req.files?.audio?.[0]?.path || null;
    const videoPath = req.files?.video?.[0]?.path || null;

    console.log("[InterviewController] Processing interview submission");
    console.log("[InterviewController] Audio file:", audioPath);
    console.log("[InterviewController] Video file:", videoPath);

    const contentAnalysis = aiAnalyzer.analyzeContent(
      transcription,
      keywords,
      questiontype,
    );

    console.log(
      "[InterviewController] Content analysis complete:",
      contentAnalysis.overallContentScore,
    );

    let audioFeatures = getDefaultAudioFeatures();
    let videoFeatures = getDefaultVideoFeatures();
    let multimodalAnalysisSuccess = false;

    if (audioPath || videoPath) {
      try {
        console.log("[InterviewController] Calling Python analyzer for multimodal analysis...");
        const pythonResult = await callPythonAnalyzer(audioPath, videoPath);

        if (pythonResult.success) {
          if (pythonResult.audio) {
            audioFeatures = { ...audioFeatures, ...pythonResult.audio };
          }
          if (pythonResult.video) {
            videoFeatures = { ...videoFeatures, ...pythonResult.video };
          }
          multimodalAnalysisSuccess = true;
          console.log("[InterviewController] Multimodal analysis complete");
        } else {
          console.warn("[InterviewController] Python analysis completed with warnings");
        }
      } catch (error) {
        console.error(
          "[InterviewController] Python multimodal analysis failed:",
          error.message,
        );
      }
    } else {
      console.log("[InterviewController] No audio/video file, using defaults");
    }

    const multimodalScore = calculateFusedScore({
      contentScore: contentAnalysis.overallContentScore,
      audioScore: audioFeatures.overallVoiceScore || 75,
      videoScore: videoFeatures.overallFacialScore || 75,
    });

    console.log(
      "[InterviewController] Fused score (multimodal):",
      multimodalScore,
    );

    let llmEvaluation = null;
    const useLLMFlag = useLLM === true || useLLM === "true";

    if (useLLMFlag) {
      try {
        console.log("[InterviewController] Calling LLM service...");

        let jdObj = null;
        if (jobDescriptionFromMiddleware) {
          jdObj =
            typeof jobDescriptionFromMiddleware.toObject === "function"
              ? jobDescriptionFromMiddleware.toObject()
              : jobDescriptionFromMiddleware;
        } else if (jobDescriptionFromClient) {
          if (typeof jobDescriptionFromClient === "string") {
            try {
              jdObj = JSON.parse(jobDescriptionFromClient);
            } catch {
              jdObj = null;
            }
          } else if (typeof jobDescriptionFromClient === "object") {
            jdObj = jobDescriptionFromClient;
          }
        }

        const llmResult = await llmService.evaluateResponse(
          transcription,
          questionText,
          jdObj,
        );

        if (llmResult && llmResult.success) {
          llmEvaluation = llmResult.evaluation;
          console.log(
            "[InterviewController] LLM evaluation complete:",
            llmResult.usage || "(no usage returned)",
          );
        } else {
          console.warn(
            "[InterviewController] LLM evaluation failed:",
            llmResult?.error || "unknown error",
          );
        }
      } catch (err) {
        console.error("[InterviewController] LLM service error:", err.message);
        llmEvaluation = null;
      }
    }

    let finalScore = multimodalScore;
    const clientOverall = Number(req.body?.overallscore);
    const teacherScore = additionalmetrics?.teacherEvaluation?.score;
    const teacherEvalScore =
      Number.isFinite(clientOverall) && clientOverall > 0
        ? clientOverall
        : typeof teacherScore === "number" &&
            Number.isFinite(teacherScore) &&
            teacherScore > 0
          ? teacherScore
          : null;
    const backendLLMScore =
      llmEvaluation && typeof llmEvaluation.overallScore === "number"
        ? llmEvaluation.overallScore
        : null;

    const scoreComponents = [
      { label: "multimodal", score: multimodalScore, weight: 0.5 },
    ];
    if (teacherEvalScore !== null) {
      scoreComponents.push({
        label: "teacher",
        score: teacherEvalScore,
        weight: backendLLMScore !== null ? 0.25 : 0.5,
      });
    }
    if (backendLLMScore !== null) {
      scoreComponents.push({
        label: "llm",
        score: backendLLMScore,
        weight: teacherEvalScore !== null ? 0.25 : 0.5,
      });
    }

    const totalWeight = scoreComponents.reduce(
      (sum, component) => sum + component.weight,
      0,
    );
    if (totalWeight > 0) {
      finalScore = Math.round(
        scoreComponents.reduce(
          (sum, component) => sum + component.score * component.weight,
          0,
        ) / totalWeight,
      );
    }

    console.log("[InterviewController] Score blend:", scoreComponents);
    console.log("[InterviewController] Final score:", finalScore);

    const comprehensiveFeedback = generateFeedback({
      contentAnalysis,
      audioFeatures,
      videoFeatures,
      overallScore: finalScore,
    });

    const mongoose = require("mongoose");
    const toObjectIdOrUndef = (v) =>
      v && mongoose.Types.ObjectId.isValid(String(v)) ? String(v) : undefined;

        const mergedAdditionalMetrics = {
      ...(additionalmetrics && typeof additionalmetrics === "object"
        ? additionalmetrics
        : {}),
      source,
      multimodalAnalysisSuccess,
      multimodalInput: {
        hasAudio: Boolean(audioPath),
        hasVideo: Boolean(videoPath),
      },
      scoreBreakdown: {
        multimodalScore,
        teacherScore: teacherEvalScore,
        llmScore: backendLLMScore,
        blend: scoreComponents,
      },
    };

    const newResult = new InterviewResult({
      sessionid: session?.sessionId || req.body?.sessionId || "",
      jdId: toObjectIdOrUndef(jobDescriptionFromMiddleware?._id),
      questionId: toObjectIdOrUndef(questionId),

      question: questionText,

      transcription,
      keywords,
      questiontype,
      sessionduration: parseInt(sessionduration) || 0,
      role: role || undefined,
      difficulty: difficulty || undefined,
      skills: skills || undefined,

      contentanalysis: contentAnalysis,
      voiceanalysis: audioFeatures,
      facialanalysis: videoFeatures,
      llmevaluation: llmEvaluation,

      comprehensivefeedback: comprehensiveFeedback,
      additionalmetrics: mergedAdditionalMetrics,
      overallscore: finalScore,
      contentscore: contentAnalysis.overallContentScore,
      deliveryscore: audioFeatures.deliveryScore || 75,
      engagementscore: videoFeatures.engagementScore || 70,
      professionalismscore: videoFeatures.professionalism || 80,

      audiopath: audioPath || "",
      videopath: videoPath || "",
      recordedat: new Date(),
      analyzedat: new Date(),
    });

    await newResult.save();

    console.log(
      "[InterviewController] Result saved to MongoDB:",
      newResult._id,
    );

    return res.status(201).json({
      message: "Interview result saved with multimodal and LLM analysis",
      sessionId: session?.sessionId || null,
      questionId,
      validated: Boolean(session && jobDescriptionFromMiddleware),
      data: newResult,
      analysisSummary: {
        overallScore: finalScore,
        multimodalScore,
        llmScore: llmEvaluation ? llmEvaluation.overallScore : null,
        contentScore: contentAnalysis.overallContentScore,
        audioScore: audioFeatures.overallVoiceScore,
        videoScore: videoFeatures.overallFacialScore,
        multimodalIntegrated: multimodalAnalysisSuccess,
        llmIntegrated: llmEvaluation !== null,
      },
    });
  } catch (error) {
    console.error("[InterviewController] Error:", error);
    return res.status(500).json({
      message: "Server error during analysis",
      error: error.message,
    });
  }
};

/**
 * Get all results with filtering
 * GET /api/interviews
 */
exports.getAllResults = async (req, res) => {
  try {
    const {
      limit = 50,
      skip = 0,
      sortby = "recordedat",
      order = "desc",
      questiontype,
      minscore,
      maxscore,
    } = req.query;

    let query = {};

    if (questiontype) {
      query.questiontype = questiontype;
    }

    if (minscore || maxscore) {
      query.overallscore = {};
      if (minscore) query.overallscore.$gte = parseInt(minscore);
      if (maxscore) query.overallscore.$lte = parseInt(maxscore);
    }

    const results = await InterviewResult.find(query)
      .sort({ [sortby]: order === "desc" ? -1 : 1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select("-audiopath")
      .lean();

    const totalResults = await InterviewResult.countDocuments(query);

    const averageScore = await InterviewResult.aggregate([
      { $match: query },
      { $group: { _id: null, avgScore: { $avg: "$overallscore" } } },
    ]);

    const summary = {
      totalinterviews: totalResults,
      averagescore: averageScore[0]?.avgScore || 0,
      returnedcount: results.length,
      hasmore: parseInt(skip) + results.length < totalResults,
    };

    res.json({
      results,
      summary,
      filtersapplied: { questiontype, minscore, maxscore, sortby, order },
    });
  } catch (error) {
    console.error("[InterviewController] Get results error:", error);
    res.status(500).json({
      message: "Server error retrieving results",
      error: error.message,
    });
  }
};


function round2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdSample(arr) {
  if (arr.length <= 1) return null;
  const m = avg(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function ci95(arr) {
  if (arr.length <= 1) return { low: null, high: null };
  const m = avg(arr);
  const sd = stdSample(arr);
  const sem = sd / Math.sqrt(arr.length);
  return { low: m - 1.96 * sem, high: m + 1.96 * sem };
}

function safeNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

function pickPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object" || !(p in cur)) return null;
    cur = cur[p];
  }
  return cur;
}

function firstDefined(obj, paths) {
  for (const p of paths) {
    const v = pickPath(obj, p);
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

function normalizeSource(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "live" || s === "jd" || s === "practice") return s;
  return "unknown";
}

function getCanonicalMetricExpressions() {
  const averageAvailableExpr = (...exprs) => ({
    $let: {
      vars: {
        values: {
          $filter: {
            input: exprs,
            as: "value",
            cond: { $ne: ["$$value", null] },
          },
        },
      },
      in: {
        $cond: [
          { $gt: [{ $size: "$$values" }, 0] },
          { $avg: "$$values" },
          null,
        ],
      },
    },
  });

  const sourceExpr = {
    $let: {
      vars: {
        src: {
          $toLower: {
            $ifNull: [
              "$additionalmetrics.source",
              { $ifNull: ["$source", "unknown"] },
            ],
          },
        },
      },
      in: {
        $cond: [
          { $in: ["$$src", ["live", "jd", "practice"]] },
          "$$src",
          "unknown",
        ],
      },
    },
  };

  const llmConfidenceExpr = {
    $ifNull: [
      "$additionalmetrics.teacherEvaluation.competencies.confidence",
      {
        $ifNull: [
          "$comprehensivefeedback.competencies.confidence",
          "$llmevaluation.competencies.confidence",
        ],
      },
    ],
  };

  const llmClarityExpr = {
    $ifNull: [
      "$additionalmetrics.teacherEvaluation.competencies.clarity",
      {
        $ifNull: [
          "$comprehensivefeedback.competencies.clarity",
          "$llmevaluation.competencies.clarity",
        ],
      },
    ],
  };

  const llmEngagementExpr = {
    $ifNull: [
      "$additionalmetrics.teacherEvaluation.competencies.engagement",
      {
        $ifNull: [
          "$comprehensivefeedback.competencies.engagement",
          "$llmevaluation.competencies.engagement",
        ],
      },
    ],
  };

  const multimodalConfidenceExpr = {
    $ifNull: [
      "$confidence",
      { $ifNull: ["$voiceanalysis.confidence", "$voiceanalysis.overallVoiceScore"] },
    ],
  };

  const multimodalClarityExpr = {
    $ifNull: ["$clarity", "$voiceanalysis.clarity"],
  };

  const multimodalEngagementExpr = {
    $ifNull: [
      "$engagement",
      { $ifNull: ["$facialanalysis.engagement", "$facialanalysis.engagementScore"] },
    ],
  };

  const liveJdEngagementExpr = averageAvailableExpr(
    multimodalEngagementExpr,
    llmEngagementExpr,
  );

  return {
    sourceExpr,
    llmConfidenceExpr,
    llmClarityExpr,
    llmEngagementExpr,
    multimodalConfidenceExpr,
    multimodalClarityExpr,
    multimodalEngagementExpr,
    liveJdEngagementExpr,
  };
}
/**
 * Get analytics aggregations
 * GET /api/interviews/analytics
 */
exports.getAnalytics = async (req, res) => {
  try {
    const { timeperiod = "30d", questiontype } = req.query;

    const endDate = new Date();
    const startDate = new Date();

    let matchConditions = {};

    switch (timeperiod) {
      case "7d":
        startDate.setDate(endDate.getDate() - 7);
        matchConditions.recordedat = { $gte: startDate, $lte: endDate };
        break;
      case "30d":
        startDate.setDate(endDate.getDate() - 30);
        matchConditions.recordedat = { $gte: startDate, $lte: endDate };
        break;
      case "90d":
        startDate.setDate(endDate.getDate() - 90);
        matchConditions.recordedat = { $gte: startDate, $lte: endDate };
        break;
      case "all":
      default:
        break;
    }

    if (questiontype) {
      matchConditions.questiontype = questiontype;
    }

    const {
      sourceExpr,
      llmConfidenceExpr,
      llmClarityExpr,
      llmEngagementExpr,
      multimodalConfidenceExpr,
      multimodalClarityExpr,
      multimodalEngagementExpr,
      liveJdEngagementExpr,
    } = getCanonicalMetricExpressions();

    const [performanceTrends, questionTypePerformance, scoreDistribution, modeMetrics, overallMetrics] = await Promise.all([
      InterviewResult.aggregate([
        { $match: matchConditions },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: "%Y-%m-%d", date: "$recordedat" },
              },
            },
            avgScore: { $avg: "$overallscore" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),
      InterviewResult.aggregate([
        { $match: matchConditions },
        {
          $group: {
            _id: "$questiontype",
            avgScore: { $avg: "$overallscore" },
            count: { $sum: 1 },
            avgContentScore: { $avg: "$contentscore" },
            avgDeliveryScore: { $avg: "$deliveryscore" },
            avgEngagementScore: { $avg: "$engagementscore" },
            avgProfessionalismScore: { $avg: "$professionalismscore" },
          },
        },
        { $sort: { avgScore: -1 } },
      ]),
      InterviewResult.aggregate([
        { $match: matchConditions },
        {
          $bucket: {
            groupBy: "$overallscore",
            boundaries: [0, 20, 40, 60, 80, 100],
            default: 100,
            output: {
              count: { $sum: 1 },
              avgScore: { $avg: "$overallscore" },
            },
          },
        },
      ]),
      InterviewResult.aggregate([
        { $match: matchConditions },
        { $addFields: { sourceNorm: sourceExpr } },
        {
          $addFields: {
            confidenceMetric: {
              $cond: [
                { $eq: ["$sourceNorm", "practice"] },
                llmConfidenceExpr,
                { $ifNull: [multimodalConfidenceExpr, llmConfidenceExpr] },
              ],
            },
            clarityMetric: {
              $cond: [
                { $eq: ["$sourceNorm", "practice"] },
                llmClarityExpr,
                { $ifNull: [multimodalClarityExpr, llmClarityExpr] },
              ],
            },
            engagementMetric: {
              $switch: {
                branches: [
                  { case: { $eq: ["$sourceNorm", "practice"] }, then: llmEngagementExpr },
                  {
                    case: { $in: ["$sourceNorm", ["live", "jd"]] },
                    then: liveJdEngagementExpr,
                  },
                ],
                default: { $ifNull: [multimodalEngagementExpr, llmEngagementExpr] },
              },
            },
          },
        },
        {
          $group: {
            _id: "$sourceNorm",
            count: { $sum: 1 },
            avgConfidence: { $avg: "$confidenceMetric" },
            avgClarity: { $avg: "$clarityMetric" },
            avgEngagement: { $avg: "$engagementMetric" },
          },
        },
      ]),
      InterviewResult.aggregate([
        { $match: matchConditions },
        { $addFields: { sourceNorm: sourceExpr } },
        {
          $addFields: {
            confidenceMetric: {
              $cond: [
                { $eq: ["$sourceNorm", "practice"] },
                llmConfidenceExpr,
                { $ifNull: [multimodalConfidenceExpr, llmConfidenceExpr] },
              ],
            },
            clarityMetric: {
              $cond: [
                { $eq: ["$sourceNorm", "practice"] },
                llmClarityExpr,
                { $ifNull: [multimodalClarityExpr, llmClarityExpr] },
              ],
            },
            engagementMetric: {
              $switch: {
                branches: [
                  { case: { $eq: ["$sourceNorm", "practice"] }, then: llmEngagementExpr },
                  {
                    case: { $in: ["$sourceNorm", ["live", "jd"]] },
                    then: liveJdEngagementExpr,
                  },
                ],
                default: { $ifNull: [multimodalEngagementExpr, llmEngagementExpr] },
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgConfidence: { $avg: "$confidenceMetric" },
            avgClarity: { $avg: "$clarityMetric" },
            avgEngagement: { $avg: "$engagementMetric" },
          },
        },
      ]),
    ]);

    const cleanedModeMetrics = (modeMetrics || []).map((m) => ({
      source: m._id || "unknown",
      count: m.count || 0,
      confidence: round2(m.avgConfidence),
      clarity: round2(m.avgClarity),
      engagement: round2(m.avgEngagement),
    }));

    const overall = overallMetrics?.[0]
      ? {
          count: overallMetrics[0].count || 0,
          confidence: round2(overallMetrics[0].avgConfidence),
          clarity: round2(overallMetrics[0].avgClarity),
          engagement: round2(overallMetrics[0].avgEngagement),
        }
      : { count: 0, confidence: null, clarity: null, engagement: null };

    res.json({
      analytics: {
        performancetrends: performanceTrends,
        questiontypeperformance: questionTypePerformance,
        scoredistribution: scoreDistribution,
        modeMetrics: cleanedModeMetrics,
        overallMetrics: overall,
      },
      timeperiod,
      daterange:
        timeperiod === "all" ? null : { start: startDate, end: endDate },
    });
  } catch (error) {
    console.error("[InterviewController] Analytics error:", error);
    res.status(500).json({
      message: "Server error generating analytics",
      error: error.message,
    });
  }
};

/**
 * Get IEEE-style statistical summary
 * GET /api/interviews/ieee-summary
 */
exports.getIEEESummary = async (req, res) => {
  try {
    const docs = await InterviewResult.find({}).lean();

    const normalized = docs.map((doc) => {
      const additional = firstDefined(doc, ["additionalmetrics", "additional_metrics"]) || {};
      const comprehensive =
        firstDefined(doc, ["comprehensivefeedback", "comprehensive_feedback"]) || {};
      const content = firstDefined(doc, ["contentanalysis", "content_analysis"]) || {};
      const llmEval = firstDefined(doc, ["llmevaluation", "llm_evaluation"]) || {};

      const score = safeNum(
        firstDefined(doc, [
          "overallscore",
          "overall_score",
          "finalscore",
          "final_score",
          "comprehensivefeedback.overallScore",
          "comprehensive_feedback.overallScore",
          "llmevaluation.overallScore",
        ]),
      );

      const tsRaw = firstDefined(doc, ["recordedat", "recorded_at", "analyzedat", "updatedat"]);
      const ts = tsRaw ? new Date(tsRaw) : null;
      const source = normalizeSource(firstDefined(doc, ["additionalmetrics.source", "additional_metrics.source", "source"]));

      const competencies =
        firstDefined(doc, [
          "comprehensivefeedback.competencies",
          "comprehensive_feedback.competencies",
          "llmevaluation.competencies",
        ]) || {};

      return {
        score,
        ts,
        source,
        role: String(firstDefined(doc, ["role"]) || "").trim(),
        difficulty: String(firstDefined(doc, ["difficulty"]) || "").trim(),
        jdTraceable: Boolean(doc?.jdId) && Boolean(doc?.questionId),
        content: {
          keywordRelevance: safeNum(content.keywordRelevance),
          starMethodScore: safeNum(content.starMethodScore),
          vocabularyDiversity: safeNum(content.vocabularyDiversity),
          coherenceScore: safeNum(content.coherenceScore),
          professionalTerminologyScore: safeNum(content.professionalTerminologyScore),
          overallContentScore: safeNum(content.overallContentScore),
        },
        competencies: {
          technical: safeNum(firstDefined(competencies, ["technical", "tech"])),
          clarity: safeNum(firstDefined(competencies, ["clarity"])),
          confidence: safeNum(firstDefined(competencies, ["confidence"])),
          conciseness: safeNum(firstDefined(competencies, ["conciseness", "brevity"])),
          engagement: safeNum(firstDefined(competencies, ["engagement", "energy"])),
        },
      };
    });

    const scoreVals = normalized.map((x) => x.score).filter((x) => Number.isFinite(x));
    const tsVals = normalized.map((x) => x.ts).filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));

    const bySource = {};
    const byDifficulty = {};
    for (const row of normalized) {
      if (Number.isFinite(row.score)) {
        if (!bySource[row.source]) bySource[row.source] = [];
        bySource[row.source].push(row.score);

        if (row.difficulty) {
          if (!byDifficulty[row.difficulty]) byDifficulty[row.difficulty] = [];
          byDifficulty[row.difficulty].push(row.score);
        }
      }
    }

    const summarizeGrouped = (grouped) =>
      Object.fromEntries(
        Object.entries(grouped).map(([k, vals]) => [
          k,
          {
            mean: round2(avg(vals)),
            std: round2(stdSample(vals)),
            count: vals.length,
          },
        ]),
      );

    const contentKeys = [
      "keywordRelevance",
      "starMethodScore",
      "vocabularyDiversity",
      "coherenceScore",
      "professionalTerminologyScore",
      "overallContentScore",
    ];

    const contentSummary = {};
    for (const key of contentKeys) {
      const vals = normalized
        .map((x) => x.content[key])
        .filter((x) => Number.isFinite(x));
      contentSummary[key] = {
        mean: round2(avg(vals)),
        std: round2(stdSample(vals)),
        count: vals.length,
      };
    }

    const compKeys = ["technical", "clarity", "confidence", "conciseness", "engagement"];
    const competencySummary = {};
    for (const key of compKeys) {
      const vals = normalized
        .map((x) => x.competencies[key])
        .filter((x) => Number.isFinite(x));
      competencySummary[key] = {
        mean: round2(avg(vals)),
        std: round2(stdSample(vals)),
        count: vals.length,
      };
    }

    const ci = ci95(scoreVals);

    res.json({
      totalSessions: normalized.length,
      dateRange: {
        min: tsVals.length ? new Date(Math.min(...tsVals.map((d) => d.getTime()))).toISOString() : null,
        max: tsVals.length ? new Date(Math.max(...tsVals.map((d) => d.getTime()))).toISOString() : null,
      },
      overall: {
        mean: round2(avg(scoreVals)),
        std: round2(stdSample(scoreVals)),
        ci95: {
          low: round2(ci.low),
          high: round2(ci.high),
        },
        count: scoreVals.length,
      },
      bySource: summarizeGrouped(bySource),
      byDifficulty: summarizeGrouped(byDifficulty),
      jdTraceability: {
        linked: normalized.filter((x) => x.jdTraceable).length,
        total: normalized.length,
      },
      contentMetrics: contentSummary,
      competencyMetrics: competencySummary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[InterviewController] IEEE summary error:", error);
    res.status(500).json({
      message: "Server error generating IEEE summary",
      error: error.message,
    });
  }
};

/**
 * Get research statistics (for paper)
 * GET /api/interviews/research-statistics
 */
exports.getResearchStatistics = async (req, res) => {
  try {
    const [roleStats, difficultyStats, skillGaps, datasetInfo] =
      await Promise.all([
        InterviewResult.getStatsByRole(),
        InterviewResult.getStatsByDifficulty(),
        InterviewResult.getSkillGapAnalysis(),
        InterviewResult.getDatasetDescription(),
      ]);

    res.json({
      dataset: datasetInfo,
      byRole: roleStats,
      byDifficulty: difficultyStats,
      skillGaps: skillGaps,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("[InterviewController] Research statistics error:", error);
    res.status(500).json({
      message: "Server error generating research statistics",
      error: error.message,
    });
  }
};

/**
 * Delete all interview results (optionally by source)
 * DELETE /api/interviews
 */
exports.deleteResults = async (req, res) => {
  try {
    const { source } = req.query;
    const filter = {};

    if (source) {
      filter["additionalmetrics.source"] = source;
    }

    const deleted = await InterviewResult.deleteMany(filter);

    return res.json({
      message: "Interview results deleted",
      deletedCount: deleted.deletedCount || 0,
      filterApplied: source ? { source } : "all",
    });
  } catch (error) {
    console.error("[InterviewController] Delete results error:", error);
    return res.status(500).json({
      message: "Server error deleting results",
      error: error.message,
    });
  }
};

function getDefaultAudioFeatures() {
  return {
    energy_db: -30.0,
    spectral_centroid_mean: 2000.0,
    zcr_mean: 0.08,
    pitch_mean: 150.0,
    tempo: 120.0,
    pause_ratio: 0.2,
    voice_activity: 0.8,
    clarity: 75,
    pace: 75,
    volume: 75,
    confidence: 75,
    overallVoiceScore: 75,
    deliveryScore: 75,
  };
}

function getDefaultVideoFeatures() {
  return {
    eyeContact: 70,
    headStability: 75,
    postureScore: 75,
    gestureIntensity: 50,
    engagement: 70,
    professionalism: 80,
    confidence: 75,
    overallFacialScore: 75,
    engagementScore: 70,
  };
}

function generateFeedback({
  contentAnalysis,
  audioFeatures,
  videoFeatures,
  overallScore,
}) {
  const strengths = [];
  const improvements = [];

  if (contentAnalysis.keywordRelevance > 70) {
    strengths.push("Excellent relevance to the question asked");
  } else if (contentAnalysis.keywordRelevance < 50) {
    improvements.push("Focus more directly on answering the specific question");
  }

  if (contentAnalysis.starMethodScore > 60) {
    strengths.push(
      "Well-structured response using professional storytelling methods",
    );
  } else if (contentAnalysis.starMethodScore < 40) {
    improvements.push(
      "Structure responses using the STAR method (Situation, Task, Action, Result)",
    );
  }

  if (audioFeatures.confidence > 80) {
    strengths.push("Confident and clear vocal delivery");
  } else if (audioFeatures.confidence < 60) {
    improvements.push(
      "Practice speaking with more confidence and vocal energy",
    );
  }

  if (audioFeatures.pace > 70 && audioFeatures.pace < 85) {
    strengths.push("Good speaking pace and rhythm");
  } else if (audioFeatures.pace < 60 || audioFeatures.pace > 90) {
    improvements.push("Adjust speaking pace for better clarity");
  }

  if (videoFeatures.eyeContact > 75) {
    strengths.push("Strong eye contact and camera presence");
  } else if (videoFeatures.eyeContact < 60) {
    improvements.push("Maintain better eye contact with the camera");
  }

  return {
    overallScore,
    categoryScores: {
      content: contentAnalysis.overallContentScore,
      delivery: audioFeatures.deliveryScore || 75,
      engagement: videoFeatures.engagementScore || 70,
      professionalism: videoFeatures.professionalism || 80,
    },
    strengths,
    improvements,
    recommendations: [
      "Practice recording yourself to improve self-awareness",
      "Prepare structured examples using the STAR method",
      "Research the company and role thoroughly before interviews",
    ],
    nextSteps: [
      "Continue practicing interview responses with mock questions",
      "Record mock interviews monthly to track progress",
    ],
  };
}

module.exports = exports;












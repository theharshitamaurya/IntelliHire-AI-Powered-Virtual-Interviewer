const mongoose = require("mongoose");
const { Schema } = mongoose;
const EnhancedInterviewResultSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    transcription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    keywords: [
      {
        type: String,
        trim: true,
      },
    ],
    question_type: {
      type: String,
      enum: [
        "introduction",
        "behavioral",
        "technical",
        "problem_solving",
        "leadership",
        "communication",
        "adaptability",
        "goals",
        "strengths_weaknesses",
        "company_fit",
        "general",
      ],
      default: "general",
    },
    session_duration: {
      type: Number,
      default: 0,
      min: 0,
      max: 1200000,
    },

    jdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JDHistory",
    },

    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionBank",
    },

    role: {
      type: String,
      trim: true,
    },

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    skills: [
      {
        type: String,
        trim: true,
      },
    ],

    grounding: {
      retrievedChunks: [
        {
          id: String,
          source: { type: String, enum: ["jd", "resume", "rubric"] },
          text: String,
          score: Number,
        },
      ],
      citations: [
        {
          feedbackSpan: String,
          chunkIds: [String],
        },
      ],
      metrics: {
        groundednessScore: Number,
        citationPrecision: Number,
        citationRecall: Number,
        feedbackUsefulness: Number,
      },
    },

    content_analysis: {
      keywordRelevance: { type: Number, default: 0, min: 0, max: 100 },
      wordCount: { type: Number, default: 0, min: 0 },
      sentenceCount: { type: Number, default: 0, min: 0 },
      avgWordsPerSentence: { type: Number, default: 0, min: 0 },
      vocabularyDiversity: { type: Number, default: 0, min: 0, max: 100 },
      starMethodScore: { type: Number, default: 0, min: 0, max: 100 },
      professionalTerminologyScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      sentimentScore: { type: Number, default: 50, min: 0, max: 100 },
      coherenceScore: { type: Number, default: 0, min: 0, max: 100 },
      overallContentScore: { type: Number, default: 0, min: 0, max: 100 },
    },

    voice_analysis: {
      clarity: { type: Number, default: 75, min: 0, max: 100 },
      pace: { type: Number, default: 75, min: 0, max: 100 },
      volume: { type: Number, default: 75, min: 0, max: 100 },
      confidence: { type: Number, default: 75, min: 0, max: 100 },
      overallVoiceScore: { type: Number, default: 75, min: 0, max: 100 },
    },

    facial_analysis: {
      eyeContact: { type: Number, default: 70, min: 0, max: 100 },
      engagement: { type: Number, default: 70, min: 0, max: 100 },
      professionalism: { type: Number, default: 80, min: 0, max: 100 },
      confidence: { type: Number, default: 75, min: 0, max: 100 },
      overallFacialScore: { type: Number, default: 75, min: 0, max: 100 },
    },

    behavioral_analysis: {
      posture: { type: Number, default: 75, min: 0, max: 100 },
      gestures: { type: Number, default: 75, min: 0, max: 100 },
      stability: { type: Number, default: 75, min: 0, max: 100 },
      nervousness: { type: Number, default: 25, min: 0, max: 100 },
      overallBehavioralScore: { type: Number, default: 75, min: 0, max: 100 },
    },

    comprehensive_feedback: {
      overallScore: { type: Number, default: 0, min: 0, max: 100 },
      categoryScores: {
        content: { type: Number, default: 0, min: 0, max: 100 },
        delivery: { type: Number, default: 75, min: 0, max: 100 },
        engagement: { type: Number, default: 70, min: 0, max: 100 },
        professionalism: { type: Number, default: 80, min: 0, max: 100 },
      },
      strengths: [{ type: String, trim: true }],
      improvements: [{ type: String, trim: true }],
      recommendations: [{ type: String, trim: true }],
      nextSteps: [{ type: String, trim: true }],
    },

    keywords_score: { type: Number, default: 0, min: 0, max: 100 },
    engagement_score: { type: Number, default: 0, min: 0, max: 100 },
    final_score: { type: Number, default: 0, min: 0, max: 100 },
    feedback: { type: String, default: "", maxlength: 2000 },

    overall_score: { type: Number, default: 0, min: 0, max: 100 },
    content_score: { type: Number, default: 0, min: 0, max: 100 },
    delivery_score: { type: Number, default: 75, min: 0, max: 100 },
    engagement_score_enhanced: { type: Number, default: 70, min: 0, max: 100 },
    professionalism_score: { type: Number, default: 80, min: 0, max: 100 },

    audio_path: { type: String, trim: true },
    video_path: { type: String, trim: true },

    additional_metrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    session_id: { type: String, trim: true },
    user_agent: { type: String, trim: true },
    ip_address: { type: String, trim: true },

    recorded_at: { type: Date, default: Date.now },
    analyzed_at: { type: Date },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

const ContentAnalysisSchema = new Schema(
  {
    keywordRelevance: { type: Number, default: 0, min: 0, max: 100 },
    wordCount: { type: Number, default: 0, min: 0 },
    sentenceCount: { type: Number, default: 0, min: 0 },
    avgWordsPerSentence: { type: Number, default: 0, min: 0 },
    vocabularyDiversity: { type: Number, default: 0, min: 0, max: 100 },
    starMethodScore: { type: Number, default: 0, min: 0, max: 100 },
    professionalTerminologyScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    sentimentScore: { type: Number, default: 50, min: 0, max: 100 },
    coherenceScore: { type: Number, default: 0, min: 0, max: 100 },
    overallContentScore: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false },
);

const VoiceAnalysisSchema = new Schema(
  {
    energy_db: { type: Number, default: -30 },
    spectral_centroid_mean: { type: Number, default: 2000 },
    spectral_centroid_std: { type: Number, default: 500 },
    spectral_rolloff_mean: { type: Number, default: 4000 },
    zcr_mean: { type: Number, default: 0.08 },
    zcr_std: { type: Number, default: 0.02 },
    pitch_mean: { type: Number, default: 150 },
    pitch_std: { type: Number, default: 30 },
    tempo: { type: Number, default: 120 },
    pause_ratio: { type: Number, default: 0.2 },
    voice_activity: { type: Number, default: 0.8 },

    clarity: { type: Number, default: 75, min: 0, max: 100 },
    pace: { type: Number, default: 75, min: 0, max: 100 },
    volume: { type: Number, default: 75, min: 0, max: 100 },
    confidence: { type: Number, default: 75, min: 0, max: 100 },
    overallVoiceScore: { type: Number, default: 75, min: 0, max: 100 },
    deliveryScore: { type: Number, default: 75, min: 0, max: 100 },
  },
  { _id: false },
);

const FacialAnalysisSchema = new Schema(
  {
    eyeContact: { type: Number, default: 70, min: 0, max: 100 },
    engagement: { type: Number, default: 70, min: 0, max: 100 },
    professionalism: { type: Number, default: 80, min: 0, max: 100 },
    confidence: { type: Number, default: 75, min: 0, max: 100 },
    overallFacialScore: { type: Number, default: 75, min: 0, max: 100 },
    engagementScore: { type: Number, default: 70, min: 0, max: 100 },

    headStability: { type: Number, default: 75, min: 0, max: 100 },
    postureScore: { type: Number, default: 75, min: 0, max: 100 },
    gestureIntensity: { type: Number, default: 50, min: 0, max: 100 },
  },
  { _id: false },
);

const CategoryScoresSchema = new Schema(
  {
    content: { type: Number, default: 0, min: 0, max: 100 },
    delivery: { type: Number, default: 75, min: 0, max: 100 },
    engagement: { type: Number, default: 70, min: 0, max: 100 },
    professionalism: { type: Number, default: 80, min: 0, max: 100 },
  },
  { _id: false },
);

const ComprehensiveFeedbackSchema = new Schema(
  {
    overallScore: { type: Number, default: 0, min: 0, max: 100 },
    categoryScores: { type: CategoryScoresSchema, default: () => ({}) },

    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    nextSteps: { type: [String], default: [] },

    feedback: { type: String, default: "", maxlength: 4000 },

    status: {
      type: String,
      enum: ["correct", "partially-correct", "incorrect", "unknown"],
      default: "unknown",
    },
    competencies: {
      type: new Schema(
        {
          technical: { type: Number, min: 0, max: 100, default: 0 },
          clarity: { type: Number, min: 0, max: 100, default: 0 },
          confidence: { type: Number, min: 0, max: 100, default: 0 },
          conciseness: { type: Number, min: 0, max: 100, default: 0 },
          engagement: { type: Number, min: 0, max: 100, default: 0 },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    followUp: { type: String, default: "" },
  },
  { _id: false },
);

const InterviewResultSchema = new Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 1000 },
    transcription: { type: String, default: "", trim: true, maxlength: 20000 },

    keywords: { type: [String], default: [] },
    questiontype: {
      type: String,
      default: "general",
      index: true,
    },

    sessionduration: { type: Number, default: 0, min: 0, max: 1200000 },

    jdId: {
      type: Schema.Types.ObjectId,
      ref: "JDHistory",
      default: null,
      index: true,
    },
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "QuestionBank",
      default: null,
      index: true,
    },

    role: { type: String, trim: true, default: "" },
    difficulty: { type: String, trim: true, default: "medium" },
    skills: { type: [String], default: [] },

    contentanalysis: { type: ContentAnalysisSchema, default: {} },
    voiceanalysis: { type: VoiceAnalysisSchema, default: {} },
    facialanalysis: { type: FacialAnalysisSchema, default: {} },
    comprehensivefeedback: { type: ComprehensiveFeedbackSchema, default: {} },

    llmevaluation: {
      overallScore: { type: Number, min: 0, max: 100 },
      strengths: [{ type: String }],
      improvements: [{ type: String }],
      feedback: { type: String, default: "" },
    },

    overallscore: { type: Number, default: 0, min: 0, max: 100, index: true },
    contentscore: { type: Number, default: 0, min: 0, max: 100 },
    deliveryscore: { type: Number, default: 75, min: 0, max: 100 },
    engagementscore: { type: Number, default: 70, min: 0, max: 100 },
    professionalismscore: { type: Number, default: 80, min: 0, max: 100 },

    audiopath: { type: String, trim: true, default: "" },
    videopath: { type: String, trim: true, default: "" },
    additionalmetrics: { type: Schema.Types.Mixed, default: null },
    sessionid: { type: String, trim: true, default: "", index: true },

    recordedat: { type: Date, default: Date.now, index: true },
    analyzedat: { type: Date, default: Date.now },
    updatedat: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false },
);

InterviewResultSchema.pre("save", function (next) {
  this.updatedat = new Date();
  next();
});

EnhancedInterviewResultSchema.index({ recorded_at: -1 });
EnhancedInterviewResultSchema.index({ question_type: 1, recorded_at: -1 });
EnhancedInterviewResultSchema.index({ overall_score: -1 });
EnhancedInterviewResultSchema.index({ session_id: 1 });
EnhancedInterviewResultSchema.index({
  "comprehensive_feedback.overallScore": -1,
});
EnhancedInterviewResultSchema.index({ jdId: 1 });
EnhancedInterviewResultSchema.index({ questionId: 1 });
EnhancedInterviewResultSchema.index({ role: 1 });
EnhancedInterviewResultSchema.index({ difficulty: 1 });
EnhancedInterviewResultSchema.index({ skills: 1 });

EnhancedInterviewResultSchema.pre("save", function (next) {
  this.updated_at = new Date();

  if (this.comprehensive_feedback && this.comprehensive_feedback.overallScore) {
    this.overall_score = this.comprehensive_feedback.overallScore;
  }

  if (this.overall_score) {
    this.final_score = this.overall_score;
  }

  if (
    !this.analyzed_at &&
    (this.content_analysis || this.comprehensive_feedback)
  ) {
    this.analyzed_at = new Date();
  }

  next();
});

EnhancedInterviewResultSchema.virtual("performance_level").get(function () {
  const score = this.overall_score || 0;
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 55) return "Fair";
  return "Needs Improvement";
});

EnhancedInterviewResultSchema.virtual("performance_color").get(function () {
  const score = this.overall_score || 0;
  if (score >= 85) return "#27ae60";
  if (score >= 70) return "#f39c12";
  if (score >= 55) return "#e67e22";
  return "#e74c3c";
});

EnhancedInterviewResultSchema.methods.getAnalysisSummary = function () {
  return {
    overall_score: this.overall_score,
    performance_level: this.performance_level,
    strengths_count: this.comprehensive_feedback?.strengths?.length || 0,
    improvements_count: this.comprehensive_feedback?.improvements?.length || 0,
    recommendations_count:
      this.comprehensive_feedback?.recommendations?.length || 0,
    question_type: this.question_type,
    word_count: this.content_analysis?.wordCount || 0,
    duration_minutes: Math.round((this.session_duration || 0) / 60000),
    analyzed_at: this.analyzed_at,
    recorded_at: this.recorded_at,
  };
};

EnhancedInterviewResultSchema.statics.getPerformanceStats = function (
  conditions = {},
) {
  return this.aggregate([
    { $match: conditions },
    {
      $group: {
        _id: null,
        totalInterviews: { $sum: 1 },
        avgScore: { $avg: "$overall_score" },
        maxScore: { $max: "$overall_score" },
        minScore: { $min: "$overall_score" },
        excellentCount: {
          $sum: { $cond: [{ $gte: ["$overall_score", 85] }, 1, 0] },
        },
        goodCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$overall_score", 70] },
                  { $lt: ["$overall_score", 85] },
                ],
              },
              1,
              0,
            ],
          },
        },
        fairCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ["$overall_score", 55] },
                  { $lt: ["$overall_score", 70] },
                ],
              },
              1,
              0,
            ],
          },
        },
        needsImprovementCount: {
          $sum: { $cond: [{ $lt: ["$overall_score", 55] }, 1, 0] },
        },
      },
    },
  ]);
};

EnhancedInterviewResultSchema.statics.getTrendingFeedback = function (
  conditions = {},
  limit = 10,
) {
  return this.aggregate([
    { $match: conditions },
    { $unwind: "$comprehensive_feedback.strengths" },
    {
      $group: {
        _id: "$comprehensive_feedback.strengths",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);
};

EnhancedInterviewResultSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.ip_address;
    delete ret.audio_path;
    delete ret.video_path;
    return ret;
  },
});

EnhancedInterviewResultSchema.set("toObject", { virtuals: true });

EnhancedInterviewResultSchema.statics.getStatsByRole = function () {
  return this.aggregate([
    {
      $group: {
        _id: "$role",
        avgScore: { $avg: "$overall_score" },
        stdDev: { $stdDevPop: "$overall_score" },
        count: { $sum: 1 },
      },
    },
    { $sort: { avgScore: -1 } },
  ]);
};

EnhancedInterviewResultSchema.statics.getStatsByDifficulty = function () {
  return this.aggregate([
    {
      $group: {
        _id: "$difficulty",
        avgScore: { $avg: "$overall_score" },
        stdDev: { $stdDevPop: "$overall_score" },
        count: { $sum: 1 },
      },
    },
  ]);
};

EnhancedInterviewResultSchema.statics.getSkillGapAnalysis = function () {
  return this.aggregate([
    { $unwind: "$skills" },
    {
      $group: {
        _id: "$skills",
        avgScore: { $avg: "$overall_score" },
        count: { $sum: 1 },
      },
    },
    { $sort: { avgScore: 1 } },
    { $limit: 10 },
  ]);
};

EnhancedInterviewResultSchema.statics.getDatasetDescription = function () {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        avgScore: { $avg: "$overall_score" },
        minDate: { $min: "$recorded_at" },
        maxDate: { $max: "$recorded_at" },
      },
    },
  ]);
};

module.exports =
  mongoose.models.InterviewResult ||
  mongoose.model("InterviewResult", InterviewResultSchema);

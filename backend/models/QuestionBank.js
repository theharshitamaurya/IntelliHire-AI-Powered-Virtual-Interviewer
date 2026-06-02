const mongoose = require("mongoose");

const QuestionBankSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true, trim: true, maxlength: 1000 },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    relatedSkills: [String],
    difficulty: { type: String, enum: ["easy", "medium", "hard"] },

    source: { type: String, enum: ["jd", "practice", "manual"], default: "jd" },

    jdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JDHistory",
      required: false,
    },
    personaStyle: { type: String, trim: true, default: "general" },

    question: { type: String, trim: true, maxlength: 1000 },
    category: {
      type: String,
      enum: ["technical", "behavioral", "hr", "system_design", "general"],
      default: "general",
    },
    skills: [{ type: String, trim: true }],
    idealPoints: [{ type: String, trim: true }],
    source: {
      type: String,
      enum: ["manual", "generated"],
      default: "generated",
    },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

QuestionBankSchema.pre("validate", function (next) {
  if (!this.questionText && this.question) this.questionText = this.question;
  if (!this.question && this.questionText) this.question = this.questionText;

  if (
    (!this.relatedSkills || this.relatedSkills.length === 0) &&
    this.skills?.length
  )
    this.relatedSkills = this.skills;

  if ((!this.skills || this.skills.length === 0) && this.relatedSkills?.length)
    this.skills = this.relatedSkills;

  next();
});

QuestionBankSchema.index({ createdAt: -1 });
QuestionBankSchema.index({ difficulty: 1 });
QuestionBankSchema.index({ jdId: 1 });
QuestionBankSchema.index({ relatedSkills: 1 });

module.exports = mongoose.model("QuestionBank", QuestionBankSchema);

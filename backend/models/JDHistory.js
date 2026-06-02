const mongoose = require("mongoose");

const JDHistorySchema = new mongoose.Schema(
  {
    jobTitle: { type: String, required: true, trim: true, maxlength: 200 },
    company: { type: String, trim: true, maxlength: 200, default: "Unknown" },

    requiredSkills: [String],
    rawText: String,
    resumeText: String,
    experienceLevel: {
      type: String,
      enum: ["intern", "junior", "mid", "senior", "lead", "unspecified"],
      default: "unspecified",
    },

    role: { type: String, trim: true, maxlength: 200 },
    companyContext: { type: String, trim: true, maxlength: 500 },
    description: { type: String, trim: true, maxlength: 10000, default: "" },
    skills: [{ type: String, trim: true }],
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    source: {
      type: String,
      enum: ["manual", "generated", "uploaded"],
      default: "generated",
    },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

JDHistorySchema.pre("validate", function (next) {
  if (!this.jobTitle && this.role) this.jobTitle = this.role;
  if (!this.role && this.jobTitle) this.role = this.jobTitle;

  if (
    (!this.requiredSkills || this.requiredSkills.length === 0) &&
    this.skills?.length
  )
    this.requiredSkills = this.skills;

  if ((!this.skills || this.skills.length === 0) && this.requiredSkills?.length)
    this.skills = this.requiredSkills;

  next();
});

JDHistorySchema.index({ createdAt: -1 });
JDHistorySchema.index({ jobTitle: 1 });
JDHistorySchema.index({ requiredSkills: 1 });

module.exports = mongoose.model("JDHistory", JDHistorySchema);

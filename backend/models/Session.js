const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    jobDescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JDHistory",
      required: true,
      index: true,
    },

    mode: {
      type: String,
      enum: ["practice", "jd"],
      required: true,
    },

    questionIds: [
      {
        type: String,
        required: true,
      },
    ],

    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    metadata: {
      browserInfo: String,
      ipAddress: String,
      deviceType: String,
    },
  },
  {
    timestamps: true,
  },
);

sessionSchema.index({ sessionId: 1, status: 1 });
sessionSchema.index({ jobDescriptionId: 1, createdAt: -1 });

module.exports = mongoose.model("Session", sessionSchema);

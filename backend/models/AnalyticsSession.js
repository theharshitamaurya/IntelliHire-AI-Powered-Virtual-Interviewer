const mongoose = require("mongoose");

const AnalyticsSessionSchema = new mongoose.Schema(
  {
    deviceId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    startedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    eventCount: { type: Number, default: 0 },
  },
  { versionKey: false },
);

AnalyticsSessionSchema.index({ deviceId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model("AnalyticsSession", AnalyticsSessionSchema);

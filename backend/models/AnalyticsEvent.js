const mongoose = require("mongoose");

const AnalyticsEventSchema = new mongoose.Schema(
  {
    deviceId: { type: String, index: true, required: true },
    sessionId: { type: String, index: true, required: true },
    name: { type: String, required: true },
    ts: { type: Date, required: true },
    props: { type: mongoose.Schema.Types.Mixed },
    url: String,
    ref: String,
  },
  { timestamps: true, versionKey: false },
);

AnalyticsEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AnalyticsEvent", AnalyticsEventSchema);

const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");

const AnalyticsEvent = require("../models/AnalyticsEvent");
const AnalyticsSession = require("../models/AnalyticsSession");

function isValidBatch(body) {
  if (!body || typeof body !== "object") return false;
  if (typeof body.deviceId !== "string" || typeof body.sessionId !== "string")
    return false;
  if (!Array.isArray(body.events)) return false;
  if (body.events.length > 2000) return false;
  return true;
}

router.post("/batch", async (req, res, next) => {
  try {
    if (!isValidBatch(req.body))
      return res.status(400).json({ ok: false, error: "Invalid payload" });

    const { deviceId, sessionId, events } = req.body;

    const docs = events.map((e) => ({
      deviceId,
      sessionId,
      name: String(e.name ?? "unknown"),
      ts: new Date(e.ts ?? Date.now()),
      props: e.props ?? {},
      url: e.url ?? null,
      ref: e.ref ?? null,
    }));

    if (!docs.length) return res.json({ ok: true, inserted: 0 });

    await AnalyticsEvent.insertMany(docs, { ordered: false });

    await AnalyticsSession.updateOne(
      { deviceId, sessionId },
      {
        $set: { lastSeenAt: new Date() },
        $inc: { eventCount: docs.length },
        $setOnInsert: { startedAt: new Date() },
      },
      { upsert: true },
    );

    res.json({ ok: true, inserted: docs.length });
  } catch (err) {
    next(err);
  }
});

router.get("/compare/:sessionId", analyticsController.compareSession);
router.get("/percentile/:sessionId", analyticsController.getPercentile);
router.get("/trend/:userId", analyticsController.getUserTrend);

module.exports = router;

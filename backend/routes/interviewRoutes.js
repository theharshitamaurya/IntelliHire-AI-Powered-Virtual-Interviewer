const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");

const {
  createResult,
  getAllResults,
  getAnalytics,
  getResearchStatistics,
  getIEEESummary,
  deleteResults,
} = require("../controllers/interviewController");

const {
  validateSession,
  createSession,
  completeSession,
} = require("../middleware/sessionValidator");

router.post("/sessions", createSession);
router.put("/sessions/:sessionId/complete", completeSession);

router.post("/", upload.fields([{ name: "audio", maxCount: 1 }, { name: "video", maxCount: 1 }]), validateSession, createResult);

router.get("/", getAllResults);
router.delete("/", deleteResults);
router.get("/analytics", getAnalytics);
router.get("/research-statistics", getResearchStatistics);
router.get("/ieee-summary", getIEEESummary);

module.exports = router;




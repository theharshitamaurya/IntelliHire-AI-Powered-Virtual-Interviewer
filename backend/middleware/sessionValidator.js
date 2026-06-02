const Session = require("../models/Session");
const JDHistory = require("../models/JDHistory");

async function validateSession(req, res, next) {
  try {
    const { sessionId, questionId, source } = req.body;

    if (source === "live" || source === "practice") {
      return next();
    }

    if (source === "jd" && (!sessionId || !questionId)) {
      return next();
    }

    if (!sessionId) {
      return res.status(400).json({
        error: "Missing sessionId",
        message: "All interview submissions must be linked to a valid session",
      });
    }

    if (!questionId) {
      return res.status(400).json({
        error: "Missing questionId",
        message: "Question ID is required for session validation",
      });
    }

    const session = await Session.findOne({
      sessionId,
      status: "active",
    }).populate("jobDescriptionId");

    if (!session) {
      return res.status(404).json({
        error: "Session not found",
        message: "Invalid or expired session ID",
      });
    }

    if (!session.questionIds.includes(questionId)) {
      return res.status(400).json({
        error: "Invalid question",
        message: "Question ID does not belong to this session",
      });
    }

    req.session = session;
    req.jobDescription = session.jobDescriptionId;

    console.log(
      `[SessionValidator] Valid session ${sessionId} for JD ${session.jobDescriptionId?.title || ""}`,
    );

    return next();
  } catch (error) {
    console.error("[SessionValidator] Error:", error);
    return res.status(500).json({ error: "Session validation failed" });
  }
}

async function createSession(req, res) {
  try {
    const { jobDescriptionId, mode = "practice", questionIds } = req.body;

    const jd = await JDHistory.findById(jobDescriptionId);

    if (!jd) {
      return res.status(404).json({ error: "Job description not found" });
    }

    if (!questionIds || questionIds.length === 0) {
      return res.status(400).json({
        error: "Question IDs required",
        message: "Session must include at least one question",
      });
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session = new Session({
      sessionId,
      jobDescriptionId,
      mode,
      questionIds,
      userId: req.user ? req.user.id : null,
      metadata: {
        browserInfo: req.headers["user-agent"],
        ipAddress: req.ip,
        deviceType: req.body.deviceType || "unknown",
      },
    });

    await session.save();

    return res.status(201).json({
      message: "Session created",
      sessionId: session.sessionId,
      jobDescription: {
        id: jd.id,
        title: jd.title,
        company: jd.company,
      },
      questionCount: questionIds.length,
      expiresIn: "24 hours",
    });
  } catch (error) {
    console.error("[SessionValidator] Create session error:", error);
    return res.status(500).json({ error: "Failed to create session" });
  }
}

async function completeSession(req, res) {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOneAndUpdate(
      { sessionId, status: "active" },
      { status: "completed", completedAt: new Date() },
      { new: true },
    );

    if (!session) {
      return res.status(404).json({ error: "Active session not found" });
    }

    return res.json({
      message: "Session completed",
      sessionId: session.sessionId,
      duration: session.completedAt - session.startedAt,
    });
  } catch (error) {
    console.error("[SessionValidator] Complete session error:", error);
    return res.status(500).json({ error: "Failed to complete session" });
  }
}

module.exports = {
  validateSession,
  createSession,
  completeSession,
};

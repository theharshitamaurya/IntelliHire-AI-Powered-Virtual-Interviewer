import config from "../config";

class APIService {
  constructor() {
    this.baseURL = config.API_BASE_URL;
    this.timeout = config.API_TIMEOUT ?? 30000;
  }

  async evaluatePracticeAnswer(question, answer, persona = "technical") {
    return this.request("questions/evaluate-practice", {
      method: "POST",
      body: JSON.stringify({ question, answer, persona }),
    });
  }

  async generateJDFromText(jdText, resumeText) {
    return this.request("jds/generate", {
      method: "POST",
      body: JSON.stringify({ jdText, resumeText }),
    });
  }

  async generateJD(jdText, resumeText) {
    return this.request("jds/generate", {
      method: "POST",
      body: JSON.stringify({ jdText, resumeText }),
    });
  }

  async generatePracticeQuestions(topic, count = 3, persona = "technical") {
    return this.request("/questions/generate-practice", {
      method: "POST",
      body: JSON.stringify({ topic, count, persona }),
    });
  }

  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const isAbsolute = /^https?:\/\//i.test(String(endpoint || ""));
      const base = String(this.baseURL || "").replace(/\/+$/, "");
      const path = String(endpoint || "").replace(/^\/+/, "");

      if (!isAbsolute && !base) {
        throw new Error("API baseURL is missing. Check frontend config/env.");
      }

      const url = isAbsolute ? String(endpoint) : `${base}/${path}`;

      const isFormData =
        typeof FormData !== "undefined" && options?.body instanceof FormData;

      const headers = { ...(options.headers || {}) };

      if (!isFormData) {
        if (!headers["Content-Type"] && !headers["content-type"]) {
          headers["Content-Type"] = "application/json";
        }
      } else {
        delete headers["Content-Type"];
        delete headers["content-type"];
      }

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const errJson = await response.json();
          message =
            errJson?.error || errJson?.message || errJson?.details || message;
        } catch {
          try {
            const errText = await response.text();
            if (errText) message = errText;
          } catch {}
        }
        throw new Error(message);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json"))
        return await response.json();
      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error?.name === "AbortError") throw new Error("Request timeout");
      throw error;
    }
  }

  async checkHealth() {
    return this.request("/health");
  }

  async createJD(jdPayload) {
    return this.request("/jds", {
      method: "POST",
      body: JSON.stringify(jdPayload),
    });
  }

  async createQuestion(questionPayload) {
    return this.request("/questions", {
      method: "POST",
      body: JSON.stringify(questionPayload),
    });
  }

  async getAllJDs() {
    return this.request("/jds");
  }

  async getAllQuestions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/questions${queryString ? "?" + queryString : ""}`;
    return this.request(endpoint);
  }

  async deleteAllJDs() {
    return this.request("/jds", { method: "DELETE" });
  }

  async deleteAllQuestions() {
    return this.request("/questions", { method: "DELETE" });
  }

  async createSession(sessionPayload) {
    return this.request("/interviews/sessions", {
      method: "POST",
      body: JSON.stringify(sessionPayload),
    });
  }

  async completeSession(sessionId) {
    return this.request(
      `/interviews/sessions/${encodeURIComponent(sessionId)}/complete`,
      {
        method: "PUT",
      },
    );
  }

  async bootstrapPracticeSession(questionText) {
    const jd = await this.createJD({
      jobTitle: "Practice Mode",
      company: "Self-Practice",
      requiredSkills: ["general"],
      experienceLevel: "unspecified",
      source: "manual",
      description: "Practice session for standalone question practice",
    });

    const q = await this.createQuestion({
      questionText: String(questionText || "Tell me about yourself"),
      difficulty: "medium",
      relatedSkills: ["general"],
      jdId: jd._id,
      category: "general",
      source: "manual",
    });

    const session = await this.createSession({
      jobDescriptionId: jd._id,
      mode: "practice",
      questionIds: [q._id],
    });

    return { sessionId: session.sessionId, questionId: q._id, jdId: jd._id };
  }

  async createInterviewResult(data) {
    const formData = new FormData();

    formData.append("question", data.question || "");
    formData.append("transcription", data.transcription || "");
    formData.append("keywords", JSON.stringify(data.keywords || []));

    formData.append(
      "questiontype",
      data.questiontype || data.questionType || "general",
    );

    formData.append(
      "sessionduration",
      String(data.sessionduration ?? data.sessionDuration ?? 0),
    );

    if (data.sessionId) formData.append("sessionId", String(data.sessionId));
    if (data.questionId) formData.append("questionId", String(data.questionId));

    if (data.useLLM === true) {
      formData.append("useLLM", "true");
    }

    if (data.jobDescription) {
      formData.append("jobDescription", JSON.stringify(data.jobDescription));
    }

    formData.append("source", data.source || "live");

    const teacherScore = data?.teacherEvaluation?.score;
    if (typeof teacherScore === "number" && Number.isFinite(teacherScore)) {
      formData.append("overallscore", String(teacherScore));
    }

    formData.append(
      "additionalmetrics",
      JSON.stringify({
        source: data.source,
        persona: data.persona,
        teacherEvaluation: data.teacherEvaluation,
        mlMetrics: data.mlMetrics,
        videoFeedback: data.videoFeedback,
        clientTimestamp: data.clientTimestamp,
      }),
    );

    if (data.audioBlob) formData.append("audio", data.audioBlob, "audio.webm");
    if (data.videoBlob) formData.append("video", data.videoBlob, "video.webm");

    return this.request("interviews", { method: "POST", body: formData });
  }

  async submitInterviewWithLLM(interviewData) {
    let ensured = { ...interviewData };

    if (!ensured.sessionId || !ensured.questionId) {
      const boot = await this.bootstrapPracticeSession(ensured.question);
      ensured = {
        ...ensured,
        sessionId: boot.sessionId,
        questionId: boot.questionId,
        jdId: ensured.jdId || boot.jdId,
      };
    }

    return this.createInterviewResult({
      ...ensured,
      useLLM: true,
    });
  }

  async getAllInterviews(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/interviews${queryString ? "?" + queryString : ""}`;
    return this.request(endpoint);
  }

  async deleteAllInterviews(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/interviews${queryString ? "?" + queryString : ""}`;
    return this.request(endpoint, { method: "DELETE" });
  }

  async getAnalytics(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/interviews/analytics${
      queryString ? "?" + queryString : ""
    }`;
    return this.request(endpoint);
  }

  async getIEEESummary() {
    return this.request(`/interviews/ieee-summary`);
  }

  async getSessionComparison(sessionId) {
    return this.request(`/analytics/compare/${encodeURIComponent(sessionId)}`);
  }

  async getPercentile(sessionId) {
    return this.request(
      `/analytics/percentile/${encodeURIComponent(sessionId)}`,
    );
  }

  async getTrend(userId) {
    return this.request(`/analytics/trend/${encodeURIComponent(userId)}`);
  }
}

export default new APIService();



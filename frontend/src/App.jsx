import React, { useState, useEffect } from "react";
import { Layout } from "./components/layout/Layout";
import APIService from "./services/api";
import { AppTab } from "./constants/tabs";

import { PracticeMode } from "./components/practice/PracticeMode";
import { JDMode } from "./components/jd/JDMode";
import { LiveSetup } from "./components/live/LiveSetup";
import { LiveSession } from "./components/live/LiveSession";
import { Analytics } from "./components/analytics/Analytics";
import {
  installAutoFlush,
  track as trackEvent,
  flush,
} from "./lib/analyticsClient";

import {
  Brain,
  Zap,
  ArrowRight,
  Target,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";

const App = () => {
  const analyticsBatchEndpoint = (() => {
    const base = String(APIService?.baseURL || "").replace(/\/+$/, "");
    return `${base}/analytics/batch`;
  })();

  const [activeTab, setActiveTab] = useState(AppTab.Home);
  const [interviewResults, setInterviewResults] = useState([]);
  const [jdHistory, setJdHistory] = useState([]);
  const [questionHistory, setQuestionHistory] = useState([]);
  const [liveStage, setLiveStage] = useState("setup");
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [livePersona, setLivePersona] = useState("technical");
  const startLiveSession = ({ questions, persona }) => {
    setSessionQuestions(questions);
    setLivePersona(persona);
    setLiveStage("session");
    setActiveTab(AppTab.Interview);
  };

  const stopLiveSession = () => {
    setLiveStage("setup");
    setSessionQuestions([]);
  };
  const onSearch = (query, resultsCount) => {
    trackEvent("search", { query, resultsCount });
  };

  const onClickResult = (docId, rank) => {
    trackEvent("click_result", { docId, rank });
  };

  const [interviewFlow, setInterviewFlow] = useState({
    mode: null,
    stage: "idle",
    persona: "technical",
    questions: [],
  });

  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;

    (async () => {
      try {
        await APIService.checkHealth();
        if (cancelled) return;
        cleanup = installAutoFlush({
          endpoint: analyticsBatchEndpoint,
        });
        trackEvent("app_loaded");
      } catch {}
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [analyticsBatchEndpoint]);

  const isGoodNum = (v) => typeof v === "number" && Number.isFinite(v);

  const pickNum = (mongoVal, localVal) => {
    if (isGoodNum(mongoVal) && mongoVal !== 0) return mongoVal;
    if (isGoodNum(localVal) && localVal !== 0) return localVal;
    if (isGoodNum(mongoVal)) return mongoVal;
    if (isGoodNum(localVal)) return localVal;
    return 0;
  };

  const getId = (x) => String(x?._id ?? x?.id ?? "");

  const mergeById = (localArr, mongoArr) => {
    const localMap = new Map((localArr || []).map((x) => [getId(x), x]));
    const mongoIds = new Set((mongoArr || []).map((x) => getId(x)));

    const merged = (mongoArr || []).map((m) => {
      const l = localMap.get(getId(m));
      if (!l) return m;

      return {
        ...m,
        overallScore: pickNum(m.overallScore, l.overallScore),
        confidence: pickNum(m.confidence, l.confidence),
        clarity: pickNum(m.clarity, l.clarity),
        engagement: pickNum(m.engagement, l.engagement),
        teacherFeedback: (m.teacherFeedback || "").trim()
          ? m.teacherFeedback
          : l.teacherFeedback || "",
        status:
          m.status && m.status !== "unknown" ? m.status : l.status || "unknown",
        competencies: m.competencies ?? l.competencies ?? null,
        source: m.source ?? l.source ?? "unknown",
        timestamp: m.timestamp ?? l.timestamp ?? Date.now(),
      };
    });

    return merged;
  };

  const normalizeJDs = (rows) =>
    (Array.isArray(rows) ? rows : []).map((jd) => ({
      ...jd,
      id: jd?.id ?? jd?._id,
      role: jd?.role ?? jd?.jobTitle ?? "Role",
      skills: jd?.skills ?? jd?.requiredSkills ?? [],
      timestamp: jd?.timestamp ? new Date(jd.timestamp).getTime() : Date.now(),
    }));

  const normalizeQuestions = (rows) =>
    (Array.isArray(rows) ? rows : []).map((q) => ({
      ...q,
      id: q?.id ?? q?._id,
      question: q?.question ?? q?.questionText ?? "",
      jdId: q?.jdId ?? null,
      source: q?.personaStyle ?? q?.source ?? (q?.jdId ? "jd" : "generated"),
      difficulty: q?.difficulty ?? "medium",
      timestamp: q?.timestamp ? new Date(q.timestamp).getTime() : Date.now(),
    }));

  const refreshArchiveFromBackend = async () => {
    try {
      const [jdsResp, questionsResp] = await Promise.all([
        APIService.getAllJDs(),
        APIService.getAllQuestions(),
      ]);
      setJdHistory(normalizeJDs(jdsResp));
      setQuestionHistory(normalizeQuestions(questionsResp));
    } catch (e) {
      console.error("[Archive refetch]", e.message);
    }
  };

  useEffect(() => {
    if (activeTab !== AppTab.Analytics && activeTab !== AppTab.Home) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
                const pageSize = 200;
        const fetched = [];
        let skip = 0;

        while (true) {
          const resp = await APIService.getAllInterviews({
            limit: pageSize,
            skip,
            sortby: "recordedat",
            order: "desc",
          });

          const page = Array.isArray(resp?.results) ? resp.results : [];
          if (!page.length) break;

          fetched.push(...page);

          const hasMore = Boolean(resp?.summary?.hasmore);
          if (!hasMore || page.length < pageSize) break;
          skip += pageSize;
        }

        const results = fetched;
        if (cancelled || !results.length) {
          if (!cancelled) setInterviewResults([]);
          return;
        }

        const toNum = (v, fallback = 0) => {
          const n = typeof v === "number" ? v : Number(v);
          return Number.isFinite(n) ? n : fallback;
        };
        const toMaybeNum = (v) => {
          const n = typeof v === "number" ? v : Number(v);
          return Number.isFinite(n) ? n : null;
        };
        const pickText = (...vals) => {
          for (const v of vals)
            if (typeof v === "string" && v.trim()) return v.trim();
          return "";
        };
        const parseAdd = (raw) => {
          if (!raw) return null;
          if (typeof raw === "object") return raw;
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        };

        const mapped = results.map((r) => {
          const add = parseAdd(r?.additionalMetrics ?? r?.additionalmetrics);
          const ml =
            add?.mlMetrics && typeof add.mlMetrics === "object"
              ? add.mlMetrics
              : null;
          const te =
            add?.teacherEvaluation && typeof add.teacherEvaluation === "object"
              ? add.teacherEvaluation
              : null;
          const llm =
            r?.llmevaluation && typeof r.llmevaluation === "object"
              ? r.llmevaluation
              : null;
          const averageMetrics = (...values) => {
            const nums = values.filter(
              (value) =>
                typeof value === "number" && Number.isFinite(value),
            );
            if (!nums.length) return null;
            return nums.reduce((sum, value) => sum + value, 0) / nums.length;
          };
          const readCompMetric = (key) => {
            const toMetric = (v) => {
              const n = typeof v === "number" ? v : Number(v);
              return Number.isFinite(n) ? n : null;
            };
            const fromTe =
              te?.competencies && typeof te.competencies === "object"
                ? toMetric(te.competencies[key])
                : null;
            if (fromTe !== null) return fromTe;

            const fromLlm =
              llm?.competencies && typeof llm.competencies === "object"
                ? toMetric(llm.competencies[key])
                : null;
            if (fromLlm !== null) return fromLlm;

            const fromComprehensive =
              r?.comprehensivefeedback?.competencies &&
              typeof r.comprehensivefeedback.competencies === "object"
                ? toMetric(r.comprehensivefeedback.competencies[key])
                : null;
            return fromComprehensive;
          };
          const ts =
            typeof r?.timestamp === "number"
              ? r.timestamp
              : r?.recordedat
                ? new Date(r.recordedat).getTime()
                : Date.now();
          const sourceRaw = String(r?.source ?? add?.source ?? "unknown")
            .trim()
            .toLowerCase();
          const source =
            sourceRaw === "jd" ||
            sourceRaw === "practice" ||
            sourceRaw === "live"
              ? sourceRaw
              : "live";

          const overallScore = toNum(
            r?.overallScore ??
              r?.overallscore ??
              te?.score ??
              r?.finalscore ??
              r?.comprehensivefeedback?.overallScore ??
              r?.llmevaluation?.overallScore ??
              ml?.overall ??
              0,
          );
          const confidence = toMaybeNum(
            r?.confidence ??
              ml?.confidence ??
              readCompMetric("confidence") ??
              r?.voiceanalysis?.confidence ??
              r?.voiceanalysis?.overallVoiceScore,
          );
          const clarity = toMaybeNum(
            r?.clarity ??
              ml?.clarity ??
              readCompMetric("clarity") ??
              r?.voiceanalysis?.clarity,
          );
          const facialEngagement = toMaybeNum(
            r?.facialanalysis?.engagement ??
              r?.facialanalysis?.engagementScore,
          );
          const llmEngagement = toMaybeNum(readCompMetric("engagement"));
          const engagement = toMaybeNum(
            r?.engagement ??
              ml?.engagement ??
              (source === "live" || source === "jd"
                ? averageMetrics(facialEngagement, llmEngagement)
                : llmEngagement ?? facialEngagement),
          );
          const teacherFeedback = pickText(
            r?.teacherFeedback,
            te?.feedback,
            r?.llmevaluation?.feedback,
            r?.comprehensivefeedback?.feedback,
            typeof r?.comprehensivefeedback?.recommendations === "string"
              ? r.comprehensivefeedback.recommendations
              : Array.isArray(r?.comprehensivefeedback?.recommendations)
                ? r.comprehensivefeedback.recommendations.join(" ")
                : "",
          );
          const status =
            r?.status ??
            te?.status ??
            r?.comprehensivefeedback?.status ??
            "unknown";
          const competencies =
            r?.competencies ??
            te?.competencies ??
            llm?.competencies ??
            r?.comprehensivefeedback?.competencies ??
            null;
          return {
            ...r,
            timestamp: ts,
            source,
            overallScore,
            confidence,
            clarity,
            engagement,
            teacherFeedback,
            status,
            competencies,
          };
        });

        if (!cancelled) setInterviewResults(mapped);
      } catch (e) {
        console.error("[MongoDB refetch]", e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    refreshArchiveFromBackend();
  }, [analyticsBatchEndpoint]);

  useEffect(() => {
    if (activeTab === AppTab.Interview && interviewFlow.stage === "idle") {
      setInterviewFlow((prev) => ({
        ...prev,
        mode: prev.mode ?? "live",
        stage: "setup",
        persona: prev.persona ?? "technical",
        questions: prev.mode === "jd" ? prev.questions : [],
      }));
    }
  }, [activeTab, interviewFlow.stage]);

  const saveResult = async (result) => {
    const payload = {
      question: result.question,
      transcription: result.transcription || "",
      keywords: result.keywords || [],
      questionType: result.questiontype ?? result.questionType ?? "general",
      sessionDuration: result.sessionduration ?? result.sessionDuration ?? 0,
      source: result.source,
      persona: result.persona,
      sessionId: result.sessionId ?? result.sessionid ?? null,
      questionId: result.questionId ?? null,
      teacherEvaluation: {
        score: result.groqScore ?? result.overallScore ?? null,
        feedback: result.groqFeedback ?? result.teacherFeedback ?? null,
        competencies: result.competencies ?? null,
        status: result.status ?? null,
        followUpQuestion: result.followUpQuestion ?? null,
      },
      mlMetrics: result.mlMetrics,
      videoFeedback: result.videoFeedback,
      audioBlob: result.audioBlob ?? null,
      videoBlob: result.videoBlob ?? null,
      useLLM:
        (result.source === "live" || result.source === "jd") &&
        Boolean(result.transcription?.trim()),
      clientTimestamp: result.timestamp,
    };

    const optimisticEntry = {
      id:
        result.id ??
        `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: result.timestamp ?? Date.now(),
      question: result.question ?? "",
      transcription: result.transcription ?? "",
      source: result.source ?? "live",
      persona: result.persona,
      overallScore: result.overallScore ?? result.groqScore ?? 0,
      overallscore: result.overallScore ?? result.groqScore ?? 0,
      teacherFeedback: result.teacherFeedback ?? result.groqFeedback ?? "",
      competencies: result.competencies ?? null,
      status: result.status ?? "unknown",
      confidence:
        result.mlMetrics?.confidence ?? result.competencies?.confidence ?? null,
      clarity: result.mlMetrics?.clarity ?? result.competencies?.clarity ?? null,
      engagement:
        result.mlMetrics?.engagement ?? result.competencies?.engagement ?? null,
      additionalmetrics: {
        source: result.source,
        persona: result.persona,
        teacherEvaluation: payload.teacherEvaluation,
      },
      recordedat: new Date().toISOString(),
    };

    setInterviewResults((prev) => {
      return [...prev, optimisticEntry];
    });

    try {
      const resp = await APIService.createInterviewResult(payload);

      const savedDoc =
        resp?.data && typeof resp.data === "object" && resp.data.question
          ? {
              ...resp.data,
              analysisSummary:
                resp?.analysisSummary && typeof resp.analysisSummary === "object"
                  ? resp.analysisSummary
                  : resp.data.analysisSummary,
            }
          : resp && typeof resp === "object" && resp.question
            ? resp
            : null;

      if (savedDoc) {
        setInterviewResults((prev) => {
          const without = prev.filter((r) => r.id !== optimisticEntry.id);
          return [...without, savedDoc];
        });

        logQuestion({
          id: Math.random().toString(36).substring(7),
          timestamp: Date.now(),
          question: savedDoc.question,
          source: payload.source,
          difficulty: "adaptive",
        });
        try {
          trackEvent("interview_saved", {
            id: savedDoc?.id ?? savedDoc?._id,
            source: payload.source,
            questionType: payload.questionType,
          });
          flush({
            endpoint: analyticsBatchEndpoint,
          }).catch(() => {});
        } catch {}
        return savedDoc;
      }

      return optimisticEntry;
    } catch (err) {
      console.error(
        "[saveResult] Backend error (keeping optimistic entry):",
        err.message,
      );
      return optimisticEntry;
    }
  };

  const logJD = (jd) => {
    setJdHistory((prev) => {
      const incomingId = String(jd?.id ?? jd?._id ?? "");
      return incomingId
        ? [
            ...prev.filter((x) => String(x?.id ?? x?._id ?? "") !== incomingId),
            jd,
          ]
        : [...prev, jd];
    });
    refreshArchiveFromBackend();
  };

  const logQuestion = async (q) => {
    setQuestionHistory((prev) => {
      const exists = prev.some((item) => item.question === q.question);
      if (exists) return prev;
      return [...prev, q];
    });

    try {
      const text = String(q?.question || "").trim();
      if (!text) return;

      const source = ["generated", "manual"].includes(
        String(q?.source || "")
          .trim()
          .toLowerCase(),
      )
        ? String(q.source).trim().toLowerCase()
        : "generated";
      const difficulty = ["easy", "medium", "hard"].includes(q?.difficulty)
        ? q.difficulty
        : "medium";

      const payload = {
        questionText: text,
        difficulty,
        relatedSkills: Array.isArray(q?.skills) ? q.skills : ["general"],
        category: "general",
        source,
        personaStyle:
          String(q?.source || "")
            .trim()
            .toLowerCase() || "general",
      };

      const jdId = String(q?.jdId ?? "").trim();
      if (/^[a-fA-F0-9]{24}$/.test(jdId)) {
        payload.jdId = jdId;
      }

      await APIService.createQuestion(payload);
      await refreshArchiveFromBackend();
    } catch (err) {
      console.error("[Question save]", err.message);
    }
  };

  const startJDInterview = (qs) => {
    setSessionQuestions(qs);
    setActiveTab(AppTab.Interview);
  };
  const startJDSetup = ({ questions, persona = "technical" }) => {
    setInterviewFlow({
      mode: "jd",
      stage: "setup",
      persona,
      questions: (questions || []).slice(0, 5),
    });
    setActiveTab(AppTab.Interview);
  };
  const startLiveInterviewSetup = () => {
    setInterviewFlow({
      mode: "live",
      stage: "setup",
      persona: "technical",
      questions: [],
    });
    setActiveTab(AppTab.Interview);
  };

  const startInterviewSession = ({ questions, persona }) => {
    setInterviewFlow((prev) => ({
      ...prev,
      stage: "session",
      persona,
      questions,
    }));
    setActiveTab(AppTab.Interview);
  };

  const finishInterviewToAnalytics = () => {
    setInterviewFlow((prev) => ({ ...prev, stage: "analytics" }));
    setActiveTab(AppTab.Analytics);
  };

  const clearAllHistory = async () => {
    if (!window.confirm("Delete all behavioral and JD data from Analytics?")) {
      return;
    }

    try {
      await Promise.all([
        APIService.deleteAllInterviews(),
        APIService.deleteAllJDs(),
        APIService.deleteAllQuestions(),
      ]);
    } catch (err) {
      console.error("[clearAllHistory] Failed to clear backend data:", err);
      alert("Could not fully delete server data. Please retry.");
    }

    setInterviewResults([]);
    setJdHistory([]);
    setQuestionHistory([]);
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === AppTab.Home && (
        <div className="space-y-24 py-10 animate-in fade-in duration-1000">
          <section className="text-center space-y-12 max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-black uppercase tracking-[0.3em] mb-6">
              <Zap className="w-4 h-4" /> Groq LPU + AI Integration
            </div>
            <h1 className="text-7xl md:text-9xl font-black text-white leading-[0.9] tracking-tighter">
              Build <span className="text-indigo-500">Interview</span>{" "}
              Intuition.
            </h1>
            <p className="text-2xl text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium">
              A unified coaching platform that researchers company culture,
              generates adaptive challenges, and tracks your technical growth in
              real-time.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-8 pt-8">
              <button
                onClick={startLiveInterviewSetup}
                className="group px-12 py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2.5rem] font-black text-2xl shadow-2xl transition-all flex items-center justify-center gap-4 active:scale-95 shadow-indigo-500/30"
              >
                Launch Teacher Session
                <ArrowRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
              </button>
              <button
                onClick={() => setActiveTab(AppTab.Practice)}
                className="px-12 py-6 bg-slate-900 hover:bg-slate-800 text-white rounded-[2.5rem] font-black text-2xl transition-all border border-slate-800 flex items-center justify-center gap-4"
              >
                <Target className="w-6 h-6" />
                Practice Drill
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                label: "Evaluation Logs",
                count: interviewResults.length,
                color: "text-indigo-400",
                icon: Activity,
              },
              {
                label: "JD Repository",
                count: jdHistory.length,
                color: "text-emerald-400",
                icon: ShieldCheck,
              },
              {
                label: "Knowledge Bank",
                count: questionHistory.length,
                color: "text-amber-400",
                icon: Brain,
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-slate-900/50 border border-slate-800/80 p-12 rounded-[3rem] text-center shadow-xl backdrop-blur-sm group hover:border-indigo-500/30 transition-all"
              >
                <stat.icon
                  className={`w-12 h-12 mx-auto mb-6 ${stat.color} opacity-50`}
                />
                <h4 className={`text-6xl font-black ${stat.color} mb-2`}>
                  {stat.count}
                </h4>
                <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.4em]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === AppTab.Practice && (
        <PracticeMode onResultSave={saveResult} />
      )}

      {activeTab === AppTab.JDMode && (
        <JDMode
          onLogJD={logJD}
          onLogQuestion={logQuestion}
          onStartJDSetup={startJDSetup}
          onSearch={onSearch}
          onClickResult={onClickResult}
        />
      )}

      {activeTab === AppTab.Interview &&
        (interviewFlow.stage !== "session" ? (
          <LiveSetup
            initialQuestions={interviewFlow.questions}
            initialPersona={interviewFlow.persona}
            hideGenerator={interviewFlow.mode === "jd"}
            ctaLabel="START INTERVIEW"
            onStartLiveSession={startInterviewSession}
          />
        ) : (
          <LiveSession
            questions={interviewFlow.questions}
            persona={interviewFlow.persona}
            source={interviewFlow.mode === "jd" ? "jd" : "live"}
            onResultSave={saveResult}
            onStopSession={finishInterviewToAnalytics}
          />
        ))}

      {activeTab === AppTab.Analytics && (
        <Analytics
          results={interviewResults}
          jdHistory={jdHistory}
          questionHistory={questionHistory}
          onClear={clearAllHistory}
        />
      )}
    </Layout>
  );
};

export default App;







import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

import {
  Trash2,
  TrendingUp,
  FileText,
  Database,
  HelpCircle,
  Filter,
  Brain,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import APIService from "../services/api";

const overallFrom = (r) => {
  const add = getAdditional(r);
  const candidates = [
    r?.overallScore,
    r?.overallscore,
    add?.teacherEvaluation?.score,
    r?.finalscore,
    r?.finalScore,
    r?.score,
    r?.comprehensivefeedback?.overallScore,
    r?.llmevaluation?.overallScore,
    add?.mlMetrics?.overall,
  ];
  for (const v of candidates) {
    const n = num(v, null);

    if (typeof n === "number" && Number.isFinite(n) && n > 0)
      return clamp100(n);
  }
  return 0;
};

const clamp100 = (n) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

const num = (v, fallback = null) => {
  if (typeof v === "string") {
    const cleaned = v.trim().replace("%", "");
    const n1 = Number(cleaned);
    if (Number.isFinite(n1)) return n1;
    const n2 = parseFloat(cleaned);
    return Number.isFinite(n2) ? n2 : fallback;
  }
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const dateLabel = (ts) => {
  try {
    return new Date(ts).toLocaleDateString();
  } catch {
    return "";
  }
};

const pickText = (...vals) => {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

const normalizeQuestionText = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenOverlapScore = (a, b) => {
  const aTokens = new Set(normalizeQuestionText(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalizeQuestionText(b).split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) overlap += 1;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
};

const scoreBucket = (s) => {
  if (s < 20) return "0-19";
  if (s < 40) return "20-39";
  if (s < 60) return "40-59";
  if (s < 80) return "60-79";
  return "80-100";
};

const getAdditional = (r) => {
  const a = r?.additionalMetrics ?? r?.additionalmetrics;
  if (!a) return null;
  if (typeof a === "object") return a;
  if (typeof a === "string") {
    try {
      return JSON.parse(a);
    } catch {
      return null;
    }
  }
  return null;
};

const averageMetrics = (...values) => {
  const nums = values
    .map((value) => num(value, null))
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!nums.length) return null;
  return clamp100(
    Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length),
  );
};

const metricFrom = (r, key) => {
  const add = getAdditional(r);
  const source = String(r?.source ?? add?.source ?? "unknown")
    .trim()
    .toLowerCase();
  const direct = typeof r?.[key] === "number" ? r[key] : null;
  if (direct !== null) return clamp100(num(direct, 0));

  const ml1 = typeof r?.mlMetrics?.[key] === "number" ? r.mlMetrics[key] : null;
  if (ml1 !== null) return clamp100(num(ml1, 0));

  const ml2 =
    typeof add?.mlMetrics?.[key] === "number" ? add.mlMetrics[key] : null;
  if (ml2 !== null) return clamp100(num(ml2, 0));

  const fromTeacherCompetencies = num(
    add?.teacherEvaluation?.competencies?.[key],
    null,
  );
  if (fromTeacherCompetencies !== null) {
    return clamp100(num(fromTeacherCompetencies, 0));
  }

  const fromLlmCompetencies = num(r?.llmevaluation?.competencies?.[key], null);
  if (fromLlmCompetencies !== null) {
    return clamp100(num(fromLlmCompetencies, 0));
  }

  const fromComprehensiveCompetencies = num(
    r?.comprehensivefeedback?.competencies?.[key],
    null,
  );
  if (fromComprehensiveCompetencies !== null) {
    return clamp100(num(fromComprehensiveCompetencies, 0));
  }

  if (key === "confidence") {
    const v =
      typeof r?.voiceanalysis?.confidence === "number"
        ? r.voiceanalysis.confidence
        : typeof r?.voiceanalysis?.overallVoiceScore === "number"
          ? r.voiceanalysis.overallVoiceScore
          : null;
    return v === null ? null : clamp100(num(v, 0));
  }

  if (key === "clarity") {
    const v =
      typeof r?.voiceanalysis?.clarity === "number"
        ? r.voiceanalysis.clarity
        : null;
    return v === null ? null : clamp100(num(v, 0));
  }

  if (key === "engagement") {
    const facial =
      typeof r?.facialanalysis?.engagement === "number"
        ? r.facialanalysis.engagement
        : typeof r?.facialanalysis?.engagementScore === "number"
          ? r.facialanalysis.engagementScore
          : null;
    const llmEngagement =
      fromTeacherCompetencies ??
      fromLlmCompetencies ??
      fromComprehensiveCompetencies;

    if (source === "live" || source === "jd") {
      const combined = averageMetrics(facial, llmEngagement);
      return combined === null ? null : combined;
    }

    const v = llmEngagement ?? facial;
    return v === null ? null : clamp100(num(v, 0));
  }

  return null;
};

const COMPETENCY_ALIASES = {
  technical: ["technical", "tech", "technicalDepth", "domainKnowledge"],
  clarity: ["clarity", "communication", "communicationClarity"],
  confidence: ["confidence", "selfConfidence"],
  conciseness: ["conciseness", "concise", "brevity"],
  engagement: ["engagement", "energy", "enthusiasm"],
};

const normalizeKey = (k) =>
  String(k ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const readCompetency = (competencies, aliases) => {
  if (!competencies) return null;
  const wanted = aliases.map(normalizeKey);

  if (Array.isArray(competencies)) {
    for (const item of competencies) {
      const name = normalizeKey(item?.name ?? item?.key ?? item?.competency);
      if (!wanted.includes(name)) continue;
      const value = num(item?.score ?? item?.value ?? item?.rating, null);
      if (typeof value === "number") return clamp100(value);
    }
    return null;
  }

  if (typeof competencies !== "object") return null;
  for (const [k, raw] of Object.entries(competencies)) {
    if (!wanted.includes(normalizeKey(k))) continue;
    const value =
      typeof raw === "object"
        ? num(raw?.score ?? raw?.value ?? raw?.rating, null)
        : num(raw, null);
    if (typeof value === "number") return clamp100(value);
  }

  return null;
};

const normalizeResult = (r) => {
  const add = getAdditional(r);
  const parsedCompetencies =
    typeof r?.competencies === "string"
      ? (() => {
          try {
            return JSON.parse(r.competencies);
          } catch {
            return null;
          }
        })()
      : null;

  const timestamp =
    typeof r?.timestamp === "number"
      ? r.timestamp
      : r?.recordedat
        ? new Date(r.recordedat).getTime()
        : Date.now();

  return {
    id:
      r?.id ?? r?._id ?? `${timestamp}-${Math.random().toString(36).slice(2)}`,
    timestamp,

    question: r?.question ?? "",
    transcription: r?.transcription ?? "",

    source: (() => {
      const raw = String(r?.source ?? add?.source ?? "unknown")
        .trim()
        .toLowerCase();
      if (raw === "live" || raw === "jd" || raw === "practice") return raw;
      return "unknown";
    })(),

    status:
      r?.status ??
      add?.teacherEvaluation?.status ??
      r?.comprehensivefeedback?.status ??
      "unknown",

    overallScore: overallFrom(r),

    teacherFeedback: pickText(
      r?.teacherFeedback,
      add?.teacherEvaluation?.feedback,
      r?.llmevaluation?.feedback,
      r?.comprehensivefeedback?.feedback,
      r?.comprehensivefeedback?.recommendations,
    ),

    confidence: metricFrom(r, "confidence"),
    clarity: metricFrom(r, "clarity"),
    engagement: metricFrom(r, "engagement"),

    competencies:
      (r?.competencies && typeof r.competencies === "object"
        ? r.competencies
        : null) ??
      parsedCompetencies ??
      add?.teacherEvaluation?.competencies ??
      r?.llmevaluation?.competencies ??
      r?.comprehensivefeedback?.competencies ??
      null,

    persona: r?.persona ?? add?.persona,
    questiontype: r?.questiontype ?? add?.questiontype,
  };
};

const avgOf = (items, key) => {
  const vals = items
    .map((x) => x?.[key])
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!vals.length) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

const EmptyState = ({ title, subtitle }) => (
  <div className="py-28 text-center">
    <h2 className="text-xl font-black text-slate-200">{title}</h2>
    <p className="text-slate-500 mt-3 text-sm">{subtitle}</p>
  </div>
);

const StatCard = ({ value, label }) => (
  <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-[2.25rem] shadow-xl min-w-0">
    <div className="text-3xl md:text-4xl font-black text-indigo-400 break-words">
      {value}
    </div>
    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">
      {label}
    </div>
  </div>
);

const MetricBar = ({ label, value, color }) => (
  <div>
    <div className="flex items-center justify-between mb-3">
      <div className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">
        {label}
      </div>
      <div className="text-sm font-black text-slate-200">{value}%</div>
    </div>
    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/10">
      <div
        className="h-full rounded-full"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  </div>
);

const cardShell =
  "bg-slate-900 border border-slate-800 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] shadow-2xl w-full min-w-0 overflow-hidden";

const SERIES = [
  { key: "clarity", name: "Clarity", color: "#a78bfa", width: 3 },
  { key: "confidence", name: "Confidence", color: "#22d3ee", width: 3 },
  { key: "engagement", name: "Engagement", color: "#fbbf24", width: 3 },
  { key: "overallScore", name: "Overall Score", color: "#6366f1", width: 5 },
];

export const Analytics = ({
  results = [],
  jdHistory = [],
  questionHistory = [],
  onClear,
}) => {
  const [activeTab, setActiveTab] = useState("performance");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedJD, setSelectedJD] = useState(null);
  const [mongoModeMetrics, setMongoModeMetrics] = useState({
    overall: null,
    bySource: {},
  });
  const [ieeeSummary, setIeeeSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [aggResp, ieeeResp] = await Promise.all([
          APIService.getAnalytics({ timeperiod: "all" }),
          APIService.getIEEESummary(),
        ]);

        if (cancelled) return;

        const modeRows = Array.isArray(aggResp?.analytics?.modeMetrics)
          ? aggResp.analytics.modeMetrics
          : [];

        const bySource = {};
        for (const row of modeRows) {
          const src = String(row?.source || "unknown").toLowerCase();
          bySource[src] = {
            confidence: num(row?.confidence, null),
            clarity: num(row?.clarity, null),
            engagement: num(row?.engagement, null),
            count: num(row?.count, 0),
          };
        }

        setMongoModeMetrics({
          overall: aggResp?.analytics?.overallMetrics || null,
          bySource,
        });
        setIeeeSummary(ieeeResp || null);
      } catch (err) {
        console.error(
          "[Analytics] Failed to load Mongo summaries:",
          err?.message || err,
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [results?.length]);

  const normalized = useMemo(() => {
    const arr = (results || [])
      .filter(Boolean)
      .map(normalizeResult)

      .filter(
        (r) => typeof r.timestamp === "number" && r.question !== undefined,
      )

      .sort((a, b) => a.timestamp - b.timestamp);

    return arr.map((r, idx) => ({
      ...r,
      sessionNumber: idx + 1,
      sessionLabel: `#${idx + 1}`,
    }));
  }, [results]);

  const filtered = useMemo(() => {
    if (sourceFilter === "all") return normalized;
    return normalized.filter((r) => r.source === sourceFilter);
  }, [normalized, sourceFilter]);

  const stats = useMemo(() => {
    if (!filtered.length) return { total: 0, avg: 0, best: 0, latest: 0 };
    const scores = filtered.map((r) => r.overallScore);
    return {
      total: filtered.length,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      best: Math.max(...scores),
      latest: scores[scores.length - 1],
    };
  }, [filtered]);

  const trendData = useMemo(
    () =>
      filtered.map((r) => ({
        sessionLabel: r.sessionLabel,
        overallScore: r.overallScore,
        confidence: r.confidence,
        clarity: r.clarity,
        engagement: r.engagement,
      })),
    [filtered],
  );

  const avgMetrics = useMemo(() => {
    return {
      confidence: avgOf(filtered, "confidence"),
      clarity: avgOf(filtered, "clarity"),
      engagement: avgOf(filtered, "engagement"),
    };
  }, [filtered]);

  const radarData = useMemo(() => {
    const list = filtered.filter(
      (r) => r.competencies && typeof r.competencies === "object",
    );
    if (!list.length) return [];

    const acc = {
      technical: 0,
      clarity: 0,
      confidence: 0,
      conciseness: 0,
      engagement: 0,
      n: 0,
    };

    for (const r of list) {
      const c = r.competencies;
      const technical = readCompetency(c, COMPETENCY_ALIASES.technical);
      const clarity = readCompetency(c, COMPETENCY_ALIASES.clarity);
      const confidence = readCompetency(c, COMPETENCY_ALIASES.confidence);
      const conciseness = readCompetency(c, COMPETENCY_ALIASES.conciseness);
      const engagement = readCompetency(c, COMPETENCY_ALIASES.engagement);

      acc.technical += num(technical, 0);
      acc.clarity += num(clarity, 0);
      acc.confidence += num(confidence, 0);
      acc.conciseness += num(conciseness, 0);
      acc.engagement += num(engagement, 0);
      acc.n += 1;
    }

    const n = Math.max(1, acc.n);
    return [
      { subject: "Tech Depth", A: clamp100(Math.round(acc.technical / n)) },
      { subject: "Clarity", A: clamp100(Math.round(acc.clarity / n)) },
      { subject: "Confidence", A: clamp100(Math.round(acc.confidence / n)) },
      { subject: "Concise", A: clamp100(Math.round(acc.conciseness / n)) },
      { subject: "Energy", A: clamp100(Math.round(acc.engagement / n)) },
    ];
  }, [filtered]);

  const distribution = useMemo(() => {
    const buckets = ["0-19", "20-39", "40-59", "60-79", "80-100"].map((b) => ({
      bucket: b,
      count: 0,
    }));
    const idx = (b) => buckets.findIndex((x) => x.bucket === b);

    for (const r of filtered) {
      const b = scoreBucket(r.overallScore);
      const i = idx(b);
      if (i >= 0) buckets[i].count += 1;
    }
    return buckets;
  }, [filtered]);

  const getAnswerForQuestion = (questionText) => {
    const target = normalizeQuestionText(questionText);
    if (!target) return null;

    for (let i = normalized.length - 1; i >= 0; i--) {
      if (normalizeQuestionText(normalized[i]?.question) === target)
        return normalized[i];
    }

    let best = null;
    let bestScore = 0;
    for (let i = normalized.length - 1; i >= 0; i--) {
      const score = tokenOverlapScore(normalized[i]?.question, questionText);
      if (score > bestScore) {
        best = normalized[i];
        bestScore = score;
      }
    }
    return bestScore >= 0.7 ? best : null;
  };

  const PerformanceTab = () => {
    if (!filtered.length) {
      return (
        <EmptyState
          title="No sessions recorded"
          subtitle="Complete an interview session to see performance analytics here."
        />
      );
    }

    return (
      <div className="space-y-10">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
          <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-full sm:w-fit overflow-x-auto">
            {["all", "live", "jd", "practice"].map((f) => (
              <button
                key={f}
                onClick={() => setSourceFilter(f)}
                className={`px-4 md:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  sourceFilter === f
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {f} Mode
              </button>
            ))}
          </div>

          <div className="text-[10px] font-black uppercase tracking-[0.25em] md:tracking-[0.35em] text-slate-600 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter: {sourceFilter}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard value={stats.total} label="Total Sessions" />
          <StatCard value={`${stats.avg}%`} label="Average Score" />
          <StatCard value={`${stats.best}%`} label="Best Score" />
          <StatCard value={`${stats.latest}%`} label="Latest Score" />
        </div>

        {/* Trends */}
        <div className={cardShell}>
          <h3 className="text-xl font-black mb-8 text-indigo-400">
            Performance Trends Across Sessions
          </h3>

          <div className="w-full min-w-0 h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
                vertical={false}
              />
              <XAxis
                dataKey="sessionLabel"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#334155" }}
                label={{
                  value: "Session Number",
                  position: "insideBottom",
                  offset: -4,
                  fill: "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                domain={[0, 100]}
                tickLine={false}
                axisLine={{ stroke: "#334155" }}
                label={{
                  value: "Score (%)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#64748b",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0b1220",
                  border: "1px solid #1e293b",
                  borderRadius: "16px",
                  color: "#e2e8f0",
                }}
                formatter={(value, name) => [
                  value === null || value === undefined ? "â€”" : `${value}%`,
                  name,
                ]}
              />
              <Legend wrapperStyle={{ paddingTop: 12, color: "#94a3b8" }} />

              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={s.width}
                  dot={{ r: s.key === "overallScore" ? 5 : 4 }}
                  activeDot={{ r: s.key === "overallScore" ? 7 : 6 }}
                  connectNulls
                />
              ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Average metrics */}
        <div className={cardShell}>
          <h3 className="text-xl font-black mb-8 text-indigo-400">
            Average Performance Metrics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <MetricBar
              label="Confidence"
              value={avgMetrics.confidence}
              color="#22d3ee"
            />
            <MetricBar
              label="Clarity"
              value={avgMetrics.clarity}
              color="#a78bfa"
            />
            <MetricBar
              label="Engagement"
              value={avgMetrics.engagement}
              color="#fbbf24"
            />
          </div>
        </div>
        <div className={cardShell}>
          <h3 className="text-lg font-black mb-8 flex items-center gap-3">
            <Brain className="w-5 h-5 text-indigo-400" />
            Competency + Distribution
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Radar */}
            <div className="h-[420px] min-w-0 rounded-3xl border border-slate-800 bg-slate-950/40 p-3">
              {radarData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    data={radarData}
                  >
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis
                      dataKey="subject"
                      stroke="#94a3b8"
                      fontSize={10}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      stroke="#334155"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: "12px",
                      }}
                      formatter={(value) => [`${value}%`, "Average"]}
                    />
                    <Radar
                      name="Average"
                      dataKey="A"
                      stroke="#818cf8"
                      fill="#818cf8"
                      fillOpacity={0.5}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-700 font-black uppercase tracking-widest text-xs">
                  No competency data yet...
                </div>
              )}
            </div>

            {/* Distribution */}
            <div className="h-[420px] min-w-0 rounded-3xl border border-slate-800 bg-slate-950/40 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis dataKey="bucket" stroke="#475569" fontSize={10} />
                  <YAxis stroke="#475569" fontSize={10} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: "16px",
                    }}
                    formatter={(value) => [value, "Sessions"]}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[12, 12, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const IEEETab = () => {
    if (!ieeeSummary) {
      return (
        <EmptyState
          title="IEEE Summary Unavailable"
          subtitle="Run at least one session and ensure backend /api/interviews/ieee-summary is reachable."
        />
      );
    }

    return (
      <div className="space-y-10">
        <div className={cardShell}>
          <h3 className="text-xl font-black mb-6 text-indigo-400">
            IEEE Statistical Summary (MongoDB)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Sessions</div>
              <div className="text-2xl font-black text-slate-100 mt-2">{ieeeSummary.totalSessions ?? 0}</div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Mean ± SD</div>
              <div className="text-2xl font-black text-slate-100 mt-2">
                {num(ieeeSummary?.overall?.mean, 0)?.toFixed?.(2) ?? "0.00"} ± {num(ieeeSummary?.overall?.std, 0)?.toFixed?.(2) ?? "0.00"}
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">95% CI</div>
              <div className="text-2xl font-black text-slate-100 mt-2">
                [{num(ieeeSummary?.overall?.ci95?.low, 0)?.toFixed?.(2) ?? "0.00"}, {num(ieeeSummary?.overall?.ci95?.high, 0)?.toFixed?.(2) ?? "0.00"}]
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-3">By Source</div>
              <div className="space-y-2 text-slate-200">
                {Object.entries(ieeeSummary?.bySource || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="uppercase text-slate-400">{k}</span>
                    <span>{num(v?.mean, 0)?.toFixed?.(2)} ({v?.count || 0})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-3">JD Traceability</div>
              <div className="text-slate-200 text-lg font-black">
                {ieeeSummary?.jdTraceability?.linked ?? 0}/{ieeeSummary?.jdTraceability?.total ?? 0}
              </div>
              <div className="text-slate-500 text-xs mt-2">JD-linked sessions (jdId + questionId)</div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  const JDsTab = () => {
    if (!jdHistory?.length) {
      return (
        <EmptyState
          title="JD Repository Empty"
          subtitle="Generate or upload JDs to build your repository."
        />
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {jdHistory
          .slice()
          .reverse()
          .map((jd, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedJD(jd)}
              className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] space-y-6 hover:border-indigo-500/50 transition-all flex flex-col shadow-xl"
            >
              <div className="flex justify-between items-start">
                <div className="bg-indigo-600/20 p-4 rounded-2xl">
                  <FileText className="w-8 h-8 text-indigo-400" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-500">
                  {dateLabel(jd.timestamp)}
                </span>
              </div>

              <div>
                <h4 className="text-2xl font-black text-white">
                  {jd.role || "Role"}
                </h4>
                {jd.companyContext && (
                  <p className="text-xs text-indigo-400/70 font-bold mt-1 line-clamp-1 italic">
                    {jd.companyContext}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-auto pt-6">
                {(jd.skills || []).map((s, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-slate-800 px-3 py-1.5 rounded-xl text-slate-400 font-black uppercase border border-slate-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div>
    );
  };

  const QuestionsTab = () => {
    const entries = (questionHistory || [])
      .map((q, idx) => {
        const answer = getAnswerForQuestion(q?.question);
        return {
          key: q?.id ?? q?._id ?? `${idx}-${q?.question ?? "question"}`,
          question: q?.question || "Untitled question",
          difficulty: q?.difficulty,
          source: q?.source || "unknown",
          answer,
        };
      })
      .filter((x) => x.answer)
      .sort((a, b) => (b.answer?.timestamp ?? 0) - (a.answer?.timestamp ?? 0));

    if (!questionHistory?.length) {
      return (
        <EmptyState
          title="Question Bank Empty"
          subtitle="Generate questions to build your knowledge bank."
        />
      );
    }

    if (!entries.length) {
      return (
        <EmptyState
          title="No answered questions yet"
          subtitle="Answer interview questions to populate your Knowledge Bank with evaluation details."
        />
      );
    }

    return (
      <div className="space-y-6">
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">
          Evaluation Feed
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {entries.map((entry) => (
            <motion.div
              key={entry.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setSelectedQuestion({ ...entry, answer: entry.answer })}
              className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-4 hover:border-indigo-500/40 transition-all group shadow-md relative overflow-hidden cursor-pointer"
            >
              <div className="absolute top-0 right-0 px-4 py-1 text-[8px] font-black uppercase tracking-widest bg-indigo-600">
                {entry.source}
              </div>

              <div className="flex justify-between items-start pr-12">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    {dateLabel(entry.answer?.timestamp)}
                  </span>
                </div>
                <span className="text-2xl font-black text-indigo-400">
                  {entry.answer.overallScore ?? 0}%
                </span>
              </div>

              <h5 className="font-bold text-slate-100 leading-relaxed line-clamp-2 group-hover:text-white transition-colors">
                {entry.question}
              </h5>

              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                  {entry.difficulty || "standard"}
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                  Click to view details
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };
  const jdKey = (jd) => String(jd?.id ?? jd?._id ?? "");

  const questionsForJD = (jd) => {
    const key = jdKey(jd);
    return (questionHistory || []).filter((q) => String(q?.jdId ?? "") === key);
  };

  const attemptsForJD = (jd) => {
    const key = jdKey(jd);
    return (results || []).filter((r) => String(r?.jdId ?? "") === key);
  };

  const renderTab = () => {
    if (activeTab === "performance") return <PerformanceTab />;
    if (activeTab === "ieee") return <IEEETab />;
    if (activeTab === "jds") return <JDsTab />;
    if (activeTab === "questions") return <QuestionsTab />;
    return null;
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight break-words">
            Analytics Dashboard
          </h1>
          <p className="text-slate-400 text-base md:text-lg mt-2">
            Session trends, performance metrics, and your knowledge archive.
          </p>
        </div>

        <button
          onClick={onClear}
          className="px-10 py-4 bg-red-600/10 text-red-500 rounded-2xl hover:bg-red-600/20 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all border border-red-500/20 w-fit"
        >
          <Trash2 className="w-4 h-4" /> Clear Analytics
        </button>
      </header>

      {/* Internal tabs */}
      <div className="flex gap-3 p-2 bg-slate-900/60 border border-slate-800 rounded-[2rem] w-full overflow-x-auto backdrop-blur-sm shadow-xl">
        {[
          { id: "performance", label: "Performance", icon: TrendingUp },
          { id: "ieee", label: "IEEE Summary", icon: Database },
          { id: "jds", label: "JD Repository", icon: Database },
          { id: "questions", label: "Knowledge Bank", icon: HelpCircle },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-6 md:px-10 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest flex items-center gap-3 transition-all whitespace-nowrap ${
              activeTab === t.id
                ? "bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40"
                : "text-slate-500 hover:text-white"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-2">{renderTab()}</div>
      {/* Question detail popup */}
      <AnimatePresence>
        {selectedQuestion && (
          <motion.div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
            onClick={() => setSelectedQuestion(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-2xl w-full max-h-[85vh] shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedQuestion(null);
                }}
                className="absolute top-4 right-4 p-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="max-h-[72vh] overflow-y-auto pr-2">
                <h2 className="text-xl font-bold text-white mb-4 pr-10">
                  {selectedQuestion.question}
                </h2>

                {selectedQuestion.answer ? (
                  <>
                    <p className="text-slate-300 mb-3 whitespace-pre-wrap break-words">
                      <b>Your Answer:</b>{" "}
                      {selectedQuestion.answer.transcription || "ï¿½"}
                    </p>

                    <p className="text-slate-300 mb-3 whitespace-pre-wrap break-words">
                      <b>Feedback:</b>{" "}
                      {selectedQuestion.answer.teacherFeedback ||
                        "No feedback saved."}
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                      {[
                        {
                          label: "Overall",
                          val: selectedQuestion.answer.overallScore ?? 0,
                          accent: "text-indigo-400",
                        },
                        {
                          label: "Confidence",
                          val: selectedQuestion.answer.confidence ?? 0,
                          accent: "text-slate-200",
                        },
                        {
                          label: "Clarity",
                          val: selectedQuestion.answer.clarity ?? 0,
                          accent: "text-slate-200",
                        },
                        {
                          label: "Engagement",
                          val: selectedQuestion.answer.engagement ?? 0,
                          accent: "text-slate-200",
                        },
                      ].map((m) => (
                        <div
                          key={m.label}
                          className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4"
                        >
                          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                            {m.label}
                          </div>
                          <div className={`text-2xl font-black ${m.accent} mt-1`}>
                            {m.val}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500 italic">
                    You havenï¿½t answered this question yet.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* JD detail popup */}
      <AnimatePresence>
        {selectedJD && (
          <motion.div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
            onClick={() => setSelectedJD(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-900 border border-slate-800 p-8 rounded-3xl max-w-3xl w-full shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedJD(null);
                }}
                className="absolute top-4 right-4 p-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-black text-white mb-2 pr-10">
                {selectedJD.role || selectedJD.jobTitle || "JD"}
              </h2>

              <p className="text-slate-400 text-sm mb-6">
                Questions: {questionsForJD(selectedJD).length} â€¢ Attempts:{" "}
                {attemptsForJD(selectedJD).length}
              </p>

              <div className="space-y-3 max-h-[50vh] overflow-auto pr-2">
                {questionsForJD(selectedJD).length ? (
                  questionsForJD(selectedJD).map((q, i) => (
                    <div
                      key={q.id ?? i}
                      className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4"
                    >
                      <div className="text-slate-200 font-bold">
                        {q.question}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                        Difficulty: {q.difficulty || "â€”"} â€¢ Source:{" "}
                        {q.source || "â€”"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">
                    No questions linked to this JD yet.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


















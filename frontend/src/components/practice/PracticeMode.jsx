import React, { useState } from "react";
import {
  RefreshCw,
  BookOpen,
  Plus,
  Loader2,
  Brain,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import APIService from "../../services/api";

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const clamp100 = (x) => Math.max(0, Math.min(100, Number(x) || 0));

const scoreToHue = (score) => {
  const s = clamp100(score);
  return Math.round((s / 100) * 120);
};

const scoreAccent = (score) => {
  const s = clamp100(score);
  let h, sat, light;

  if (s >= 85) {
    h = 160;
    sat = 60;
    light = 55;
  } else if (s >= 70) {
    h = 40;
    sat = 70;
    light = 58;
  } else if (s >= 55) {
    h = 50;
    sat = 75;
    light = 60;
  } else {
    h = 10;
    sat = 80;
    light = 52;
  }

  return {
    border: `hsla(${h}, ${sat}%, ${light}%, 0.25)`,
    bg: `hsla(${h}, ${sat}%, ${light}%, 0.08)`,
    icon: `hsl(${h}, ${sat}%, 65%)`,
    text: `hsl(${h}, ${sat}%, 75%)`,
  };
};

const STATIC_QUESTIONS = [
  {
    id: "1",
    question: "Tell me about yourself and your background.",
    difficulty: "easy",
  },
  {
    id: "2",
    question: "What are your greatest professional strengths?",
    difficulty: "easy",
  },
  {
    id: "3",
    question:
      "Describe a difficult situation you encountered at work and how you handled it.",
    difficulty: "medium",
  },
  {
    id: "4",
    question: "Where do you see your career heading in the next 5 years?",
    difficulty: "easy",
  },
  {
    id: "5",
    question:
      "Why are you interested in this role and our company specifically?",
    difficulty: "medium",
  },
  {
    id: "6",
    question:
      "Tell me about a time you had to manage a conflict within a team.",
    difficulty: "medium",
  },
  {
    id: "7",
    question:
      "How do you handle high-pressure environments and tight deadlines?",
    difficulty: "medium",
  },
  {
    id: "8",
    question:
      "Describe a time you failed. What did you learn from the experience?",
    difficulty: "hard",
  },
  {
    id: "9",
    question:
      "What is your preferred management style, and how do you give feedback?",
    difficulty: "medium",
  },
  {
    id: "10",
    question:
      "Explain a complex technical concept to someone with a non-technical background.",
    difficulty: "hard",
  },
  {
    id: "11",
    question:
      "What is the biggest project you've ever led? What was the outcome?",
    difficulty: "hard",
  },
  {
    id: "12",
    question: "How do you stay updated with current trends in your industry?",
    difficulty: "easy",
  },
  {
    id: "13",
    question:
      "Give an example of a time you went above and beyond for a customer or stakeholder.",
    difficulty: "medium",
  },
  {
    id: "14",
    question: "How do you handle disagreement with a supervisor's decision?",
    difficulty: "hard",
  },
  {
    id: "15",
    question:
      "What do you consider your biggest professional achievement so far?",
    difficulty: "medium",
  },
];

export const PracticeMode = ({ onResultSave }) => {
  const [practiceType, setPracticeType] = useState("static");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [customTopics, setCustomTopics] = useState("");
  const [questions, setQuestions] = useState(STATIC_QUESTIONS);
  const [userResponse, setUserResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState(null);

  const currentQuestion =
    questions[currentIndex]?.question || "Ready to start?";

  const handleGenerate = async () => {
    if (!customTopics.trim()) return;
    setLoading(true);
    setLastEvaluation(null);
    try {
      const res = await APIService.generatePracticeQuestions(
        customTopics,
        5,
        "technical",
      );
      const arr = Array.isArray(res?.questions) ? res.questions : [];
      const normalized = arr.map((item, i) => ({
        id: item.id ?? `live-${Date.now()}-${i}`,
        question: item.question ?? item.questionText ?? String(item.text || ""),
        difficulty: item.difficulty || "medium",
      }));
      setQuestions(normalized);
      setCurrentIndex(0);
    } catch (error) {
      console.error("Practice Gen API Error", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!userResponse.trim() || evaluating) return;
    setEvaluating(true);
    try {
      const currentQuestion = questions[currentIndex]?.question;

      const res = await APIService.evaluatePracticeAnswer(
        currentQuestion,
        userResponse,
        "technical",
      );

      const raw = res?.evaluation || {};
      const score =
        typeof raw.overallScore === "number"
          ? raw.overallScore
          : typeof raw.score === "number"
            ? raw.score
            : 0;

      const evalResult = { ...raw, score };

      setLastEvaluation(evalResult);

      const fullResult = {
        id: Math.random().toString(36).substring(7),
        questionId: questions[currentIndex]?.id,
        timestamp: Date.now(),
        question: currentQuestion,
        transcription: userResponse,
        overallScore: score,
        competencies: evalResult.competencies,
        teacherFeedback: evalResult.feedback,
        status: evalResult.status,
        followUpQuestion: evalResult.followUp,
        source: "practice",
      };

      await onResultSave?.(fullResult);
    } catch (e) {
      console.error("Practice Evaluation failed", e);
    } finally {
      setEvaluating(false);
    }
  };

  const handleNext = () => {
    setLastEvaluation(null);
    setUserResponse("");
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
            Practice Drill
          </h1>
          <p className="text-slate-400 mt-2 text-lg">
            AI-evaluated practice sessions with deep feedback loops.
          </p>
        </div>
        <div className="bg-indigo-600/10 border border-indigo-500/20 px-6 py-3 rounded-2xl flex items-center gap-3">
          <Trophy className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-black uppercase text-indigo-400 tracking-widest">
            Mastery Level: 84%
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => {
            setPracticeType("static");
            setQuestions(STATIC_QUESTIONS);
            setCurrentIndex(0);
            setLastEvaluation(null);
          }}
          className={`p-6 rounded-2xl border-2 flex items-center justify-center space-x-3 transition-all ${practiceType === "static" ? "border-indigo-600 bg-indigo-600/10 text-white" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700"}`}
        >
          <BookOpen className="w-6 h-6" />
          <span className="font-black uppercase tracking-widest text-xs">
            Standard Library
          </span>
        </button>
        <button
          onClick={() => {
            setPracticeType("custom");
            setQuestions([]);
            setLastEvaluation(null);
          }}
          className={`p-6 rounded-2xl border-2 flex items-center justify-center space-x-3 transition-all ${practiceType === "custom" ? "border-indigo-600 bg-indigo-600/10 text-white" : "border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700"}`}
        >
          <Plus className="w-6 h-6" />
          <span className="font-black uppercase tracking-widest text-xs">
            AI Topic Generator
          </span>
        </button>
      </div>

      <AnimatePresence>
        {practiceType === "custom" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2rem] shadow-xl"
          >
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">
              Define Custom Focus (Powered by Groq)
            </h3>
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                value={customTopics}
                onChange={(e) => setCustomTopics(e.target.value)}
                placeholder="e.g. Distributed Systems, Product Management..."
                className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-white"
              />
              <button
                onClick={handleGenerate}
                disabled={loading || !customTopics.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-10 py-4 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 text-white"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
                Generate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-[2.5rem] min-h-[250px] flex flex-col relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Brain className="w-24 h-24 text-white" />
            </div>
            <div className="flex items-center justify-between mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">
                Drill {currentIndex + 1} of {questions.length}
              </span>
              {questions[currentIndex]?.difficulty && (
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${questions[currentIndex].difficulty === "hard" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-slate-800 text-slate-300 border-slate-700"}`}
                >
                  {questions[currentIndex].difficulty}
                </span>
              )}
            </div>
            {questions.length === 0 && practiceType === "custom" && (
              <div className="text-slate-400 text-center py-10">
                Click <b>Generate</b> to create practice questions.
              </div>
            )}

            <h2 className="text-2xl md:text-3xl font-black leading-tight text-white mb-6">
              {currentQuestion}
            </h2>
            <p className="mt-auto text-xs text-slate-500 font-bold uppercase tracking-widest italic">
              Craft a structured response (STAR Method recommended)
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-white"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-4 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-indigo-500/20"
            >
              Skip Drill
            </button>
          </div>
        </div>

        <div className="flex flex-col space-y-4">
          <textarea
            value={userResponse}
            onChange={(e) => setUserResponse(e.target.value)}
            disabled={evaluating || lastEvaluation}
            placeholder="Type your response here..."
            className="flex-grow min-h-[300px] bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-200 text-lg leading-relaxed shadow-inner transition-all disabled:opacity-50"
          />

          <AnimatePresence>
            {lastEvaluation ? (
              (() => {
                const accent = scoreAccent(lastEvaluation.score);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 rounded-[2rem] border-2 shadow-2xl"
                    style={{
                      borderColor: accent.border,
                      backgroundColor: accent.bg,
                    }}
                  >
                    <div className="flex flex-col md:flex-row items-start gap-6">
                      <div
                        className="p-4 rounded-2xl"
                        style={{
                          backgroundColor: accent.bg,
                          color: accent.icon,
                        }}
                      >
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4
                            className="font-black text-2xl"
                            style={{ color: accent.text }}
                          >
                            Grade: {lastEvaluation.score}%
                          </h4>
                          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                            Evaluated by Groq LPU
                          </span>
                        </div>
                        <p className="text-slate-300 italic leading-relaxed text-lg">
                          "{lastEvaluation.feedback}"
                        </p>
                        <div className="pt-4 flex flex-wrap gap-4">
                          <button
                            onClick={handleNext}
                            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/30"
                          >
                            Next Question
                          </button>
                          <button
                            onClick={() => {
                              setLastEvaluation(null);
                              setUserResponse("");
                            }}
                            className="px-8 py-3 bg-slate-800 text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest"
                          >
                            Retry Drill
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!userResponse.trim() || evaluating}
                className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/30 transition-all active:scale-95 text-white"
              >
                {evaluating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Groq is Evaluating...
                  </>
                ) : (
                  <>
                    <Brain className="w-6 h-6" />
                    Submit for AI Evaluation
                  </>
                )}
              </button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

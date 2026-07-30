import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Square,
  Brain,
  MessageCircle,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  UserCheck,
  ShieldAlert,
  GraduationCap,
  Mic,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import APIService from "../../services/api";

export const LiveSetup = ({
  onStartLiveSession,
  initialQuestions = [],
  initialPersona = "technical",
  hideGenerator = false,
  ctaLabel = "Launch Session",
}) => {
  const [isActive, setIsActive] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  const [questions, setQuestions] = useState(initialQuestions);

  const [genTopic, setGenTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [persona, setPersona] = useState(initialPersona);

  const [duration, setDuration] = useState(0);
  const [transcription, setTranscription] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [teacherEvaluation, setTeacherEvaluation] = useState(null);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);

  const [analysis, setAnalysis] = useState({
    confidence: 0,
    clarity: 0,
    engagement: 0,
    overall: 0,
    audioLevel: 0,
    isSpeaking: false,
    feedback: "Ready...",
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);

  const setupSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event) => {
        let text = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          text += event.results[i][0].transcript;
        }
        setTranscription(text);
      };
    }
  }, []);

  useEffect(() => {
    if (initialQuestions?.length) setQuestions(initialQuestions);
  }, [initialQuestions]);

  useEffect(() => {
    if (initialPersona) setPersona(initialPersona);
  }, [initialPersona]);

  const handleGenerateQuestions = async () => {
    if (!genTopic.trim()) return;
    setIsGenerating(true);
    try {
      const res = await APIService.generatePracticeQuestions(
        genTopic,
        3,
        persona,
      );

      const arr = Array.isArray(res?.questions) ? res.questions : res;
      const normalized = arr.map((item, i) => {
        const id = item?.id ?? `live-${Date.now()}-${i}`;
        if (typeof item === "string") {
          return {
            id,
            question: item,
            source: "live",
            difficulty: "medium",
          };
        }
        if (item?.question) {
          return {
            id,
            question: item.question,
            source: "live",
            difficulty: item.difficulty || "medium",
          };
        }
        if (item?.text) {
          return {
            id,
            question: item.text,
            source: "live",
            difficulty: item.difficulty || "medium",
          };
        }
        return {
          id,
          question: "Invalid question format",
          source: "live",
          difficulty: "medium",
        };
      });
      setQuestions(normalized);
    } catch (error) {
      console.error("Question Gen API Error", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStart = async () => {
    if (questions.length === 0) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      analyserRef.current = audioCtx.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      dataArrayRef.current = new Uint8Array(
        analyserRef.current.frequencyBinCount,
      );

      setupSpeechRecognition();
      if (recognitionRef.current) recognitionRef.current.start();

      setIsActive(true);
      setSessionStarted(true);
      setDuration(0);
      setTranscription("");
      setTeacherEvaluation(null);
      setIsFollowUpMode(false);

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      runAnalysis();
    } catch (e) {
      alert("Camera/Mic permissions required.");
    }
  };

  const handleEvaluateAnswer = async () => {
    if (!transcription.trim() || isEvaluating) return;
    setIsEvaluating(true);
    const currentQ = isFollowUpMode
      ? teacherEvaluation.followUp
      : questions[currentQIndex]?.question;
    try {
      const evaluation = await groqService.evaluateAsTeacher(
        currentQ,
        transcription,
        persona,
      );

      setTeacherEvaluation(evaluation);

      if (onResultSave) {
        onResultSave({
          id: Math.random().toString(36).substring(7),
          questionId: questions[currentQIndex]?.id,
          timestamp: Date.now(),
          question: currentQ,
          transcription: transcription.trim(),
          overallScore: evaluation.score,
          competencies: evaluation.competencies,
          teacherFeedback: evaluation.feedback,
          status: evaluation.status,
          followUpQuestion: evaluation.followUp,
          source: "live",
        });
      }
    } catch (error) {
      console.error("Groq Evaluation Error:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleStop = () => {
    if (streamRef.current)
      streamRef.current.getTracks().forEach((t) => t.stop());
    if (recognitionRef.current) recognitionRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current)
      cancelAnimationFrame(animationFrameRef.current);
    setIsActive(false);
  };

  const runAnalysis = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    const sum = dataArrayRef.current.reduce((a, b) => a + b, 0);
    const level = Math.min(
      100,
      Math.round((sum / dataArrayRef.current.length) * 2),
    );
    const isSpeaking = level > 15;

    setAnalysis((prev) => ({
      ...prev,
      audioLevel: level,
      isSpeaking,
      confidence: isSpeaking
        ? Math.min(100, prev.confidence + 0.5)
        : Math.max(0, prev.confidence - 0.2),
      overall: Math.round((prev.confidence + 85 + 90) / 3),
      feedback: isSpeaking ? "Voice Captured..." : "Listening...",
    }));
    animationFrameRef.current = requestAnimationFrame(runAnalysis);
  };

  if (!sessionStarted) {
    return (
      <div className="max-w-4xl mx-auto py-12 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-6xl font-black text-white">
            Live Teacher Simulation
          </h1>
          <p className="text-slate-400 text-lg">
            Adaptive AI coaching for high-stakes interviews.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              id: "encouraging",
              label: "Supportive",
              icon: GraduationCap,
              color: "text-emerald-400",
            },
            {
              id: "technical",
              label: "Technical",
              icon: UserCheck,
              color: "text-indigo-400",
            },
            {
              id: "strict",
              label: "Strict",
              icon: ShieldAlert,
              color: "text-red-400",
            },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              className={`p-6 rounded-[2.5rem] border-2 text-left transition-all ${persona === p.id ? "bg-indigo-600/10 border-indigo-600 shadow-2xl" : "bg-slate-900 border-slate-800"}`}
            >
              <p.icon
                className={`w-8 h-8 mb-4 ${persona === p.id ? p.color : "text-slate-600"}`}
              />
              <h4 className="font-black text-lg text-white">{p.label}</h4>
            </button>
          ))}
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-[3rem] shadow-2xl space-y-8 backdrop-blur-md">
          {/* <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em]">
              Build Curriculum
            </label>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Enter topic (e.g. Distributed Systems, Product Management...)"
                className="flex-grow bg-slate-950 border border-slate-700 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
              />
              <button
                onClick={handleGenerateQuestions}
                disabled={isGenerating || !genTopic.trim()}
                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
                Assemble
              </button>
            </div>
          </div> */}
          {!hideGenerator && (
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.3em]">
                Build Curriculum
              </label>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Enter topic (e.g. Distributed Systems, Product Management...)"
                  className="flex-grow bg-slate-950 border border-slate-700 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                />
                <button
                  onClick={handleGenerateQuestions}
                  disabled={isGenerating || !genTopic.trim()}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all"
                >
                  {isGenerating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  Assemble
                </button>
              </div>
            </div>
          )}

          {questions.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div
                    key={q.id || i}
                    className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 text-sm font-medium text-slate-200"
                  >
                    {q.question}
                  </div>
                ))}
              </div>

              <button
                onClick={() => onStartLiveSession({ questions, persona })}
              >
                {ctaLabel}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative aspect-video bg-slate-950 rounded-[3rem] overflow-hidden border-2 border-slate-800 shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
            <div className="absolute top-6 left-6 px-4 py-2 bg-slate-900/90 backdrop-blur rounded-full text-xs font-bold border border-slate-700 text-white flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${analysis.isSpeaking ? "bg-emerald-500" : "bg-red-500"} animate-pulse`}
              />
              {Math.floor(duration / 60)
                .toString()
                .padStart(2, "0") +
                ":" +
                (duration % 60).toString().padStart(2, "0")}
            </div>
            {isFollowUpMode && (
              <div className="absolute top-6 left-6 ml-24 px-4 py-2 bg-amber-600/90 backdrop-blur rounded-full text-[10px] font-black tracking-widest uppercase text-white">
                ADAPTIVE PROBE
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6 shadow-xl">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                {isFollowUpMode
                  ? "Deep Probe Active"
                  : `Session Question ${currentQIndex + 1}`}
              </span>
            </div>
            <p className="text-3xl font-bold leading-tight text-white">
              {isFollowUpMode
                ? teacherEvaluation.followUp
                : questions[currentQIndex]?.question}
            </p>

            <AnimatePresence>
              {teacherEvaluation && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-6 rounded-3xl border-2 ${
                    teacherEvaluation.status === "correct"
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : teacherEvaluation.status === "partially-correct"
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  <div className="flex items-start gap-5">
                    <div
                      className={`p-3 rounded-2xl ${teacherEvaluation.status === "correct" ? "bg-emerald-500/20 text-emerald-500" : "bg-amber-500/20 text-amber-500"}`}
                    >
                      {teacherEvaluation.status === "correct" ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        <AlertCircle className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-black text-xl text-white">
                          Score: {teacherEvaluation.score}%
                        </h4>
                        <span className="text-xs font-bold uppercase text-slate-500 tracking-widest">
                          {persona} Mode
                        </span>
                      </div>
                      <p className="text-slate-300 italic leading-relaxed">
                        "{teacherEvaluation.feedback}"
                      </p>

                      <div className="flex gap-4 pt-4">
                        {teacherEvaluation.followUp && !isFollowUpMode && (
                          <button
                            onClick={() => {
                              setIsFollowUpMode(true);
                              setTranscription("");
                              setTeacherEvaluation(null);
                            }}
                            className="px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg"
                          >
                            Probe Deeper <Sparkles className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setCurrentQIndex((i) =>
                              Math.min(questions.length - 1, i + 1),
                            );
                            setTranscription("");
                            setTeacherEvaluation(null);
                            setIsFollowUpMode(false);
                          }}
                          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg"
                        >
                          Next Base <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isActive && !teacherEvaluation && (
              <div className="flex gap-4">
                <button
                  onClick={handleEvaluateAnswer}
                  disabled={isEvaluating || !transcription.trim()}
                  className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black flex items-center justify-center gap-3 disabled:opacity-50 transition-all shadow-xl shadow-indigo-500/20"
                >
                  {isEvaluating ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Brain className="w-6 h-6" />
                  )}
                  Submit to Teacher
                </button>
                <button
                  onClick={handleStop}
                  className="px-10 py-5 bg-slate-800 text-white rounded-2xl font-black hover:bg-slate-700 transition-all"
                >
                  <Square className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[3rem] shadow-xl">
            <h3 className="font-black text-lg mb-8 flex items-center gap-2 text-indigo-400">
              <Mic className="w-5 h-5" /> Live HUD
            </h3>
            <div className="space-y-6">
              {[
                {
                  label: "Energy",
                  val: analysis.audioLevel,
                  color: "bg-indigo-500",
                },
                {
                  label: "Stability",
                  val: analysis.confidence,
                  color: "bg-emerald-500",
                },
                { label: "Focus", val: 95, color: "bg-amber-500" },
              ].map((m) => (
                <div key={m.label} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                    <span>{m.label}</span>
                    <span>{Math.round(m.val)}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${m.val}%` }}
                      className={`h-full ${m.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-xs text-slate-500 text-center font-bold uppercase tracking-[0.3em]">
              {analysis.feedback}
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/50 p-8 rounded-[3rem] backdrop-blur-md">
            <h3 className="font-black text-lg mb-4 flex items-center gap-2 text-indigo-400">
              <MessageCircle className="w-5 h-5" /> Audio Stream
            </h3>
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar pr-4">
              <p className="text-sm text-slate-400 leading-relaxed italic">
                {transcription || "Listening for your response..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

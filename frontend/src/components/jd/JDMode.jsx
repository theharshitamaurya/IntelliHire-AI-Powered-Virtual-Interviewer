import React, { useMemo, useState } from "react";
import {
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Brain,
  Info,
  Globe,
} from "lucide-react";

import APIService from "../../services/api";

import mammoth from "mammoth";

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let pdfWorkerConfigured = false;

async function extractPdfText(arrayBuffer) {
  const pdfjs = await import("pdfjs-dist/build/pdf");

  if (!pdfWorkerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    pdfWorkerConfigured = true;
  }

  const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = (content.items || [])
      .map((it) => (typeof it?.str === "string" ? it.str : ""))
      .join(" ");
    fullText += pageText + "\n\n";
  }
  return fullText.trim();
}

async function fileToText(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();

  if (ext === "txt") {
    return await file.text();
  }

  const buf = await file.arrayBuffer();

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return (result?.value || "").trim();
  }

  if (ext === "pdf") {
    return await extractPdfText(buf);
  }

  throw new Error("Unsupported file type");
}

function TextOrDocInput({
  label,
  text,
  setText,
  placeholder,
  height = "h-[300px]",
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
          {label}
        </label>

        <input
          type="file"
          accept=".txt,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const extracted = await fileToText(file);
              setText(extracted);
            } catch (err) {
              console.error(err);
              alert("Could not read file. Please use .txt, .docx, or .pdf");
            } finally {
              e.target.value = "";
            }
          }}
          className="text-xs text-slate-400"
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className={`w-full ${height} bg-slate-900 border border-slate-800 rounded-[3rem] p-8 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-2xl transition-all`}
      />
    </div>
  );
}

const JDMode = ({ onLogJD, onLogQuestion, onStartJDSetup }) => {
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");

  const [role, setRole] = useState("");
  const [skills, setSkills] = useState([]);
  const [context, setContext] = useState("");
  const [questions, setQuestions] = useState([]);

  const [loading, setLoading] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const [step, setStep] = useState(1);

  const canAnalyze = useMemo(
    () => !!jdText.trim() || !!resumeText.trim(),
    [jdText, resumeText],
  );

  const handleProcess = async () => {
    const hasJD = !!jdText.trim();
    const hasResume = !!resumeText.trim();
    console.log("Analyze clicked", {
      hasJD,
      hasResume,
      len: jdText.trim().length,
    });

    if (!hasJD && !hasResume) return;

    if (hasJD && jdText.trim().length < 50) {
      alert("JD must be at least 50 characters.");
      return;
    }

    setLoading(true);
    try {
      console.log("Calling POST /api/jds/generate ...");

      const resp = await APIService.request("jds/generate", {
        method: "POST",
        body: JSON.stringify({
          jdText: jdText.trim(),
          resumeText: hasResume ? resumeText.trim() : undefined,
        }),
      });

      console.log("JD generate response:", resp);
      const jd = resp?.jd || {};
      const qs = Array.isArray(resp?.questions) ? resp.questions : [];

      const generated = qs.map((q, i) => ({
        id: q.id ?? `jd-${Date.now()}-${i}`,
        question: q.text ?? "Question missing",
        difficulty: q.difficulty || difficulty,
        skill_area:
          Array.isArray(q.skills) && q.skills[0] ? q.skills[0] : "general",
        source: "jd",
        jdId: jd.id ?? null,
      }));
      console.log("questions count:", qs.length);
      console.log("generated count:", generated.length);

      onLogJD?.({
        id: jd.id ?? `jd-local-${Date.now()}`,
        _id: jd.id ?? undefined,
        role: (role || jd.title || "").trim() || "Role",
        jobTitle: jd.title || role || "Role",
        company: jd.company || "Unknown",
        skills: Array.isArray(jd.skills) ? jd.skills : [],
        companyContext: jd.context || "",
        timestamp: Date.now(),
        source: "generated",
      });

      setSkills(jd.skills || []);
      setContext(jd.context || "");
      setQuestions(generated);

      generated.forEach((q) => {
        onLogQuestion?.({
          id: q.id,
          question: q.question,
          difficulty: q.difficulty,
          source: "jd",
          jdId: q.jdId ?? jd.id ?? null,
          timestamp: Date.now(),
          skills: Array.isArray(jd.skills) ? jd.skills : [],
        });
      });

      setStep(2);
    } catch (e) {
      console.error("JD analyze failed:", e);
      alert("JD analyze failed: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-4xl font-extrabold text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-emerald-400">
          Grounded JD Analysis
        </h1>
        <p className="text-slate-400 mt-2">
          Extract skills and research company context using AI grounding logic.
        </p>
      </header>

      {step === 1 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: JD + Resume */}
          <div className="space-y-6 lg:space-y-8">
            <TextOrDocInput
              label={
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Job Specification
                </span>
              }
              text={jdText}
              setText={setJdText}
              placeholder="Paste the job description here (or upload .pdf/.docx/.txt, add company name for deeper insights)..."
              height="h-[200px]"
            />

            <TextOrDocInput
              label={
                <span className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                  📄 Resume (optional)
                </span>
              }
              text={resumeText}
              setText={setResumeText}
              placeholder="Paste your resume here or upload .pdf/.docx/.txt for personalized questions..."
              height="h-[200px]"
            />
          </div>

          {/* RIGHT: Role + Difficulty + Analyze */}
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Target Designation
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Principal Architect @ Google"
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[3rem] space-y-6 shadow-2xl backdrop-blur-md">
              <h4 className="font-black text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-500" /> Challenge Level
              </h4>

              <div className="flex gap-3">
                {["easy", "medium", "hard"].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setDifficulty(lvl)}
                    className={`flex-1 py-3 rounded-xl text-xs font-black border uppercase tracking-widest transition-all ${
                      difficulty === lvl
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                        : "bg-slate-950 border-slate-700 text-slate-500 hover:text-white"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <button
                onClick={handleProcess}
                disabled={loading || !canAnalyze}
                className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-2xl font-black text-xl text-white flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-500/30"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
                Analyze Logic
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
              <div className="flex items-center gap-6">
                <div className="bg-indigo-500/20 p-5 rounded-[2rem]">
                  <CheckCircle2 className="w-12 h-12 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-4xl font-black text-white">
                    {role || "Role Breakdown"}
                  </h3>
                  <div className="flex items-center gap-2 text-emerald-400 mt-2">
                    <Globe className="w-4 h-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">
                      Verified with AI Grounding
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() =>
                  onStartJDSetup?.({ questions, persona: "technical" })
                }
                className="px-12 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg flex items-center gap-3 shadow-xl shadow-indigo-500/40 transition-all active:scale-95"
              >
                Enter Teacher Session <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-1 space-y-10">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-6">
                    Competency Tags
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {skills.map((s, i) => (
                      <span
                        key={i}
                        className="px-5 py-2.5 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-2xl text-xs font-bold shadow-sm"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {context && (
                  <div className="p-8 bg-slate-950/80 rounded-[2rem] border border-slate-800 shadow-inner">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 mb-3 flex items-center gap-2">
                      <Info className="w-4 h-4" /> Grounded Wisdom
                    </h4>
                    <p className="text-sm text-slate-400 italic leading-relaxed font-medium">
                      "{context}"
                    </p>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2 space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                  Curriculum Roadmap
                </h4>

                <div className="grid gap-4">
                  {questions.map((q, i) => (
                    <div
                      key={q.id || i}
                      className="bg-slate-950/50 border border-slate-800 p-8 rounded-[2rem] group hover:border-indigo-500/30 transition-all shadow-md"
                    >
                      <p className="text-xl font-bold text-slate-100 group-hover:text-white transition-colors">
                        {q.question}
                      </p>

                      <div className="flex gap-6 mt-4">
                        <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
                          Logic: {q.difficulty}
                        </span>
                        <span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">
                          {q.skill_area}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="text-slate-500 text-xs font-black uppercase tracking-widest hover:text-white transition-colors"
          >
            ← Analyze Another JD
          </button>
        </div>
      )}
    </div>
  );
};

export { JDMode };
export default JDMode;

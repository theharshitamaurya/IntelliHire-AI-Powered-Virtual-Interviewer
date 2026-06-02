import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000/api";

export default function JDUpload() {
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const navigate = useNavigate();

  async function handleGenerate() {
    if (jdText.trim().length < 50) {
      setError("Job description must be at least 50 characters");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/jds/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, resumeText }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Generation failed");
      }

      const data = await response.json();
      console.log("✅ JD generated:", data);

      setResult(data);
    } catch (err) {
      console.error("Generation error:", err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleStartInterview() {
    if (!result) return;

    navigate("/interview", {
      state: {
        mode: "jd",
        jobDescriptionId: result.jd.id,
        questions: result.questions,
      },
    });
  }

  return (
    <div className="jd-upload-container">
      <h2>📄 JD-Grounded Interview Generation</h2>
      <p>
        Upload a job description to generate role-specific interview questions
      </p>

      {!result ? (
        <div className="upload-form">
          <div className="form-group">
            <label>Job Description *</label>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={12}
              disabled={isProcessing}
            />
            <small>{jdText.length} characters (min 50)</small>
          </div>

          <div className="form-group">
            <label>Your Resume (Optional)</label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume for personalized questions (optional)..."
              rows={6}
              disabled={isProcessing}
            />
          </div>

          {error && <div className="error-message">⚠️ {error}</div>}

          <button
            onClick={handleGenerate}
            disabled={isProcessing || jdText.length < 50}
            className="btn-primary"
          >
            {isProcessing ? "⏳ Processing..." : "🚀 Generate Interview"}
          </button>
        </div>
      ) : (
        <div className="generation-results">
          <h3>✅ Interview Generated Successfully!</h3>

          <div className="jd-summary">
            <h4>📋 Job Details</h4>
            <p>
              <strong>Title:</strong> {result.jd.title}
            </p>
            <p>
              <strong>Company:</strong> {result.jd.company}
            </p>
            <p>
              <strong>Level:</strong> {result.jd.experienceLevel}
            </p>
            <p>
              <strong>Context:</strong> {result.jd.context}
            </p>

            <div className="skills-list">
              <strong>Key Skills (8):</strong>
              <div className="skills-tags">
                {result.jd.skills.map((skill, idx) => (
                  <span key={idx} className="skill-tag">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="questions-preview">
            <h4>❓ Generated Questions ({result.questions.length})</h4>
            <ul>
              {result.questions.map((q, idx) => (
                <li key={q.id}>
                  <strong>Q{idx + 1}:</strong> {q.text}
                  <span className={`difficulty-badge ${q.difficulty}`}>
                    {q.difficulty}
                  </span>
                  <span className="category-badge">{q.category}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="action-buttons">
            <button onClick={handleStartInterview} className="btn-primary">
              ▶️ Start Interview
            </button>
            <button onClick={() => setResult(null)} className="btn-secondary">
              ← Generate Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

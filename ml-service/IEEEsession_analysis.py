import pymongo
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
import tempfile


def get_path(doc, path, default=None):
    cur = doc
    for part in path.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return default
    return cur


def first_defined(doc, paths, default=None):
    for p in paths:
        v = get_path(doc, p, None)
        if v is not None:
            return v
    return default


def to_number(v, default=np.nan):
    if v is None:
        return default
    if isinstance(v, (int, float, np.number)):
        return float(v)
    if isinstance(v, str):
        cleaned = v.replace("%", "").strip()
        try:
            return float(cleaned)
        except Exception:
            return default
    return default


def to_ts(v):
    if v is None:
        return pd.NaT
    dt = pd.to_datetime(v, errors="coerce", utc=True)
    if pd.isna(dt):
        return pd.NaT
    return dt


def normalize_source(raw):
    s = str(raw or "").strip().lower()
    if s in {"live", "practice", "jd"}:
        return s
    return "unknown"


def normalize_doc(doc):
    content = first_defined(doc, ["content_analysis", "contentanalysis"], default={}) or {}
    additional = first_defined(doc, ["additional_metrics", "additionalmetrics"], default={}) or {}
    comprehensive = first_defined(
        doc, ["comprehensive_feedback", "comprehensivefeedback"], default={}
    ) or {}

    score = first_defined(
        doc,
        [
            "overall_score",
            "overallscore",
            "final_score",
            "comprehensive_feedback.overallScore",
            "comprehensivefeedback.overallScore",
            "llmevaluation.overallScore",
        ],
        default=np.nan,
    )

    ts = first_defined(
        doc,
        ["recorded_at", "recordedat", "analyzed_at", "analyzedat", "updated_at", "updatedat"],
        default=None,
    )

    source = normalize_source(
        first_defined(doc, ["additional_metrics.source", "additionalmetrics.source", "source"], default=None)
    )

    session_id = first_defined(doc, ["session_id", "sessionid"], default="")
    role = first_defined(doc, ["role"], default="")
    difficulty = first_defined(doc, ["difficulty"], default="")

    competencies = first_defined(
        doc,
        [
            "comprehensive_feedback.competencies",
            "comprehensivefeedback.competencies",
            "llmevaluation.competencies",
        ],
        default={},
    ) or {}

    return {
        "_id": str(doc.get("_id", "")),
        "recorded_at": to_ts(ts),
        "overall_score": to_number(score),
        "role": role if role is not None else "",
        "difficulty": difficulty if difficulty is not None else "",
        "source": source,
        "session_id": str(session_id or ""),
        "jdId": doc.get("jdId"),
        "questionId": doc.get("questionId"),
        "keywordRelevance": to_number(content.get("keywordRelevance", np.nan)),
        "starMethodScore": to_number(content.get("starMethodScore", np.nan)),
        "vocabularyDiversity": to_number(content.get("vocabularyDiversity", np.nan)),
        "coherenceScore": to_number(content.get("coherenceScore", np.nan)),
        "professionalTerminologyScore": to_number(
            content.get("professionalTerminologyScore", np.nan)
        ),
        "overallContentScore": to_number(content.get("overallContentScore", np.nan)),
        "comp_technical": to_number(first_defined(competencies, ["technical", "tech"], np.nan)),
        "comp_clarity": to_number(first_defined(competencies, ["clarity"], np.nan)),
        "comp_confidence": to_number(first_defined(competencies, ["confidence"], np.nan)),
        "comp_conciseness": to_number(first_defined(competencies, ["conciseness", "brevity"], np.nan)),
        "comp_engagement": to_number(first_defined(competencies, ["engagement", "energy"], np.nan)),
        "jd_traceable": bool(doc.get("jdId")) and bool(doc.get("questionId")),
        "raw_additional": additional,
        "raw_comprehensive": comprehensive,
    }


def print_ci(series):
    s = series.dropna()
    n = len(s)
    if n <= 1:
        return "[NA, NA]"
    mean = s.mean()
    sem = s.sem()
    lo = mean - 1.96 * sem
    hi = mean + 1.96 * sem
    return f"[{lo:.2f}, {hi:.2f}]"


def main():
    client = pymongo.MongoClient("mongodb://localhost:27017/")
    db = client["intellihire"]
    collection = db["interviewresults"]

    docs = list(collection.find({}))
    rows = [normalize_doc(d) for d in docs]
    df = pd.DataFrame(rows)

    # Print header
    print("\n" + "=" * 70)
    
    # Total sessions and date range
    total = len(df)
    if "recorded_at" in df.columns and df["recorded_at"].notna().any():
        min_date = df['recorded_at'].min().strftime("%Y-%m-%d")
        max_date = df['recorded_at'].max().strftime("%Y-%m-%d")
        print(f"Total sessions: {total}    Date range: {min_date} → {max_date}")
    else:
        print(f"Total sessions: {total}    Date range: NA")

    # Overall score
    mean_score = df['overall_score'].mean(skipna=True)
    std_score = df['overall_score'].std(skipna=True)
    s = df['overall_score'].dropna()
    n = len(s)
    if n > 1:
        sem = s.sem()
        lo = mean_score - 1.96 * sem
        hi = mean_score + 1.96 * sem
        ci_str = f"[{lo:.1f}, {hi:.1f}]"
    else:
        ci_str = "[NA, NA]"
    print(f"\n=== OVERALL SCORE ===")
    print(f"Mean: {mean_score:.1f}    SD: {std_score:.1f}    95% CI: {ci_str}")

    # By source
    if "source" in df.columns:
        print(f"\n=== BY SOURCE ===")
        src_groups = df.groupby("source")["overall_score"]
        for src in sorted(df["source"].unique()):
            if src == "unknown":
                continue
            group = df[df["source"] == src]["overall_score"].dropna()
            if len(group) > 0:
                n_src = len(group)
                mean_src = group.mean()
                std_src = group.std()
                if n_src > 1:
                    sem_src = group.sem()
                    lo_src = mean_src - 1.96 * sem_src
                    hi_src = mean_src + 1.96 * sem_src
                    ci_src = f"[{lo_src:.1f}, {hi_src:.1f}]"
                else:
                    ci_src = "[NA, NA]"
                print(f"{src:<10} n={n_src:<2} mean={mean_src:.1f}  SD={std_src:.1f}   CI={ci_src}")

    # JD traceability
    print(f"\n=== JD TRACEABILITY ===")
    traceable = int(df["jd_traceable"].sum())
    pct = (traceable / len(df) * 100) if len(df) > 0 else 0
    print(f"Traceable: {traceable}/{len(df)} ({pct:.1f}%)")

    # Content metrics
    content_cols = [
        ("keywordRelevance", "Keyword Relevance"),
        ("starMethodScore", "STAR Method Score"),
        ("vocabularyDiversity", "Vocabulary Diversity"),
        ("coherenceScore", "Coherence Score"),
        ("professionalTerminologyScore", "Professional Terminology"),
        ("overallContentScore", "Content Score"),
    ]
    
    available_content = [(col, label) for col, label in content_cols 
                         if col in df.columns and df[col].notna().any()]
    if available_content:
        print(f"\n=== CONTENT METRICS ===")
        for col, label in available_content:
            mean_val = df[col].mean()
            std_val = df[col].std()
            print(f"{label}: {mean_val:.1f} (SD: {std_val:.1f})")

    # Competency metrics
    comp_cols = [
        ("comp_technical", "Technical"),
        ("comp_clarity", "Clarity"),
        ("comp_confidence", "Confidence"),
        ("comp_conciseness", "Conciseness"),
        ("comp_engagement", "Engagement"),
    ]
    
    available_comp = [(col, label) for col, label in comp_cols 
                      if col in df.columns and df[col].notna().any()]
    if available_comp:
        print(f"\n=== COMPETENCY METRICS ===")
        for col, label in available_comp:
            mean_val = df[col].mean()
            std_val = df[col].std()
            if mean_val > 0:  # Only print if there's actual data
                print(f"{label}: {mean_val:.1f} (SD: {std_val:.1f})")

    # Export results
    script_dir = Path(__file__).resolve().parent
    export_path = script_dir / "results_export.csv"

    try:
        df.to_csv(export_path, index=False)
    except PermissionError:
        ts_name = f"results_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        export_path = script_dir / ts_name
        try:
            df.to_csv(export_path, index=False)
        except PermissionError:
            export_path = Path(tempfile.gettempdir()) / ts_name
            df.to_csv(export_path, index=False)

    print(f"\nResults exported to {export_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()

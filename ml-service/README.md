# Analyzer Guide - IEEEsession_analysis.py

## Overview

This guide explains how to run `IEEEsession_analysis.py` and interpret its outputs for IEEE-paper-ready statistics.

## What This Script Does

- Connects to MongoDB (`intellihire.interviewresults`)
- Normalizes schema drift variants (for example `overall_score` vs `overallscore`)
- Computes:
  - total sessions and date range
  - mean/std/95% CI for overall score
  - source/role/difficulty breakdowns
  - JD traceability (`jdId + questionId`)
  - deterministic content metric summary
  - competency metric summary
- Exports normalized rows to CSV (`results_export.csv`)

## Prerequisites

1. Python 3.9+
2. Local MongoDB running
3. Analyzer dependencies installed

Install dependencies from `analyzer/`:

```bash
pip install -r requirements.txt
```

## How To Run

From project root:

```bash
cd analyzer
python IEEEsession_analysis.py
```

## Expected Output

Console output sections:

- `INTELLIHIRE STATISTICAL ANALYSIS`
- `OVERALL PERFORMANCE`
- `BY SOURCE`
- `BY ROLE` (if role exists)
- `BY DIFFICULTY` (if difficulty exists)
- `JD TRACEABILITY`
- `DETERMINISTIC CONTENT METRICS`
- `COMPETENCY METRICS`

CSV export location:

- Default: `analyzer/results_export.csv`
- Fallback: timestamped CSV in `analyzer/` or temp folder if file is locked

## Expected Output Example

```
INTELLIHIRE STATISTICAL ANALYSIS
============================================================
Total Sessions: 54
Date Range: 2026-02-21 18:24:12.758000+00:00 to 2026-03-03 08:32:58.472000+00:00

OVERALL PERFORMANCE
Mean Score: 50.87
Std Dev: 16.49
95% CI: [46.47, 55.27]

BY SOURCE
               mean        std  count
source
live      42.652174   8.177623     23
practice  61.681818  18.704179     22
jd        45.444444  12.289336      9

BY DIFFICULTY
                mean        std  count
difficulty
medium      50.87037  16.492475     54

JD TRACEABILITY
JD-linked sessions (jdId + questionId present): 9/54

DETERMINISTIC CONTENT METRICS
                                   mean        std
keywordRelevance              50.000000   0.000000
starMethodScore               17.592593  26.435053
vocabularyDiversity           90.548148   9.608384
coherenceScore                41.018519  19.399952
professionalTerminologyScore   3.592593   6.929615
overallContentScore           29.962963   7.182166

COMPETENCY METRICS
                  mean  std
comp_technical     0.0  0.0
comp_clarity       0.0  0.0
comp_confidence    0.0  0.0
comp_conciseness   0.0  0.0
comp_engagement    0.0  0.0

Results exported to D:\harshita\university\major-project\code\I2ITCON-IntellihireIEEE\analyzer\results_export.csv

```

## Notes On Data Consistency

- Competency values can be zero if the source documents have missing competency fields.
- Date range shows `NA` when all timestamp fields are missing or unparsable.
- This script is analytics-only. It does not modify MongoDB.

## Troubleshooting

- `KeyError` style failures should not occur in this script; it uses schema-safe mapping.
- If Mongo connection fails, verify MongoDB service and connection URI.
- If CSV write fails, close any open spreadsheet locking the file and run again.

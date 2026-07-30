# Backend Test Files

This README lists only the project test files present in `backend/tests/` (excluding dependencies).

## Total Test Files

`2`

## Test File List

1. `test-all-phase.js`
2. `test-python-integration.js`

## How To Run

From `backend/`:

```bash
node tests/test-all-phase.js
node tests/test-python-integration.js
```

## Expected Output Example

```

D:\harshita\university\major-project\code\I2ITCON-IntellihireIEEE\backend>node test-python-integration.js

============================================================
  IntelliHire Python Integration Test
============================================================

TEST 1: Checking Python Dependencies...
[PythonAnalyzer] Dependencies check: OK
OK Python dependencies installed

TEST 2: Checking Python Script...
OK Python script found at: D:\harshita\university\major-project\code\I2ITCON-IntellihireIEEE\analyzer\multimodal_analyzer.py

TEST 3: Testing Audio Analysis...
INFO Testing with: audio-1772526708930.webm
[PythonAnalyzer] Spawning: python D:\harshita\university\major-project\code\I2ITCON-IntellihireIEEE\analyzer\multimodal_analyzer.py --audio D:\harshita\university\major-project\code\I2ITCON-IntellihireIEEE\backend\uploads\audio-1772526708930.webm --verbose
[PythonAnalyzer] Processing audio: D:\harshita\university\major-project\code\I2ITCON-IntellihireIEEE\backend\uploads\audio-1772526708930.webm
[PythonAnalyzer] Audio extraction error:
Audio extraction complete
[PythonAnalyzer] Analysis complete
OK Audio analysis completed successfully

Sample Audio Features:
  Energy (dB): -30.00
  Spectral Centroid: 2000.00 Hz
  Pitch: 150.00 Hz
  Voice Activity: 80.0%
  Confidence Score: 75
  Overall Voice Score: 75

TEST 4: Checking MongoDB Schema...
OK Schema has 'voiceanalysis' field
OK Schema has 'facialanalysis' field
OK Schema has 'contentanalysis' field
OK Schema has 'overallscore' field
OK Schema has 'comprehensivefeedback' field

============================================================
  Test Results: 4 passed, 0 skipped, 0 failed
============================================================
OK
All required tests passed. Python integration is ready.

Next Steps:
  1. Start backend: npm start
  2. Upload interview through frontend
  3. Check MongoDB for voiceanalysis data
  4. Verify overallscore reflects multimodal fusion

(node:26524) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

D:\harshita\university\major-project\code\I2ITCON-IntellihireIEEE\backend>node test-all-phase.js
═══════════════════════════════════════════════
   IntelliHire Phase 2 - Full Integration Test
═══════════════════════════════════════════════

(node:55604) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
(node:55604) [MONGOOSE] DeprecationWarning: Mongoose: the `strictQuery` option will be switched back to `false` by default in Mongoose 7. Use `mongoose.set('strictQuery', false);` if you want to prepare for this change. Or use `mongoose.set('strictQuery', true);` to suppress this warning.
✅ MongoDB connected

TEST 1: LLM Service Health Check
─────────────────────────────────
✅ LLM service operational

TEST 2: Python Multimodal Dependencies
─────────────────────────────────────
[PythonAnalyzer] Dependencies check: OK
✅ Python dependencies installed

TEST 3: Session Enforcement
───────────────────────────
   Found 4 sessions in database
   Sample session: session_1772483489786_fgefb0nar
   Status: active
   Question count: 5
✅ Session enforcement ready

TEST 4: Multimodal Data Integration
────────────────────────────────────
   Results with multimodal analysis: 3
   Sample voice score: 75
   Sample facial score: 75
   Energy (dB): undefined
   Pitch mean: undefined
✅ Multimodal pipeline working

TEST 5: JD-Grounded Generation Service
───────────────────────────────────────
✅ JD Metadata extracted: {
  company: 'Unknown',
  title: 'Senior Software Engineer',
  skills: [
    'React',
    'Node.js',
    'AWS',
    'General Competency',
    'General Competency',
    'General Competency',
    'General Competency',
    'General Competency'
  ],
  context: 'Senior software engineer position',
  experienceLevel: 'senior'
}
✅ JD-grounded service operational

TEST 6: JD Generation Records
──────────────────────────────
   Generated JDs: 20
   Sample JD: Machine Learning Engineer at Company Name
   Skills: Machine Learning, Deep Learning, TensorFlow, PyTorch, Data Engineering, Docker, Kubernetes, Python
✅ JD generation working

═══════════════════════════════════════════════
   Test Results: 6/6 passed
═══════════════════════════════════════════════

🎉 All systems operational! Phase 2 complete.

✅ MongoDB disconnected



```

## Notes

- Ensure MongoDB is running and `.env` is configured.
- These scripts use your existing backend models/services; they are not isolated unit tests.

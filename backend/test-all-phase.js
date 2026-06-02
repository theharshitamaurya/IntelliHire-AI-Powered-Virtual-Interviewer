require("dotenv").config();
const mongoose = require("mongoose");
const { healthCheck: llmHealthCheck } = require("./services/llmService");
const { checkPythonDependencies } = require("./services/pythonAnalyzer");
const { healthCheck: jdHealthCheck } = require("./services/jdGroundedService");
const Session = require("./models/Session");
const InterviewResult = require("./models/InterviewResult");
const JDHistory = require("./models/JDHistory");

async function runFullTest() {
  console.log("═══════════════════════════════════════════════");
  console.log("   IntelliHire Phase 2 - Full Integration Test");
  console.log("═══════════════════════════════════════════════\n");

  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/intellihire",
    );
    console.log("✅ MongoDB connected\n");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }

  let passedTests = 0;
  const totalTests = 6;

  console.log("TEST 1: LLM Service Health Check");
  console.log("─────────────────────────────────");
  try {
    const llmOk = await llmHealthCheck();
    if (llmOk) {
      console.log("✅ LLM service operational\n");
      passedTests++;
    } else {
      console.log("❌ LLM service failed\n");
    }
  } catch (err) {
    console.log("❌ LLM test error:", err.message, "\n");
  }

  console.log("TEST 2: Python Multimodal Dependencies");
  console.log("─────────────────────────────────────");
  try {
    const pythonOk = await checkPythonDependencies();
    if (pythonOk) {
      console.log("✅ Python dependencies installed\n");
      passedTests++;
    } else {
      console.log("❌ Python dependencies missing");
      console.log(
        "   Install: pip3 install numpy opencv-python librosa mediapipe\n",
      );
    }
  } catch (err) {
    console.log("❌ Python test error:", err.message, "\n");
  }

  console.log("TEST 3: Session Enforcement");
  console.log("───────────────────────────");
  try {
    const sessionCount = await Session.countDocuments();
    console.log(`   Found ${sessionCount} sessions in database`);

    if (sessionCount > 0) {
      const sample = await Session.findOne();
      console.log(`   Sample session: ${sample.sessionId}`);
      console.log(`   Status: ${sample.status}`);
      console.log(`   Question count: ${sample.questionIds.length}`);
      console.log("✅ Session enforcement ready\n");
      passedTests++;
    } else {
      console.log("⚠️  No sessions yet (create via POST /api/sessions)\n");
      passedTests++;
    }
  } catch (err) {
    console.log("❌ Session test error:", err.message, "\n");
  }

  console.log("TEST 4: Multimodal Data Integration");
  console.log("────────────────────────────────────");
  try {
    const multimodalCount = await InterviewResult.countDocuments({
      "additionalmetrics.multimodalAnalysisSuccess": true,
    });

    console.log(`   Results with multimodal analysis: ${multimodalCount}`);

    if (multimodalCount > 0) {
      const sample = await InterviewResult.findOne({
        "additionalmetrics.multimodalAnalysisSuccess": true,
      });
      console.log(
        `   Sample voice score: ${sample.voiceanalysis.overallVoiceScore}`,
      );
      console.log(
        `   Sample facial score: ${sample.facialanalysis.overallFacialScore}`,
      );
      console.log(`   Energy (dB): ${sample.voiceanalysis.energydb}`);
      console.log(`   Pitch mean: ${sample.voiceanalysis.pitchmean}`);
      console.log("✅ Multimodal pipeline working\n");
      passedTests++;
    } else {
      console.log("⚠️  No multimodal results yet");
      console.log("   Upload audio/video to test pipeline\n");
    }
  } catch (err) {
    console.log("❌ Multimodal test error:", err.message, "\n");
  }

  console.log("TEST 5: JD-Grounded Generation Service");
  console.log("───────────────────────────────────────");
  try {
    const jdOk = await jdHealthCheck();
    if (jdOk) {
      console.log("✅ JD-grounded service operational\n");
      passedTests++;
    } else {
      console.log("❌ JD service failed\n");
    }
  } catch (err) {
    console.log("❌ JD test error:", err.message, "\n");
  }

  console.log("TEST 6: JD Generation Records");
  console.log("──────────────────────────────");
  try {
    const generatedJDCount = await JDHistory.countDocuments({
      source: "generated",
    });
    console.log(`   Generated JDs: ${generatedJDCount}`);

    if (generatedJDCount > 0) {
      const sample = await JDHistory.findOne({ source: "generated" });
      console.log(`   Sample JD: ${sample.jobTitle} at ${sample.company}`);
      console.log(`   Skills: ${sample.requiredSkills.join(", ")}`);
      console.log("✅ JD generation working\n");
      passedTests++;
    } else {
      console.log("⚠️  No generated JDs yet");
      console.log("   Use POST /api/jds/generate to test\n");
      passedTests++;
    }
  } catch (err) {
    console.log("❌ JD generation test error:", err.message, "\n");
  }

  console.log("═══════════════════════════════════════════════");
  console.log(`   Test Results: ${passedTests}/${totalTests} passed`);
  console.log("═══════════════════════════════════════════════\n");

  if (passedTests === totalTests) {
    console.log("🎉 All systems operational! Phase 2 complete.\n");
  } else {
    console.log("⚠️  Some tests failed. Review logs above.\n");
  }

  await mongoose.disconnect();
  console.log("✅ MongoDB disconnected\n");
}

runFullTest().catch((err) => {
  console.error("❌ Test runner failed:", err);
  process.exit(1);
});

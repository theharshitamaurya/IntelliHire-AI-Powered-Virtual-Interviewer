/**
 * Integration Test for Python-Node Bridge
 * Run this to verify multimodal analysis is working
 *
 * Usage: node test-python-integration.js
 */

const {
  callPythonAnalyzer,
  checkPythonDependencies,
} = require("./services/pythonAnalyzer");
const path = require("path");
const fs = require("fs");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function success(msg) {
  console.log(`${colors.green}OK ${msg}${colors.reset}`);
}

function error(msg) {
  console.log(`${colors.red}FAIL ${msg}${colors.reset}`);
}

function warn(msg) {
  console.log(`${colors.yellow}WARN ${msg}${colors.reset}`);
}

function info(msg) {
  console.log(`${colors.blue}INFO ${msg}${colors.reset}`);
}

async function testIntegration() {
  console.log("\n" + "=".repeat(60));
  console.log("  IntelliHire Python Integration Test");
  console.log("=".repeat(60) + "\n");

  let testsPassedCount = 0;
  let testsSkippedCount = 0;
  const totalTests = 4;

  console.log("TEST 1: Checking Python Dependencies...");

  const depsOk = await checkPythonDependencies();

  if (depsOk) {
    success("Python dependencies installed");
    testsPassedCount++;
  } else {
    error("Python dependencies missing");
    console.log("\nInstall with:");
    console.log("  pip3 install numpy opencv-python librosa mediapipe\n");
    process.exit(1);
  }

  console.log("");

  console.log("TEST 2: Checking Python Script...");

  const pythonScriptPath = path.join(
    __dirname,
    "../analyzer/multimodal_analyzer.py",
  );

  if (fs.existsSync(pythonScriptPath)) {
    success(`Python script found at: ${pythonScriptPath}`);
    testsPassedCount++;
  } else {
    error("Python script not found");
    warn(`Expected location: ${pythonScriptPath}`);
    warn("Copy python-analyzer-cli.py to analyzer/multimodal_analyzer.py");
    process.exit(1);
  }

  console.log("");

  console.log("TEST 3: Testing Audio Analysis...");

  const uploadsDir = path.join(__dirname, "uploads");

  if (!fs.existsSync(uploadsDir)) {
    warn("Uploads directory does not exist, creating...");
    fs.mkdirSync(uploadsDir);
  }

  const audioFiles = fs
    .readdirSync(uploadsDir)
    .filter(
      (f) => f.endsWith(".wav") || f.endsWith(".mp3") || f.endsWith(".webm"),
    );

  if (audioFiles.length > 0) {
    const testAudioPath = path.join(uploadsDir, audioFiles[0]);
    info(`Testing with: ${audioFiles[0]}`);

    try {
      const result = await callPythonAnalyzer(testAudioPath, null);

      if (result.success && result.audio) {
        success("Audio analysis completed successfully");

        console.log("\nSample Audio Features:");
        console.log(`  Energy (dB): ${result.audio.energy_db.toFixed(2)}`);
        console.log(
          `  Spectral Centroid: ${result.audio.spectral_centroid_mean.toFixed(2)} Hz`,
        );
        console.log(`  Pitch: ${result.audio.pitch_mean.toFixed(2)} Hz`);
        console.log(
          `  Voice Activity: ${(result.audio.voice_activity * 100).toFixed(1)}%`,
        );
        console.log(`  Confidence Score: ${result.audio.confidence}`);
        console.log(`  Overall Voice Score: ${result.audio.overallVoiceScore}`);

        testsPassedCount++;
      } else {
        warn("Audio analysis returned but no features extracted");
      }
    } catch (err) {
      error(`Audio analysis failed: ${err.message}`);
      console.log("\nError details:", err);
    }
  } else {
    warn("No audio files found in uploads/ directory");
    info("Upload an interview through the frontend to test with real data");
    info("Skipping audio analysis test");
    testsSkippedCount++;
  }

  console.log("");

  console.log("TEST 4: Checking MongoDB Schema...");

  try {
    const InterviewResult = require("./models/InterviewResult");
    const schema = InterviewResult.schema.paths;

    const requiredFields = [
      "voiceanalysis",
      "facialanalysis",
      "contentanalysis",
      "overallscore",
      "comprehensivefeedback",
    ];

    let allFieldsExist = true;

    requiredFields.forEach((field) => {
      if (schema[field]) {
        success(`Schema has '${field}' field`);
      } else {
        error(`Schema missing '${field}' field`);
        allFieldsExist = false;
      }
    });

    if (allFieldsExist) {
      testsPassedCount++;
    } else {
      error("MongoDB schema is missing required fields");
      warn("Your InterviewResult model may be outdated");
    }
  } catch (err) {
    error(`Could not load InterviewResult model: ${err.message}`);
  }

  console.log("");

  const testsFailedCount = totalTests - testsPassedCount - testsSkippedCount;

  console.log("=".repeat(60));
  console.log(
    `  Test Results: ${testsPassedCount} passed, ${testsSkippedCount} skipped, ${testsFailedCount} failed`,
  );
  console.log("=".repeat(60));

  if (testsFailedCount === 0) {
    success("\nAll required tests passed. Python integration is ready.\n");

    console.log("Next Steps:");
    console.log("  1. Start backend: npm start");
    console.log("  2. Upload interview through frontend");
    console.log("  3. Check MongoDB for voiceanalysis data");
    console.log("  4. Verify overallscore reflects multimodal fusion\n");
  } else {
    error(`\n${testsFailedCount} test(s) failed. Fix issues above.\n`);
    process.exit(1);
  }
}

testIntegration().catch((err) => {
  error(`Test suite failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});

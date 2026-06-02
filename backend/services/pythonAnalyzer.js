const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// Hugging Face Space configuration
const HF_SPACE_URL = process.env.HF_SPACE_URL || null;
const HF_SPACE_API_KEY = process.env.HF_SPACE_API_KEY || null;
const USE_LOCAL_ANALYZER = process.env.USE_LOCAL_ANALYZER === "true" || !HF_SPACE_URL;

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Hugging Face Space analyzer with retry logic
 * @param {string} audioPath - Path to audio file
 * @param {string} videoPath - Path to video file
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Object>} - Multimodal features extracted by HF Space
 */
async function callHuggingFaceSpace(audioPath = null, videoPath = null, retryCount = 0) {
  if (!audioPath && !videoPath) {
    throw new Error("At least one of audioPath or videoPath must be provided");
  }

  if (!HF_SPACE_URL) {
    throw new Error(
      "HF_SPACE_URL not configured. Please set the environment variable or enable USE_LOCAL_ANALYZER=true"
    );
  }

  // Validate files exist
  if (audioPath && !fs.existsSync(audioPath)) {
    console.error(`[HFAnalyzer] Audio file not found: ${audioPath}`);
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  if (videoPath && !fs.existsSync(videoPath)) {
    console.error(`[HFAnalyzer] Video file not found: ${videoPath}`);
    throw new Error(`Video file not found: ${videoPath}`);
  }

  try {
    const form = new FormData();

    if (audioPath) {
      console.log(`[HFAnalyzer] Adding audio file: ${path.basename(audioPath)}`);
      form.append("audio", fs.createReadStream(audioPath));
    }

    if (videoPath) {
      console.log(`[HFAnalyzer] Adding video file: ${path.basename(videoPath)}`);
      form.append("video", fs.createReadStream(videoPath));
    }

    const headers = {
      ...form.getHeaders(),
    };

    // Add API key if provided (for private Spaces)
    if (HF_SPACE_API_KEY) {
      headers["Authorization"] = `Bearer ${HF_SPACE_API_KEY}`;
    }

    console.log(`[HFAnalyzer] Calling Hugging Face Space: ${HF_SPACE_URL}/analyze (attempt ${retryCount + 1}/${MAX_RETRIES})`);

    const response = await axios.post(`${HF_SPACE_URL}/analyze`, form, {
      headers,
      timeout: REQUEST_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    if (!response.data) {
      throw new Error("Empty response from Hugging Face Space");
    }

    if (!response.data.success) {
      console.warn("[HFAnalyzer] Analysis completed with warnings");
      if (response.data.error) {
        console.warn(`[HFAnalyzer] Error: ${response.data.error}`);
      }
    }

    console.log("[HFAnalyzer] Analysis complete");
    return response.data;

  } catch (error) {
    const isTimeout = error.code === "ECONNABORTED" || error.message.includes("timeout");
    const isServerError = error.response && error.response.status >= 500;
    const isColdStart = isTimeout && retryCount === 0;

    console.error(`[HFAnalyzer] Request failed (attempt ${retryCount + 1}):`, error.message);

    // Retry logic
    if (retryCount < MAX_RETRIES - 1 && (isTimeout || isServerError || isColdStart)) {
      const delayMs = RETRY_DELAY_MS * Math.pow(2, retryCount); // Exponential backoff
      console.log(`[HFAnalyzer] Retrying in ${delayMs}ms... (cold start: ${isColdStart})`);
      await sleep(delayMs);
      return callHuggingFaceSpace(audioPath, videoPath, retryCount + 1);
    }

    // After all retries exhausted
    if (error.response) {
      throw new Error(
        `Hugging Face Space returned ${error.response.status}: ${error.response.data?.error || error.message}`
      );
    } else if (error.request) {
      throw new Error(
        `No response from Hugging Face Space. Please check if the Space is running at ${HF_SPACE_URL}`
      );
    } else {
      throw new Error(`Failed to call Hugging Face Space: ${error.message}`);
    }
  }
}

/**
 * Call Python analyzer for audio and/or video files
 * Routes to either local Python or Hugging Face Space based on configuration
 * @param {string} audioPath - Path to audio file
 * @param {string} videoPath - Path to video file
 * @returns {Promise<Object>} - Multimodal features extracted by analyzer
 */
async function callPythonAnalyzer(audioPath = null, videoPath = null) {
  if (USE_LOCAL_ANALYZER) {
    // Fallback to local Python analyzer (legacy mode)
    console.log("[Analyzer] Using local Python analyzer (legacy mode)");
    return callLocalPythonAnalyzer(audioPath, videoPath);
  } else {
    // Use Hugging Face Space
    console.log("[Analyzer] Using Hugging Face Space analyzer");
    return callHuggingFaceSpace(audioPath, videoPath);
  }
}

/**
 * Legacy local Python analyzer (kept for fallback)
 * @param {string} audioPath - Path to audio file
 * @param {string} videoPath - Path to video file
 * @returns {Promise<Object>} - Multimodal features
 */
async function callLocalPythonAnalyzer(audioPath = null, videoPath = null) {
  const { spawn } = require("child_process");

  const PYTHON_SCRIPT_CANDIDATES = [
    path.join(__dirname, "../../ml-service/multimodal_analyzer.py"),
    path.join(__dirname, "../../python/multimodal_analyzer.py"),
    path.join(__dirname, "../../analyzer/multimodal_analyzer.py"),
  ];

  const PYTHON_SCRIPT =
    PYTHON_SCRIPT_CANDIDATES.find((p) => fs.existsSync(p)) ||
    PYTHON_SCRIPT_CANDIDATES[0];

  const PYTHON_EXECUTABLE =
    process.env.PYTHON_EXECUTABLE ||
    (process.platform === "win32" ? "python" : "python3");

  return new Promise((resolve, reject) => {
    if (!audioPath && !videoPath) {
      return reject(
        new Error("At least one of audioPath or videoPath must be provided")
      );
    }

    const args = [PYTHON_SCRIPT];

    if (audioPath) {
      if (!fs.existsSync(audioPath)) {
        return reject(new Error(`Audio file not found: ${audioPath}`));
      }
      args.push("--audio", audioPath);
    }

    if (videoPath) {
      if (!fs.existsSync(videoPath)) {
        return reject(new Error(`Video file not found: ${videoPath}`));
      }
      args.push("--video", videoPath);
    }

    args.push("--verbose");

    console.log(`[LocalAnalyzer] Spawning: ${PYTHON_EXECUTABLE} ${args.join(" ")}`);

    const python = spawn(PYTHON_EXECUTABLE, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutData = "";
    let stderrData = "";

    python.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    python.stderr.on("data", (data) => {
      const message = data.toString();
      stderrData += message;
      console.error(`[LocalAnalyzer] ${message.trim()}`);
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error(`[LocalAnalyzer] Process exited with code ${code}`);
        return reject(
          new Error(`Python analyzer exited with code ${code}: ${stderrData}`)
        );
      }

      try {
        const result = JSON.parse(stdoutData);
        console.log("[LocalAnalyzer] Analysis complete");
        resolve(result);
      } catch (parseError) {
        console.error("[LocalAnalyzer] Failed to parse JSON output");
        reject(new Error(`Failed to parse Python output: ${parseError.message}`));
      }
    });

    python.on("error", (error) => {
      console.error("[LocalAnalyzer] Failed to spawn process:", error);
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });

    const timeout = setTimeout(() => {
      python.kill();
      reject(new Error("Python analyzer timed out after 5 minutes"));
    }, 5 * 60 * 1000);

    python.on("close", () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Analyze audio file only
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<Object>} - Audio features
 */
async function analyzeAudio(audioPath) {
  const result = await callPythonAnalyzer(audioPath, null);
  return result.audio || {};
}

/**
 * Analyze video file only
 * @param {string} videoPath - Path to video file
 * @returns {Promise<Object>} - Video features
 */
async function analyzeVideo(videoPath) {
  const result = await callPythonAnalyzer(null, videoPath);
  return result.video || {};
}

/**
 * Analyze both audio and video
 * @param {string} audioPath - Path to audio file
 * @param {string} videoPath - Path to video file
 * @returns {Promise<Object>} - Combined features
 */
async function analyzeMultimodal(audioPath, videoPath) {
  const result = await callPythonAnalyzer(audioPath, videoPath);
  return {
    audio: result.audio || {},
    video: result.video || {},
    success: result.success,
  };
}

/**
 * Check if analyzer service is available and ready
 * @returns {Promise<boolean>}
 */
async function checkPythonDependencies() {
  try {
    if (USE_LOCAL_ANALYZER) {
      // Check local Python dependencies
      console.log("[Analyzer] Checking local Python dependencies...");
      const { spawn } = require("child_process");
      const PYTHON_EXECUTABLE =
        process.env.PYTHON_EXECUTABLE ||
        (process.platform === "win32" ? "python" : "python3");

      return new Promise((resolve) => {
        const python = spawn(PYTHON_EXECUTABLE, [
          "-c",
          "import cv2, librosa, mediapipe, numpy",
        ]);

        python.on("close", (code) => {
          if (code === 0) {
            console.log("[Analyzer] Local Python dependencies: OK");
            resolve(true);
          } else {
            console.error("[Analyzer] Local Python dependencies: FAILED");
            console.error(
              "[Analyzer] Install: pip install opencv-python librosa mediapipe numpy"
            );
            resolve(false);
          }
        });

        python.on("error", () => {
          console.error("[Analyzer] Python executable not found");
          resolve(false);
        });
      });
    } else {
      // Check Hugging Face Space health
      console.log("[Analyzer] Checking Hugging Face Space health...");

      if (!HF_SPACE_URL) {
        console.error("[Analyzer] HF_SPACE_URL not configured");
        return false;
      }

      const headers = {};
      if (HF_SPACE_API_KEY) {
        headers["Authorization"] = `Bearer ${HF_SPACE_API_KEY}`;
      }

      const response = await axios.get(`${HF_SPACE_URL}/health`, {
        headers,
        timeout: 30000, // 30 seconds
      });

      if (response.data && response.data.status === "ok") {
        console.log("[Analyzer] Hugging Face Space: OK");
        console.log(`[Analyzer] Models loaded: ${response.data.models_loaded}`);
        return true;
      } else {
        console.error("[Analyzer] Hugging Face Space health check failed");
        return false;
      }
    }
  } catch (error) {
    console.error(
      `[Analyzer] Health check failed: ${error.message}`
    );
    if (!USE_LOCAL_ANALYZER) {
      console.error(
        `[Analyzer] Make sure your Hugging Face Space is running at: ${HF_SPACE_URL}`
      );
    }
    return false;
  }
}

module.exports = {
  callPythonAnalyzer,
  analyzeAudio,
  analyzeVideo,
  analyzeMultimodal,
  checkPythonDependencies,
};

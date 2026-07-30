#!/usr/bin/env node
/**
 * Test script for Hugging Face Space integration
 * Tests both health check and analysis endpoints
 * 
 * Usage:
 *   node test-hf-space.js
 *   node test-hf-space.js --audio sample.wav --video sample.mp4
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const HF_SPACE_URL = process.env.HF_SPACE_URL;
const HF_SPACE_API_KEY = process.env.HF_SPACE_API_KEY;

// Parse command line arguments
const args = process.argv.slice(2);
let audioPath = null;
let videoPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--audio' && i + 1 < args.length) {
    audioPath = args[i + 1];
    i++;
  } else if (args[i] === '--video' && i + 1 < args.length) {
    videoPath = args[i + 1];
    i++;
  }
}

console.log('='.repeat(60));
console.log('Hugging Face Space Integration Test');
console.log('='.repeat(60));

// Validate configuration
if (!HF_SPACE_URL) {
  console.error('❌ ERROR: HF_SPACE_URL not set in .env file');
  console.log('\nPlease add to backend/.env:');
  console.log('HF_SPACE_URL=https://huggingface.co/spaces/YOUR_USERNAME/intellihire-analyzer/api');
  process.exit(1);
}

console.log(`\n🌐 Space URL: ${HF_SPACE_URL}`);
console.log(`🔑 API Key: ${HF_SPACE_API_KEY ? 'Set (Private Space)' : 'Not set (Public Space)'}\n`);

// Test 1: Health Check
async function testHealthCheck() {
  console.log('Test 1: Health Check');
  console.log('-'.repeat(60));

  try {
    const headers = {};
    if (HF_SPACE_API_KEY) {
      headers['Authorization'] = `Bearer ${HF_SPACE_API_KEY}`;
    }

    console.log(`📡 GET ${HF_SPACE_URL}/health`);
    
    const startTime = Date.now();
    const response = await axios.get(`${HF_SPACE_URL}/health`, {
      headers,
      timeout: 30000,
    });
    const duration = Date.now() - startTime;

    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));

    if (response.data.status === 'ok' && response.data.models_loaded) {
      console.log('✅ Health check PASSED\n');
      return true;
    } else {
      console.log('⚠️  Health check returned unexpected data\n');
      return false;
    }
  } catch (error) {
    console.log('❌ Health check FAILED');
    
    if (error.code === 'ECONNABORTED') {
      console.log('   Reason: Request timeout (Space may be waking up)');
      console.log('   Solution: Wait 30-60s and try again');
    } else if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error || error.message}`);
    } else if (error.request) {
      console.log('   Reason: No response from server');
      console.log('   Solution: Check if Space URL is correct and Space is Running');
    } else {
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Visit your Space in a browser to wake it up');
    console.log('   2. Check Space status is "Running" not "Building"');
    console.log('   3. Verify HF_SPACE_URL in .env is correct');
    console.log(`      Expected format: https://huggingface.co/spaces/USERNAME/SPACE_NAME/api\n`);
    
    return false;
  }
}

// Test 2: Analysis (if files provided)
async function testAnalysis() {
  if (!audioPath && !videoPath) {
    console.log('Test 2: Analysis');
    console.log('-'.repeat(60));
    console.log('⏭️  Skipped (no audio/video files provided)');
    console.log('\nTo test analysis, run:');
    console.log('  node test-hf-space.js --audio sample.wav --video sample.mp4\n');
    return true;
  }

  console.log('Test 2: Analysis');
  console.log('-'.repeat(60));

  // Validate files
  if (audioPath && !fs.existsSync(audioPath)) {
    console.log(`❌ Audio file not found: ${audioPath}\n`);
    return false;
  }

  if (videoPath && !fs.existsSync(videoPath)) {
    console.log(`❌ Video file not found: ${videoPath}\n`);
    return false;
  }

  try {
    const form = new FormData();

    if (audioPath) {
      console.log(`📁 Uploading audio: ${path.basename(audioPath)} (${fs.statSync(audioPath).size} bytes)`);
      form.append('audio', fs.createReadStream(audioPath));
    }

    if (videoPath) {
      console.log(`📁 Uploading video: ${path.basename(videoPath)} (${fs.statSync(videoPath).size} bytes)`);
      form.append('video', fs.createReadStream(videoPath));
    }

    const headers = {
      ...form.getHeaders(),
    };

    if (HF_SPACE_API_KEY) {
      headers['Authorization'] = `Bearer ${HF_SPACE_API_KEY}`;
    }

    console.log(`📡 POST ${HF_SPACE_URL}/analyze`);
    console.log(`⏳ Processing (this may take 10-60 seconds)...`);

    const startTime = Date.now();
    const response = await axios.post(`${HF_SPACE_URL}/analyze`, form, {
      headers,
      timeout: 120000, // 2 minutes
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    const duration = Date.now() - startTime;

    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`⏱️  Response time: ${(duration / 1000).toFixed(1)}s`);

    const result = response.data;

    if (result.success) {
      console.log('✅ Analysis PASSED');
      
      if (result.audio) {
        console.log('\n📊 Audio Analysis:');
        console.log(`   Confidence: ${result.audio.confidence}`);
        console.log(`   Clarity: ${result.audio.clarity}`);
        console.log(`   Pace: ${result.audio.pace}`);
        console.log(`   Volume: ${result.audio.volume}`);
        console.log(`   Overall Voice Score: ${result.audio.overallVoiceScore}`);
      }

      if (result.video) {
        console.log('\n📊 Video Analysis:');
        console.log(`   Eye Contact: ${result.video.eyeContact}`);
        console.log(`   Professionalism: ${result.video.professionalism}`);
        console.log(`   Engagement: ${result.video.engagement}`);
        console.log(`   Gestures: ${result.video.gestures}`);
        console.log(`   Overall Video Score: ${result.video.overallVideoScore}`);
      }

      console.log('\n✅ All tests PASSED! Integration is working correctly.\n');
      return true;
    } else {
      console.log('⚠️  Analysis returned success=false');
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log();
      return false;
    }
  } catch (error) {
    console.log('❌ Analysis FAILED');

    if (error.code === 'ECONNABORTED') {
      console.log('   Reason: Request timeout');
      console.log('   Solution: Try again or increase timeout in pythonAnalyzer.js');
    } else if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error || error.message}`);
    } else if (error.request) {
      console.log('   Reason: No response from server');
    } else {
      console.log(`   Error: ${error.message}`);
    }

    console.log();
    return false;
  }
}

// Run tests
(async () => {
  try {
    const healthPassed = await testHealthCheck();
    
    if (!healthPassed) {
      console.log('❌ Health check failed. Fix health check before testing analysis.\n');
      process.exit(1);
    }

    const analysisPassed = await testAnalysis();

    if (healthPassed && analysisPassed) {
      console.log('='.repeat(60));
      console.log('🎉 SUCCESS! Hugging Face Space is ready to use.');
      console.log('='.repeat(60));
      console.log('\nNext steps:');
      console.log('1. Start your backend: npm start');
      console.log('2. Check logs for: [Analyzer] Using Hugging Face Space analyzer');
      console.log('3. Test end-to-end by recording an interview in the frontend\n');
      process.exit(0);
    } else {
      console.log('='.repeat(60));
      console.log('❌ Tests failed. Check errors above and try again.');
      console.log('='.repeat(60));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
})();

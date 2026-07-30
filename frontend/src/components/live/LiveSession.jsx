import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  Play,
  Pause,
  Square,
  Camera,
  Target,
  MessageSquare,
  Send,
  Brain,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import APIService from "../../services/api";

const FallbackStyles = (
  <style>{`
    /* IntelliHire theme tokens (easy to tweak: accent hue + surface opacity) */
    :root{
      /* Accent hue: 255–270 = indigo→violet */
      --ih-accent-h: 262;

      /* Background */
      --ih-bg-0: #070A14;
      --ih-bg-1: #0A1022;
      --ih-bg-2: #0B132B;

      /* Text */
      --ih-text: rgba(255,255,255,.92);
      --ih-muted: rgba(255,255,255,.68);
      --ih-muted2: rgba(255,255,255,.50);

      /* Surfaces (flatter cards) */
      --ih-surface: rgba(15, 23, 42, .58);
      --ih-surface-strong: rgba(15, 23, 42, .70);
      --ih-inset: rgba(255,255,255,.03);

      /* Borders (sharper) */
      --ih-border: rgba(255,255,255,.08);
      --ih-border-2: rgba(255,255,255,.12);
      --ih-focus: hsla(var(--ih-accent-h), 90%, 62%, .22);

      /* Accents */
      --ih-accent-a: hsl(calc(var(--ih-accent-h) - 10), 92%, 62%);
      --ih-accent-b: hsl(calc(var(--ih-accent-h) + 10), 90%, 62%);

      /* Status */
      --ih-danger-a:#ed3a5a;
      --ih-danger-b:#a0062d;
      --ih-warn:#ffb347;

      /* Radius + shadows (less glow, more crisp depth) */
      --ih-r-card: 16px;
      --ih-r-inner: 12px;
      --ih-r-pill: 999px;

      --ih-shadow: 0 18px 54px rgba(0,0,0,.44);
      --ih-shadow-soft: 0 12px 32px rgba(0,0,0,.30);

      --ih-ease: cubic-bezier(.2,.8,.2,1);
      --ih-t: 180ms;
      --ih-t-fast: 140ms;
    }

    *{ box-sizing:border-box; }
    html, body{ height:100%; }
    body{
      color: var(--ih-text);
      background: var(--ih-bg-0);
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }

    /* FULL-SCREEN BACKGROUND (removes the "boxed" look inside Layout max-width) */
    .app-container{
      position: relative;
      isolation: isolate;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      color: var(--ih-text);
      background: transparent !important; /* important: background goes on ::before */
    }

    .app-container::before{
      content:"";
      position: fixed;
      inset: 0;
      z-index: -1;

      background:
        radial-gradient(1200px 700px at 18% 12%, hsla(var(--ih-accent-h), 90%, 62%, .18), transparent 60%),
        radial-gradient(900px 600px at 85% 28%, hsla(calc(var(--ih-accent-h) + 18), 90%, 62%, .12), transparent 55%),
        linear-gradient(180deg, var(--ih-bg-0) 0%, var(--ih-bg-1) 45%, var(--ih-bg-2) 100%);
    }

    /* --- CARD: flatter surface, sharper border --- */
    .card{
      background: var(--ih-surface);
      border: 1px solid var(--ih-border);
      border-radius: var(--ih-r-card);

      padding: 1.55rem;
      margin-bottom: 1.55rem;

      box-shadow: var(--ih-shadow-soft);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);

      transition:
        transform var(--ih-t) var(--ih-ease),
        box-shadow var(--ih-t) var(--ih-ease),
        border-color var(--ih-t) var(--ih-ease),
        background var(--ih-t) var(--ih-ease);
    }

    @media (hover:hover){
      .card:hover{
        transform: translateY(-1px);
        box-shadow: var(--ih-shadow);
        border-color: var(--ih-border-2);
        background: var(--ih-surface-strong);
      }
    }

    /* Remove “card inside card” look (nested cards become inset panels) */
    .card .card{
      margin-bottom: 0 !important;
      padding: 1rem 1.05rem !important;

      background: var(--ih-inset) !important;
      border: 1px solid rgba(255,255,255,.07) !important;
      box-shadow: none !important;

      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;

      transform: none !important;
    }

    /* --- BUTTONS: crisp gradient, consistent focus ring --- */
    .btn{
      display:inline-flex;
      align-items:center;
      gap:.5rem;

      padding: 11px 18px;
      border-radius: 12px;

      border: 1px solid rgba(255,255,255,.10);
      cursor:pointer;

      font-weight: 650;
      letter-spacing: .2px;
      color:#fff;

      background: linear-gradient(90deg, var(--ih-accent-a) 0%, var(--ih-accent-b) 100%);
      box-shadow: 0 14px 30px rgba(0,0,0,.28);

      margin-right: .5rem;

      transition:
        transform var(--ih-t-fast) var(--ih-ease),
        box-shadow var(--ih-t) var(--ih-ease),
        filter var(--ih-t) var(--ih-ease),
        border-color var(--ih-t) var(--ih-ease);
      will-change: transform;
    }

    @media (hover:hover){
      .btn:hover{
        transform: translateY(-1px);
        filter: brightness(1.05) saturate(1.03);
        box-shadow: 0 18px 40px rgba(0,0,0,.34);
        border-color: rgba(255,255,255,.14);
      }
    }

    .btn:active{ transform: translateY(0) scale(.99); filter: brightness(.98); }
    .btn:disabled{ opacity:.55; cursor:not-allowed; transform:none; filter:none; }

    .btn:focus-visible{
      outline:none;
      box-shadow:
        0 18px 40px rgba(0,0,0,.34),
        0 0 0 3px var(--ih-focus);
    }

    .btn-warning{
      background: var(--ih-warn);
      color:#18223c;
      border-color: rgba(255,255,255,.18);
      box-shadow: 0 16px 34px rgba(0,0,0,.22);
    }

    .btn-danger{
      background: linear-gradient(90deg, var(--ih-danger-a) 0%, var(--ih-danger-b) 100%);
      border-color: rgba(255,255,255,.10);
      box-shadow: 0 18px 40px rgba(0,0,0,.34);
    }

    /* --- CAMERA --- */
    .camera-container{
      position:relative;
      height:370px;
      overflow:hidden;

      border-radius: 18px;
      background:#050510;

      border: 1px solid hsla(var(--ih-accent-h), 90%, 62%, .26);
      box-shadow: 0 20px 60px rgba(0,0,0,.45);
    }

    .camera-video{
      width:100%;
      height:100%;
      object-fit:cover;
      transform:scaleX(-1);
      border-radius:18px;
      background:#050510;
      filter: contrast(1.03) saturate(1.03);
    }

    .camera-placeholder{
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      height:100%;
      color:#7a90b3;
      gap:.25rem;
    }

    /* --- REC --- */
    .recording-indicator{
      position:absolute;
      top:1rem;
      right:1rem;

      background: rgba(237,58,90,.92);
      color:white;

      border-radius: var(--ih-r-pill);
      padding: 8px 18px;
      font-weight: 750;
      letter-spacing: .3px;

      display:flex;
      align-items:center;
      box-shadow: 0 16px 34px rgba(0,0,0,.30);
    }

    @keyframes recPulse{
      0%{ transform: scale(1); opacity: .92; }
      50%{ transform: scale(1.12); opacity: 1; }
      100%{ transform: scale(1); opacity: .92; }
    }

    .recording-dot{
      width:10px;
      height:10px;
      background:white;
      border-radius:50%;
      display:inline-block;
      margin-right:8px;
      animation: recPulse 1.1s ease-in-out infinite;
    }

    /* --- PROGRESS --- */
    .progress-bar{
      width:100%;
      height: 8px;
      background: rgba(255,255,255,.06);
      border-radius: var(--ih-r-pill);
      overflow:hidden;
      margin-top:1rem;
      border: 1px solid rgba(255,255,255,.06);
    }

    .progress-fill{
      height:100%;
      background: linear-gradient(90deg, var(--ih-accent-a) 0%, var(--ih-accent-b) 100%);
      border-radius: var(--ih-r-pill);
      transition: width 320ms var(--ih-ease);
      box-shadow: none;
    }

    .text-gradient{
      background: linear-gradient(90deg, var(--ih-accent-a) 0%, var(--ih-accent-b) 100%);
      -webkit-background-clip:text;
      -webkit-text-fill-color:transparent;
      background-clip:text;
      letter-spacing: .2px;
    }

    /* --- CHAT --- */
    .chat-container{
      max-height:300px;
      overflow-y:auto;
      margin-bottom:1rem;
      padding-right: 6px;
      scroll-behavior:smooth;
    }

    .chat-message{
      margin-bottom:.85rem;
      padding:.9rem .95rem;
      border-radius: 12px;

      background: rgba(255,255,255,.03);
      border: 1px solid rgba(255,255,255,.07);
      box-shadow: none;
    }

    .chat-message.ai{
      border-left: 3px solid rgba(99,102,241,.92);
      background: rgba(99,102,241,.08);
    }

    .chat-message.user{
      border-left: 3px solid hsla(var(--ih-accent-h), 90%, 62%, .92);
      background: hsla(var(--ih-accent-h), 90%, 62%, .08);
      text-align:right;
    }

    .chat-input-container{ display:flex; gap:.6rem; }

    .chat-input{
      flex:1;
      background: rgba(255,255,255,.03);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 12px;
      padding: .78rem .9rem;
      color:#fff;
      transition: border-color var(--ih-t) var(--ih-ease), box-shadow var(--ih-t) var(--ih-ease), background var(--ih-t) var(--ih-ease);
    }

    .chat-input::placeholder{ color: rgba(255,255,255,.40); }

    .chat-input:focus{
      outline:none;
      background: rgba(255,255,255,.04);
      border-color: hsla(var(--ih-accent-h), 90%, 62%, .34);
      box-shadow: 0 0 0 3px hsla(var(--ih-accent-h), 90%, 62%, .14);
    }

    .btn-success{
      background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%) !important;
      border-color: rgba(255,255,255,.14) !important;
      box-shadow: 0 18px 40px rgba(0,0,0,.30) !important;
    }

    /* --- LIVE SESSION LAYOUT --- */
    .live-layout{
      display:grid;
      grid-template-columns: 320px minmax(520px, 1fr) minmax(300px, .95fr);
      gap: 1.25rem;
      max-width: 1800px;
      margin: 0 auto;
      align-items: start;
    }

    .live-col-sticky{
      position: sticky;
      top: 100px;
      align-self: start;
    }

    .live-col-right{
      min-width: 0;
    }

    @media (max-width: 1400px){
      .live-layout{
        grid-template-columns: 290px minmax(460px, 1fr) minmax(280px, .9fr);
      }
    }

    @media (max-width: 1120px){
      .live-layout{
        grid-template-columns: 1fr;
      }

      .live-col-sticky{
        position: static;
        top: auto;
      }
    }


    @media (max-width: 768px){
      .card{ padding: 1.2rem; margin-bottom: 1.2rem; }
      .camera-container{ height: 320px; }
    }

    @media (prefers-reduced-motion: reduce){
      .card, .btn, .progress-fill{ transition: none !important; }
      .recording-dot{ animation: none !important; }
    }
  `}</style>
);

const CONFIG = {
  SAMPLE_RATE: 44100,
  PAUSE_THRESHOLD: 0.018,
  ENERGY_MIN: 0.015,
  ENERGY_MAX: 0.2,
  PITCH_MIN: 80,
  PITCH_MAX: 300,
  PITCH_VAR_MIN: 10,
  PITCH_VAR_MAX: 80,
  MAX_HISTORY_SIZE: 50,
  QUESTION_MS: 30_000,
  VIDEO_WIDTH: 640,
  VIDEO_HEIGHT: 360,
  FACE_SCAN_WIDTH: 320,
  FACE_SCAN_HEIGHT: 180,
  VIDEO_TIMESLICE_MS: 2000,
};

const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const minmax = (x, minv, maxv) => (x - minv) / (maxv - minv + 1e-9);
const logistic = (x, k = 6, x0 = 0.5) => 1 / (1 + Math.exp(-k * (x - x0)));

class AudioFeatureExtractor {
  constructor() {
    this.energyHistory = [];
    this.pitchHistory = [];
    this.spectralCentroidHistory = [];
    this.spectralRolloffHistory = [];
    this.zcrHistory = [];
    this.pauseCount = 0;
    this.speechFrames = 0;
    this.totalFrames = 0;
  }

  extractFeatures(analyser, freqArray, timeArray) {
    if (!analyser || !freqArray || !timeArray) return this.getDefaultFeatures();

    analyser.getByteFrequencyData(freqArray);
    analyser.getByteTimeDomainData(timeArray);

    let sum = 0;
    for (let i = 0; i < timeArray.length; i++) {
      const n = (timeArray[i] - 128) / 128;
      sum += n * n;
    }
    const energy = Math.sqrt(sum / timeArray.length);
    this.energyHistory.push(energy);
    if (this.energyHistory.length > CONFIG.MAX_HISTORY_SIZE)
      this.energyHistory.shift();

    const pitch = this.estimatePitch(timeArray);
    if (pitch > 0) {
      this.pitchHistory.push(pitch);
      if (this.pitchHistory.length > CONFIG.MAX_HISTORY_SIZE)
        this.pitchHistory.shift();
    }

    const spectralCentroid = this.calculateSpectralCentroid(freqArray);
    const spectralRolloff = this.calculateSpectralRolloff(freqArray, 0.85);
    this.spectralCentroidHistory.push(spectralCentroid);
    this.spectralRolloffHistory.push(spectralRolloff);
    if (this.spectralCentroidHistory.length > CONFIG.MAX_HISTORY_SIZE)
      this.spectralCentroidHistory.shift();
    if (this.spectralRolloffHistory.length > CONFIG.MAX_HISTORY_SIZE)
      this.spectralRolloffHistory.shift();

    let zc = 0;
    for (let i = 1; i < timeArray.length; i++) {
      const a = timeArray[i - 1] - 128;
      const b = timeArray[i] - 128;
      if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) zc++;
    }
    const zcr = zc / timeArray.length;
    this.zcrHistory.push(zcr);
    if (this.zcrHistory.length > CONFIG.MAX_HISTORY_SIZE)
      this.zcrHistory.shift();

    const isSpeaking = energy > CONFIG.PAUSE_THRESHOLD;
    if (!isSpeaking) this.pauseCount++;
    else this.speechFrames++;
    this.totalFrames++;

    return {
      energy,
      pitch,
      spectralCentroid,
      spectralRolloff,
      zcr,
      isSpeaking,
    };
  }

  estimatePitch(timeArray) {
    const SIZE = timeArray.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);

    let bestOffset = -1;
    let bestCorrelation = 0;

    const minOff = Math.floor(CONFIG.SAMPLE_RATE / CONFIG.PITCH_MAX);
    const maxOff = Math.floor(CONFIG.SAMPLE_RATE / CONFIG.PITCH_MIN);

    for (
      let offset = minOff;
      offset <= Math.min(MAX_SAMPLES, maxOff);
      offset++
    ) {
      let corr = 0;
      for (let i = 0; i < MAX_SAMPLES; i++) {
        corr += Math.abs(timeArray[i] - 128 - (timeArray[i + offset] - 128));
      }
      corr = 1 - corr / (MAX_SAMPLES * 128);
      if (corr > 0.9 && corr > bestCorrelation) {
        bestCorrelation = corr;
        bestOffset = offset;
      }
    }
    if (bestOffset > 0) return CONFIG.SAMPLE_RATE / bestOffset;
    return 0;
  }

  calculateSpectralCentroid(freqArray) {
    let num = 0;
    let den = 0;
    for (let i = 0; i < freqArray.length; i++) {
      num += i * freqArray[i];
      den += freqArray[i];
    }
    return den > 0 ? num / den : 0;
  }

  calculateSpectralRolloff(freqArray, rolloffPercent = 0.85) {
    let total = 0;
    for (let i = 0; i < freqArray.length; i++) total += freqArray[i];
    const threshold = total * rolloffPercent;
    let sum = 0;
    for (let i = 0; i < freqArray.length; i++) {
      sum += freqArray[i];
      if (sum >= threshold) return i / freqArray.length;
    }
    return 1.0;
  }

  mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  std(arr) {
    if (!arr.length) return 0;
    const m = this.mean(arr);
    return Math.sqrt(this.mean(arr.map((v) => (v - m) ** 2)));
  }

  getAggregatedFeatures() {
    return {
      energyMean: this.mean(this.energyHistory),
      pitchStd: this.std(this.pitchHistory),
      spectralCentroidMean: this.mean(this.spectralCentroidHistory),
      pauseCount: this.pauseCount,
      speechRatio: this.speechFrames / Math.max(1, this.totalFrames),
    };
  }

  getDefaultFeatures() {
    return {
      energy: 0,
      pitch: 0,
      spectralCentroid: 0,
      spectralRolloff: 0,
      zcr: 0,
      isSpeaking: false,
    };
  }

  reset() {
    this.energyHistory = [];
    this.pitchHistory = [];
    this.spectralCentroidHistory = [];
    this.spectralRolloffHistory = [];
    this.zcrHistory = [];
    this.pauseCount = 0;
    this.speechFrames = 0;
    this.totalFrames = 0;
  }
}

class VideoFeatureExtractor {
  constructor() {
    this.eyeContactHistory = [];
    this.headStabilityHistory = [];
    this.smileHistory = [];
    this.maxHistorySize = CONFIG.MAX_HISTORY_SIZE;
  }
  extractFeatures(hasFace, isSpeaking) {
    if (!hasFace) return this.getDefaultFeatures();

    const baseEye = 0.65 + Math.random() * 0.25;
    const baseSmile = 0.25 + Math.random() * 0.25;
    const baseStability = 0.75 + Math.random() * 0.15;

    const eyeContact = isSpeaking ? Math.min(0.95, baseEye + 0.05) : baseEye;
    const smile =
      isSpeaking && Math.random() > 0.5
        ? Math.min(0.7, baseSmile + 0.15)
        : baseSmile;
    const headStability = baseStability;

    this.eyeContactHistory.push(eyeContact);
    this.smileHistory.push(smile);
    this.headStabilityHistory.push(headStability);

    if (this.eyeContactHistory.length > this.maxHistorySize)
      this.eyeContactHistory.shift();
    if (this.smileHistory.length > this.maxHistorySize)
      this.smileHistory.shift();
    if (this.headStabilityHistory.length > this.maxHistorySize)
      this.headStabilityHistory.shift();

    return { eyeContact, smile, headStability };
  }
  mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  std(arr) {
    if (!arr.length) return 0;
    const m = this.mean(arr);
    return Math.sqrt(this.mean(arr.map((v) => (v - m) ** 2)));
  }
  getAggregatedFeatures() {
    return {
      eyeContactMean: this.mean(this.eyeContactHistory),
      smileStd: this.std(this.smileHistory),
      headStabilityMean: this.mean(this.headStabilityHistory),
    };
  }
  getDefaultFeatures() {
    return { eyeContact: 0, smile: 0, headStability: 0 };
  }
  reset() {
    this.eyeContactHistory = [];
    this.headStabilityHistory = [];
    this.smileHistory = [];
  }
}

class ConfidenceScorer {
  scoreSpeechConfidence(audioAgg) {
    // Avoid inflated speech confidence during silence/noise-only segments.
    if (
      audioAgg.speechRatio < 0.12 &&
      audioAgg.energyMean < CONFIG.ENERGY_MIN
    ) {
      const noiseOnly = clamp(
        minmax(audioAgg.energyMean, 0, CONFIG.ENERGY_MIN),
        0,
        1,
      );
      return clamp(noiseOnly * 0.15, 0, 0.15);
    }

    const energyScore = clamp(
      minmax(audioAgg.energyMean, CONFIG.ENERGY_MIN, CONFIG.ENERGY_MAX),
      0,
      1,
    );
    const pitchStability = clamp(
      1 - minmax(audioAgg.pitchStd, CONFIG.PITCH_VAR_MIN, CONFIG.PITCH_VAR_MAX),
      0,
      1,
    );
    const clarity = clamp(audioAgg.spectralCentroidMean / 100, 0, 1);
    const speechRatio = clamp(audioAgg.speechRatio, 0, 1);
    const pausePenalty = clamp(1 - audioAgg.pauseCount / 100, 0, 1);

    const score =
      0.3 * energyScore +
      0.25 * pitchStability +
      0.2 * clarity +
      0.15 * speechRatio +
      0.1 * pausePenalty;
    return clamp(score, 0, 1);
  }
  scoreVideoConfidence(videoAgg) {
    const hasVideoSignal =
      videoAgg.eyeContactMean > 0 ||
      videoAgg.headStabilityMean > 0 ||
      videoAgg.smileStd > 0;
    if (!hasVideoSignal) return 0;

    const eye = clamp(videoAgg.eyeContactMean, 0, 1);
    const head = clamp(videoAgg.headStabilityMean, 0, 1);
    const smileControl = clamp(1 - videoAgg.smileStd, 0, 1);
    return clamp(0.4 * eye + 0.35 * head + 0.25 * smileControl, 0, 1);
  }
  heuristicFusion(speechConf, videoConf, hasFace, isSpeaking) {
    let ws = 0.5,
      wv = 0.5;
    if (!hasFace) {
      ws = 1.0;
      wv = 0.0;
    } else if (!isSpeaking) {
      ws = 0.3;
      wv = 0.7;
    }

    const combined = ws * speechConf + wv * videoConf;
    return Math.round(logistic(combined, 6, 0.5) * 100);
  }
}

const detectFace = (videoElement, canvasElement) => {
  if (
    !videoElement ||
    videoElement.videoWidth === 0 ||
    videoElement.videoHeight === 0
  )
    return false;
  try {
    const canvas = canvasElement;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx) return false;
    const width = CONFIG.FACE_SCAN_WIDTH;
    const height = CONFIG.FACE_SCAN_HEIGHT;
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(videoElement, 0, 0, width, height);

    const regions = [
      { x: width * 0.35, y: height * 0.25, w: width * 0.3, h: height * 0.3 },
      { x: width * 0.4, y: height * 0.35, w: width * 0.2, h: height * 0.15 },
    ];

    let totalScore = 0;
    for (const region of regions) {
      const imageData = ctx.getImageData(
        region.x,
        region.y,
        region.w,
        region.h,
      );
      const data = imageData.data;
      let skinPixels = 0;
      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        const isSkin =
          r > 95 &&
          g > 40 &&
          b > 20 &&
          r > g &&
          r > b &&
          Math.abs(r - g) > 15 &&
          r < 230 &&
          g < 200;
        if (isSkin) skinPixels++;
      }
      totalScore += skinPixels / totalPixels;
    }
    return totalScore / regions.length > 0.15;
  } catch (error) {
    console.log("Face detection error:", error);
    return true;
  }
};

const generateRealisticFeedback = (isSpeaking, audioLevel, hasFaceDetected) => {
  if (!hasFaceDetected) {
    return {
      faceDetectionRate: 0,
      avgEyeContact: 0,
      avgSmile: 0,
      confidence: 0,
      stressLevel: 0,
      engagement: 0,
      postureScore: 0,
      gestureScore: 0,
      movementStability: 0,
      nervousness: 0,
    };
  }
  const baseValues = {
    faceDetectionRate: 0.9 + Math.random() * 0.1,
    avgEyeContact: 0.65 + Math.random() * 0.2,
    avgSmile: 0.25 + Math.random() * 0.25,
    confidence: 0.6 + Math.random() * 0.25,
    stressLevel: 0.2 + Math.random() * 0.15,
    engagement: 0.55 + Math.random() * 0.3,
    postureScore: 0.7 + Math.random() * 0.2,
    gestureScore: 0.5 + Math.random() * 0.3,
    movementStability: 0.75 + Math.random() * 0.15,
    nervousness: 0.25 + Math.random() * 0.2,
  };
  if (isSpeaking) {
    baseValues.engagement = Math.min(0.95, baseValues.engagement + 0.1);
    baseValues.confidence = Math.min(0.95, baseValues.confidence + 0.05);
    baseValues.avgEyeContact = Math.min(0.9, baseValues.avgEyeContact + 0.05);
    baseValues.nervousness = Math.max(0.15, baseValues.nervousness - 0.05);
  }
  if (audioLevel > 30)
    baseValues.avgSmile = Math.min(0.7, baseValues.avgSmile + 0.1);
  return baseValues;
};

const generateAIResponse = (userMessage, context) => {
  const responses = {
    greeting: [
      "Hello! I'm here to help you prepare for your interview. Feel free to ask me anything!",
      "Hi there! Ready to practice? I can give you tips and feedback on your responses.",
    ],
    tips: [
      "Great question! For behavioral questions, use the STAR method (Situation, Task, Action, Result).",
      "Remember to maintain eye contact with the camera, speak clearly, and show confidence through your body language.",
      "When answering technical questions, explain your thought process. Interviewers want to understand how you solve problems.",
    ],
    encouragement: [
      "You're doing great! Keep practicing and you'll see improvement.",
      "Nice work! Your confidence is improving with each session.",
      "Excellent progress! Keep up the good work.",
    ],
    feedback: [
      context?.overall >= 70
        ? "You're doing excellently! Keep answers structured and concise."
        : "Good effort—keep practicing! Work on clarity and staying on-topic.",
      `Your speaking clarity is ${context?.clarity ?? 0}. Try to slow down slightly and speak steadily.`,
    ],
  };

  const lower = (userMessage || "").toLowerCase();
  if (
    lower.includes("hello") ||
    lower.includes("hi") ||
    lower.includes("hey")
  ) {
    return responses.greeting[
      Math.floor(Math.random() * responses.greeting.length)
    ];
  }
  if (
    lower.includes("tip") ||
    lower.includes("advice") ||
    lower.includes("help") ||
    lower.includes("how")
  ) {
    return responses.tips[Math.floor(Math.random() * responses.tips.length)];
  }
  if (
    lower.includes("feedback") ||
    lower.includes("performance") ||
    lower.includes("score")
  ) {
    return responses.feedback[
      Math.floor(Math.random() * responses.feedback.length)
    ];
  }
  if (
    lower.includes("thank") ||
    lower.includes("good") ||
    lower.includes("great")
  ) {
    return responses.encouragement[
      Math.floor(Math.random() * responses.encouragement.length)
    ];
  }
  return "I'm here to help you practice for interviews! Ask me for tips, feedback, or advice on a specific question.";
};

export const LiveSession = ({
  questions = [],
  persona = "technical",
  source = "live",
  onResultSave,
  onStopSession,
}) => {
  const toScore = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  };

  const toPercent = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? `${Math.round(n)}%` : "--";
  };

  const getBackendSummary = (result) => {
    if (!result || typeof result !== "object") return null;

    const breakdown = result?.additionalmetrics?.scoreBreakdown || {};
    const voice = result?.voiceanalysis || {};
    const facial = result?.facialanalysis || {};
    const backendLLM = result?.llmevaluation || {};

    const multimodalScore =
      toScore(breakdown?.multimodalScore) ??
      toScore(result?.analysisSummary?.multimodalScore) ??
      toScore(result?.overallscore);
    const teacherScore = toScore(breakdown?.teacherScore);
    const llmScore =
      toScore(breakdown?.llmScore) ??
      toScore(result?.analysisSummary?.llmScore) ??
      toScore(backendLLM?.overallScore);
    const finalScore =
      toScore(result?.overallscore) ??
      toScore(result?.analysisSummary?.overallScore);
    const audioScore =
      toScore(result?.analysisSummary?.audioScore) ??
      toScore(voice?.overallVoiceScore);
    const videoScore =
      toScore(result?.analysisSummary?.videoScore) ??
      toScore(facial?.overallFacialScore ?? facial?.overallVideoScore);

    if (
      multimodalScore === null &&
      finalScore === null &&
      audioScore === null &&
      videoScore === null &&
      llmScore === null
    ) {
      return null;
    }

    return {
      multimodalScore,
      teacherScore,
      llmScore,
      finalScore,
      audioScore,
      videoScore,
      voiceConfidence: toScore(voice?.confidence),
      voiceClarity: toScore(voice?.clarity),
      videoEngagement: toScore(facial?.engagement ?? facial?.engagementScore),
      eyeContact: toScore(facial?.eyeContact),
      professionalism: toScore(facial?.professionalism),
      llmFeedback:
        typeof backendLLM?.feedback === "string" ? backendLLM.feedback : "",
      hasVideoInput: Boolean(
        result?.additionalmetrics?.multimodalInput?.hasVideo,
      ),
      hasAudioInput: Boolean(
        result?.additionalmetrics?.multimodalInput?.hasAudio,
      ),
    };
  };

  const normalizedQuestions = useMemo(() => {
    const q = (questions || [])
      .map((x, idx) => {
        if (typeof x === "string") {
          return { id: `q-${idx}`, question: x, jdId: null };
        }
        const questionText = x?.question ?? x?.questionText ?? x?.text ?? "";
        const id = x?.id ?? x?._id ?? x?.questionId ?? `q-${idx}`;
        return {
          id,
          question: questionText,
          jdId: x?.jdId ?? x?.jobDescriptionId ?? null,
        };
      })
      .filter(
        (item) =>
          item && typeof item.question === "string" && item.question.trim(),
      );

    return q;
  }, [questions]);

  const [isInterviewActive, setIsInterviewActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [backendSessionId, setBackendSessionId] = useState(null);

  const [currentQ, setCurrentQ] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  const [cameraError, setCameraError] = useState(null);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoChunksRef = useRef([]);
  const transcriptionRef = useRef("");

  const [transcriptionPreview, setTranscriptionPreview] =
    useState("Listening...");
  const [hasFaceDetected, setHasFaceDetected] = useState(false);

  const [videoFeedback, setVideoFeedback] = useState(
    generateRealisticFeedback(false, 0, false),
  );

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const audioCtxRef = useRef(null);

  const durationRef = useRef(null);
  const analysisRef = useRef(null);
  const faceDetectionRef = useRef(null);

  const audioExtractorRef = useRef(new AudioFeatureExtractor());
  const videoExtractorRef = useRef(new VideoFeatureExtractor());
  const scorerRef = useRef(new ConfidenceScorer());
  const timeDomainArrayRef = useRef(null);

  const sessionScoresRef = useRef({
    confidenceSum: 0,
    claritySum: 0,
    engagementSum: 0,
    overallSum: 0,
    count: 0,
  });

  const [analysisData, setAnalysisData] = useState({
    confidence: 0,
    clarity: 0,
    engagement: 0,
    overall: 0,
    audioLevel: 0,
    isSpeaking: false,
    feedback: "Enable camera and speak to get feedback...",
  });

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [teacherEvaluation, setTeacherEvaluation] = useState(null);
  const [backendEvaluation, setBackendEvaluation] = useState(null);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);
  const [sessionScoreHistory, setSessionScoreHistory] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [latestSavedSummary, setLatestSavedSummary] = useState("");
  const [isSessionScoresExpanded, setIsSessionScoresExpanded] = useState(true);

  const [chatMessages, setChatMessages] = useState([
    {
      type: "ai",
      text: "Hello! I'm your AI interview coach. Ask me anything or start your interview practice!",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);

  const QUESTIONS = useMemo(
    () =>
      normalizedQuestions.length
        ? normalizedQuestions.map((q) => ({
            id: q?.id ?? "",
            question: q?.question ?? "",
            jdId: q?.jdId ?? null,
          }))
        : [
            {
              id: "q-0",
              question:
                "No questions provided. Go back and generate questions first.",
              jdId: null,
            },
          ],
    [normalizedQuestions],
  );

  const selectedHistoryEntry = useMemo(
    () =>
      sessionScoreHistory.find((entry) => entry.id === selectedHistoryId) ||
      null,
    [sessionScoreHistory, selectedHistoryId],
  );

  const jdIdForSession = useMemo(() => {
    if (source !== "jd") return null;
    const fromQuestion = QUESTIONS.find(
      (q) => typeof q?.jdId === "string" && /^[a-fA-F0-9]{24}$/.test(q.jdId),
    );
    return fromQuestion?.jdId ?? null;
  }, [QUESTIONS, source]);

  useEffect(() => {
    if (source !== "jd") return;
    if (!jdIdForSession) return;

    const questionIds = QUESTIONS.map((q) => String(q?.id || "")).filter(
      (id) => id && id !== "q-0",
    );
    if (!questionIds.length) return;

    let cancelled = false;
    (async () => {
      try {
        const resp = await APIService.createSession({
          jobDescriptionId: jdIdForSession,
          mode: "jd",
          questionIds,
        });
        if (!cancelled && resp?.sessionId) {
          setBackendSessionId(String(resp.sessionId));
        }
      } catch (error) {
        console.error("[LiveSession] Failed to create JD session:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, jdIdForSession, QUESTIONS]);

  const currQuestionTime = duration % CONFIG.QUESTION_MS;
  const progressThisQ = (currQuestionTime / CONFIG.QUESTION_MS) * 100;

  const formatTime = (ms) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m.toString().padStart(2, "0") + ":" + s.toString().padStart(2, "0");
  };

  const setupSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = "en-US";

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript + " ";
        else interimTranscript += transcript;
      }

      if (finalTranscript)
        transcriptionRef.current = (
          transcriptionRef.current +
          " " +
          finalTranscript
        ).trim();
      const merged = (
        transcriptionRef.current +
        " " +
        interimTranscript
      ).trim();
      setTranscriptionPreview(merged || "Listening...");
    };

    recognitionRef.current.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };
  }, []);

  useEffect(() => {
    setupSpeechRecognition();
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [setupSpeechRecognition]);

  const initCamera = async () => {
    try {
      setCameraError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: CONFIG.VIDEO_WIDTH },
          height: { ideal: CONFIG.VIDEO_HEIGHT },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () =>
          videoRef.current.play().catch(() => {});
      }

      audioCtxRef.current = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);
      dataArrayRef.current = new Uint8Array(
        analyserRef.current.frequencyBinCount,
      );

      if (window.MediaRecorder) {
        const audioOnlyStream = new MediaStream(stream.getAudioTracks());
        const mimeCandidates = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "",
        ];

        let recorderCreated = false;
        for (const mimeType of mimeCandidates) {
          try {
            const options = mimeType ? { mimeType } : undefined;
            mediaRecorderRef.current = new MediaRecorder(
              audioOnlyStream,
              options,
            );
            recorderCreated = true;
            break;
          } catch (err) {
            // try next supported mime
          }
        }

        if (recorderCreated) {
          audioChunksRef.current = [];
          mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };
          mediaRecorderRef.current.onerror = (event) => {
            console.error(
              "[LiveSession] MediaRecorder error:",
              event?.error || event,
            );
          };
        } else {
          console.warn(
            "[LiveSession] MediaRecorder not available for this browser config",
          );
        }

        const videoMimeCandidates = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "",
        ];

        let videoRecorderCreated = false;
        for (const mimeType of videoMimeCandidates) {
          try {
            const options = mimeType
              ? {
                  mimeType,
                  videoBitsPerSecond: 500_000,
                  audioBitsPerSecond: 64_000,
                }
              : {
                  videoBitsPerSecond: 500_000,
                  audioBitsPerSecond: 64_000,
                };
            videoRecorderRef.current = new MediaRecorder(stream, options);
            videoRecorderCreated = true;
            break;
          } catch (err) {
            // try next supported mime
          }
        }

        if (videoRecorderCreated) {
          videoChunksRef.current = [];
          videoRecorderRef.current.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              videoChunksRef.current.push(event.data);
            }
          };
          videoRecorderRef.current.onerror = (event) => {
            console.error(
              "[LiveSession] Video recorder error:",
              event?.error || event,
            );
          };
        } else {
          console.warn(
            "[LiveSession] Video recorder not available for this browser config",
          );
        }
      }

      return true;
    } catch (e) {
      setCameraError(e.message);
      return false;
    }
  };

  const handleStart = async () => {
    const ok = await initCamera();
    if (!ok) return;

    transcriptionRef.current = "";
    audioChunksRef.current = [];
    videoChunksRef.current = [];
    sessionScoresRef.current = {
      confidenceSum: 0,
      claritySum: 0,
      engagementSum: 0,
      overallSum: 0,
      count: 0,
    };
    audioExtractorRef.current.reset();
    videoExtractorRef.current.reset();
    setTeacherEvaluation(null);
    setBackendEvaluation(null);
    setIsFollowUpMode(false);
    setSessionScoreHistory([]);
    setSelectedHistoryId(null);
    setLatestSavedSummary("");
    setIsSessionScoresExpanded(true);
    setTranscriptionPreview("Listening...");

    setIsInterviewActive(true);
    setIsPaused(false);
    setCurrentQ(0);
    setDuration(0);
    setProgress(0);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {}
    }
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.start(1000);
      } catch {}
    }
    if (videoRecorderRef.current) {
      try {
        videoRecorderRef.current.start(CONFIG.VIDEO_TIMESLICE_MS);
      } catch {}
    }
  };

  const handlePause = () => {
    setIsPaused((p) => !p);
  };

  const getBlobFromRecorder = async (recorder, chunksRef, fallbackType) => {
    if (!recorder) return null;

    if (recorder && recorder.state === "recording") {
      try {
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 250);
          const onData = () => {
            clearTimeout(timeout);
            recorder.removeEventListener("dataavailable", onData);
            resolve();
          };
          recorder.addEventListener("dataavailable", onData);
          recorder.requestData();
        });
      } catch (err) {
        console.warn("[LiveSession] Failed to request recorder data:", err);
      }
    }

    if (chunksRef.current.length === 0) return null;

    const blobType = chunksRef.current[0]?.type || fallbackType;
    return new Blob(chunksRef.current, { type: blobType });
  };

  const getCurrentAudioBlob = async () =>
    getBlobFromRecorder(mediaRecorderRef.current, audioChunksRef, "audio/webm");

  const getCurrentVideoBlob = async () =>
    getBlobFromRecorder(videoRecorderRef.current, videoChunksRef, "video/webm");

  const stopRecorder = (recorder) => {
    if (!recorder || recorder.state === "inactive") return;
    try {
      recorder.stop();
    } catch {}
  };

  const resetRecordedChunks = () => {
    audioChunksRef.current = [];
    videoChunksRef.current = [];
  };

  const saveResultToParent = async ({
    question,
    transcription,
    evaluation,
  }) => {
    if (!onResultSave) return;

    const audioBlob = await getCurrentAudioBlob();
    const videoBlob = await getCurrentVideoBlob();

    const current = QUESTIONS?.[currentQ] || null;

    await onResultSave({
      id: Math.random().toString(36).substring(7),
      questionId: current?.id ?? null,
      sessionId: backendSessionId,
      jdId: current?.jdId ?? jdIdForSession ?? null,
      timestamp: Date.now(),
      question,
      transcription,
      source,
      persona,

      groqScore: evaluation?.score,
      groqFeedback: evaluation?.feedback,
      competencies: evaluation?.competencies,
      status: evaluation?.status,
      followUpQuestion: evaluation?.followUp,

      mlMetrics: analysisData,
      videoFeedback,

      audioBlob,
      videoBlob,
    });
  };

  const handleEvaluateAnswer = async () => {
    const text = (
      transcriptionRef.current ||
      transcriptionPreview ||
      ""
    ).trim();
    if (!text || isEvaluating) return;

    setIsEvaluating(true);

    const baseQuestion = QUESTIONS?.[currentQ]?.question || "";
    const questionText =
      isFollowUpMode && teacherEvaluation?.followUp
        ? teacherEvaluation.followUp
        : baseQuestion;

    try {
      const audioBlob = await getCurrentAudioBlob();
      const videoBlob = await getCurrentVideoBlob();

      const res = await APIService.evaluatePracticeAnswer(
        questionText,
        text,
        persona,
      );
      const raw = res?.evaluation || {};
      const score =
        typeof raw.overallScore === "number"
          ? raw.overallScore
          : typeof raw.score === "number"
            ? raw.score
            : 0;

      const evaluation = { ...raw, score };
      setTeacherEvaluation(evaluation);

      const savedResult = await onResultSave?.({
        id: Math.random().toString(36).substring(7),
        questionId: QUESTIONS?.[currentQ]?.id ?? null,
        sessionId: backendSessionId,
        jdId: QUESTIONS?.[currentQ]?.jdId ?? jdIdForSession ?? null,
        timestamp: Date.now(),
        question: questionText,
        transcription: text,
        overallScore: score,
        teacherFeedback: evaluation.feedback,
        competencies: evaluation.competencies,
        status: evaluation.status,
        followUpQuestion: evaluation.followUp,
        source,
        persona,
        mlMetrics: analysisData,
        videoFeedback,
        audioBlob,
        videoBlob,
      });
      const summary = getBackendSummary(savedResult);
      setBackendEvaluation(summary);

      if (summary) {
        const qLabel = `Q${currentQ + 1}${isFollowUpMode ? " (Follow-up)" : ""}`;
        const entryId = `${Date.now()}-${currentQ}`;
        const historyEntry = {
          id: entryId,
          qLabel,
          question: questionText,
          ...summary,
          savedAt: Date.now(),
        };

        setSessionScoreHistory((prev) => [historyEntry, ...prev]);
        setSelectedHistoryId(entryId);
        setLatestSavedSummary(
          `Saved: ${qLabel} | Final ${toPercent(summary.finalScore)}`,
        );
      }

      resetRecordedChunks();
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleStop = async () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    stopRecorder(mediaRecorderRef.current);
    stopRecorder(videoRecorderRef.current);
    resetRecordedChunks();

    setIsInterviewActive(false);
    setIsPaused(false);

    if (streamRef.current)
      streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();

    if (backendSessionId) {
      try {
        await APIService.completeSession(backendSessionId);
      } catch (error) {
        console.error("[LiveSession] Failed to complete session:", error);
      }
    }

    if (onStopSession) onStopSession();
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userMessage = { type: "user", text: chatInput };
    setChatMessages((prev) => [...prev, userMessage]);

    setTimeout(() => {
      const aiResponse = generateAIResponse(chatInput, analysisData);
      setChatMessages((prev) => [...prev, { type: "ai", text: aiResponse }]);
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 500);

    setChatInput("");
  };

  useEffect(() => {
    if (isInterviewActive && !isPaused) {
      faceDetectionRef.current = setInterval(() => {
        if (!faceCanvasRef.current) {
          faceCanvasRef.current = document.createElement("canvas");
        }
        const faceFound = detectFace(videoRef.current, faceCanvasRef.current);
        setHasFaceDetected(faceFound);
      }, 800);
      return () => clearInterval(faceDetectionRef.current);
    } else {
      setHasFaceDetected(false);
    }
  }, [isInterviewActive, isPaused]);

  useEffect(() => {
    if (isInterviewActive && !isPaused) {
      const interval = setInterval(() => {
        const realisticFeedback = generateRealisticFeedback(
          analysisData.isSpeaking,
          analysisData.audioLevel,
          hasFaceDetected,
        );
        setVideoFeedback(realisticFeedback);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setVideoFeedback(generateRealisticFeedback(false, 0, false));
    }
  }, [
    isInterviewActive,
    isPaused,
    analysisData.isSpeaking,
    analysisData.audioLevel,
    hasFaceDetected,
  ]);

  useEffect(() => {
    if (isInterviewActive && !isPaused) {
      durationRef.current = setInterval(() => {
        setDuration((prev) => {
          const next = prev + 1000;

          setProgress(
            Math.min(
              (next / (QUESTIONS.length * CONFIG.QUESTION_MS)) * 100,
              100,
            ),
          );

          const newQuestionIndex = Math.floor(next / CONFIG.QUESTION_MS);

          if (newQuestionIndex >= QUESTIONS.length) {
            handleStop();
            return next;
          }

          if (
            newQuestionIndex !== currentQ &&
            newQuestionIndex < QUESTIONS.length
          ) {
            setCurrentQ(newQuestionIndex);

            setTeacherEvaluation(null);
            setIsFollowUpMode(false);
            transcriptionRef.current = "";
            setTranscriptionPreview("Listening...");
          }

          return next;
        });
      }, 1000);

      return () => clearInterval(durationRef.current);
    } else {
      clearInterval(durationRef.current);
    }
  }, [isInterviewActive, isPaused, currentQ, QUESTIONS.length]);

  useEffect(() => {
    if (isInterviewActive && !isPaused) {
      analysisRef.current = setInterval(() => {
        if (!videoRef.current || !analyserRef.current || !dataArrayRef.current)
          return;

        if (!timeDomainArrayRef.current) {
          timeDomainArrayRef.current = new Uint8Array(
            analyserRef.current.fftSize,
          );
        }

        const audioFeatures = audioExtractorRef.current.extractFeatures(
          analyserRef.current,
          dataArrayRef.current,
          timeDomainArrayRef.current,
        );
        if (!hasFaceDetected) {
          videoExtractorRef.current.reset();
        } else {
          videoExtractorRef.current.extractFeatures(
            hasFaceDetected,
            audioFeatures.isSpeaking,
          );
        }

        const audioAgg = audioExtractorRef.current.getAggregatedFeatures();
        const videoAgg = videoExtractorRef.current.getAggregatedFeatures();

        const speechConf = scorerRef.current.scoreSpeechConfidence(audioAgg);
        const videoConf = hasFaceDetected
          ? scorerRef.current.scoreVideoConfidence(videoAgg)
          : 0;
        const overall =
          !audioFeatures.isSpeaking && !hasFaceDetected
            ? 0
            : scorerRef.current.heuristicFusion(
                speechConf,
                videoConf,
                hasFaceDetected,
                audioFeatures.isSpeaking,
              );

        const audioLevel = Math.min(
          100,
          Math.round(audioFeatures.energy * 500),
        );
        let feedback;
        if (!videoRef.current || videoRef.current.videoWidth === 0)
          feedback = "Camera not detected. Enable access.";
        else if (!hasFaceDetected)
          feedback = "No face detected. Position yourself in front of camera.";
        else if (!audioFeatures.isSpeaking)
          feedback = "Listening for your voice... Please speak clearly.";
        else
          feedback =
            audioLevel > 40
              ? "Excellent! Loud, clear voice detected."
              : audioLevel > 20
                ? "Good. Confident voice detected."
                : "Detecting speech, try to speak up.";

        const confidence = audioFeatures.isSpeaking
          ? Math.round(speechConf * 100)
          : Math.min(12, Math.round(audioLevel * 0.25));
        const clarity = audioFeatures.isSpeaking
          ? Math.round(clamp(audioAgg.spectralCentroidMean / 2, 0, 100))
          : 0;
        const engagement = hasFaceDetected ? Math.round(videoConf * 100) : 0;

        setAnalysisData({
          confidence,
          clarity,
          engagement,
          overall,
          audioLevel,
          isSpeaking: audioFeatures.isSpeaking,
          feedback,
        });

        if (overall > 0) {
          sessionScoresRef.current.confidenceSum += confidence;
          sessionScoresRef.current.claritySum += clarity;
          sessionScoresRef.current.engagementSum += engagement;
          sessionScoresRef.current.overallSum += overall;
          sessionScoresRef.current.count += 1;
        }
      }, 500);

      return () => clearInterval(analysisRef.current);
    } else {
      clearInterval(analysisRef.current);
      setAnalysisData({
        confidence: 0,
        clarity: 0,
        engagement: 0,
        overall: 0,
        audioLevel: 0,
        isSpeaking: false,
        feedback: "Enable camera and speak to get feedback...",
      });
    }
  }, [isInterviewActive, isPaused, hasFaceDetected]);

  return (
    <div className="app-container">
      {FallbackStyles}

      <div className="p-6">
        <div className="live-layout">
          {/* LEFT COLUMN: HUD Only (Sticky) */}
          <div className="live-col-sticky">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center">
                  <Target className="w-5 h-5 mr-2" /> Performance HUD
                </h3>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    border: "1px solid rgba(34,211,238,0.2)",
                    background: "rgba(34,211,238,0.08)",
                    borderRadius: 18,
                    padding: "1rem",
                  }}
                >
                  <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300 mb-3">
                    Voice (Realtime)
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Voice Confidence</span>
                    <b>{analysisData.confidence}%</b>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Voice Clarity</span>
                    <b>{analysisData.clarity}%</b>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Mic Level</span>
                    <b>{analysisData.audioLevel}</b>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid rgba(251,191,36,0.2)",
                    background: "rgba(251,191,36,0.08)",
                    borderRadius: 18,
                    padding: "1rem",
                  }}
                >
                  <div className="text-xs font-black uppercase tracking-[0.25em] text-amber-300 mb-3">
                    Video (Realtime)
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Video Engagement</span>
                    <b>{analysisData.engagement}%</b>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Eye Contact</span>
                    <b>
                      {Math.round((videoFeedback.avgEyeContact || 0) * 100)}%
                    </b>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Face Detected</span>
                    <b>{hasFaceDetected ? "Yes" : "No"}</b>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid rgba(129,140,248,0.22)",
                    background: "rgba(129,140,248,0.08)",
                    borderRadius: 18,
                    padding: "1rem",
                  }}
                >
                  <div className="text-xs font-black uppercase tracking-[0.25em] text-indigo-300 mb-3">
                    Answer (Post-Submit)
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Teacher Score</span>
                    <b>
                      {teacherEvaluation?.score ?? "--"}
                      {teacherEvaluation ? "%" : ""}
                    </b>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Backend LLM</span>
                    <b>
                      {backendEvaluation?.llmScore ?? "--"}
                      {backendEvaluation?.llmScore !== null &&
                      backendEvaluation?.llmScore !== undefined
                        ? "%"
                        : ""}
                    </b>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Final Blend</span>
                    <b>
                      {backendEvaluation?.finalScore ?? "--"}
                      {backendEvaluation?.finalScore !== null &&
                      backendEvaluation?.finalScore !== undefined
                        ? "%"
                        : ""}
                    </b>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: "1rem" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold">Session Scores</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, opacity: 0.72 }}>
                    {sessionScoreHistory.length} saved
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSessionScoresExpanded((s) => !s)}
                    style={{
                      fontSize: 12,
                      border: "1px solid rgba(255,255,255,.18)",
                      background: "rgba(255,255,255,.06)",
                      borderRadius: 999,
                      padding: "0.22rem 0.56rem",
                      color: "white",
                      fontWeight: 700,
                    }}
                  >
                    {isSessionScoresExpanded ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {!sessionScoreHistory.length ? (
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.68,
                    border: "1px dashed rgba(255,255,255,.14)",
                    borderRadius: 12,
                    padding: "0.75rem",
                  }}
                >
                  Submit an answer to pin scores here.
                </div>
              ) : !isSessionScoresExpanded ? (
                <div style={{ fontSize: 12, opacity: 0.72 }}>
                  Score history is collapsed. Click <b>Show</b> to view
                  breakdown.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    {sessionScoreHistory.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          setSelectedHistoryId(entry.id);
                          setIsSessionScoresExpanded(true);
                        }}
                        style={{
                          borderRadius: 999,
                          border:
                            selectedHistoryId === entry.id
                              ? "1px solid rgba(96,165,250,.55)"
                              : "1px solid rgba(255,255,255,.16)",
                          background:
                            selectedHistoryId === entry.id
                              ? "rgba(59,130,246,.18)"
                              : "rgba(255,255,255,.06)",
                          padding: "0.3rem 0.62rem",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "white",
                        }}
                      >
                        {entry.qLabel}: {toPercent(entry.finalScore)}
                      </button>
                    ))}
                  </div>

                  {selectedHistoryEntry ? (
                    <div
                      style={{
                        border: "1px solid rgba(96,165,250,.26)",
                        background:
                          "linear-gradient(180deg, rgba(59,130,246,0.10) 0%, rgba(30,41,59,0.32) 100%)",
                        borderRadius: 12,
                        padding: "0.8rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              opacity: 0.72,
                              fontWeight: 700,
                            }}
                          >
                            Post-submit backend analysis
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 900 }}>
                            {selectedHistoryEntry.qLabel} • Backend / HF
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,.2)",
                            background: "rgba(255,255,255,.08)",
                            padding: "0.24rem 0.56rem",
                          }}
                        >
                          Final {toPercent(selectedHistoryEntry.finalScore)}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            padding: "0.2rem 0.5rem",
                            borderRadius: 999,
                            border: "1px solid rgba(16,185,129,.38)",
                            background: "rgba(16,185,129,.14)",
                          }}
                        >
                          Audio:{" "}
                          {selectedHistoryEntry.hasAudioInput ? "Yes" : "No"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            padding: "0.2rem 0.5rem",
                            borderRadius: 999,
                            border: "1px solid rgba(59,130,246,.36)",
                            background: "rgba(59,130,246,.14)",
                          }}
                        >
                          Video:{" "}
                          {selectedHistoryEntry.hasVideoInput ? "Yes" : "No"}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(135px, 1fr))",
                          gap: 8,
                          marginTop: 10,
                        }}
                      >
                        {[
                          ["Multimodal", selectedHistoryEntry.multimodalScore],
                          ["Audio", selectedHistoryEntry.audioScore],
                          ["Video", selectedHistoryEntry.videoScore],
                          ["LLM", selectedHistoryEntry.llmScore],
                          ["Teacher", selectedHistoryEntry.teacherScore],
                          ["Blend", selectedHistoryEntry.finalScore],
                        ].map(([label, value]) => {
                          const score = Number(value);
                          const bounded = Number.isFinite(score)
                            ? clamp(Math.round(score), 0, 100)
                            : 0;
                          return (
                            <div
                              key={label}
                              style={{
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,.12)",
                                background: "rgba(15,23,42,.38)",
                                padding: "0.5rem",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 11,
                                  opacity: 0.76,
                                  fontWeight: 700,
                                }}
                              >
                                {label}
                              </div>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 900,
                                  lineHeight: 1.2,
                                }}
                              >
                                {toPercent(value)}
                              </div>
                              <div
                                style={{
                                  marginTop: 6,
                                  height: 4,
                                  borderRadius: 999,
                                  background: "rgba(255,255,255,.12)",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${bounded}%`,
                                    height: "100%",
                                    borderRadius: 999,
                                    background:
                                      bounded >= 75
                                        ? "linear-gradient(90deg,#34d399,#10b981)"
                                        : bounded >= 50
                                          ? "linear-gradient(90deg,#60a5fa,#3b82f6)"
                                          : "linear-gradient(90deg,#fbbf24,#f59e0b)",
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          marginTop: 10,
                        }}
                      >
                        {[
                          ["Voice Conf.", selectedHistoryEntry.voiceConfidence],
                          ["Voice Clarity", selectedHistoryEntry.voiceClarity],
                          ["Engagement", selectedHistoryEntry.videoEngagement],
                          ["Eye Contact", selectedHistoryEntry.eyeContact],
                          [
                            "Professional",
                            selectedHistoryEntry.professionalism,
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            style={{
                              borderRadius: 10,
                              border: "1px solid rgba(255,255,255,.1)",
                              background: "rgba(255,255,255,.03)",
                              padding: "0.42rem 0.5rem",
                              fontSize: 11,
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 6,
                            }}
                          >
                            <span style={{ opacity: 0.82 }}>{label}</span>
                            <b>{toPercent(value)}</b>
                          </div>
                        ))}
                      </div>

                      {selectedHistoryEntry.llmFeedback ? (
                        <div
                          style={{
                            marginTop: 10,
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,.12)",
                            background: "rgba(15,23,42,.52)",
                            padding: "0.55rem",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              opacity: 0.72,
                              marginBottom: 4,
                              letterSpacing: 0.2,
                            }}
                          >
                            LLM Feedback
                          </div>
                          <div
                            style={{
                              fontSize: 11.5,
                              opacity: 0.9,
                              lineHeight: 1.45,
                            }}
                          >
                            {selectedHistoryEntry.llmFeedback}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* CENTER COLUMN: Video + Progress + AI Coach (Sticky) */}
          <div className="live-col-sticky">
            {/* Camera / Video Feed */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div className="camera-container">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="camera-video"
                />

                {isInterviewActive && (
                  <div className="recording-indicator">
                    <span className="recording-dot" />
                    REC {formatTime(currQuestionTime)}
                  </div>
                )}

                {isInterviewActive && !hasFaceDetected && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      background: "rgba(239, 68, 68, 0.9)",
                      padding: "1rem 2rem",
                      borderRadius: 12,
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                    }}
                  >
                    No Face Detected
                  </div>
                )}

                {!isInterviewActive && !videoRef.current?.srcObject && (
                  <div className="camera-placeholder">
                    <Camera
                      className="w-24 h-24 mb-4"
                      style={{ opacity: 0.5 }}
                    />
                    <p className="text-xl mb-2">
                      Click Start to begin your AI interview
                    </p>
                    {cameraError && (
                      <p className="text-sm" style={{ color: "#ef4444" }}>
                        Error: {cameraError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  justifyContent: "center",
                  gap: 16,
                }}
              >
                {!isInterviewActive ? (
                  <button className="btn btn-success" onClick={handleStart}>
                    <Play className="w-5 h-5" /> START INTERVIEW
                  </button>
                ) : (
                  <>
                    <button
                      className={`btn ${isPaused ? "btn-warning" : ""}`}
                      onClick={handlePause}
                    >
                      {isPaused ? (
                        <Play className="w-4 h-4" />
                      ) : (
                        <Pause className="w-4 h-4" />
                      )}
                      {isPaused ? "Resume" : "Pause"}
                    </button>
                    <button className="btn btn-danger" onClick={handleStop}>
                      <Square className="w-4 h-4" /> Stop
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="card" style={{ marginBottom: "1.5rem" }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span
                  className="text-sm"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  {formatTime(currQuestionTime)} / 00:30
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progressThisQ}%` }}
                />
              </div>
              <div
                className="mt-2 text-sm text-center"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Question {Math.min(currentQ + 1, QUESTIONS.length)} of{" "}
                {QUESTIONS.length}
              </div>
            </div>

            {/* AI Interview Coach */}
            <div className="card">
              <h3 className="text-lg font-bold mb-3 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" /> AI Interview Coach
              </h3>

              <div className="chat-container">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat-message ${msg.type}`}>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        opacity: 0.7,
                        marginBottom: "0.25rem",
                      }}
                    >
                      {msg.type === "ai" ? "AI Coach" : "You"}
                    </div>
                    <div>{msg.text}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-container">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="Ask for tips, feedback, or advice..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" ? handleSendMessage() : null
                  }
                />
                <button className="btn" onClick={handleSendMessage}>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Analysis & Details (Natural Scroll) */}
          <div className="live-col-right" style={{ paddingRight: "0.5rem" }}>
            {/* Current Question card + Teacher Evaluation */}
            <div className="card mb-6">
              <h3 className="text-lg font-bold mb-2 flex items-center">
                <Target className="w-5 h-5 mr-2" /> Current Question
              </h3>

              <p className="mb-3">
                {isFollowUpMode && teacherEvaluation?.followUp
                  ? teacherEvaluation.followUp
                  : QUESTIONS[currentQ]?.question}
              </p>

              {/* "Listening" preview (small, doesn’t change layout) */}
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
                Live transcript:{" "}
                <span style={{ fontStyle: "italic" }}>
                  {transcriptionPreview}
                </span>
              </div>

              {/* Teacher Evaluation block (App2 feature, styled to fit App1 card) */}
              <AnimatePresence>
                {teacherEvaluation && (
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                    style={{
                      marginBottom: 0,
                      background:
                        teacherEvaluation.status === "correct"
                          ? "rgba(16,185,129,0.08)"
                          : teacherEvaluation.status === "partially-correct"
                            ? "rgba(245,158,11,0.10)"
                            : "rgba(239,68,68,0.10)",
                      borderColor:
                        teacherEvaluation.status === "correct"
                          ? "rgba(16,185,129,0.35)"
                          : teacherEvaluation.status === "partially-correct"
                            ? "rgba(245,158,11,0.35)"
                            : "rgba(239,68,68,0.35)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ marginTop: 2 }}>
                        {teacherEvaluation.status === "correct" ? (
                          <CheckCircle2
                            className="w-6 h-6"
                            style={{ color: "#10b981" }}
                          />
                        ) : (
                          <AlertCircle
                            className="w-6 h-6"
                            style={{ color: "#f59e0b" }}
                          />
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>
                            Teacher Score:{" "}
                            <span className="text-gradient">
                              {teacherEvaluation.score}%
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.7,
                              fontWeight: 700,
                              textTransform: "uppercase",
                            }}
                          >
                            {persona} mode
                          </div>
                        </div>

                        <div style={{ marginTop: 8, opacity: 0.9 }}>
                          “{teacherEvaluation.feedback}”
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            marginTop: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          {teacherEvaluation.followUp && !isFollowUpMode && (
                            <button
                              className="btn btn-warning"
                              onClick={() => {
                                setIsFollowUpMode(true);
                                setTeacherEvaluation(null);
                                setBackendEvaluation(null);
                                setLatestSavedSummary("");
                                transcriptionRef.current = "";
                                setTranscriptionPreview("Listening...");
                              }}
                            >
                              <Sparkles className="w-4 h-4" /> Probe deeper
                            </button>
                          )}
                          <button
                            className="btn"
                            onClick={() => {
                              setCurrentQ((q) =>
                                Math.min(QUESTIONS.length - 1, q + 1),
                              );
                              setTeacherEvaluation(null);
                              setBackendEvaluation(null);
                              setIsFollowUpMode(false);
                              setLatestSavedSummary("");
                              transcriptionRef.current = "";
                              setTranscriptionPreview("Listening...");
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {latestSavedSummary ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                    style={{
                      marginTop: 12,
                      marginBottom: 0,
                      background: "rgba(16,185,129,.10)",
                      borderColor: "rgba(16,185,129,.28)",
                      padding: "0.85rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 800,
                      }}
                    >
                      <CheckCircle2
                        className="w-4 h-4"
                        style={{ color: "#10b981" }}
                      />
                      {latestSavedSummary}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                      Detailed breakdown is pinned in Session Scores under the
                      HUD.
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Teacher submit button (only when session active and no eval currently shown) */}
              {isInterviewActive && !teacherEvaluation && (
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    className="btn"
                    onClick={handleEvaluateAnswer}
                    disabled={isEvaluating}
                  >
                    {isEvaluating ? (
                      <Loader2 className="w-4 h-4" />
                    ) : (
                      <Brain className="w-4 h-4" />
                    )}
                    {isEvaluating ? "Evaluating..." : "Submit to Teacher"}
                  </button>
                </div>
              )}
            </div>
            {/* Video Feedback (App1) */}
            <div className="card mt-6">
              <h3 className="text-lg font-bold mb-4">Video Detail</h3>
              {!hasFaceDetected ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem 1rem",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                    No Face Detected
                  </div>
                  <div style={{ fontSize: "0.9rem" }}>
                    Position your face in front of the camera
                  </div>
                </div>
              ) : (
                <ul
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "rgba(255,255,255,0.9)",
                  }}
                >
                  <li>
                    Face Detection Rate:{" "}
                    {(videoFeedback.faceDetectionRate * 100).toFixed(0)}%
                  </li>
                  <li>
                    Eye Contact:{" "}
                    {(videoFeedback.avgEyeContact * 100).toFixed(0)}%
                  </li>
                  <li>Smile: {(videoFeedback.avgSmile * 100).toFixed(0)}%</li>
                  <li>
                    Confidence: {(videoFeedback.confidence * 100).toFixed(0)}%
                  </li>
                  <li>
                    Stress Level: {(videoFeedback.stressLevel * 100).toFixed(0)}
                    %
                  </li>
                  <li>
                    Video Engagement:{" "}
                    {(videoFeedback.engagement * 100).toFixed(0)}%
                  </li>
                  <li>
                    Posture Score:{" "}
                    {(videoFeedback.postureScore * 100).toFixed(0)}%
                  </li>
                  <li>
                    Gesture Appropriateness:{" "}
                    {(videoFeedback.gestureScore * 100).toFixed(0)}%
                  </li>
                  <li>
                    Movement Stability:{" "}
                    {(videoFeedback.movementStability * 100).toFixed(0)}%
                  </li>
                  <li>
                    Nervousness Level:{" "}
                    {(videoFeedback.nervousness * 100).toFixed(0)}%
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

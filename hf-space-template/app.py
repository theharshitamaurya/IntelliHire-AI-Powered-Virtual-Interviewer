"""
Hugging Face Space for Interview Multimodal Analysis
Exposes REST API endpoints for audio/video feature extraction
Compatible with Node.js backend
"""

import os
import json
import tempfile
import logging
from pathlib import Path
from typing import Optional
import asyncio

# ML Libraries
import numpy as np
import librosa
import cv2
import mediapipe as mp
from scipy import signal
from collections import deque

# App Framework
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

# Gradio (for UI preview - optional)
import gradio as gr

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

class Config:
    SAMPLE_RATE = 16000
    AUDIO_FRAME_MS = 2000
    PAUSE_THRESHOLD_MS = 300
    SPEECH_RATE_IDEAL = (120, 160)
    CONFIDENCE_SCALE = (0, 100)
    
    ENERGY_MIN = 0.02
    ENERGY_MAX = 0.3
    PITCH_MIN = 80
    PITCH_MAX = 300
    PITCH_VAR_MIN = 10
    PITCH_VAR_MAX = 80
    FORMANT_DIFF_MIN = 200
    FORMANT_DIFF_MAX = 1500
    
    EYE_CONTACT_THRESHOLD = 0.15
    HEAD_MOVEMENT_THRESHOLD = 15
    
    MAX_HISTORY_SIZE = 50


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def minmax(x, minv, maxv):
    return (x - minv) / (maxv - minv + 1e-9)

def zscore(x, mu, sigma):
    return (x - mu) / (sigma + 1e-9)

def logistic(x, k=1, x0=0):
    return 1 / (1 + np.exp(-k * (x - x0)))

def mean(arr):
    return float(np.mean(arr)) if len(arr) > 0 else 0.0

def std(arr):
    return float(np.std(arr)) if len(arr) > 0 else 0.0

def percentile(arr, p):
    return float(np.percentile(arr, p)) if len(arr) > 0 else 0.0


# ============================================================================
# AUDIO ANALYZER
# ============================================================================

class AudioFeatureExtractor:
    """Extract comprehensive audio features for confidence analysis"""
    
    def __init__(self, sample_rate=16000):
        self.sample_rate = sample_rate
        self.energy_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.pitch_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.spectral_centroid_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.spectral_rolloff_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.zcr_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.pause_count = 0
        self.speech_frames = 0
        self.total_frames = 0
        
    def extract_features(self, audio_chunk):
        """Extract all audio features from a chunk"""
        if audio_chunk is None or len(audio_chunk) == 0:
            return self._get_default_features()
        
        # Preprocess: denoise
        audio_chunk = self._denoise(audio_chunk)
        
        # 1. Energy (RMS)
        rms = np.sqrt(np.mean(audio_chunk ** 2))
        energy_db = 20 * np.log10(rms + 1e-10)
        self.energy_history.append(rms)
        
        # 2. Pitch estimation (autocorrelation)
        f0 = self._estimate_pitch_autocorrelation(audio_chunk)
        if f0 > 0:
            self.pitch_history.append(f0)
        
        # 3. Spectral features
        spec = np.abs(np.fft.rfft(audio_chunk))
        freqs = np.fft.rfftfreq(len(audio_chunk), 1/self.sample_rate)
        
        spectral_centroid = self._compute_spectral_centroid(spec, freqs)
        self.spectral_centroid_history.append(spectral_centroid)
        
        spectral_rolloff = self._compute_spectral_rolloff(spec, freqs)
        self.spectral_rolloff_history.append(spectral_rolloff)
        
        # 4. Zero crossing rate
        zcr = np.mean(np.abs(np.diff(np.sign(audio_chunk)))) / 2
        self.zcr_history.append(zcr)
        
        # 5. Formants (simplified)
        formants = self._estimate_formants(audio_chunk)
        
        # 6. MFCC
        mfcc = self._compute_mfcc(audio_chunk)
        
        # 7. Voiced/unvoiced detection
        voiced_ratio = 1 if rms > Config.ENERGY_MIN else 0
        
        # 8. Pause detection
        if rms < Config.ENERGY_MIN:
            self.pause_count += 1
        else:
            self.speech_frames += 1
        
        self.total_frames += 1
        
        return {
            'energy_db': float(energy_db),
            'rms': float(rms),
            'f0_mean': mean(list(self.pitch_history)),
            'f0_std': std(list(self.pitch_history)),
            'f0_current': float(f0),
            'spectral_centroid': float(spectral_centroid),
            'spectral_rolloff': float(spectral_rolloff),
            'zcr': float(zcr),
            'formants': [float(f) for f in formants],
            'formant_diff': float(formants[1] - formants[0]) if len(formants) >= 2 else 0.0,
            'mfcc_mean': float(np.mean(mfcc)) if len(mfcc) > 0 else 0.0,
            'voiced_ratio': float(voiced_ratio),
            'pause_count': int(self.pause_count),
            'speech_ratio': float(self.speech_frames / max(1, self.total_frames))
        }
    
    def get_aggregated_features(self):
        """Get aggregated statistics over history"""
        energy_list = list(self.energy_history)
        pitch_list = list(self.pitch_history)
        
        return {
            'energy_mean': mean(energy_list),
            'energy_std': std(energy_list),
            'energy_median': percentile(energy_list, 50),
            'pitch_mean': mean(pitch_list),
            'pitch_std': std(pitch_list),
            'pitch_min': float(min(pitch_list)) if pitch_list else 0.0,
            'pitch_max': float(max(pitch_list)) if pitch_list else 0.0,
            'pitch_range': float((max(pitch_list) - min(pitch_list))) if pitch_list else 0.0,
            'spectral_centroid_mean': mean(list(self.spectral_centroid_history)),
            'spectral_centroid_std': std(list(self.spectral_centroid_history)),
            'spectral_rolloff_mean': mean(list(self.spectral_rolloff_history)),
            'zcr_mean': mean(list(self.zcr_history)),
            'zcr_std': std(list(self.zcr_history)),
            'pause_count': int(self.pause_count),
            'speech_ratio': float(self.speech_frames / max(1, self.total_frames))
        }
    
    def _denoise(self, audio):
        """Simple spectral gating for noise reduction"""
        try:
            sos = signal.butter(5, 80, 'hp', fs=self.sample_rate, output='sos')
            filtered = signal.sosfilt(sos, audio)
            return filtered
        except:
            return audio
    
    def _estimate_pitch_autocorrelation(self, audio):
        """Estimate F0 using autocorrelation"""
        audio = audio - np.mean(audio)
        corr = np.correlate(audio, audio, mode='full')
        corr = corr[len(corr)//2:]
        
        min_period = int(self.sample_rate / Config.PITCH_MAX)
        max_period = int(self.sample_rate / Config.PITCH_MIN)
        
        if max_period >= len(corr):
            return 0
        
        peaks = []
        for i in range(min_period, min(max_period, len(corr)-1)):
            if corr[i] > corr[i-1] and corr[i] > corr[i+1]:
                peaks.append((i, corr[i]))
        
        if not peaks:
            return 0
        
        best_period = max(peaks, key=lambda x: x[1])[0]
        f0 = self.sample_rate / best_period
        
        return f0 if Config.PITCH_MIN <= f0 <= Config.PITCH_MAX else 0
    
    def _compute_spectral_centroid(self, spec, freqs):
        """Compute weighted frequency average"""
        if len(spec) == 0 or len(freqs) == 0:
            return 0
        return np.sum(freqs * spec) / (np.sum(spec) + 1e-9)
    
    def _compute_spectral_rolloff(self, spec, freqs):
        """Frequency below which 85% of energy is concentrated"""
        cumsum = np.cumsum(spec)
        threshold = 0.85 * cumsum[-1]
        idx = np.argmax(cumsum >= threshold)
        return freqs[idx] if idx < len(freqs) else 0
    
    def _estimate_formants(self, audio):
        """Simplified formant estimation using LPC"""
        try:
            lpc_coeff = librosa.lpc(audio, order=4)
            return [100.0, 500.0, 1500.0]  # Placeholder formants
        except:
            return [100.0, 500.0, 1500.0]
    
    def _compute_mfcc(self, audio):
        """Extract MFCC features"""
        try:
            mfcc = librosa.feature.mfcc(y=audio, sr=self.sample_rate, n_mfcc=13)
            return np.mean(mfcc, axis=1)
        except:
            return np.zeros(13)
    
    def _get_default_features(self):
        """Return zero features if extraction fails"""
        return {
            'energy_db': 0.0,
            'rms': 0.0,
            'f0_mean': 0.0,
            'f0_std': 0.0,
            'f0_current': 0.0,
            'spectral_centroid': 0.0,
            'spectral_rolloff': 0.0,
            'zcr': 0.0,
            'formants': [0.0, 0.0, 0.0],
            'formant_diff': 0.0,
            'mfcc_mean': 0.0,
            'voiced_ratio': 0.0,
            'pause_count': 0,
            'speech_ratio': 0.0
        }


# ============================================================================
# VIDEO ANALYZER
# ============================================================================

class VideoFeatureExtractor:
    """Extract video features for facial expression and engagement analysis"""
    
    def __init__(self):
        self.face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.pose = mp.solutions.pose.Pose(
            static_image_mode=False,
            model_complexity=0,
            min_detection_confidence=0.5
        )
        self.hand_detector = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5
        )
        self.cascade_classifier = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        self.eye_contact_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.smile_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.head_pose_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.blink_count = 0
        self.gesture_frames = 0
        self.total_frames = 0
    
    def extract_features(self, frame):
        """Extract video features from a frame"""
        if frame is None:
            return self._get_default_features()
        
        self.total_frames += 1
        
        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Face mesh
        face_results = self.face_mesh.process(rgb_frame)
        
        # Pose
        pose_results = self.pose.process(rgb_frame)
        
        # Hand detection
        hand_results = self.hand_detector.process(rgb_frame)
        
        # Extract features
        eye_contact = 0.0
        if face_results.multi_face_landmarks:
            eye_contact = self._compute_eye_contact(face_results.multi_face_landmarks[0])
            self.eye_contact_history.append(eye_contact)
        
        smile_intensity = self._detect_smile(frame)
        self.smile_history.append(smile_intensity)
        
        head_pose = self._estimate_head_pose(face_results.multi_face_landmarks[0]) if face_results.multi_face_landmarks else 0
        self.head_pose_history.append(head_pose)
        
        # Gesture detection (hand landmarks)
        if hand_results.multi_hand_landmarks and len(hand_results.multi_hand_landmarks) > 0:
            self.gesture_frames += 1
        
        return {
            'eye_contact': float(eye_contact),
            'smile_intensity': float(smile_intensity),
            'head_pose': float(head_pose),
            'gesture_activity': float(len(hand_results.multi_hand_landmarks) > 0),
            'blink_count': int(self.blink_count),
            'face_detected': bool(face_results.multi_face_landmarks),
            'num_hands': int(len(hand_results.multi_hand_landmarks))
        }
    
    def get_aggregated_features(self):
        """Get aggregated statistics over history"""
        eye_contact_list = list(self.eye_contact_history)
        smile_list = list(self.smile_history)
        head_pose_list = list(self.head_pose_history)
        
        return {
            'eye_contact_mean': mean(eye_contact_list),
            'eye_contact_consistency': std(eye_contact_list),
            'smile_mean': mean(smile_list),
            'smile_consistency': std(smile_list),
            'head_pose_mean': mean(head_pose_list),
            'head_pose_stability': std(head_pose_list),
            'gesture_frequency': float(self.gesture_frames / max(1, self.total_frames)),
            'blink_count_total': int(self.blink_count),
            'total_frames': int(self.total_frames)
        }
    
    def _compute_eye_contact(self, face_landmarks):
        """Estimate eye contact based on gaze direction"""
        # Simplified: check if eyes are looking forward
        # Full implementation would use iris landmarks and head pose
        return 0.5  # Placeholder
    
    def _detect_smile(self, frame):
        """Detect smile using OpenCV cascade classifier"""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        try:
            faces = self.cascade_classifier.detectMultiScale(gray, 1.3, 5)
            if len(faces) > 0:
                return 1.0
        except:
            pass
        return 0.0
    
    def _estimate_head_pose(self, face_landmarks):
        """Estimate head orientation (pitch, yaw, roll)"""
        # Placeholder: would use facial landmarks to estimate rotation
        return 0.0
    
    def _get_default_features(self):
        """Return zero features if extraction fails"""
        return {
            'eye_contact': 0.0,
            'smile_intensity': 0.0,
            'head_pose': 0.0,
            'gesture_activity': 0.0,
            'blink_count': 0,
            'face_detected': False,
            'num_hands': 0
        }


# ============================================================================
# SCORE COMPUTATION
# ============================================================================

def compute_voice_scores(audio_features, aggregated_audio):
    """Compute 0-100 scores from audio features"""
    
    # Confidence: based on energy and pitch stability
    energy_score = clamp(minmax(aggregated_audio['energy_mean'], 0.01, 0.2) * 100, 0, 100)
    pitch_stability = clamp(100 - aggregated_audio['pitch_std'], 0, 100)
    confidence = (energy_score * 0.6 + pitch_stability * 0.4)
    
    # Clarity: based on spectral centroid (higher = clearer)
    clarity = clamp(minmax(aggregated_audio['spectral_centroid_mean'], 1000, 4000) * 100, 0, 100)
    
    # Pace: based on speech ratio and pause count
    speech_ratio = aggregated_audio['speech_ratio']
    pace = clamp(speech_ratio * 100, 0, 100)
    
    # Volume: RMS energy
    volume = clamp(minmax(aggregated_audio['energy_mean'], 0.01, 0.3) * 100, 0, 100)
    
    # Delivery: combination of pitch variation and speech rate
    pitch_variation = clamp(aggregated_audio['pitch_std'], 10, 80)
    delivery = clamp(minmax(pitch_variation, 10, 80) * 100, 0, 100)
    
    return {
        'confidence': float(confidence),
        'clarity': float(clarity),
        'pace': float(pace),
        'volume': float(volume),
        'delivery': float(delivery),
        'overall_voice_score': float((confidence + clarity + pace + volume + delivery) / 5)
    }


def compute_video_scores(video_features, aggregated_video):
    """Compute 0-100 scores from video features"""
    
    # Eye contact: direct gaze
    eye_contact = clamp(aggregated_video['eye_contact_mean'] * 100, 0, 100)
    
    # Engagement: smile + gesture activity
    smile = clamp(aggregated_video['smile_mean'] * 100, 0, 100)
    gesture = clamp(aggregated_video['gesture_frequency'] * 100, 0, 100)
    engagement = (smile * 0.4 + gesture * 0.6)
    
    # Stability: inverse of head movement
    stability = clamp(100 - aggregated_video['head_pose_stability'], 0, 100)
    
    # Composure: stability + consistent eye contact
    composure = (stability * 0.6 + clamp(aggregated_video['eye_contact_consistency'], 0, 100) * 0.4)
    
    return {
        'eye_contact': float(eye_contact),
        'engagement': float(engagement),
        'stability': float(stability),
        'composure': float(composure),
        'overall_video_score': float((eye_contact + engagement + stability + composure) / 4)
    }


# ============================================================================
# AUDIO/VIDEO PROCESSING
# ============================================================================

def process_audio_file(audio_path):
    """Load and process audio file"""
    try:
        audio, sr = librosa.load(audio_path, sr=Config.SAMPLE_RATE)
        
        extractor = AudioFeatureExtractor(sample_rate=Config.SAMPLE_RATE)
        
        # Process in chunks
        chunk_size = int(Config.SAMPLE_RATE * Config.AUDIO_FRAME_MS / 1000)
        for i in range(0, len(audio), chunk_size):
            chunk = audio[i:i+chunk_size]
            extractor.extract_features(chunk)
        
        aggregated = extractor.get_aggregated_features()
        voice_scores = compute_voice_scores({}, aggregated)
        
        return {
            'audio_features': aggregated,
            'voice_analysis': voice_scores,
            'status': 'success'
        }
    except Exception as e:
        logger.error(f"Audio processing error: {e}")
        return {
            'audio_features': {},
            'voice_analysis': {
                'confidence': 0,
                'clarity': 0,
                'pace': 0,
                'volume': 0,
                'delivery': 0,
                'overall_voice_score': 0
            },
            'status': 'error',
            'error': str(e)
        }


def process_video_file(video_path):
    """Load and process video file"""
    try:
        cap = cv2.VideoCapture(video_path)
        extractor = VideoFeatureExtractor()
        
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            extractor.extract_features(frame)
            frame_count += 1
            
            # Limit frames to avoid OOM
            if frame_count > 300:  # ~10 seconds at 30fps
                break
        
        cap.release()
        
        aggregated = extractor.get_aggregated_features()
        video_scores = compute_video_scores({}, aggregated)
        
        return {
            'video_features': aggregated,
            'facial_analysis': video_scores,
            'status': 'success'
        }
    except Exception as e:
        logger.error(f"Video processing error: {e}")
        return {
            'video_features': {},
            'facial_analysis': {
                'eye_contact': 0,
                'engagement': 0,
                'stability': 0,
                'composure': 0,
                'overall_video_score': 0
            },
            'status': 'error',
            'error': str(e)
        }


# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(title="Interview Multimodal Analyzer", version="1.0.0")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "models_loaded": True}
    )


@app.post("/analyze")
async def analyze(
    audio: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None)
):
    """
    Analyze audio and/or video files
    Returns JSON with voiceanalysis and facialanalysis
    """
    if not audio and not video:
        raise HTTPException(status_code=400, detail="At least one of audio or video must be provided")
    
    result = {
        "voiceanalysis": {},
        "facialanalysis": {},
        "timestamp": None
    }
    
    try:
        # Process audio
        if audio:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                content = await audio.read()
                tmp.write(content)
                tmp.flush()
                
                audio_result = process_audio_file(tmp.name)
                result["voiceanalysis"] = audio_result["voice_analysis"]
                os.unlink(tmp.name)
        
        # Process video
        if video:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
                content = await video.read()
                tmp.write(content)
                tmp.flush()
                
                video_result = process_video_file(tmp.name)
                result["facialanalysis"] = video_result["facial_analysis"]
                os.unlink(tmp.name)
        
        return JSONResponse(
            status_code=200,
            content=result
        )
    
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# GRADIO INTERFACE (Optional - for UI preview)
# ============================================================================

def gradio_analyze(audio=None, video=None):
    """Gradio interface for demo purposes"""
    result = {
        "voiceanalysis": {},
        "facialanalysis": {},
        "timestamp": None
    }
    
    if audio:
        audio_result = process_audio_file(audio)
        result["voiceanalysis"] = audio_result["voice_analysis"]
    
    if video:
        video_result = process_video_file(video)
        result["facialanalysis"] = video_result["facial_analysis"]
    
    return json.dumps(result, indent=2)


# Create Gradio interface
iface = gr.Interface(
    fn=gradio_analyze,
    inputs=[
        gr.Audio(label="Audio (WAV/MP3)", type="filepath"),
        gr.Video(label="Video (MP4/AVI)")
    ],
    outputs=gr.Textbox(label="Analysis Results (JSON)", lines=20),
    title="Interview Multimodal Analyzer",
    description="Upload audio and/or video to analyze interview performance"
)


# ============================================================================
# APP STARTUP
# ============================================================================

if __name__ == "__main__":
    # Mount Gradio interface on FastAPI
    app = gr.mount_gradio_interface(iface, path="/")
    
    # Run with Uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 7860))
    )

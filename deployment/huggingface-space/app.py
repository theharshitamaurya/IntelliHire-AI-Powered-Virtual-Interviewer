#!/usr/bin/env python3
"""
IntelliHire Multimodal Analyzer - Hugging Face Space
REST API for audio/video analysis with Gradio interface
"""

import gradio as gr
import numpy as np
import cv2
import librosa
import mediapipe as mp
import json
import tempfile
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import warnings

warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# Initialize FastAPI
app = FastAPI()

# Load MediaPipe models once at startup instead of per-request.
# Re-creating FaceMesh/Pose on every /analyze call (the previous behavior)
# added model-init overhead to every request; a single shared instance is
# the standard approach for a single-worker Space process like this one.
mp_face_mesh = mp.solutions.face_mesh
mp_pose = mp.solutions.pose

face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)
pose = mp_pose.Pose(
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)


# ========== Helper Functions ==========

def normalize_to_100(value, min_val, max_val):
    """Normalize value to 0-100 scale"""
    normalized = (value - min_val) / (max_val - min_val) * 100
    return max(0, min(100, normalized))


# ========== Audio Analysis ==========

def extract_audio_features(audio_path):
    """
    Extract comprehensive audio features:
    - RMS Energy (dB), Spectral features, Pitch, Tempo, Pauses
    Returns scores compatible with backend expectations
    """
    try:
        # Load audio file
        y, sr = librosa.load(audio_path, sr=None, duration=None)
        
        # 1. RMS Energy and convert to dB
        rms = librosa.feature.rms(y=y)[0]
        rms_mean = np.mean(rms)
        epsilon = 1e-10
        energy_db = 20 * np.log10(rms_mean + epsilon)
        
        # 2. Spectral Centroid (brightness of sound)
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_centroid_mean = np.mean(spectral_centroid)
        spectral_centroid_std = np.std(spectral_centroid)
        
        # 3. Spectral Rolloff (85%)
        spectral_rolloff = librosa.feature.spectral_rolloff(
            y=y, sr=sr, roll_percent=0.85
        )[0]
        spectral_rolloff_mean = np.mean(spectral_rolloff)
        
        # 4. Zero-Crossing Rate
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        zcr_mean = np.mean(zcr)
        zcr_std = np.std(zcr)
        
        # 5. Pitch analysis
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_values = []
        for t in range(pitches.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            if pitch > 0:
                pitch_values.append(pitch)
        
        pitch_mean = np.mean(pitch_values) if pitch_values else 0
        pitch_std = np.std(pitch_values) if pitch_values else 0
        
        # 6. Speech rate (tempo estimation)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempo = librosa.beat.tempo(onset_envelope=onset_env, sr=sr)[0]
        
        # 7. Pauses detection (low energy segments)
        energy_threshold = np.percentile(rms, 20)
        pause_frames = np.sum(rms < energy_threshold)
        total_frames = len(rms)
        pause_ratio = pause_frames / total_frames if total_frames > 0 else 0
        
        # 8. Voice activity
        voice_activity = 1 - pause_ratio
        
        # Calculate derived scores (0-100 scale)
        confidence_score = calculate_audio_confidence(
            energy_db, zcr_mean, voice_activity, spectral_centroid_mean
        )
        
        clarity_score = calculate_audio_clarity(
            spectral_centroid_mean, zcr_mean, energy_db
        )
        
        pace_score = calculate_audio_pace(tempo, pause_ratio)
        
        volume_score = normalize_to_100(energy_db, -40, -10)
        
        delivery_score = (confidence_score + clarity_score + pace_score + volume_score) / 4
        
        return {
            # Raw features
            'energy_db': float(energy_db),
            'spectral_centroid_mean': float(spectral_centroid_mean),
            'spectral_centroid_std': float(spectral_centroid_std),
            'spectral_rolloff_mean': float(spectral_rolloff_mean),
            'zcr_mean': float(zcr_mean),
            'zcr_std': float(zcr_std),
            'pitch_mean': float(pitch_mean),
            'pitch_std': float(pitch_std),
            'tempo': float(tempo),
            'pause_ratio': float(pause_ratio),
            'voice_activity': float(voice_activity),
            
            # Derived scores (MongoDB fields)
            'clarity': round(clarity_score, 2),
            'pace': round(pace_score, 2),
            'volume': round(volume_score, 2),
            'confidence': round(confidence_score, 2),
            'overallVoiceScore': round(delivery_score, 2),
            'deliveryScore': round(delivery_score, 2)
        }
        
    except Exception as e:
        print(f"Audio extraction error: {str(e)}")
        return get_default_audio_features()


def calculate_audio_confidence(energy_db, zcr, voice_activity, spectral_centroid):
    """Calculate confidence from audio signals"""
    energy_score = normalize_to_100(energy_db, -40, -10)
    zcr_score = normalize_to_100(zcr, 0.02, 0.15)
    voice_score = voice_activity * 100
    spectral_score = normalize_to_100(spectral_centroid, 1000, 3000)
    
    return (energy_score * 0.4 + zcr_score * 0.2 + voice_score * 0.3 + spectral_score * 0.1)


def calculate_audio_clarity(spectral_centroid, zcr, energy_db):
    """Calculate speech clarity"""
    spectral_score = normalize_to_100(spectral_centroid, 1500, 2500)
    zcr_score = normalize_to_100(zcr, 0.05, 0.12)
    energy_score = normalize_to_100(energy_db, -35, -15)
    
    return (spectral_score * 0.5 + zcr_score * 0.3 + energy_score * 0.2)


def calculate_audio_pace(tempo, pause_ratio):
    """Calculate speaking pace"""
    tempo_score = 100 - abs(tempo - 135) / 135 * 100
    tempo_score = max(0, min(100, tempo_score))
    pause_score = (1 - pause_ratio) * 100
    
    return (tempo_score * 0.6 + pause_score * 0.4)


def get_default_audio_features():
    """Return default values if audio analysis fails"""
    return {
        'energy_db': -30.0,
        'spectral_centroid_mean': 2000.0,
        'spectral_centroid_std': 500.0,
        'spectral_rolloff_mean': 4000.0,
        'zcr_mean': 0.08,
        'zcr_std': 0.02,
        'pitch_mean': 150.0,
        'pitch_std': 30.0,
        'tempo': 120.0,
        'pause_ratio': 0.2,
        'voice_activity': 0.8,
        'clarity': 75.0,
        'pace': 75.0,
        'volume': 75.0,
        'confidence': 75.0,
        'overallVoiceScore': 75.0,
        'deliveryScore': 75.0
    }


# ========== Video Analysis ==========

def extract_video_features(video_path):
    """
    Extract video features as described in paper:
    - Eye contact score
    - Head pose stability
    - Posture score
    - Gesture intensity

    Mirrors ml-service/multimodal_analyzer.py exactly so the Space produces
    the same output as the local analyzer (same algorithm, same field names).
    """
    try:
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            raise Exception("Could not open video file")

        total_frames = 0
        eye_contact_frames = 0
        head_angles = []
        posture_scores = []
        gesture_magnitudes = []
        engagement_indicators = []

        prev_hand_landmarks = None

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            total_frames += 1

            # Convert to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w, _ = frame.shape

            # Process face
            face_results = face_mesh.process(frame_rgb)

            if face_results.multi_face_landmarks:
                face_landmarks = face_results.multi_face_landmarks[0]

                # Eye contact detection (gaze direction)
                eye_contact = detect_eye_contact(face_landmarks, w, h)
                if eye_contact:
                    eye_contact_frames += 1

                # Head pose estimation
                head_angle = estimate_head_pose(face_landmarks, w, h)
                if head_angle is not None:
                    head_angles.append(head_angle)

                # Engagement (facial expressiveness)
                engagement = calculate_facial_engagement(face_landmarks)
                engagement_indicators.append(engagement)

            # Process body pose
            pose_results = pose.process(frame_rgb)

            if pose_results.pose_landmarks:
                landmarks = pose_results.pose_landmarks.landmark

                # Posture score
                posture = calculate_posture_score(landmarks)
                posture_scores.append(posture)

                # Gesture intensity (hand movement)
                hand_landmarks = extract_hand_landmarks(landmarks)
                if prev_hand_landmarks is not None:
                    movement = calculate_movement(prev_hand_landmarks, hand_landmarks)
                    gesture_magnitudes.append(movement)
                prev_hand_landmarks = hand_landmarks

            # Sample every 5 frames for performance
            if total_frames % 5 == 0:
                cap.set(cv2.CAP_PROP_POS_FRAMES, cap.get(cv2.CAP_PROP_POS_FRAMES) + 4)

        cap.release()

        # Calculate final metrics
        eye_contact_score = (eye_contact_frames / total_frames * 100) if total_frames > 0 else 70
        head_stability = 100 - min(100, np.std(head_angles) * 10) if head_angles else 75
        posture_score = np.mean(posture_scores) if posture_scores else 75
        gesture_intensity = np.mean(gesture_magnitudes) if gesture_magnitudes else 50
        engagement_score = np.mean(engagement_indicators) if engagement_indicators else 70

        # Professionalism (composite)
        professionalism_score = (eye_contact_score * 0.4 + head_stability * 0.3 +
                                posture_score * 0.3)

        # Overall facial score
        overall_facial_score = (eye_contact_score * 0.3 + engagement_score * 0.3 +
                               professionalism_score * 0.4)

        return {
            # Raw features
            'total_frames': total_frames,
            'eye_contact_frames': eye_contact_frames,
            'head_angle_std': float(np.std(head_angles)) if head_angles else 0,
            'gesture_mean': float(np.mean(gesture_magnitudes)) if gesture_magnitudes else 0,

            # MongoDB fields
            'eyeContact': round(eye_contact_score, 2),
            'headStability': round(head_stability, 2),
            'postureScore': round(posture_score, 2),
            'gestureIntensity': round(gesture_intensity, 2),
            'engagement': round(engagement_score, 2),
            'professionalism': round(professionalism_score, 2),
            'confidence': round((eye_contact_score + posture_score) / 2, 2),
            'overallFacialScore': round(overall_facial_score, 2),
            'engagementScore': round(engagement_score, 2)
        }

    except Exception as e:
        print(f"Video extraction error: {str(e)}")
        return get_default_video_features()


def detect_eye_contact(face_landmarks, frame_width, frame_height):
    """Detect if person is looking at camera (forward gaze)"""
    # Use iris landmarks (468-473 for left iris, 473-478 for right iris)
    # Simplified: check if eyes are visible and centered

    left_eye = [33, 133, 160, 159, 158, 157, 173]
    right_eye = [362, 263, 387, 386, 385, 384, 398]

    left_eye_coords = [(face_landmarks.landmark[i].x, face_landmarks.landmark[i].y)
                       for i in left_eye]
    right_eye_coords = [(face_landmarks.landmark[i].x, face_landmarks.landmark[i].y)
                        for i in right_eye]

    left_center_x = np.mean([c[0] for c in left_eye_coords])
    right_center_x = np.mean([c[0] for c in right_eye_coords])

    # Eyes should be roughly equidistant from center (0.5)
    eye_symmetry = abs((left_center_x + right_center_x) / 2 - 0.5)

    # Forward gaze: symmetry < 0.1
    return eye_symmetry < 0.1


def estimate_head_pose(face_landmarks, frame_width, frame_height):
    """Estimate head rotation angle"""
    nose_tip = face_landmarks.landmark[1]
    chin = face_landmarks.landmark[152]
    left_cheek = face_landmarks.landmark[234]
    right_cheek = face_landmarks.landmark[454]

    dx = (right_cheek.x - left_cheek.x) * frame_width
    dy = (right_cheek.y - left_cheek.y) * frame_height

    angle = np.degrees(np.arctan2(dy, dx))

    # Normalize to 0-90 range (deviation from center)
    return abs(angle - 0)


def calculate_facial_engagement(face_landmarks):
    """Calculate engagement from facial expressiveness"""
    # Mouth landmarks
    upper_lip = face_landmarks.landmark[13].y
    lower_lip = face_landmarks.landmark[14].y
    mouth_open = abs(upper_lip - lower_lip)

    # Eyebrow landmarks
    left_eyebrow = face_landmarks.landmark[70].y
    right_eyebrow = face_landmarks.landmark[300].y
    eyebrow_avg = (left_eyebrow + right_eyebrow) / 2

    # Score based on expressiveness
    expressiveness = (mouth_open + abs(eyebrow_avg - 0.4)) * 100

    return min(100, max(50, expressiveness * 50))


def calculate_posture_score(landmarks):
    """Calculate posture from shoulder and hip alignment"""
    left_shoulder = landmarks[mp.solutions.pose.PoseLandmark.LEFT_SHOULDER.value]
    right_shoulder = landmarks[mp.solutions.pose.PoseLandmark.RIGHT_SHOULDER.value]

    # Calculate shoulder alignment (should be horizontal)
    shoulder_slope = abs(left_shoulder.y - right_shoulder.y)

    # Good posture: slope < 0.05
    posture_score = 100 - min(100, shoulder_slope * 1000)

    # Check if shoulders are visible (not out of frame)
    if left_shoulder.visibility < 0.5 or right_shoulder.visibility < 0.5:
        posture_score *= 0.8

    return max(0, posture_score)


def extract_hand_landmarks(landmarks):
    """Extract hand positions for gesture tracking"""
    left_wrist = landmarks[mp.solutions.pose.PoseLandmark.LEFT_WRIST.value]
    right_wrist = landmarks[mp.solutions.pose.PoseLandmark.RIGHT_WRIST.value]

    return {
        'left': (left_wrist.x, left_wrist.y, left_wrist.z),
        'right': (right_wrist.x, right_wrist.y, right_wrist.z)
    }


def calculate_movement(prev_landmarks, curr_landmarks):
    """Calculate hand movement magnitude"""
    left_dist = np.linalg.norm(
        np.array(curr_landmarks['left']) - np.array(prev_landmarks['left'])
    )
    right_dist = np.linalg.norm(
        np.array(curr_landmarks['right']) - np.array(prev_landmarks['right'])
    )

    # Normalize to 0-100 scale
    movement = (left_dist + right_dist) * 100
    return min(100, movement)


def get_default_video_features():
    """Return default values if video analysis fails"""
    return {
        'total_frames': 0,
        'eye_contact_frames': 0,
        'head_angle_std': 0,
        'gesture_mean': 0,
        'eyeContact': 70.0,
        'headStability': 75.0,
        'postureScore': 75.0,
        'gestureIntensity': 50.0,
        'engagement': 70.0,
        'professionalism': 80.0,
        'confidence': 75.0,
        'overallFacialScore': 75.0,
        'engagementScore': 70.0
    }


# ========== Multimodal Analysis ==========

def analyze_multimodal(audio_file, video_file):
    """
    Analyze both audio and video files
    Returns JSON matching backend expectations
    """
    result = {
        'success': True,
        'audio': None,
        'video': None,
        'error': None
    }
    
    try:
        # Analyze audio
        if audio_file is not None:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_audio:
                tmp_audio.write(audio_file)
                tmp_audio_path = tmp_audio.name
            
            result['audio'] = extract_audio_features(tmp_audio_path)
            os.unlink(tmp_audio_path)
        
        # Analyze video
        if video_file is not None:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_video:
                tmp_video.write(video_file)
                tmp_video_path = tmp_video.name
            
            result['video'] = extract_video_features(tmp_video_path)
            os.unlink(tmp_video_path)
        
        return result
        
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
        return result


# ========== FastAPI Endpoints ==========

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return JSONResponse(content={
        "status": "ok",
        "models_loaded": True,
        "version": "1.0.0"
    })


@app.post("/analyze")
async def analyze_endpoint(
    audio: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None)
):
    """
    Main analysis endpoint
    Accepts audio and/or video files, returns JSON with features
    """
    if audio is None and video is None:
        raise HTTPException(status_code=400, detail="At least one file (audio or video) must be provided")
    
    result = {
        'success': True,
        'audio': None,
        'video': None,
        'error': None
    }
    
    try:
        # Process audio
        if audio is not None:
            audio_bytes = await audio.read()
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_audio:
                tmp_audio.write(audio_bytes)
                tmp_audio_path = tmp_audio.name
            
            result['audio'] = extract_audio_features(tmp_audio_path)
            os.unlink(tmp_audio_path)
        
        # Process video
        if video is not None:
            video_bytes = await video.read()
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_video:
                tmp_video.write(video_bytes)
                tmp_video_path = tmp_video.name
            
            result['video'] = extract_video_features(tmp_video_path)
            os.unlink(tmp_video_path)
        
        return JSONResponse(content=result)
        
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
        return JSONResponse(content=result, status_code=500)


# ========== Gradio Interface ==========

def gradio_analyze(audio_file, video_file):
    """Gradio interface function"""
    audio_bytes = None
    video_bytes = None
    
    if audio_file is not None:
        with open(audio_file, 'rb') as f:
            audio_bytes = f.read()
    
    if video_file is not None:
        with open(video_file, 'rb') as f:
            video_bytes = f.read()
    
    result = analyze_multimodal(audio_bytes, video_bytes)
    return json.dumps(result, indent=2)


# Create Gradio interface
demo = gr.Interface(
    fn=gradio_analyze,
    inputs=[
        gr.Audio(type="filepath", label="Upload Audio File (optional)"),
        gr.Video(label="Upload Video File (optional)")
    ],
    outputs=gr.Textbox(label="Analysis Results (JSON)", lines=20),
    title="IntelliHire Multimodal Analyzer",
    description="Upload audio and/or video files to analyze interview performance. Returns confidence, clarity, eye contact, engagement, and more.",
    examples=[],
    flagging_mode="never"
)

# Mount Gradio app to FastAPI
app = gr.mount_gradio_app(app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)

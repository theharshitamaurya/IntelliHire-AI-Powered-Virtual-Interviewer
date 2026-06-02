
import cv2
import numpy as np
import mediapipe as mp
import librosa
import joblib
from collections import deque
from scipy import signal
from scipy.fft import fft, fftfreq
import math


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


def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def minmax(x, minv, maxv):
    return (x - minv) / (maxv - minv + 1e-9)

def zscore(x, mu, sigma):
    return (x - mu) / (sigma + 1e-9)

def logistic(x, k=1, x0=0):
    return 1 / (1 + np.exp(-k * (x - x0)))

def mean(arr):
    return np.mean(arr) if len(arr) > 0 else 0

def std(arr):
    return np.std(arr) if len(arr) > 0 else 0

def percentile(arr, p):
    return np.percentile(arr, p) if len(arr) > 0 else 0


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
            'energy_db': energy_db,
            'rms': rms,
            'f0_mean': mean(list(self.pitch_history)),
            'f0_std': std(list(self.pitch_history)),
            'f0_current': f0,
            'spectral_centroid': spectral_centroid,
            'spectral_rolloff': spectral_rolloff,
            'zcr': zcr,
            'formants': formants,
            'formant_diff': formants[1] - formants[0] if len(formants) >= 2 else 0,
            'mfcc': mfcc,
            'voiced_ratio': voiced_ratio,
            'pause_count': self.pause_count,
            'speech_ratio': self.speech_frames / max(1, self.total_frames)
        }
    
    def get_aggregated_features(self):
        """Get aggregated statistics over history"""
        return {
            'energy_mean': mean(list(self.energy_history)),
            'energy_std': std(list(self.energy_history)),
            'energy_median': percentile(list(self.energy_history), 50),
            'pitch_mean': mean(list(self.pitch_history)),
            'pitch_std': std(list(self.pitch_history)),
            'pitch_min': min(self.pitch_history) if self.pitch_history else 0,
            'pitch_max': max(self.pitch_history) if self.pitch_history else 0,
            'pitch_range': (max(self.pitch_history) - min(self.pitch_history)) if self.pitch_history else 0,
            'spectral_centroid_mean': mean(list(self.spectral_centroid_history)),
            'spectral_centroid_std': std(list(self.spectral_centroid_history)),
            'spectral_rolloff_mean': mean(list(self.spectral_rolloff_history)),
            'zcr_mean': mean(list(self.zcr_history)),
            'zcr_std': std(list(self.zcr_history)),
            'pause_count': self.pause_count,
            'speech_ratio': self.speech_frames / max(1, self.total_frames)
        }
    
    def _denoise(self, audio):
        """Simple spectral gating for noise reduction"""
        try:
            # High-pass filter to remove low frequency noise
            sos = signal.butter(5, 80, 'hp', fs=self.sample_rate, output='sos')
            filtered = signal.sosfilt(sos, audio)
            return filtered
        except:
            return audio
    
    def _estimate_pitch_autocorrelation(self, audio):
        """Estimate F0 using autocorrelation"""
        # Normalize
        audio = audio - np.mean(audio)
        
        # Autocorrelation
        corr = np.correlate(audio, audio, mode='full')
        corr = corr[len(corr)//2:]
        
        # Find peaks
        min_period = int(self.sample_rate / Config.PITCH_MAX)
        max_period = int(self.sample_rate / Config.PITCH_MIN)
        
        if max_period >= len(corr):
            return 0
        
        # Find first peak after min_period
        peaks = []
        for i in range(min_period, min(max_period, len(corr)-1)):
            if corr[i] > corr[i-1] and corr[i] > corr[i+1]:
                peaks.append((i, corr[i]))
        
        if not peaks:
            return 0
        
        # Get highest peak
        best_period = max(peaks, key=lambda x: x[1])[0]
        f0 = self.sample_rate / best_period
        
        return f0 if Config.PITCH_MIN <= f0 <= Config.PITCH_MAX else 0
    
    def _compute_spectral_centroid(self, spec, freqs):
        """Compute spectral centroid"""
        if np.sum(spec) == 0:
            return 0
        return np.sum(freqs * spec) / np.sum(spec)
    
    def _compute_spectral_rolloff(self, spec, freqs, rolloff_percent=0.85):
        """Compute spectral rolloff"""
        cumsum = np.cumsum(spec)
        threshold = rolloff_percent * cumsum[-1]
        idx = np.where(cumsum >= threshold)[0]
        return freqs[idx[0]] if len(idx) > 0 else freqs[-1]
    
    def _estimate_formants(self, audio):
        """Simplified formant estimation using LPC"""
        try:
            # Pre-emphasis
            emphasized = np.append(audio[0], audio[1:] - 0.97 * audio[:-1])
            
            # LPC analysis
            order = 12
            a = self._lpc(emphasized, order)
            
            # Find roots
            roots = np.roots(a)
            roots = roots[np.imag(roots) >= 0]
            
            # Convert to frequencies
            angles = np.arctan2(np.imag(roots), np.real(roots))
            freqs = sorted(angles * (self.sample_rate / (2 * np.pi)))
            
            # Return first 3 formants
            formants = [f for f in freqs if 200 < f < 4000]
            return formants[:3] if len(formants) >= 3 else formants + [0] * (3 - len(formants))
        except:
            return [0, 0, 0]
    
    def _lpc(self, signal, order):
        """Linear Predictive Coding"""
        r = np.correlate(signal, signal, mode='full')
        r = r[len(r)//2:]
        R = np.zeros((order+1, order+1))
        for i in range(order+1):
            for j in range(order+1):
                R[i,j] = r[abs(i-j)]
        
        r_vec = r[1:order+2]
        try:
            a = np.linalg.solve(R[1:,1:], r_vec)
            return np.concatenate(([1], -a))
        except:
            return np.ones(order+1)
    
    def _compute_mfcc(self, audio, n_mfcc=13):
        """Compute MFCC features"""
        try:
            mfcc = librosa.feature.mfcc(y=audio, sr=self.sample_rate, n_mfcc=n_mfcc)
            return np.mean(mfcc, axis=1)
        except:
            return np.zeros(n_mfcc)
    
    def _get_default_features(self):
        return {
            'energy_db': -60,
            'rms': 0,
            'f0_mean': 0,
            'f0_std': 0,
            'f0_current': 0,
            'spectral_centroid': 0,
            'spectral_rolloff': 0,
            'zcr': 0,
            'formants': [0, 0, 0],
            'formant_diff': 0,
            'mfcc': np.zeros(13),
            'voiced_ratio': 0,
            'pause_count': 0,
            'speech_ratio': 0
        }


class VideoFeatureExtractor:
    """Extract comprehensive video/face features"""
    
    def __init__(self):
        self.mp_face = mp.solutions.face_mesh
        self.mp_pose = mp.solutions.pose
        self.mp_hands = mp.solutions.hands
        
        self.face_mesh = self.mp_face.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # History buffers
        self.eye_contact_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.gaze_angle_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.head_yaw_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.head_pitch_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.head_roll_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.smile_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.eyebrow_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.blink_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        self.gesture_history = deque(maxlen=Config.MAX_HISTORY_SIZE)
        
        self.prev_landmarks = None
        self.blink_counter = 0
        self.frame_count = 0
    
    def extract_features(self, frame):
        """Extract all video features from frame"""
        if frame is None:
            return self._get_default_features()
        
        self.frame_count += 1
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Face landmarks
        face_results = self.face_mesh.process(rgb_frame)
        # Pose
        pose_results = self.pose.process(rgb_frame)
        # Hands
        hand_results = self.hands.process(rgb_frame)
        
        if not face_results.multi_face_landmarks:
            return self._get_default_features()
        
        landmarks = face_results.multi_face_landmarks[0]
        
        # 1. Eye contact / gaze
        eye_contact, gaze_angle = self._analyze_eye_gaze(landmarks, frame.shape)
        self.eye_contact_history.append(eye_contact)
        self.gaze_angle_history.append(gaze_angle)
        
        # 2. Head pose
        head_pose = self._estimate_head_pose(landmarks, frame.shape)
        self.head_yaw_history.append(head_pose['yaw'])
        self.head_pitch_history.append(head_pose['pitch'])
        self.head_roll_history.append(head_pose['roll'])
        
        # 3. Smile detection
        smile_score = self._detect_smile(landmarks)
        self.smile_history.append(smile_score)
        
        # 4. Eyebrow activity
        eyebrow_activity = self._analyze_eyebrow_movement(landmarks)
        self.eyebrow_history.append(eyebrow_activity)
        
        # 5. Blink detection
        blink = self._detect_blink(landmarks)
        if blink:
            self.blink_counter += 1
        self.blink_history.append(blink)
        
        # 6. Mouth aspect ratio
        mouth_aspect = self._compute_mouth_aspect_ratio(landmarks)
        
        # 7. Body pose (if available)
        torso_openness = 0.7
        if pose_results.pose_landmarks:
            torso_openness = self._analyze_body_pose(pose_results.pose_landmarks)
        
        # 8. Hand gestures (if available)
        gesture_score = 0
        if hand_results.multi_hand_landmarks:
            gesture_score = self._analyze_hand_gestures(hand_results.multi_hand_landmarks)
        self.gesture_history.append(gesture_score)
        
        self.prev_landmarks = landmarks
        
        return {
            'face_visible': 1,
            'eye_contact_prob': eye_contact,
            'gaze_angle': gaze_angle,
            'head_yaw': head_pose['yaw'],
            'head_pitch': head_pose['pitch'],
            'head_roll': head_pose['roll'],
            'smile_score': smile_score,
            'eyebrow_activity': eyebrow_activity,
            'blink_rate': self.blink_counter / max(1, self.frame_count) * 60,  # blinks per minute
            'mouth_aspect': mouth_aspect,
            'torso_openness': torso_openness,
            'gesture_score': gesture_score
        }
    
    def get_aggregated_features(self):
        """Get aggregated video features"""
        return {
            'eye_contact_mean': mean(list(self.eye_contact_history)),
            'eye_contact_std': std(list(self.eye_contact_history)),
            'gaze_stability': 1 - std(list(self.gaze_angle_history)) / 90,
            'head_yaw_mean': mean(list(self.head_yaw_history)),
            'head_yaw_std': std(list(self.head_yaw_history)),
            'head_pitch_mean': mean(list(self.head_pitch_history)),
            'head_pitch_std': std(list(self.head_pitch_history)),
            'head_roll_mean': mean(list(self.head_roll_history)),
            'head_roll_std': std(list(self.head_roll_history)),
            'head_stability': self._calculate_head_stability(),
            'smile_mean': mean(list(self.smile_history)),
            'smile_std': std(list(self.smile_history)),
            'smile_variability': std(list(self.smile_history)),
            'eyebrow_activity_mean': mean(list(self.eyebrow_history)),
            'blink_rate': self.blink_counter / max(1, self.frame_count) * 60,
            'gesture_mean': mean(list(self.gesture_history)),
            'gesture_variance': std(list(self.gesture_history))
        }
    
    def _analyze_eye_gaze(self, landmarks, frame_shape):
        """Analyze eye gaze direction"""
        try:
            # Left and right iris centers
            left_iris = landmarks.landmark[468]
            right_iris = landmarks.landmark[473]
            
            # Eye corners
            left_corner = landmarks.landmark[33]
            right_corner = landmarks.landmark[263]
            
            # Calculate gaze direction
            left_ratio = (left_iris.x - left_corner.x)
            right_ratio = (right_iris.x - right_corner.x)
            
            gaze_x = (left_ratio + right_ratio) / 2
            gaze_y = (left_iris.y + right_iris.y) / 2
            
            # Calculate angle from center
            center_x, center_y = 0.5, 0.4
            dx = gaze_x - center_x
            dy = gaze_y - center_y
            
            angle = np.arctan2(dy, dx) * 180 / np.pi
            distance = np.sqrt(dx**2 + dy**2)
            
            # Eye contact probability (closer to center = higher prob)
            eye_contact_prob = max(0, 1 - distance * 5)
            
            return clamp(eye_contact_prob, 0, 1), angle
        except:
            return 0, 0
    
    def _estimate_head_pose(self, landmarks, frame_shape):
        """Estimate head pose (yaw, pitch, roll)"""
        try:
            h, w = frame_shape[:2]
            
            # 3D model points
            model_points = np.array([
                (0.0, 0.0, 0.0),             # Nose tip
                (0.0, -330.0, -65.0),        # Chin
                (-225.0, 170.0, -135.0),     # Left eye left corner
                (225.0, 170.0, -135.0),      # Right eye right corner
                (-150.0, -150.0, -125.0),    # Left mouth corner
                (150.0, -150.0, -125.0)      # Right mouth corner
            ])
            
            # 2D image points
            image_points = np.array([
                (landmarks.landmark[1].x * w, landmarks.landmark[1].y * h),      # Nose
                (landmarks.landmark[152].x * w, landmarks.landmark[152].y * h),  # Chin
                (landmarks.landmark[33].x * w, landmarks.landmark[33].y * h),    # Left eye
                (landmarks.landmark[263].x * w, landmarks.landmark[263].y * h),  # Right eye
                (landmarks.landmark[61].x * w, landmarks.landmark[61].y * h),    # Left mouth
                (landmarks.landmark[291].x * w, landmarks.landmark[291].y * h)   # Right mouth
            ], dtype="double")
            
            # Camera internals
            focal_length = w
            center = (w/2, h/2)
            camera_matrix = np.array([
                [focal_length, 0, center[0]],
                [0, focal_length, center[1]],
                [0, 0, 1]
            ], dtype="double")
            
            dist_coeffs = np.zeros((4,1))
            
            # Solve PnP
            success, rotation_vec, translation_vec = cv2.solvePnP(
                model_points, image_points, camera_matrix, dist_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE
            )
            
            # Convert rotation vector to rotation matrix
            rotation_mat, _ = cv2.Rodrigues(rotation_vec)
            
            # Extract Euler angles
            sy = math.sqrt(rotation_mat[0,0]**2 + rotation_mat[1,0]**2)
            
            if sy > 1e-6:
                yaw = math.atan2(rotation_mat[1,0], rotation_mat[0,0])
                pitch = math.atan2(-rotation_mat[2,0], sy)
                roll = math.atan2(rotation_mat[2,1], rotation_mat[2,2])
            else:
                yaw = math.atan2(-rotation_mat[1,2], rotation_mat[1,1])
                pitch = math.atan2(-rotation_mat[2,0], sy)
                roll = 0
            
            return {
                'yaw': math.degrees(yaw),
                'pitch': math.degrees(pitch),
                'roll': math.degrees(roll)
            }
        except:
            return {'yaw': 0, 'pitch': 0, 'roll': 0}
    
    def _detect_smile(self, landmarks):
        """Detect smile intensity"""
        try:
            # Mouth corners and lips
            left_mouth = landmarks.landmark[61]
            right_mouth = landmarks.landmark[291]
            top_lip = landmarks.landmark[13]
            bottom_lip = landmarks.landmark[14]
            
            # Mouth dimensions
            mouth_width = np.sqrt(
                (right_mouth.x - left_mouth.x)**2 +
                (right_mouth.y - left_mouth.y)**2
            )
            mouth_height = abs(top_lip.y - bottom_lip.y)
            
            # Smile ratio
            smile_ratio = mouth_width / (mouth_height + 0.001)
            
            # Mouth corner elevation
            nose_tip = landmarks.landmark[4]
            left_elevation = nose_tip.y - left_mouth.y
            right_elevation = nose_tip.y - right_mouth.y
            elevation = (left_elevation + right_elevation) / 2
            
            # Combined smile score
            smile_score = min(1.0, max(0, (smile_ratio - 2.0) / 2.5))
            elevation_score = min(1.0, max(0, elevation * 8))
            
            return (smile_score * 0.6 + elevation_score * 0.4)
        except:
            return 0
    
    def _analyze_eyebrow_movement(self, landmarks):
        """Analyze eyebrow activity"""
        try:
            # Eyebrow landmarks
            left_brow = landmarks.landmark[70]
            right_brow = landmarks.landmark[300]
            left_eye = landmarks.landmark[33]
            right_eye = landmarks.landmark[263]
            
            # Distance between eyebrows and eyes
            left_dist = abs(left_brow.y - left_eye.y)
            right_dist = abs(right_brow.y - right_eye.y)
            
            avg_dist = (left_dist + right_dist) / 2
            
            # Movement compared to neutral
            activity = min(1.0, avg_dist * 15)
            return activity
        except:
            return 0
    
    def _detect_blink(self, landmarks):
        """Detect eye blink"""
        try:
            # Eye aspect ratio for both eyes
            left_ear = self._eye_aspect_ratio(landmarks, 'left')
            right_ear = self._eye_aspect_ratio(landmarks, 'right')
            
            ear = (left_ear + right_ear) / 2
            
            # Blink threshold
            return ear < 0.2
        except:
            return False
    
    def _eye_aspect_ratio(self, landmarks, eye='left'):
        """Calculate eye aspect ratio"""
        if eye == 'left':
            p1, p2 = landmarks.landmark[159], landmarks.landmark[145]
            p3, p4 = landmarks.landmark[33], landmarks.landmark[133]
        else:
            p1, p2 = landmarks.landmark[386], landmarks.landmark[374]
            p3, p4 = landmarks.landmark[362], landmarks.landmark[263]
        
        vertical = np.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)
        horizontal = np.sqrt((p3.x - p4.x)**2 + (p3.y - p4.y)**2)
        
        return vertical / (horizontal + 1e-6)
    
    def _compute_mouth_aspect_ratio(self, landmarks):
        """Compute mouth aspect ratio"""
        try:
            left = landmarks.landmark[61]
            right = landmarks.landmark[291]
            top = landmarks.landmark[13]
            bottom = landmarks.landmark[14]
            
            width = np.sqrt((right.x - left.x)**2 + (right.y - left.y)**2)
            height = abs(top.y - bottom.y)
            
            return height / (width + 1e-6)
        except:
            return 0
    
    def _analyze_body_pose(self, pose_landmarks):
        """Analyze body openness from pose"""
        try:
            left_shoulder = pose_landmarks.landmark[11]
            right_shoulder = pose_landmarks.landmark[12]
            
            # Shoulder width (wider = more open)
            shoulder_width = abs(right_shoulder.x - left_shoulder.x)
            
            # Normalize
            openness = min(1.0, shoulder_width * 3)
            return openness
        except:
            return 0.5
    
    def _analyze_hand_gestures(self, hand_landmarks):
        """Analyze hand gesture appropriateness"""
        try:
            gesture_score = 0
            for hand in hand_landmarks:
                wrist = hand.landmark[0]
                
                # Check if hand is visible and in frame
                if 0.2 < wrist.y < 0.8:
                    gesture_score += 0.5
            
            return min(1.0, gesture_score)
        except:
            return 0
    
    def _calculate_head_stability(self):
        """Calculate overall head movement stability"""
        yaw_var = std(list(self.head_yaw_history))
        pitch_var = std(list(self.head_pitch_history))
        roll_var = std(list(self.head_roll_history))
        
        # Lower variance = more stable
        stability = 1 - min(1.0, (yaw_var + pitch_var + roll_var) / 90)
        return max(0, stability)
    
    def _get_default_features(self):
        return {
            'face_visible': 0,
            'eye_contact_prob': 0,
            'gaze_angle': 0,
            'head_yaw': 0,
            'head_pitch': 0,
            'head_roll': 0,
            'smile_score': 0,
            'eyebrow_activity': 0,
            'blink_rate': 0,
            'mouth_aspect': 0,
            'torso_openness': 0,
            'gesture_score': 0
        }


class MultimodalConfidenceScorer:
    """Score confidence using heuristic fusion"""
    
    def score_speech_confidence(self, audio_agg):
        """Score speech confidence from audio features"""
        # Energy score
        energy_score = minmax(
            audio_agg['energy_mean'],
            Config.ENERGY_MIN,
            Config.ENERGY_MAX
        )
        
        # Pitch stability (lower variance = more confident)
        pitch_stability = 1 - minmax(
            audio_agg['pitch_std'],
            Config.PITCH_VAR_MIN,
            Config.PITCH_VAR_MAX
        )
        
        # Speech rate (closer to ideal = better)
        # Would need actual WPM from speech-to-text
        speech_rate_score = 0.7  # Placeholder
        
        # Clarity from spectral features
        clarity = minmax(
            audio_agg['spectral_centroid_mean'],
            1000,
            3000
        )
        
        # Pause appropriateness
        pause_penalty = 1 - min(1.0, audio_agg['pause_count'] / 100)
        
        # Weighted combination
        score = (
            0.30 * energy_score +
            0.25 * pitch_stability +
            0.20 * speech_rate_score +
            0.15 * clarity +
            0.10 * pause_penalty
        )
        
        return clamp(score, 0, 1)
    
    def score_video_confidence(self, video_agg):
        """Score visual confidence from video features"""
        # Eye contact
        eye_contact = clamp(video_agg['eye_contact_mean'], 0, 1)
        
        # Head control
        head_control = clamp(video_agg['head_stability'], 0, 1)
        
        # Smile control (not too variable)
        smile_control = 1 - clamp(video_agg['smile_variability'], 0, 1)
        
        # Gesture appropriateness
        gesture_score = clamp(video_agg['gesture_mean'], 0, 1)
        gesture_control = 1 - clamp(video_agg['gesture_variance'], 0, 1)
        gesture_combined = (gesture_score + gesture_control) / 2
        
        # Weighted combination
        score = (
            0.35 * eye_contact +
            0.30 * head_control +
            0.15 * smile_control +
            0.20 * gesture_combined
        )
        
        return clamp(score, 0, 1)
    
    def heuristic_fusion(self, speech_conf, video_conf, has_face, is_speaking):
        """Fuse multimodal scores with adaptive weighting"""
        # Adaptive weights
        w_speech = 0.50
        w_video = 0.50
        
        if not has_face:
            w_speech = 1.0
            w_video = 0.0
        
        if not is_speaking:
            w_speech = 0.3
            w_video = 0.7
        
        # Weighted fusion
        combined = w_speech * speech_conf + w_video * video_conf
        
        # Calibration (isotonic-like with logistic)
        calibrated = self.calibrate_score(combined)
        
        # Map to 0-100 scale
        return int(calibrated * 100)
    
    def calibrate_score(self, raw_score):
        """Calibrate raw score using logistic function"""
        # Sigmoid calibration to map to well-calibrated probabilities
        return logistic(raw_score, k=6, x0=0.5)


class AdvancedAIAnalyzer:
    """Main multimodal analyzer class"""
    
    def __init__(self, sample_rate=16000):
        self.audio_extractor = AudioFeatureExtractor(sample_rate)
        self.video_extractor = VideoFeatureExtractor()
        self.scorer = MultimodalConfidenceScorer()
        
        # Load ML model for confidence prediction
        try:
            self.ml_model = joblib.load("training_pipeline/confidence_model.pkl")
        except:
            print("Warning: ML model not found. Please train the model first.")
            self.ml_model = None
        
    def analyze_audio(self, audio_chunk):
        """Analyze audio chunk"""
        return self.audio_extractor.extract_features(audio_chunk)
    
    def analyze_video(self, frame):
        """Analyze video frame"""
        return self.video_extractor.extract_features(frame)
    
        def build_feature_vector(self, audio_agg, video_agg):
            """
            Build feature vector matching training data format.
            Feature order MUST match the training script exactly.
            """
            features = []
        
            # AUDIO FEATURES (8 features)
            features += [
                audio_agg['energy_mean'],
                audio_agg['energy_std'],
                audio_agg['pitch_mean'],
                audio_agg['pitch_std'],
                audio_agg['spectral_centroid_mean'],
                audio_agg['zcr_mean'],
                audio_agg['pause_count'],
                audio_agg['speech_ratio']
            ]
        
            # VIDEO FEATURES (5 features)
            features += [
                video_agg['eye_contact_mean'],
                video_agg['head_stability'],
                video_agg['smile_mean'],
                video_agg['blink_rate'],
                video_agg['gesture_mean']
            ]
        
            return np.array(features)
    
    def get_confidence_score(self, has_face, is_speaking):
        """Get overall confidence score using ML model prediction"""
        # Get aggregated features
        audio_agg = self.audio_extractor.get_aggregated_features()
        video_agg = self.video_extractor.get_aggregated_features()
        
        # Use ML model for confidence prediction
        if self.ml_model is not None:
            try:
                # Build feature vector matching training format
                features = self.build_feature_vector(audio_agg, video_agg)
                features = features.reshape(1, -1)
                
                # Predict confidence (0-1 scale)
                pred = self.ml_model.predict(features)[0]
                
                # Convert to percentage (0-100)
                confidence_percent = int(pred * 100)
                confidence_percent = clamp(confidence_percent, 0, 100)
                
                return {
                    'overall_confidence': confidence_percent,
                    'audio_features': audio_agg,
                    'video_features': video_agg,
                    'ml_prediction': pred
                }
            except Exception as e:
                print(f"ML prediction failed: {e}. Falling back to heuristic.")
        
        # Fallback to heuristic scoring if ML model not available
        speech_conf = self.scorer.score_speech_confidence(audio_agg)
        video_conf = self.scorer.score_video_confidence(video_agg)
        overall_conf = self.scorer.heuristic_fusion(
            speech_conf, video_conf, has_face, is_speaking
        )
        
        return {
            'overall_confidence': overall_conf,
            'speech_confidence': int(speech_conf * 100),
            'video_confidence': int(video_conf * 100),
            'audio_features': audio_agg,
            'video_features': video_agg
        }


if __name__ == "__main__":
    analyzer = AdvancedAIAnalyzer(sample_rate=16000)
    
   
    # Example with dummy data
    dummy_audio = np.random.randn(16000)  # 1 second of audio
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Analyze
    audio_features = analyzer.analyze_audio(dummy_audio)
    video_features = analyzer.analyze_video(dummy_frame)
    
    # Get confidence score
    result = analyzer.get_confidence_score(has_face=True, is_speaking=True)
    
    print("Overall Confidence:", result['overall_confidence'])
    print("Speech Confidence:", result['speech_confidence'])
    print("Video Confidence:", result['video_confidence'])

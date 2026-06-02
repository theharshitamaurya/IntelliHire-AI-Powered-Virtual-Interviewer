import os
import pickle
import numpy as np
import cv2
import librosa
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
from xgboost import XGBRegressor

# ===============================
# PATH CONFIG
# ===============================
VIDEO_FOLDER = "chalearn_dataset"
LABEL_FILE = "chalearn_dataset/annotation_training.pkl"

# ===============================
# FEATURE EXTRACTION
# ===============================

def extract_audio_features(video_path):
    try:
        y, sr = librosa.load(video_path, sr=16000)

        rms = np.mean(librosa.feature.rms(y=y))
        zcr = np.mean(librosa.feature.zero_crossing_rate(y))
        centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
        rolloff = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))
        mfcc = np.mean(librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13), axis=1)

        return np.concatenate([[rms, zcr, centroid, rolloff], mfcc])
    except:
        return np.zeros(17)


def extract_video_features(video_path):
    cap = cv2.VideoCapture(video_path)

    face_detector = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    face_counts = []
    brightness_values = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_detector.detectMultiScale(gray, 1.3, 5)

        face_counts.append(len(faces))
        brightness_values.append(np.mean(gray))

    cap.release()

    if len(face_counts) == 0:
        return np.zeros(4)

    return np.array([
        np.mean(face_counts),
        np.std(face_counts),
        np.mean(brightness_values),
        np.std(brightness_values)
    ])

# ===============================
# LOAD LABELS
# ===============================

with open(LABEL_FILE, "rb") as f:
    annotations = pickle.load(f, encoding="latin1")

extraversion_dict = annotations["extraversion"]
neuroticism_dict = annotations["neuroticism"]

features = []
labels = []

for video_id in extraversion_dict.keys():

    # match video segments
    matching_files = [
        f for f in os.listdir(VIDEO_FOLDER)
        if video_id in f
    ]

    if len(matching_files) == 0:
        continue

    video_path = os.path.join(VIDEO_FOLDER, matching_files[0])

    print("Processing:", video_id)

    extraversion = extraversion_dict[video_id]
    neuroticism = neuroticism_dict[video_id]

    confidence = 0.7 * extraversion + 0.3 * (1 - neuroticism)

    audio_feat = extract_audio_features(video_path)
    video_feat = extract_video_features(video_path)

    combined = np.concatenate([audio_feat, video_feat])

    features.append(combined)
    labels.append(confidence)

X = np.array(features)
y = np.array(labels)

np.save("features.npy", X)
np.save("labels.npy", y)

print("Feature extraction complete:", X.shape)

# ===============================
# TRAIN MODEL
# ===============================

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = XGBRegressor(
    n_estimators=500,
    max_depth=6,
    learning_rate=0.05,
    random_state=42,
    eval_metric='rmse',  # Track RMSE during training
    verbosity=1,
    early_stopping_rounds=50,  # Stop if validation doesn't improve for 50 rounds
    tree_method='gpu_hist' # Add this line for GPU acceleration
)

model.fit(X_train, y_train)

pred = model.predict(X_test)

rmse = np.sqrt(mean_squared_error(y_test, pred))
r2 = r2_score(y_test, pred)

print("RMSE:", rmse)
print("R2 Score:", r2)

joblib.dump(model, "confidence_model.pkl")

print("Model saved successfully.")
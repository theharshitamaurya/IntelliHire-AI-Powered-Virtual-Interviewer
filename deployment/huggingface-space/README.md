---
title: IntelliHire Multimodal Analyzer
emoji: 🎤
colorFrom: blue
colorTo: purple
sdk: gradio
sdk_version: 5.20.1
app_file: app.py
pinned: false
license: mit
---

# IntelliHire Multimodal Analyzer

An AI-powered multimodal analysis system for interview assessment. This Space provides REST API endpoints for analyzing audio and video recordings to extract behavioral metrics.

## Features

### Audio Analysis
- **Voice Confidence**: Energy levels, pitch variation, spectral features
- **Speech Clarity**: Spectral centroid, zero-crossing rate
- **Pace & Tempo**: Speaking rate, pause detection
- **Volume Control**: RMS energy in dB

### Video Analysis (MediaPipe)
- **Eye Contact**: Gaze direction tracking
- **Professionalism**: Head pose stability, posture evaluation
- **Engagement**: Facial expressiveness
- **Gestures**: Hand movement magnitude

## API Endpoints

### 1. Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "models_loaded": true,
  "version": "1.0.0"
}
```

### 2. Multimodal Analysis
```bash
POST /analyze
Content-Type: multipart/form-data

- audio: audio file (optional, .wav, .mp3, .m4a)
- video: video file (optional, .mp4, .avi, .mov)
```

Response:
```json
{
  "success": true,
  "audio": {
    "energy_db": -25.5,
    "spectral_centroid_mean": 2150.0,
    "pitch_mean": 180.5,
    "tempo": 132.0,
    "pause_ratio": 0.15,
    "confidence": 82.5,
    "clarity": 85.0,
    "pace": 88.0,
    "volume": 80.0,
    "overallVoiceScore": 83.9
  },
  "video": {
    "total_frames": 240,
    "eye_contact_frames": 180,
    "eyeContact": 75.0,
    "headStability": 85.0,
    "postureScore": 82.0,
    "gestureIntensity": 55.0,
    "engagement": 80.0,
    "professionalism": 82.5,
    "confidence": 78.5,
    "overallFacialScore": 79.4,
    "engagementScore": 80.0
  },
  "error": null
}
```

## Usage Examples

### Python (requests)
```python
import requests

url = "https://huggingface.co/spaces/{your-username}/intellihire-analyzer/api/analyze"

files = {
    'audio': open('interview.wav', 'rb'),
    'video': open('interview.mp4', 'rb')
}

response = requests.post(url, files=files)
result = response.json()
print(result)
```

### Node.js (axios)
```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('audio', fs.createReadStream('interview.wav'));
form.append('video', fs.createReadStream('interview.mp4'));

const response = await axios.post(
  'https://huggingface.co/spaces/{your-username}/intellihire-analyzer/api/analyze',
  form,
  { headers: form.getHeaders() }
);

console.log(response.data);
```

### cURL
```bash
curl -X POST \
  "https://huggingface.co/spaces/{your-username}/intellihire-analyzer/api/analyze" \
  -F "audio=@interview.wav" \
  -F "video=@interview.mp4"
```

## Gradio Interface

The Space also provides a web UI at the root path (`/`) where you can:
1. Upload audio and video files via drag-and-drop
2. View analysis results in JSON format
3. Test the API without writing code

## Deployment Instructions

### 1. Create a Hugging Face Space
1. Go to https://huggingface.co/spaces
2. Click "Create new Space"
3. Choose:
   - **SDK**: Gradio
   - **Visibility**: Public (or Private with API token)
   - **Hardware**: CPU Basic (free tier works, GPU optional for faster processing)

### 2. Upload Files
Upload these files to your Space repository:
- `app.py`
- `requirements.txt`
- `README.md` (this file)

### 3. Wait for Build
The Space will automatically install dependencies and start the server. Wait for the "Running" status.

### 4. Test Your Space
Visit your Space URL and try uploading sample files.

## Integration with Backend

Update your Node.js backend's `pythonAnalyzer.js`:

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const HF_SPACE_URL = process.env.HF_SPACE_URL || 
  'https://huggingface.co/spaces/{your-username}/intellihire-analyzer/api';

async function callPythonAnalyzer(audioPath, videoPath) {
  const form = new FormData();
  
  if (audioPath) {
    form.append('audio', fs.createReadStream(audioPath));
  }
  
  if (videoPath) {
    form.append('video', fs.createReadStream(videoPath));
  }
  
  const response = await axios.post(
    `${HF_SPACE_URL}/analyze`,
    form,
    {
      headers: form.getHeaders(),
      timeout: 120000, // 2 minutes
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    }
  );
  
  return response.data;
}
```

## Performance Notes

- **Cold Start**: First request after inactivity may take 30-60 seconds
- **Typical Analysis**: 5-15 seconds for 60-second video
- **Free Tier Limits**: Spaces may sleep after inactivity
- **Pro Tier**: Use Hugging Face Pro for persistent deployment

## Models Used

- **Audio**: librosa (feature extraction), custom scoring algorithms
- **Video**: MediaPipe Face Mesh + Pose (Google's ML models)
- **No training required**: All models are pre-trained and ready to use

## License

MIT License - See LICENSE file for details

## Citation

If you use this system in research, please cite:
```
@article{intellihire2026,
  title={IntelliHire: Multimodal AI Interview Assessment System},
  year={2026}
}
```

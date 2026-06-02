# Quick Start: Hugging Face Space Integration

## TL;DR - 5 Minute Setup

### 1. Deploy to Hugging Face (2 minutes)

```bash
# Go to https://huggingface.co/spaces
# Click "New Space" → Name: intellihire-analyzer → SDK: Gradio → Create
# Upload files from huggingface-space/ folder
```

### 2. Configure Backend (1 minute)

```bash
# Edit backend/.env
HF_SPACE_URL=https://huggingface.co/spaces/YOUR_USERNAME/intellihire-analyzer/api
USE_LOCAL_ANALYZER=false

# Install dependencies
cd backend
npm install
```

### 3. Test (1 minute)

```bash
# Start backend
npm start

# You should see:
# [Analyzer] Using Hugging Face Space analyzer
# [Analyzer] Hugging Face Space: OK
```

### 4. Done! 🎉

Your system now uses Hugging Face for audio/video analysis. No local Python needed!

---

## Testing Your Space

### Quick API Test

```bash
# Replace YOUR_USERNAME with your actual username
curl https://huggingface.co/spaces/YOUR_USERNAME/intellihire-analyzer/api/health
```

Expected response:
```json
{"status":"ok","models_loaded":true,"version":"1.0.0"}
```

### Full Analysis Test

```bash
# Test with sample files
curl -X POST \
  "https://huggingface.co/spaces/YOUR_USERNAME/intellihire-analyzer/api/analyze" \
  -F "audio=@test_audio.wav" \
  -F "video=@test_video.mp4"
```

Expected response: JSON with `audio` and `video` analysis results.

---

## What Files Were Changed?

### New Files Created:
- ✅ `huggingface-space/app.py` - Gradio + FastAPI Space app
- ✅ `huggingface-space/requirements.txt` - Python dependencies
- ✅ `huggingface-space/README.md` - Space documentation
- ✅ `HUGGINGFACE_DEPLOYMENT.md` - Full deployment guide (you're reading the quick version!)

### Modified Files:
- ✅ `backend/services/pythonAnalyzer.js` - Now calls HF Space API
- ✅ `backend/package.json` - Added `axios` and `form-data`
- ✅ `backend/.env.example` - Added `HF_SPACE_URL` configuration

---

## Troubleshooting

**"No response from Hugging Face Space"**
- Visit your Space URL in browser to wake it up (cold start = 30-60s)
- Check Space status is "Running" not "Building" or "Sleeping"

**"Still using local Python analyzer"**
- Check `backend/.env` has `HF_SPACE_URL=...`
- Check `USE_LOCAL_ANALYZER=false` (or remove this line)
- Restart backend

**"Dependencies not found"**
- Run `npm install` in backend folder
- Check `axios` and `form-data` are in package.json dependencies

---

## Switching Between Local and Cloud

### Use Hugging Face Space (recommended)
```bash
# backend/.env
HF_SPACE_URL=https://huggingface.co/spaces/YOUR_USERNAME/intellihire-analyzer/api
USE_LOCAL_ANALYZER=false
```

### Use Local Python (fallback)
```bash
# backend/.env
USE_LOCAL_ANALYZER=true
# No HF_SPACE_URL needed
```

No code changes required! Just restart backend.

---

## Next Steps

1. 📤 **Deploy your Space** following Step 1 above
2. ⚙️ **Configure `.env`** with your Space URL
3. 🧪 **Test end-to-end** by recording an interview
4. 📊 **Monitor** Space performance in HuggingFace dashboard
5. 🚀 **Upgrade to Pro** ($9/month) if you need persistent uptime

---

## Full Documentation

- **Deployment Guide**: [HUGGINGFACE_DEPLOYMENT.md](./HUGGINGFACE_DEPLOYMENT.md)
- **Space README**: [huggingface-space/README.md](./huggingface-space/README.md)
- **API Documentation**: See README in your deployed Space

---

## Support

**Cold start taking too long?**
- This is normal on free tier (first request ~ 60 seconds)
- Backend has automatic retry logic built-in
- Upgrade to HuggingFace Pro for faster wake-up

**Want to test locally first?**
```bash
cd huggingface-space
pip install -r requirements.txt
python app.py
# Visit http://localhost:7860
```

Then set `HF_SPACE_URL=http://localhost:7860/api` in your backend .env

---

**🎉 Your ML service is now cloud-hosted and scalable!**

# Hugging Face Space Deployment Guide

This guide walks you through deploying your IntelliHire Multimodal Analyzer to Hugging Face Spaces and integrating it with your backend.

## Step 1: Create a Hugging Face Account

1. Go to [Hugging Face](https://huggingface.co/) and sign up for a free account
2. Verify your email address
3. (Optional) Subscribe to Hugging Face Pro for persistent Spaces ($9/month)

## Step 2: Create a New Space

1. Click on your profile icon → "New Space"
2. Fill in the form:
   - **Space name**: `intellihire-analyzer` (or your preferred name)
   - **License**: MIT
   - **Select the Space SDK**: Gradio
   - **Visibility**: Public (or Private if you have Pro)
   - **Hardware**: CPU basic (free) - GPU is optional but not needed
3. Click "Create Space"

## Step 3: Upload Files to Your Space

### Option A: Using the Web Interface (Easiest)

1. Navigate to the "Files" tab in your new Space
2. Click "Add file" → "Upload files"
3. Upload these files from `huggingface-space/` directory:
   - `app.py`
   - `requirements.txt`
   - `README.md`
   - `.gitignore` (optional)
4. Click "Commit changes to main"

### Option B: Using Git (Recommended for Updates)

```bash
# Clone your Space repository
git clone https://huggingface.co/spaces/YOUR_USERNAME/intellihire-analyzer
cd intellihire-analyzer

# Copy files from huggingface-space directory
cp ../huggingface-space/app.py .
cp ../huggingface-space/requirements.txt .
cp ../huggingface-space/README.md .
cp ../huggingface-space/.gitignore .

# Commit and push
git add .
git commit -m "Initial deployment of IntelliHire analyzer"
git push
```

## Step 4: Wait for Build to Complete

1. Go back to your Space on Hugging Face
2. Wait for the build process to complete (typically 3-5 minutes)
3. Look for the "Running" status indicator
4. You should see the Gradio interface appear

## Step 5: Test Your Space

### Test via Web UI

1. Click on the "App" tab in your Space
2. Upload a sample audio file (e.g., `.wav`, `.mp3`)
3. Upload a sample video file (e.g., `.mp4`)
4. Click "Submit"
5. You should see JSON output with analysis results

### Test via API

```bash
# Test health endpoint
curl https://huggingface.co/spaces/YOUR_USERNAME/intellihire-analyzer/api/health

# Test analysis endpoint (replace with your actual Space URL)
curl -X POST \
  "https://huggingface.co/spaces/YOUR_USERNAME/intellihire-analyzer/api/analyze" \
  -F "audio=@sample_audio.wav" \
  -F "video=@sample_video.mp4"
```

Expected health response:
```json
{
  "status": "ok",
  "models_loaded": true,
  "version": "1.0.0"
}
```

## Step 6: Configure Your Backend

### Update Environment Variables

1. Copy your Space URL from the browser address bar
2. Open `backend/.env` file
3. Add/update these variables:

```bash
# Hugging Face Space URL (without trailing slash)
HF_SPACE_URL=https://huggingface.co/spaces/YOUR_USERNAME/intellihire-analyzer/api

# Only needed if your Space is Private
# HF_SPACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxx

# Set to false to use HF Space (default)
USE_LOCAL_ANALYZER=false
```

### Get API Key for Private Spaces (Optional)

If you made your Space private:

1. Go to [Hugging Face Settings → Access Tokens](https://huggingface.co/settings/tokens)
2. Click "New token"
3. Name it "IntelliHire Backend"
4. Select "read" permissions
5. Copy the token and add it to your `.env` as `HF_SPACE_API_KEY`

### Install Backend Dependencies

```bash
cd backend
npm install
```

This will install the new dependencies (`axios` and `form-data`) added to `package.json`.

### Restart Your Backend

```bash
npm start
# or
npm run dev
```

## Step 7: Verify Integration

### Check Health on Backend Startup

When you start your backend, you should see:

```
[Analyzer] Using Hugging Face Space analyzer
[Analyzer] Checking Hugging Face Space health...
[Analyzer] Hugging Face Space: OK
[Analyzer] Models loaded: true
```

If you see errors, check that:
- Your `HF_SPACE_URL` is correct
- Your Space is "Running" (not sleeping or building)
- You have network connectivity

### Test End-to-End

1. Start your frontend: `cd frontend && npm run dev`
2. Record a practice interview with audio/video
3. Submit the interview
4. Check backend logs - you should see:
   ```
   [HFAnalyzer] Adding audio file: audio_xxxxx.wav
   [HFAnalyzer] Adding video file: video_xxxxx.mp4
   [HFAnalyzer] Calling Hugging Face Space: https://... (attempt 1/3)
   [HFAnalyzer] Analysis complete
   ```
5. Verify the interview results appear in your frontend

## Troubleshooting

### Issue: "No response from Hugging Face Space"

**Causes:**
- Space is sleeping (happens on free tier after 48 hours of inactivity)
- Space build failed
- Wrong URL in `HF_SPACE_URL`

**Solutions:**
1. Visit your Space URL in a browser to wake it up
2. Check "App" tab shows "Running" status
3. Verify URL in `.env` matches your Space URL exactly
4. Add `/api` at the end of the Space URL

### Issue: "Request timed out" or "Cold start"

**Cause:** First request after Space wakes up takes ~30-60 seconds

**Solution:** The backend automatically retries with exponential backoff. Wait for the retry to succeed.

### Issue: "429 Too Many Requests"

**Cause:** Free tier has rate limits

**Solutions:**
- Wait a few minutes and retry
- Upgrade to Hugging Face Pro ($9/month) for higher limits
- Use `USE_LOCAL_ANALYZER=true` temporarily

### Issue: "Module not found" errors in Space logs

**Cause:** Missing dependency in `requirements.txt`

**Solution:**
1. Check Space logs in the "Logs" tab
2. Add missing package to `requirements.txt`
3. Commit and push changes
4. Wait for rebuild

### Issue: Backend still using local Python analyzer

**Check:**
```bash
# Verify environment variables are loaded
cat backend/.env | grep HF_SPACE_URL
cat backend/.env | grep USE_LOCAL_ANALYZER
```

**Solution:**
- Ensure `HF_SPACE_URL` is set
- Ensure `USE_LOCAL_ANALYZER=false` (or remove this variable)
- Restart your backend after changing `.env`

## Performance Optimization

### Reduce Cold Starts

**Free Tier:**
- Accept 30-60s first request after inactivity
- Implement user notification: "Waking up AI service, please wait..."

**Paid Tier ($9/month Hugging Face Pro):**
- Spaces stay warm longer
- Priority processing
- Higher rate limits

### Monitor Space Usage

1. Go to your Space → "Settings" → "Statistics"
2. Monitor:
   - Request count
   - Average response time
   - Error rate
3. Set up alerts if available

### Optimize Analysis Time

Current processing time for 60-second video:
- Audio analysis: ~3-5 seconds
- Video analysis: ~5-10 seconds
- Total: ~8-15 seconds

To reduce further:
1. Pre-process videos to lower resolution (optional)
2. Use GPU hardware (paid, $0.60/hour on Hugging Face)
3. Enable frame skipping in video analysis (modify `app.py`)

## Switching Back to Local Analyzer

If you need to temporarily use local Python analyzer:

```bash
# In backend/.env
USE_LOCAL_ANALYZER=true
```

Then restart your backend. No code changes needed!

## Updating Your Space

### Update Code

```bash
cd huggingface-space/
git pull
# Make changes to app.py or requirements.txt
git add .
git commit -m "Update: improved video analysis"
git push
```

### Update via Web UI

1. Go to your Space → "Files" tab
2. Click on the file to edit (e.g., `app.py`)
3. Click "Edit" button
4. Make changes
5. Click "Commit changes"

Space will automatically rebuild (takes 2-3 minutes).

## Cost Breakdown

### Free Tier
- **Cost**: $0/month
- **Limitations**:
  - Space sleeps after 48 hours inactivity
  - Cold start: 30-60 seconds
  - CPU only
  - Public visibility required for full free tier

### Hugging Face Pro
- **Cost**: $9/month
- **Benefits**:
  - Private Spaces
  - Persistent deployment (less sleep)
  - Higher rate limits
  - Priority support

### Custom Hardware
- **CPU Basic**: Free
- **CPU Upgrade**: $0.03/hour (~$30/month)
- **GPU T4**: $0.60/hour (~$432/month if always on)

**Recommendation**: Start with free tier, upgrade to Pro if you need reliability.

## Security Considerations

### Private vs Public Spaces

**Public Space:**
- Anyone can access your API
- No authentication required
- Fine for testing and development
- Use rate limiting on backend if needed

**Private Space:**
- Requires API token
- Only accessible with authentication
- Recommended for production
- Requires Hugging Face Pro

### Protecting Your Backend

Even with public Space, your backend is protected because:
1. Space only processes files, doesn't store data
2. Files are deleted immediately after processing
3. No database access from Space
4. Backend validates all responses

### API Key Management

If using private Space:
```bash
# Generate token with minimal permissions (read only)
# Rotate tokens every 90 days
# Never commit tokens to git
# Use .env files (already in .gitignore)
```

## Next Steps

1. ✅ Deploy Space to Hugging Face
2. ✅ Configure backend environment variables
3. ✅ Test health endpoint
4. ✅ Test analysis endpoint
5. ✅ Verify end-to-end integration
6. 📊 Monitor performance and errors
7. 🚀 Consider upgrading to Pro if needed
8. 📝 Update documentation with your Space URL

## Support

- **Hugging Face Docs**: https://huggingface.co/docs/hub/spaces
- **Gradio Docs**: https://gradio.app/docs/
- **Backend Issues**: Check `backend/services/pythonAnalyzer.js` logs

## Summary

You now have:
- ✅ Multimodal analyzer deployed to Hugging Face Spaces
- ✅ REST API endpoints for audio/video analysis
- ✅ Backend configured to call HF Space
- ✅ Automatic retry logic for cold starts
- ✅ Fallback to local analyzer if needed
- ✅ Health monitoring

Your IntelliHire system no longer requires local Python dependencies! 🎉

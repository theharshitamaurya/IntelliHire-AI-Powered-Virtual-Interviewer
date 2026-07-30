---
title: IntelliHire
emoji: 🧠
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# IntelliHire (Full App)

The full IntelliHire web app — React frontend + Node/Express backend — packaged
as a single Docker Space. The Express server serves both the REST API and the
built frontend from one process on port 7860.

This Space does **not** include the Python multimodal (audio/video) analyzer.
It calls that as a separate service over HTTP, the same way local dev does
when `USE_LOCAL_ANALYZER=false`. Deploy the analyzer first — see
`deployment/huggingface-space/` in the main repo — then point this Space at
it via the `HF_SPACE_URL` secret below.

## Required Space secrets

Set these under Space settings → **Variables and secrets**:

| Name | Required | Notes |
|---|---|---|
| `MONGODB_URI` | Yes | Hugging Face Spaces has no persistent database. Use a MongoDB Atlas connection string (free tier works). |
| `GROQ_API_KEY` | Yes | Powers question generation and LLM evaluation. |
| `HF_SPACE_URL` | Yes | URL of the deployed analyzer Space, e.g. `https://huggingface.co/spaces/{you}/intellihire-analyzer/api`. |
| `USE_LOCAL_ANALYZER` | Yes | Set to `false`. This image has no Python/mediapipe — a local analyzer call would fail. |
| `FRONTEND_URL` | No | Only relevant for CORS on cross-origin requests. Frontend and backend share an origin here, so this can be left unset. |

If `HF_SPACE_URL` is missing or the analyzer call fails, the app still runs —
audio/video scoring just falls back to fixed default values instead of real
analysis (see `getDefaultAudioFeatures`/`getDefaultVideoFeatures` in
`backend/controllers/interviewController.js`).

## Deploying

From the root of the main IntelliHire repo:

1. Create a new Space on Hugging Face with **SDK: Docker**.
2. Clone the new (empty) Space repo somewhere else on your machine.
3. Copy these into the Space repo's root:
   ```bash
   cp deployment/huggingface-app/Dockerfile   /path/to/space-repo/Dockerfile
   cp deployment/huggingface-app/README.md    /path/to/space-repo/README.md
   cp -r backend                              /path/to/space-repo/backend
   cp -r frontend                             /path/to/space-repo/frontend
   ```
   (Skip `backend/node_modules`, `backend/uploads`, `frontend/node_modules`,
   and `frontend/dist` if present locally — the Docker build installs and
   builds these itself.)
4. In the Space repo, set the secrets listed above (Settings → Variables and
   secrets) — do **not** commit a `.env` file with real credentials.
5. Commit and push:
   ```bash
   cd /path/to/space-repo
   git add .
   git commit -m "Deploy IntelliHire app"
   git push
   ```
6. Wait for the build to finish (Docker builds are slower than Gradio SDK
   builds — expect several minutes for the first build). Watch the "Logs" tab
   in your Space for `MongoDB connected` and `Server started on port 7860`.

## Testing locally before deploying

From the main repo root (not this folder):

```bash
docker build -f deployment/huggingface-app/Dockerfile -t intellihire-app .
docker run -p 7860:7860 \
  -e MONGODB_URI="<your atlas uri>" \
  -e GROQ_API_KEY="<your key>" \
  -e HF_SPACE_URL="<your analyzer space url>" \
  -e USE_LOCAL_ANALYZER=false \
  intellihire-app
```

Then open `http://localhost:7860`.

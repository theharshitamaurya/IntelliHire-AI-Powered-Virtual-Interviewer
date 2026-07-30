# IntelliHire full app (frontend + backend) for a Hugging Face Docker Space.
#
# Build context must be the repository root, e.g. from the repo root:
#   docker build -f deployment/huggingface-app/Dockerfile -t intellihire-app .
#
# The multimodal analyzer (audio/video ML) is NOT bundled here — this
# container talks to it over HTTP via HF_SPACE_URL, same as local dev with
# USE_LOCAL_ANALYZER=false. See deployment/huggingface-space/ for that Space.

# ---- Stage 1: build the frontend static bundle ----
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
# Same-origin in production: backend serves both the API and the static
# frontend, so the built app can call a relative /api path.
ENV VITE_API_BASE_URL=/api
RUN npm run build

# ---- Stage 2: install backend dependencies ----
# Uses a separate stage (with build tools) so native deps like faiss-node
# can compile if no prebuilt binary matches this platform, without bloating
# the final runtime image.
FROM node:20-bookworm-slim AS backend-deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ---- Stage 3: runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend ./
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

ENV NODE_ENV=production
# Hugging Face Docker Spaces expect the app to listen on 7860.
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server.js"]

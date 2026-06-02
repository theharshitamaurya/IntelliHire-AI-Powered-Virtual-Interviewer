# Frontend README

## Overview

The IntelliHire frontend is a React + Vite application for mock interview practice, JD-grounded sessions, live interview flow, and analytics visualization.

## Tech Stack

- React 18
- Vite 5
- React Router
- Recharts
- Tailwind CSS
- Framer Motion
- Groq SDK

## Setup

From `frontend/`:

```bash
npm install
```

Create `.env` in `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## Run

```bash
npm run dev
```

Default local URL:

- `http://localhost:5173`

## Build And Preview

```bash
npm run build
npm run preview
```

## Usage Flow

1. Start backend (`backend/npm run dev`).
2. Start frontend (`frontend/npm run dev`).
3. Open the app in browser.
4. Use Practice, JD Mode, or Live Interview.
5. Open Analytics to view MongoDB-backed session data.

## Important Notes

- Analytics persistence should be backend/MongoDB based, not localStorage-only.
- Ensure backend CORS and `FRONTEND_URL` are aligned with frontend URL.

## Known Frontend Issues

- On small screens, analytics charts may need responsive container tuning.
- If API base URL is wrong, pages may load but data calls fail.

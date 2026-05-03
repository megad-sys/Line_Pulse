# Line Pulse

A real-time factory execution system for semi-manual production lines. On top of live production data, an AI assistant identifies bottlenecks, tracks part flow through every station, and routes issues to the right team in real time.

---

## Architecture

```
factoryos-mvp/
├── frontend/   Next.js 14 (App Router) — dashboard, landing page, auth
├── backend/    FastAPI — production data API (parts, scans, stations, targets)
└── agent/      FastAPI — AI layer (Groq / Llama 3.3-70B, insights, chat, cron alerts)
```

The frontend talks to both services via `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_AGENT_URL`. If those env vars are unset, it falls back to the built-in Next.js API routes (useful for Vercel-only deployments without separate services).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Auth | Supabase Auth (email/password), SSR session handling |
| Database | Supabase (Postgres), Row-Level Security, multi-tenant |
| Backend API | FastAPI, Uvicorn, Supabase Python SDK |
| AI / Agent | FastAPI, Groq SDK (Llama 3.3-70B), streaming responses |
| Deployment | Vercel (frontend), Railway or Docker (backend + agent) |

---

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.12+
- A Supabase project ([supabase.com](https://supabase.com))
- A Groq API key ([console.groq.com](https://console.groq.com)) for AI features

---

### 1. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Fill in the values (see Environment Variables section)
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

---

### 2. Backend API

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Create backend/.env with required vars (see below)
uvicorn main:app --reload --port 8001
```

API docs at [http://localhost:8001/docs](http://localhost:8001/docs).

---

### 3. Agent Service

```bash
cd agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Create agent/.env with required vars (see below)
uvicorn main:app --reload --port 8002
```

API docs at [http://localhost:8002/docs](http://localhost:8002/docs).

---

### 4. Docker (backend + agent together)

```bash
# From repo root
docker compose up
# backend → http://localhost:8001
# agent   → http://localhost:8002
```

---

## Environment Variables

### `frontend/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Leave empty to use built-in Next.js API routes (no separate services needed)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_AGENT_URL=http://localhost:8002
```

### `backend/.env` and `agent/.env`

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROQ_API_KEY=gsk_...         # agent only
CRON_SECRET=your-secret      # agent only — protects /api/agent cron endpoint
```

---

## Deployment

### Frontend → Vercel

Push to GitHub and import the repo in [vercel.com](https://vercel.com). Set root directory to `frontend`. Add all environment variables from the section above. The built-in Next.js API routes work as a fallback if you don't deploy separate Python services.

### Backend + Agent → Railway

Each service has a `railway.toml` and `Dockerfile` already configured. In Railway:

1. Create two services, point each to the `backend/` or `agent/` subdirectory.
2. Add the environment variables for each service.
3. Railway auto-detects the Dockerfile and deploys on push.

After deployment, set `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_AGENT_URL` in your Vercel project settings.

---

## Key Features

- **Live shopfloor dashboard** — real-time part status, station WIP, cycle time vs target, bottleneck detection
- **Planned vs Produced** — daily target tracking with editable targets
- **AI Production Engineer** — streaming chat assistant with factory context; proactive hourly alerts via Vercel cron
- **Escalation Center** — structured issue routing to maintenance, quality, or management
- **Lines & Stations Setup** — drag-and-drop production line configuration
- **Batch & QR workflow** — create part batches, print QR codes, scan at each station
- **Demo mode** — full experience without a database connection
- **Dark / light mode** — persisted in localStorage
- **CSV export** — every table exports to CSV with one click

---

## Demo

Live demo with sample data available at the landing page — no sign-up required.

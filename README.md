# LinePulse

AI agents that monitor, decide, and act on your production lines. Operators approve recommendations in one click — LinePulse coordinates the rest across Slack, email, and operational logs automatically.

---

## Architecture

```
factoryos-mvp/
├── frontend/          Next.js 14 (App Router) — dashboard, landing page, auth, API routes
│   ├── app/
│   │   ├── (app)/    Protected dashboard (Analytics, Agents, Setup, Board tabs)
│   │   ├── (auth)/   Login / signup
│   │   ├── api/      API routes (agent, scan, import, shopfloor, insights…)
│   │   └── page.tsx  Public landing page
│   └── components/   UI — dashboard tabs, agent cards, action tracker table
├── agents/            TypeScript agent layer — runs inside the Next.js process
│   ├── lib/
│   │   ├── agents/   production.ts · quality.ts · planning.ts
│   │   ├── tools/    level1/ — log_issue · send_email · slack
│   │   ├── compute.ts        Shopfloor metrics (cycle times, OEE, defect rates)
│   │   ├── orchestrator.ts   Runs all agents in parallel; merges results
│   │   ├── executor.ts       Deterministic tool routing + dispatch + Groq summary
│   │   └── router.ts         Routes recommended_action → tool list (no LLM)
│   └── scripts/      seed-demo.ts — populate demo tenant data
└── supabase/
    └── migrations/   011 schema migrations (multi-tenant, RLS, agent tables)
```

The `agents/` library is imported directly by Next.js API routes via the `@agents` path alias — no separate service or network hop.

---

## How It Works

### 1. Data collection
Scan events arrive via QR scan (`/api/scan`) or CSV import (`/api/import`). Each event records a part passing through a station with a timestamp.

### 2. Agent analysis
`POST /api/agent/analyse` runs three agents in parallel against the current shift's scan events:

| Agent | What it detects |
|---|---|
| **Production** | Bottlenecks, cycle time vs target, worst station, severity |
| **Quality** | Defect rates by station / operator / part, trend direction |
| **Planning** | Plan attainment, at-risk work orders, recommended sequence |

Each agent calls Groq (Llama 3.3-70B) with structured JSON output validated by Zod.

### 3. Operator approval
The dashboard surfaces recommendations. The operator clicks **Approve** on one option (or writes a custom instruction). This calls `POST /api/agent/actions/approve`.

### 4. Execution
The executor deterministically routes the approved action to tools — no LLM call for routing:

```
recommended_action → router.ts → [log_issue, slack, send_email]
                               ↓
                    dispatchTool() runs each in parallel
                               ↓
                    Groq writes a one-sentence system summary
                               ↓
                    agent_actions row: awaiting_human_action
```

**System-executed actions** (logged in DB, shown in Action Tracker):
- `log_issue` — writes a row to `agent_alerts`
- `send_email` — Resend REST API
- `slack` — Slack Block Kit webhook

**Human-required actions** (shown as AI Recommendation, pending human follow-through):
- Operator reallocation, physical inspection, root cause investigation

### 5. Action Tracker
`GET /api/agent/actions` returns all agent_actions for the tenant, joined with agent_alerts for station + severity. The Action Log table in the Agents tab reads from the DB — state persists across page refreshes.

---

## Status Model

| Status | Meaning |
|---|---|
| `executing` | Executor running tools |
| `awaiting_human_action` | System tools completed; human must carry out the recommendation |
| `completed` | Reserved for explicit human confirmation (future) |
| `failed` | Executor threw an error |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Auth | Supabase Auth (email/password), SSR session handling |
| Database | Supabase (Postgres), Row-Level Security, multi-tenant |
| Agent LLM | Groq SDK — Llama 3.3-70B (structured JSON output) |
| Email | Resend REST API |
| Slack | Incoming Webhook — Block Kit |
| Deployment | Vercel (monorepo, root = `frontend/`) |

---

## Local Development

### Prerequisites

- Node.js 18+
- Supabase project ([supabase.com](https://supabase.com))
- Groq API key ([console.groq.com](https://console.groq.com))
- Resend API key (optional — for email alerts)
- Slack webhook URL (optional — for Slack alerts)

### Setup

```bash
cd frontend
cp .env.local.example .env.local   # fill in values below
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

### Environment Variables (`frontend/.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Groq (agent LLM)
GROQ_API_KEY=gsk_...

# Integrations (optional — configured per-tenant in tenant_integrations table)
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=any-random-string   # protects /api/agent/watchdog
```

### Database Migrations

Apply all migrations in order via the Supabase dashboard SQL editor:

```
supabase/migrations/
  001_initial_schema.sql
  002_production_lines.sql
  003_parts.sql
  004_part_scans.sql
  005_ai_alerts.sql
  006_agent_system.sql
  007_downtime.sql
  008_disposition.sql
  009_tenant_integrations.sql
  010_agent_actions.sql
  011_action_tracker.sql       ← adds context JSONB + awaiting_human_action status
```

### Seed Demo Data

```bash
cd agents
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SLACK_WEBHOOK_URL=... \
  npx ts-node scripts/seed-demo.ts
```

---

## Deployment

The repo is configured for Vercel with `frontend/` as the root directory. Push to `main` → Vercel deploys automatically.

Set these environment variables in your Vercel project settings:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GROQ_API_KEY
RESEND_API_KEY          (optional)
CRON_SECRET
NEXT_PUBLIC_APP_URL
```

Configure per-tenant integrations (Slack webhook URL, supervisor email) in the `tenant_integrations` table — not in env vars.

---

## Key Features

- **Analytics dashboard** — real-time station status, cycle time vs target, OEE, FPY, DPMO, planned vs produced
- **Three AI agents** — production bottleneck detection, quality defect pattern analysis, work order planning
- **Approval flow** — agents recommend, operators approve in one click, system executes
- **Action Tracker** — live DB-sourced table: station · recommendation · priority · status · system actions executed
- **Semantic execution** — system actions (Slack, email, log) are never conflated with human actions (reassignment, inspection)
- **Watchdog cron** — background agent scans for stalls and quality spikes every N minutes
- **Integrations** — Slack Block Kit, Resend email, issue logging — all configured per tenant
- **Lines & Stations setup** — production line configuration UI
- **Batch & QR workflow** — create batches, print QR codes, scan at stations
- **CSV import** — bulk scan event ingestion
- **Demo mode** — full dashboard experience without a database connection

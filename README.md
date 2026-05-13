# LinePulse

AI agents that monitor, decide, and act on your production lines. Operators approve recommendations in one click — LinePulse coordinates the rest across Slack, email, and operational logs automatically.

## How It Works

### 1. Data collection
Parts are scanned at each station via QR code or imported from CSV. Each scan records a part, station, and timestamp — building a live picture of the production line.

### 2. Agent analysis
Three agents run in parallel against the current shift's data:

| Agent | What it detects |
|---|---|
| **Production** | Bottlenecks, cycle time vs target, worst station, severity |
| **Quality** | Defect rates by station / operator / part, trend direction |
| **Planning** | Plan attainment, at-risk work orders, recommended sequence |

### 3. Operator approval
The dashboard surfaces each agent's findings and recommended actions. The operator approves one option in a single click, or writes a custom instruction.

### 4. Execution
Once approved, LinePulse automatically coordinates the downstream response:

**System-executed actions** (logged and shown in the Action Tracker):
- Slack notification sent to the production channel
- Email alert sent to the supervisor
- Issue logged in the operational record

**Human-required actions** (shown as the AI Recommendation, pending human follow-through):
- Operator reallocation, physical inspection, root cause investigation

### 5. Action Tracker
The Action Log table shows every approved action sourced directly from the database — station, recommendation, priority, system actions executed, and current status. State persists across page refreshes.

---

## Action Status Model

| Status | Meaning |
|---|---|
| Executing | System is processing the approved action |
| Awaiting Human Action | Notifications sent; operator must carry out the recommendation |
| Completed | Human confirmed the action was completed |
| Failed | Execution error — action was not carried out |

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

Slack webhook URLs and supervisor email addresses are configured per tenant in the database — not in env vars.

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

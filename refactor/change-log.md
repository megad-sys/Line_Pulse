# Refactor Change Log

## Removals

| Path | Reason | Replacement |
|------|--------|-------------|
| `/landing_page/` | Duplicate Lovable/TanStack Vite SPA — superseded by `frontend/app/page.tsx` which is the canonical Next.js landing page already served at `/` | `frontend/app/page.tsx` |
| `/api/` | Contained only `.env.example` — documentation already covered by `backend/.env.example`, `agent/.env.example`, and `api/.env.example` → moved to those files | None needed |

## Brand Renames

| Old | New | Scope |
|-----|-----|-------|
| `FactoryOS` | `Line Pulse` | All frontend pages, nav, scan page, QR labels, API titles, layout metadata |
| `AI Production Engineer` | `Johnny on the Spot` | `ai-insights-panel.tsx`, `page.tsx` (landing hero, mockup, footer) |
| `hello@factoryos.com` | `hello@linepulse.com` | Landing page CTA and footer |
| `demo@factoryos.com` | `demo@linepulse.com` | Login page demo credentials (Supabase auth user must be updated to match) |
| `FactoryOS2026` | `LinePulse2026` | Login page demo password (Supabase auth user must be updated to match) |

## Theme Changes

| What | Before | After |
|------|--------|-------|
| CSS `--accent` variable | `#e8ff47` (yellow-green) | `#3b82f6` (blue-500) |
| Nav Factory icon | `#e8ff47` yellow-green | `#60a5fa` blue-400 |
| Nav demo mode toggle (active) | amber (`#fbbf24`) | blue-400 / blue-500 |
| AI panel header icon + send button | amber-400 | blue-400 / blue-500 |
| AI panel chat response label | amber-400 | blue-400 |
| AI panel action items | amber-400 | blue-400 |
| AI panel input focus ring | amber-400/50 | blue-500/50 |
| Parts/New batch submit button | `#e8ff47` bg, `#0f0f0e` text | blue-600 bg, white text |
| Parts/New print button | `#e8ff47` bg, `#0f0f0e` text | blue-600 bg, white text |
| Login/Signup Factory icon | `text-amber-400` | `text-blue-400` |

## Landing Page Verification

- `frontend/app/page.tsx` is the canonical landing page — served at `/` by Next.js
- No duplicate landing pages remain after removal of `/landing_page/`
- Routing: `/` → landing, `/dashboard` → app, `/login` → auth — all intact

---

## Session: 2026-05-09 — Agent System v2 + Monorepo Restructure

### Agent System v2 (new files)

| File | Purpose |
|------|---------|
| `supabase/migrations/006_agent_system.sql` | 5 new tables: `scan_events`, `shifts`, `station_config`, `agent_alerts`, `agent_runs`; added `agent_shift_id`, `priority`, `due_date`, `customer_priority` to `work_orders` |
| `agents/lib/compute.ts` | Typed compute layer — `getStationMetrics`, `getShiftSummary`, `getWorkOrderStatus`, `buildAgentContext` |
| `agents/lib/agents/bottleneck.ts` | Bottleneck agent (Groq llama-3.3-70b-versatile, Zod validated) |
| `agents/lib/agents/quality.ts` | Quality agent |
| `agents/lib/agents/planning.ts` | Planning agent — work order resequencing by `customer_priority` → `due_date` → `progress_pct` |
| `agents/lib/agents/shift.ts` | Shift summary agent |
| `agents/lib/orchestrator.ts` | Parallel orchestrator — `Promise.all` across 4 agents |
| `frontend/app/api/agent/watchdog/route.ts` | Watchdog POST — detects stalls + quality spikes, writes to `agent_alerts` |
| `frontend/app/api/agent/alerts/route.ts` | GET unresolved alerts |
| `frontend/app/api/agent/alerts/[id]/resolve/route.ts` | PATCH resolve alert |
| `frontend/app/api/agent/analyse/route.ts` | POST orchestrator — runs all 4 agents in parallel |
| `frontend/app/api/import/route.ts` | CSV import → `scan_events` |
| `frontend/components/data-source-modal.tsx` | Per-session data source picker (QR / CSV / ERP) |
| `frontend/app/(app)/settings/integrations/page.tsx` | Placeholder integrations page |
| `agents/scripts/seed-demo.ts` | Seeds 1 shift, 3 work orders, ~500 scan events for demo tenant |
| `agents/scripts/reset-demo.ts` | Wipes all demo tenant data |

### Monorepo Restructure

- Separated agent TypeScript from `frontend/` into standalone `agents/` workspace
- `agents/package.json` — own deps: `groq-sdk`, `zod`, `@supabase/supabase-js`, `dotenv`, `tsx`, `typescript`
- `agents/lib/supabase.ts` — `createServiceClient()` using `@supabase/supabase-js` directly (no Next.js)
- Root `package.json` — workspaces: `["frontend", "agents", "backend"]`
- `frontend/next.config.js` — webpack alias `@agents → ../agents/lib`
- `frontend/tsconfig.json` — `paths` for `@agents`, `groq-sdk`, `zod`, `@supabase/supabase-js` (redirected to `frontend/node_modules` so Vercel type-check passes)
- Retired Python `agent/` and `backend/` services (no Dockerfiles, no FastAPI)

### Vercel Deployment Fixes

- Root `vercel.json` — `buildCommand: "npm run build --workspace=frontend"`, `outputDirectory: "frontend/.next"` — fixes "routes-manifest.json not found" error
- Removed `*/15 * * * *` crons from `frontend/vercel.json` — Hobby plan only allows daily crons; call endpoints manually during development
- Removed `docker-compose.yml` — referenced non-existent Dockerfiles from retired Python services

### Dashboard Updates (2026-05-09)

| What | Change |
|------|--------|
| "Johnny on the Spot" in `ai-insights-panel.tsx` | → "Agent Insights" |
| "Ask Johnny" / "Johnny" in `chat-panel.tsx` | → "Ask the Agent" / "Agent"; role type renamed `"johnny"` → `"agent"` |
| KPI card grid (4 separate `KpiCard` boxes) | Replaced with single compact info strip — unified row with inline metrics |
| `EscalationCenter` data source | Was reading from old `escalations` table (manual `status` field). Now reads from `agent_alerts` (watchdog-populated). Status is now derived from `resolved_at` (null = Active, set = Resolved ✓) |
| `Escalation` type in `types.ts` | Replaced with `AgentAlert` matching `agent_alerts` schema |
| `mockEscalations` in `mock-data.ts` | Replaced with `mockAgentAlerts` using new `AgentAlert` type |

### Tech Stack Note

Current stack is all TypeScript / Next.js. A restructure to Python FastAPI backend is being considered for Phase 2 (RAG, complex AI pipelines). Keep the `agents/` workspace TypeScript for now — the interface (`buildAgentContext`) does not change when the compute layer is replaced.

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

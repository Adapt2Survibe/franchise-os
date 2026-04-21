# FranchiseOS — Project Instructions

## Git Rules (CRITICAL)

- **`master` branch = the inherited original.** Never commit to it. Never merge into it. Never touch it.
- **`chris/dev` = Chris's branch.** ALL work happens here.
- Never force push. Never create branches without asking Chris.
- Always push to `chris/dev`, never to `master`.

## Project Context

- **What:** AI-powered operating system for multi-unit franchise owners (5-50 units)
- **Previous builder:** Jeff — built the foundation using VS Code + Claude Code
- **Current owner:** Chris — building it forward from Jeff's handoff
- **First brand:** Skill Samurai (kids STEM franchise, AU-based)

## Messaging Rules (HARD RULES — NO EXCEPTIONS)

1. **Never say "AI fixes your dying locations."** We promise early detection, alerts, suggested solutions, and visibility — NOT fixes.
2. **Never position AI as replacing employees.** AI enhances the team, gives them superpowers, makes them better at their jobs. It does NOT replace anyone. Frame every feature as "your team + AI" not "AI instead of your team."

These rules apply to ALL generated content: marketing copy, agent outputs, dashboard text, emails, landing pages, documentation — everything.

## Architecture Overview

- **Monorepo** with flat directory structure (no turborepo yet)
- **dashboard-app/** — Next.js 16 War Room dashboard (the deployable frontend)
- **swarm/** — 20 AI agent personas as markdown files + 36 dispatch rules
- **brands/** — Brand configs as JSON + markdown (brand-as-directory pattern)
- **brand-engine/** — Loads/validates/switches brand configs at runtime
- **territory-engine/** — Territory scoring across 5 dimensions
- **expansion-radar/** — Market opportunity signal detection
- **initiative-engine/** — Classifies and runs initiatives via agent dispatch
- **memory/** — 9-layer knowledge system (pgvector-free for now)
- **messaging/** — Slack, SMS (Twilio), WhatsApp gateways
- **scripts/** — start-swarm.ts, bootstrap-brand.ts
- **supabase/** — Postgres schema + migrations + RLS for multi-tenant isolation

## Tech Stack

- **Frontend:** Next.js 16 + React 19 + Tailwind 4 (dark theme)
- **Auth:** Clerk (currently disabled for partner preview)
- **Database:** Supabase Postgres + pgvector
- **AI:** Claude via Anthropic SDK — 3-tier model routing (Opus/Sonnet/Haiku)
- **Deployment:** Vercel (auto-deploys from chris/dev)

## Key Files

- `_MANIFEST.md` — Full file listing and architecture decisions
- `SETUP.md` — Environment setup, bootstrapping, deployment guide
- `architecture/` — 7-layer architecture docs, schema SQL, build phases
- `docs/build-reports/` — Jeff's audit report, Dallas demo report, overnight build report
- `docs/build-reports/ITEMS_NOT_UNDERSTOOD.md` — Jeff's 7 open questions needing Chris's decisions
- `dashboard/WAR_ROOM_DASHBOARD_SPEC.md` — Master spec for the War Room UI
- `strategy/franchise-os-market-strategy.md` — Market positioning and sales strategy

## Working With Chris

- Chris is new to coding — explain what you're doing and why
- Ask before making changes — never surprise him
- Casual tone, humor welcome
- Use emojis as visual markers (not decoration)
- Commit after completing the full task, not after each sub-step

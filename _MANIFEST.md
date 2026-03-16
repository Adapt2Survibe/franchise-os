# FranchiseOS -- Project Manifest

> Auto-generated manifest reflecting the current state of the monorepo.
> Last updated: 2026-03-16 (handoff cleanup + restructure)

---

## Build Status

| Module | Status | Notes |
|--------|--------|-------|
| dashboard-app | Builds | Next.js 16.1.6 on Vercel, Clerk auth, Tailwind 4, React 19 |
| brand-engine | 3 TS files | brand-loader, config-validator, onboarding-wizard |
| territory-engine | Spec + scorer | territory-scorer.ts + heatmap engine spec |
| expansion-radar | Spec + engine | radar-engine.ts + expansion radar spec |
| initiative-engine | Spec only | INITIATIVE_ENGINE_SPEC.md |
| memory | 4 TS files | pgvector-free memory index + brand-memory, decision-logs, platform-intelligence |
| messaging | 3 gateways | Slack, SMS (Twilio), WhatsApp gateway stubs |
| swarm | 20 soul agents + 36 rules | Full personality agents (287-451 lines each) + dispatch-rules.json |
| scripts | 2 scripts | start-swarm.ts, bootstrap-brand.ts |
| supabase | Migration pushed | 1 initial migration, config.toml, linked to project |
| brands | 2 brands | example-brand (6 files), skill-samurai (6 files) |

---

## File Listing

### Root

```
.gitignore                          — Git ignore rules
package.json                        — Root package (commonjs, @supabase/supabase-js dep)
package-lock.json                   — Lockfile for root deps
SETUP.md                            — Project setup guide
agent_swarm.docx                    — Original agent swarm design document
HANDOFF_CHECKLIST.docx              — New owner handoff checklist
OWNERS_MANUAL.docx                  — Maintenance and operations manual for new owner
```

### architecture/

```
FRANCHISEOS_7_LAYER_AI_ARCHITECTURE.md  — Seven-layer AI architecture overview
LAYER_MAPPING.md                        — Maps features to architecture layers
BUILD_PHASES_BY_LAYER.md                — Build phases ordered by layer priority
supabase-schema.sql                     — Reference SQL schema for Supabase tables
```

### docs/build-reports/ (Archived)

```
AUDIT_REPORT.md                     — Codebase audit report against agent_swarm.docx
DALLAS_SCENARIO_REPORT.md           — Dallas demo scenario execution report
OVERNIGHT_BUILD_REPORT.md           — Build completion report with file manifest
ITEMS_NOT_UNDERSTOOD.md             — Ambiguous items requiring Jeff's clarification
audit-file-list.txt                 — Raw file listing from audit
```

### brand-engine/

```
brand-loader.ts                     — Loads brand config from brands/ directory at runtime
config-validator.ts                 — Validates brand JSON configs against schema
onboarding-wizard.ts                — Guided onboarding flow for new brand setup
brand-switcher.ts                   — Multi-brand org-to-brand resolution with caching
white-label-renderer.ts             — Brand theme CSS variables + voice context rendering
```

### brands/example-brand/

```
brand.json                          — Core brand configuration (name, colours, settings)
growth_strategy.json                — Growth targets and expansion plan
territory_rules.json                — Territory scoring weights and geo rules
brand_voice.md                      — Brand voice and tone guidelines
ideal_franchisee.md                 — Ideal franchisee persona profile
marketing_playbook.md               — Marketing channel strategy and playbook
```

### brands/skill-samurai/

```
brand.json                          — Skill Samurai brand configuration
brand_voice.md                      — Education-focused brand voice guidelines
growth_strategy.json                — AU → CA → EG expansion strategy
marketing_playbook.md               — STEM education marketing playbook
territory_rules.json                — School-density weighted territory rules
ideal_franchisee.md                 — Education-aligned franchisee persona
```

### dashboard/

```
WAR_ROOM_DASHBOARD_SPEC.md          — War room dashboard feature specification
```

### dashboard-app/ (Root Config)

```
package.json                        — Next.js 16.1.6, React 19, Clerk 7, Anthropic SDK
package-lock.json                   — Lockfile
tsconfig.json                       — TypeScript configuration
next.config.ts                      — Next.js config
next-env.d.ts                       — Next.js environment type declarations
eslint.config.mjs                   — ESLint flat config
postcss.config.mjs                  — PostCSS config (Tailwind)
vercel.json                         — Vercel deployment settings
.env.local.example                  — Example environment variable template
.gitignore                          — Dashboard-app specific ignores
README.md                           — Create Next App readme
tsconfig.tsbuildinfo                — TS incremental build info
```

### dashboard-app/src/

```
middleware.ts                        — Clerk auth middleware (protects routes)

app/layout.tsx                       — Root layout with ClerkProvider
app/page.tsx                         — Root page (redirect or landing)
app/globals.css                      — Global Tailwind styles + dark theme
app/favicon.ico                      — Favicon

app/(auth)/sign-in/[[...sign-in]]/page.tsx  — Clerk sign-in page
app/(auth)/sign-up/[[...sign-up]]/page.tsx  — Clerk sign-up page

app/(dashboard)/layout.tsx           — Dashboard shell layout (Sidebar + TopNav)
app/(dashboard)/page.tsx             — War room dashboard main page
app/(dashboard)/territory/page.tsx   — Territory map page with detail panel
app/(dashboard)/initiatives/page.tsx — Initiative kanban board page
app/(dashboard)/leads/page.tsx       — Leads table with filters and detail panel

app/api/webhooks/clerk/route.ts      — Clerk webhook handler (user sync)
app/api/command/route.ts             — AI command bar API endpoint
app/api/agents/route.ts              — Agent dispatch API endpoint
app/api/territories/route.ts         — Territory CRUD API (GET list, POST create)
app/api/initiatives/route.ts         — Initiative CRUD API (GET list, POST create)
app/api/leads/route.ts               — Leads API (GET paginated, POST create)

components/layout/Sidebar.tsx        — Dashboard sidebar navigation
components/layout/TopNav.tsx         — Top navigation bar

components/war-room/AICommandBar.tsx      — Natural language command input
components/war-room/SwarmActivityFeed.tsx  — Live agent activity feed
components/war-room/OpportunityRadar.tsx   — Market opportunity radar widget
components/war-room/TerritoryHeatmap.tsx   — Territory score heatmap widget
components/war-room/InitiativeBoard.tsx    — Active initiatives kanban board
components/war-room/MemoryWidget.tsx       — System memory/context widget

lib/claude.ts                        — Anthropic Claude API client wrapper
lib/model-router.ts                  — Routes agents to strategic/operational/worker models
lib/supabase.ts                      — Supabase client initialisation

types/franchise-os.ts                — Shared TypeScript type definitions
```

### dashboard-app/public/

```
file.svg                             — Icon asset
globe.svg                            — Icon asset
next.svg                             — Next.js logo
vercel.svg                           — Vercel logo
window.svg                           — Icon asset
```

### expansion-radar/

```
EXPANSION_RADAR_SPEC.md              — Expansion radar feature specification
radar-engine.ts                      — Expansion opportunity detection engine
```

### initiative-engine/

```
INITIATIVE_ENGINE_SPEC.md            — Initiative engine feature specification
logic/initiative-classifier.ts       — Classifies initiatives by type and priority
logic/initiative-runner.ts           — Executes initiatives via agent dispatch
policies/approval-policy.ts          — Auto-approve vs human review rules
templates/territory-expansion.json   — Territory expansion initiative template
templates/lead-campaign.json         — Lead campaign initiative template
templates/franchisee-support.json    — Franchisee support initiative template
templates/compliance-action.json     — Compliance action initiative template
templates/marketing-push.json        — Marketing push initiative template
```

### memory/

```
index.ts                             — Memory layer (pgvector-free Supabase storage + retrieval)
brand-memory/index.ts                — Per-brand scoped knowledge store (voice, campaign, market, competitor)
decision-logs/index.ts               — Structured decision tracking with outcome recording
platform-intelligence/index.ts       — Cross-brand pattern detection and system-level insights
```

### messaging/

```
slack-gateway.ts                     — Slack notification gateway
sms-gateway.ts                       — Twilio SMS gateway
whatsapp-gateway.ts                  — WhatsApp Business API gateway
```

### scripts/

```
start-swarm.ts                       — Boots the agent swarm event loop
bootstrap-brand.ts                   — Scaffolds a new brand directory from template
```

### supabase/

```
config.toml                          — Supabase CLI project configuration
.gitignore                           — Supabase local ignores
migrations/20260308000001_initial_schema.sql  — Initial DB migration (all tables, RLS, indexes)
migrations/20260308000002_missing_tables.sql  — Additional tables: expansion_signals, initiative_runs, brand_settings, playbooks
```

### swarm/

```
SWARM_CONTROLLER_SPEC.md             — Swarm controller architecture spec
AGENT_REGISTRY.md                    — Registry of all 20 agents with roles and triggers
EVENT_SCHEMA.md                      — Event envelope spec and full event type catalog
MEMORY_SYSTEM.md                     — 9-layer memory architecture specification
MODEL_ROUTING.md                     — OpenClaw model routing specification
TOOLS_SPEC.md                        — Tool categories and function signatures
dispatch-rules.json                  — 36 event-driven dispatch rules (trigger → agent → model tier)
event-bus.ts                         — Supabase realtime event pub/sub system
playbook-optimizer.ts                — Self-improving playbook loop
memory-middleware.ts                 — Agent memory context injection middleware
scenarios/opportunity-auto-response.ts — Dallas scenario auto-response pipeline

agents/ceo.md                        — CEO Agent (309 lines) — strategic oversight, soul personality
agents/cro.md                        — CRO Agent (307 lines) — revenue engine, soul personality
agents/coo.md                        — COO Agent (332 lines) — operational backbone, soul personality
agents/cmo.md                        — CMO Agent (327 lines) — brand and growth voice, soul personality
agents/market-opportunity.md         — Market Opportunity Agent (309 lines) — geographic scout, soul personality
agents/territory-intelligence.md     — Territory Intelligence Agent (301 lines) — geographic strategist, soul personality
agents/lead-intelligence.md          — Lead Intelligence Agent (300 lines) — lead scoring specialist, soul personality
agents/sales-pipeline.md             — Sales Pipeline Agent (444 lines) — deal progression engine, soul personality
agents/campaign.md                   — Campaign Agent (310 lines) — multi-channel conductor, soul personality
agents/content-strategy.md           — Content Strategy Agent (330 lines) — messaging architect, soul personality
agents/onboarding.md                 — Onboarding Agent (315 lines) — franchisee welcome hand, soul personality
agents/coaching.md                   — Coaching Agent (346 lines) — performance partner, soul personality
agents/memory-curator.md             — Memory Curator Agent (316 lines) — knowledge keeper, soul personality
agents/pattern-detection.md          — Pattern Detection Agent (405 lines) — cross-system detective, soul personality
agents/learning.md                   — Learning Agent (451 lines) — scientific mind, soul personality
agents/landing-page.md               — Landing Page Agent (287 lines) — conversion craftsman, soul personality
agents/email.md                      — Email Agent (340 lines) — persuasive inbox voice, soul personality
agents/social-content.md             — Social Content Agent (297 lines) — social storyteller, soul personality
agents/report.md                     — Report Agent (378 lines) — executive communicator, soul personality
agents/initiative.md                 — Initiative Agent (376 lines) — action catalyst, soul personality
agents/skill-samurai-config.md       — Skill Samurai brand-specific agent overrides
```

### agency-agents/ (Git Submodule)

```
README.md                            — Agency Agents open-source collection
CONTRIBUTING.md                      — Contribution guidelines
design/                              — 7 design agents (brand guardian, UI, UX, etc.)
engineering/                         — 8 engineering agents (AI, backend, frontend, etc.)
marketing/                           — 11 marketing agents (content, social, growth, etc.)
product/                             — 3 product agents (feedback, sprint, trends)
project-management/                  — 5 PM agents (shepherd, producer, operations, etc.)
spatial-computing/                   — 6 spatial/XR agents
specialized/                         — 7 specialised agents (orchestrator, data, identity, etc.)
strategy/                            — Strategy docs (executive brief, quickstart)
scripts/                             — Utility scripts (convert, install, lint)
integrations/                        — IDE integration guides (Cursor, Claude Code, etc.)
examples/                            — Workflow examples
```

---

## Environment Variables Checklist

| Variable | Module | Source | Vercel Status |
|----------|--------|--------|---------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | dashboard-app | Clerk dashboard | Set in local.env; needs Vercel env |
| `CLERK_SECRET_KEY` | dashboard-app | Clerk dashboard | Set in local.env; needs Vercel env |
| `CLERK_WEBHOOK_SECRET` | dashboard-app | Clerk webhooks panel | Set in local.env; needs Vercel env |
| `NEXT_PUBLIC_SUPABASE_URL` | dashboard-app | Supabase project settings | Set in local.env; needs Vercel env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dashboard-app | Supabase project settings | Set in local.env; needs Vercel env |
| `SUPABASE_SERVICE_ROLE_KEY` | dashboard-app, scripts | Supabase project settings | Set in local.env; needs Vercel env |
| `ANTHROPIC_API_KEY` | dashboard-app, swarm | Anthropic console | Set in local.env; needs Vercel env |
| `NEXT_PUBLIC_APP_URL` | dashboard-app | Manual | localhost in local.env; Vercel auto-sets VERCEL_URL |
| `NEXT_PUBLIC_PRIMARY_DOMAIN` | dashboard-app | Manual | zorspace.io (in .env.local.example) |
| `NEXT_PUBLIC_SKILL_SAMURAI_DOMAIN` | dashboard-app | Manual | os.skillsamurai.com (in .env.local.example) |
| `NEXT_PUBLIC_CLERK_DOMAIN` | dashboard-app | Clerk dashboard | In .env.local.example only |
| `MODEL_STRATEGIC` | dashboard-app | Optional override | claude-opus-4-5-20250918 (default) |
| `MODEL_OPERATIONAL` | dashboard-app | Optional override | claude-sonnet-4-5-20250514 (default) |
| `MODEL_WORKER` | dashboard-app | Optional override | claude-haiku-4-5-20251001 (default) |
| `TWILIO_ACCOUNT_SID` | messaging | Twilio console | Not set -- add later |
| `TWILIO_AUTH_TOKEN` | messaging | Twilio console | Not set -- add later |
| `TWILIO_PHONE_NUMBER` | messaging | Twilio console | Not set -- add later |

---

## Architecture Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Next.js 16 App Router | Server Components, streaming, API routes in one framework | Remix, SvelteKit |
| Clerk for auth | Drop-in auth with org/multi-tenant support, webhook sync | NextAuth, Supabase Auth, Auth0 |
| Supabase + pgvector | Postgres with vector search, RLS, real-time subscriptions, edge functions | PlanetScale, Firebase, Neon |
| pgvector-free memory (phase 1) | Ship faster; keyword + metadata search first, upgrade to embeddings later | Pinecone, Weaviate |
| Claude API (Anthropic SDK) | Best reasoning for strategic agents; model-router tiers costs down | OpenAI GPT-4, Gemini |
| Three-tier model routing | Strategic (Opus) for C-suite, Operational (Sonnet) for mid-tier, Worker (Haiku) for content | Single model for all agents |
| Event-driven swarm dispatch | 36 rules in dispatch-rules.json; decoupled, auditable, brand-scoped | Direct agent-to-agent calls, queue-based |
| Tailwind 4 dark theme | Fast styling, dark-first war room aesthetic | Chakra UI, shadcn/ui, MUI |
| Vercel deployment | Zero-config Next.js hosting, preview deploys, edge functions | AWS Amplify, Cloudflare Pages, Railway |
| Monorepo (flat dirs) | Simple structure for solo/small team; no turborepo overhead yet | Turborepo, Nx, pnpm workspaces |
| Brand-as-directory pattern | Each brand is a folder with JSON + MD configs; loaded by brand-engine | DB-only config, YAML, env vars |
| Markdown agent definitions | Human-readable, version-controlled agent personas and rules | JSON agent configs, DB-stored prompts |

---

## Next Steps (Prioritized)

1. **Set remaining Vercel env secrets** -- Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, and `ANTHROPIC_API_KEY` to Vercel project environment variables
2. **Configure Clerk webhook endpoint** -- Point Clerk webhook to `https://<vercel-domain>/api/webhooks/clerk` and verify `CLERK_WEBHOOK_SECRET` matches
3. **Wire agent execution pipeline** -- Currently dispatch-only (rules exist but no Claude API calls); implement `executeAgent()` in start-swarm.ts that calls Claude with agent persona + context
4. **Integrate real embeddings** -- Replace pgvector-free keyword memory with OpenAI `text-embedding-3-small` or Anthropic embeddings; enable vector similarity search in memory/index.ts
5. **Territory scorer: real data APIs** -- Connect territory-scorer.ts to Census API (ABS for AU), Google Maps Places API, and school directory datasets
6. **Dashboard: connect widgets to live Supabase data** -- Wire SwarmActivityFeed, OpportunityRadar, TerritoryHeatmap, InitiativeBoard, and MemoryWidget to real-time Supabase queries
7. **Swarm monitor page** -- Add `/swarm` route showing agent status, recent dispatches, event log, and queue depth
8. **Custom domain setup** -- Configure `zorspace.io` and `os.skillsamurai.com` on Vercel with DNS and SSL
9. **CI/CD pipeline** -- Add GitHub Actions for lint, type-check, build, and Supabase migration checks on PR
10. **Multi-brand tenant testing** -- End-to-end test with example-brand and skill-samurai running concurrently; verify RLS isolation and brand-scoped dispatch

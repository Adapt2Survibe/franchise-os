# FranchiseOS Audit Report

> Generated: 2026-03-08
> Source of truth: agent_swarm.docx + current codebase

---

## 1. FILES PRESENT AND COMPLETE

| File | Status |
|------|--------|
| `architecture/FRANCHISEOS_7_LAYER_AI_ARCHITECTURE.md` | Complete — full 7-layer spec with data flow examples |
| `architecture/supabase-schema.sql` | Complete — reference schema |
| `brand-engine/brand-loader.ts` | Complete — loadBrand, loadBrandByOrg, validation |
| `brand-engine/config-validator.ts` | Complete — full schema validation with all field checks |
| `brand-engine/onboarding-wizard.ts` | Complete — startOnboarding, advanceStep, getOnboardingStatus |
| `brands/example-brand/*` (6 files) | Complete — brand.json, voice, strategy, rules, playbook, persona |
| `brands/skill-samurai/*` (6 files) | Complete — brand.json, voice, strategy, rules, playbook, persona |
| `dashboard/WAR_ROOM_DASHBOARD_SPEC.md` | Complete — full widget specs, layout, interactions, color system |
| `dashboard-app/src/app/(dashboard)/layout.tsx` | Complete — Sidebar + TopNav shell |
| `dashboard-app/src/app/(dashboard)/page.tsx` | Complete — War Room page with all 6 widgets |
| `dashboard-app/src/app/(auth)/*` | Complete — sign-in and sign-up pages |
| `dashboard-app/src/app/api/webhooks/clerk/route.ts` | Complete |
| `dashboard-app/src/app/api/command/route.ts` | Complete |
| `dashboard-app/src/app/api/agents/route.ts` | Complete |
| `dashboard-app/src/components/war-room/AICommandBar.tsx` | Complete |
| `dashboard-app/src/components/war-room/SwarmActivityFeed.tsx` | Complete |
| `dashboard-app/src/components/war-room/OpportunityRadar.tsx` | Complete — fetches from API, renders signal cards |
| `dashboard-app/src/components/war-room/TerritoryHeatmap.tsx` | Complete — card grid with grade badges, stats |
| `dashboard-app/src/components/war-room/InitiativeBoard.tsx` | Complete |
| `dashboard-app/src/components/war-room/MemoryWidget.tsx` | Complete |
| `dashboard-app/src/components/layout/Sidebar.tsx` | Complete — nav items, collapse, mobile drawer |
| `dashboard-app/src/components/layout/TopNav.tsx` | Complete |
| `dashboard-app/src/lib/claude.ts` | Complete |
| `dashboard-app/src/lib/model-router.ts` | Complete — getModel, routeRequest with keyword matching |
| `dashboard-app/src/lib/supabase.ts` | Complete — browser, server, org-scoped clients |
| `dashboard-app/src/types/franchise-os.ts` | Complete — all major types defined |
| `dashboard-app/src/middleware.ts` | Complete — Clerk auth |
| `expansion-radar/radar-engine.ts` | Complete — 4 signal types, clustering, event emission |
| `initiative-engine/INITIATIVE_ENGINE_SPEC.md` | Complete — full spec with 5 gates, outcomes, decision logic |
| `memory/index.ts` | Complete — storeMemory, retrieveMemory, searchSimilarMemories, logDecision |
| `messaging/slack-gateway.ts` | Stub — gateway structure present |
| `messaging/sms-gateway.ts` | Stub — gateway structure present |
| `messaging/whatsapp-gateway.ts` | Stub — gateway structure present |
| `scripts/start-swarm.ts` | Present |
| `scripts/bootstrap-brand.ts` | Present |
| `supabase/migrations/20260308000001_initial_schema.sql` | Complete — brands, territories, franchisees, leads, initiatives, agent_events, memory_entries, campaigns + RLS |
| `swarm/AGENT_REGISTRY.md` | Complete — 20 agents, tiers, event subscription map |
| `swarm/SWARM_CONTROLLER_SPEC.md` | Complete — full lifecycle, dispatch rules, concurrency, safety controls |
| `swarm/dispatch-rules.json` | Complete — 36 dispatch rules |
| `swarm/agents/*.md` (20 files) | Complete — all agent personas defined |
| `territory-engine/territory-scorer.ts` | Complete — 5 dimensions, weighted scoring, recommendation generator |
| `_MANIFEST.md` | Complete — full file listing with descriptions |

---

## 2. FILES PRESENT BUT EMPTY OR STUB

| File | Lines | What Needs Writing |
|------|-------|--------------------|
| `territory-engine/TERRITORY_HEATMAP_ENGINE_SPEC.md` | ~42 (truncated) | Truncated mid-sentence at "Map Engine:" — needs full spec: technology choice, map layers, data sources, component API, integration points |
| `expansion-radar/EXPANSION_RADAR_SPEC.md` | 1 (empty) | Full spec needed: signal types, scoring methodology, data sources, API contracts, integration with initiative engine |
| `architecture/LAYER_MAPPING.md` | 1 (empty) | Map each feature/module to its architecture layer(s) |
| `architecture/BUILD_PHASES_BY_LAYER.md` | 1 (empty) | Build phases ordered by layer priority |
| `initiative-engine/logic/` | Directory exists, empty | initiative-classifier.ts and initiative-runner.ts needed |
| `initiative-engine/policies/` | Directory exists, empty | approval-policy.ts needed |
| `initiative-engine/templates/` | Directory exists, empty | 5 initiative template JSON files needed |

---

## 3. FILES MISSING ENTIRELY

| File | What Needs Creating |
|------|---------------------|
| `swarm/EVENT_SCHEMA.md` | Event envelope spec, event categories, payload examples |
| `swarm/MEMORY_SYSTEM.md` | 9-layer memory architecture spec |
| `swarm/MODEL_ROUTING.md` | OpenClaw model routing spec |
| `swarm/TOOLS_SPEC.md` | Tool categories and function signatures |
| `swarm/event-bus.ts` | Supabase realtime event pub/sub |
| `swarm/playbook-optimizer.ts` | Self-improving playbook loop |
| `swarm/memory-middleware.ts` | Agent memory context injection |
| `swarm/scenarios/opportunity-auto-response.ts` | Dallas scenario auto-response |
| `brand-engine/brand-switcher.ts` | Multi-brand org-to-brand resolution with caching |
| `brand-engine/white-label-renderer.ts` | Brand theme + voice context rendering |
| `initiative-engine/logic/initiative-classifier.ts` | Classify initiative by type and priority |
| `initiative-engine/logic/initiative-runner.ts` | Execute initiatives via agent dispatch |
| `initiative-engine/policies/approval-policy.ts` | Auto-approve vs human review rules |
| `initiative-engine/templates/territory-expansion.json` | Template for expansion initiatives |
| `initiative-engine/templates/lead-campaign.json` | Template for lead campaign initiatives |
| `initiative-engine/templates/franchisee-support.json` | Template for franchisee support initiatives |
| `initiative-engine/templates/compliance-action.json` | Template for compliance initiatives |
| `initiative-engine/templates/marketing-push.json` | Template for marketing push initiatives |
| `dashboard-app/src/app/(dashboard)/territory/page.tsx` | Territory map page |
| `dashboard-app/src/app/(dashboard)/initiatives/page.tsx` | Initiative board page |
| `dashboard-app/src/app/(dashboard)/leads/page.tsx` | Leads table page |
| `dashboard-app/src/app/api/initiatives/route.ts` | Initiatives CRUD API |
| `dashboard-app/src/app/api/territories/route.ts` | Territories CRUD API |
| `dashboard-app/src/app/api/leads/route.ts` | Leads CRUD API |
| `supabase/migrations/20260308000002_missing_tables.sql` | expansion_signals, initiative_runs, brand_settings, playbooks tables |

---

## 4. CONCEPTS IN agent_swarm.docx NOT YET IMPLEMENTED

| Concept | Description | Status |
|---------|-------------|--------|
| Self-improving playbook loop | Learning agent reviews playbook performance, rewrites underperformers | No code |
| OpenClaw model router (full) | Brand-level model overrides from brand_settings, routing log to agent_events | Partial — basic keyword routing exists, no brand overrides or logging |
| Dallas scenario (auto-response) | Full multi-agent pipeline: CEO evaluates → Territory scores → Landing Page → Campaign → Social → Initiative tracked | No code |
| Agent memory middleware | Before/after hooks that inject memory context into agent runs and store outcomes | No code |
| Event bus (Supabase realtime) | publish/subscribe/subscribeAll/unsubscribe on agent_events | No code — events are inserted but not subscribed to |
| Brand switcher | Clerk org → brand config resolution with in-memory cache | No code |
| White-label renderer | CSS variables + voice context from brand config | No code |
| State registration gate | Check brand registration status before launching expansion | In spec only, no code |
| Filing policy integration | brands/{brand}/filing_policy.json and registration_config.json | Referenced in spec, no files exist |
| Initiative duplication gate | Check for existing active initiatives before creating new ones | In spec only, no code |
| Circuit breakers | Agent failure tracking, auto-disable after 5 failures/hour | In spec only, no code |
| CTO Agent (health monitoring) | Mentioned in SWARM_CONTROLLER_SPEC but not in agent registry | Not implemented, not an agent file |

---

## 5. CONTRADICTIONS BETWEEN agent_swarm.docx AND CURRENT BUILD

| Contradiction | Detail | Resolution |
|--------------|--------|------------|
| Model tier assignments | Architecture doc says Tier 2 uses "Gemini Pro / GPT-4o-mini / Mistral" but model-router.ts only routes to Claude models | IGNORED — current build uses Claude-only routing which is simpler and correct for v1 |
| Memory system approach | Architecture doc references pgvector but migration uses text-based search (pgvector-free) | IGNORED — pgvector-free approach is documented as Phase 1 decision |
| Franchise saturation vs school proximity | Task spec says weight `school_proximity: 0.20` but territory-scorer.ts uses `franchiseSaturation: 0.20` | IGNORED — current scorer is more general-purpose; school proximity is brand-specific |
| Initiative types | Spec has: market_expansion, unit_recovery, campaign_optimization, territory_outreach, onboarding_support. Task spec has: territory_expansion, lead_campaign, franchisee_support, compliance_action, marketing_push | Using DB-defined types for existing code, new initiative-classifier will use task spec types |

---

## 6. ITEMS NOT UNDERSTOOD

See `ITEMS_NOT_UNDERSTOOD.md` for detailed list.

Summary:
1. OpenClaw — referenced as "provider-agnostic agent execution" but no clear spec on how non-Claude providers integrate
2. n8n automation workflows — mentioned in Layer 4 but no integration code or config
3. React Native mobile app — referenced in Layer 5 but no mobile codebase exists
4. CTO Agent — mentioned in health monitoring section but not in agent registry
5. Filing policy / registration config — referenced in initiative engine spec but no brand files created for these

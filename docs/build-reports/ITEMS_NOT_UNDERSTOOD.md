# Items Not Understood

> Items from agent_swarm.docx that were ambiguous, contradictory, or required assumptions.

---

## Item 1: OpenClaw Model Router — Provider Agnosticism

**Source**: Layer 7 (Model Routing Layer) in 7-Layer Architecture
**Issue**: OpenClaw is described as a "provider-agnostic agent execution" runtime supporting Gemini Pro, GPT-4o-mini, Mistral, DeepSeek, and local Llama in addition to Claude. However, the current codebase is Claude-only, and no OpenClaw library, configuration, or multi-provider setup exists.
**Assumption made**: Implemented model-router.ts using Claude models only (Opus for strategic, Sonnet for operational, Haiku for worker). Brand-level overrides read from brand_settings.ai_model_overrides but still route to Claude model IDs.
**Jeff needs to decide**: Should v1 support non-Claude providers? If yes, which providers and what API keys are available? If no, should the architecture docs be updated to reflect Claude-only routing?

---

## Item 2: n8n Automation Workflows

**Source**: Layer 4 (Tools & Automations) in 7-Layer Architecture
**Issue**: n8n is listed as a technology for "complex automation workflows" alongside Supabase Edge Functions and serverless workers. No n8n instance, configuration, or workflow definitions exist in the codebase.
**Assumption made**: All automations are implemented as TypeScript functions and Supabase queries. No n8n integration was built.
**Jeff needs to decide**: Is n8n still planned for v1? If yes, which workflows should run in n8n vs TypeScript? What is the n8n instance URL?

---

## Item 3: React Native Mobile App

**Source**: Layer 5 (Client Layer) in 7-Layer Architecture
**Issue**: A mobile app is described with "simplified daily briefing" features including activity summaries, lead notifications, AI suggestions, and quick approve/reject. No React Native or mobile codebase exists.
**Assumption made**: Mobile is not in scope for this build. The web dashboard is responsive and serves as the mobile interface for now.
**Jeff needs to decide**: Is the mobile app planned for a future phase? Should the responsive web dashboard be optimized further for mobile use?

---

## Item 4: CTO Agent for Health Monitoring

**Source**: Section 8 (Agent Lifecycle — Health Monitoring) in SWARM_CONTROLLER_SPEC.md
**Issue**: The spec mentions "The CTO_AGENT (when enabled) monitors: agent execution times, failure rates, event queue depth, model cost per agent tier, memory storage growth." However, there is no CTO agent in the AGENT_REGISTRY.md (20 agents listed, no CTO), and no agent definition file exists.
**Assumption made**: CTO Agent is a future addition. Health monitoring is not implemented in v1. The "(when enabled)" qualifier suggests this was always planned as optional.
**Jeff needs to decide**: Should a CTO_AGENT be added to the registry and implemented? Or should health monitoring be a dashboard page without an agent?

---

## Item 5: State Registration / Filing Policy Files

**Source**: Section 7 (Required Brand Parameters) in INITIATIVE_ENGINE_SPEC.md
**Issue**: The spec references `brands/{brand}/registration_config.json` and `brands/{brand}/filing_policy.json` as required files for the Initiative Engine's gate system. These files do not exist for any brand. The gate system (State Registration Gate, Territory Availability Gate, etc.) requires this data to function.
**Assumption made**: The initiative classifier and runner were implemented without gate checks, as the required brand config files do not exist. The gate system is spec-complete but code-incomplete.
**Jeff needs to decide**: Should registration_config.json and filing_policy.json be created for Skill Samurai? What states are registered? What is the filing policy?

---

## Item 6: Clerk Org-to-Brand Mapping

**Source**: Brand isolation architecture throughout
**Issue**: The system assumes a 1:1 mapping between Clerk organizations and brands (clerk_org_id column on brands table). However, no Clerk organization has been created and linked to the Skill Samurai brand record (clerk_org_id is null in the seed data).
**Assumption made**: brand-switcher.ts resolves by clerk_org_id but falls back gracefully. The war room page uses a hardcoded placeholder brand ID.
**Jeff needs to decide**: What is the Clerk org ID for Skill Samurai? Should the seed data be updated? Should there be a setup flow to link Clerk orgs to brands?

---

## Item 7: Budget Field for Initiatives

**Source**: Approval policy references budget thresholds ($500, $1000, $200)
**Issue**: The initiatives table does not have a budget column. The approval policy references budget amounts for auto-approve decisions, but there's no way to store or track initiative budgets in the schema.
**Assumption made**: Budget is stored in the initiatives.data JSONB column as `data.budget`. The approval policy reads from there.
**Jeff needs to decide**: Should a dedicated `budget numeric` column be added to the initiatives table? Or is the JSONB approach sufficient?

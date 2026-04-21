# Agent Dispatch Log — FranchiseOS

This log tracks every agent dispatched in this project per Chris's CLAUDE.md global rule. A weekly review agent reads this every Saturday at 7:00 AM ET to identify gaps in specialized agent coverage and surface flagged dispatches.

**Format reference:** see `~/.claude/CLAUDE.md` → "Agent Logging" section.

---

## 2026-04-07 09:30 | Search codebase for Sally / Franchise Hero references
- **Project:** franchise-os
- **Agent type:** Explore
- **Purpose:** Comprehensive search for any existing Sally Sales Rep files, Franchise Hero personas, or sales-rep agent scaffolding before building Sally v1. Chris was convinced a Sally.md file existed somewhere.
- **Specialized agent available:** YES → Explore
- **Task category:** Codebase Discovery
- **Outcome:** completed
- **Files/scope:** Read across `swarm/`, `docs/`, `Franchise Hero Docs/`, `dashboard-app/`, `scripts/`, `architecture/`
- **Notes:** Found Sally is 100% documented in strategy (Franchise Hero Docs) but 0% implemented. The closest existing scaffolding is `swarm/agents/sales-pipeline.md` and `lead-intelligence.md`. Only 8-line Sally mention in `docs/ZorSpace Mindmap.md` lines 28-35 (v2 features).

## 2026-04-07 09:45 | Tiger Adjusters + Jay (VP Franchise Dev) intelligence brief
- **Project:** franchise-os
- **Agent type:** general-purpose
- **Purpose:** Research the franchise business and Jay's profile to design Sally for Tiger Adjusters' actual workflow before pilot kickoff
- **Specialized agent available:** NO 🔴 FLAGGED FOR REVIEW
- **Task category:** Pilot Customer Research
- **Outcome:** completed
- **Files/scope:** Web research only (no codebase touched)
- **Notes:** No specialized "company/prospect research" agent exists. The `prospecting-research` SKILL exists but skills aren't agents. This is the 1st time this task category has come up in this project — may warrant a specialist for similar pilot/customer research in the future. Surfaced Jared Harrell vs Jessie Hernandez ambiguity (resolved on call: it's Jared).

## 2026-04-07 10:15 | Monday.com GraphQL API technical research
- **Project:** franchise-os
- **Agent type:** general-purpose
- **Purpose:** Phase 1 research for Sally v1 — gather Monday API capabilities, webhooks, auth, SDKs to inform tech stack decisions in Phase 2 decision framework
- **Specialized agent available:** NO 🔴 FLAGGED FOR REVIEW
- **Task category:** Technical API Research (SaaS platform)
- **Outcome:** completed
- **Files/scope:** Web research only; saved to `docs/superpowers/plans/sally-v1/00-research-monday-api.md`
- **Notes:** No dedicated "SaaS API research" agent. `compound-engineering:research:framework-docs-researcher` exists but is described as for frameworks/libraries, not SaaS platform APIs — unclear fit. Review whether to create a specialist for technical SaaS API briefs since this will recur (HubSpot, GoHighLevel, Salesforce, etc.).

## 2026-04-07 10:30 | Google Meet/Drive/Gemini transcript access research
- **Project:** franchise-os
- **Agent type:** general-purpose
- **Purpose:** Phase 1 research for Sally v1 — verify whether reading Jay's auto-saved Gemini Meet transcripts is technically feasible and what auth/scopes are needed for the heat-scoring v2 feature
- **Specialized agent available:** NO 🔴 FLAGGED FOR REVIEW
- **Task category:** Technical API Research (SaaS platform)
- **Outcome:** completed
- **Files/scope:** Web research only; saved to `docs/superpowers/plans/sally-v1/00-research-google-transcripts.md`
- **Notes:** Same context as Monday API research dispatch above — no dedicated SaaS API research specialist. 2nd dispatch in this task category today. **If this happens 3+ times in coming weeks, recommend creating a `saas-api-researcher` specialist agent.**

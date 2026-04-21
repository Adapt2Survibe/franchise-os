# Sally v1 — Session History

**Session date:** 2026-04-07 through 2026-04-20
**Participants:** Chris (product owner, learning to code) + Claude Opus 4.6 (1M context)
**Branch:** chris/dev
**Outcome:** Full planning cycle completed, architecture pivoted from custom backend to Claude Managed Agents. Ready for build planning in next session.

---

## The Story (Chronological)

### 1. "Which agent should we build first?" (April 7)

Chris asked which of the 20 AI agents in the FranchiseOS swarm — or which of the 13 Franchise Hero AI employees — to build and monetize first. After analyzing both sets:

- **Swarm agents** (in `swarm/agents/`) = Jeff's technical architecture (function-based: LEAD_INTELLIGENCE_AGENT, MARKET_OPPORTUNITY_AGENT, etc.)
- **Franchise Hero employees** (in `Franchise Hero Docs/`) = Jeff's marketing product (persona-based: Sally Sales Rep, Rachel Receptionist, Frankie Concierge, etc.)

**Key insight discovered:** These are two different abstractions of the same system. The swarm is the engine; Franchise Hero is the brand. Jeff's GTM playbook already picked the MVP wedge: the "Growth Pack" = Sally + Frankie + Rachel, with Sally as the revenue driver.

**Decision: Build Sally Sales Rep first.** ROI math: one extra franchise deal ($50-500K) pays for a decade of subscription. Jeff already validated this as the wedge.

**Important scope note (added post-review):** Jay's #1 pain is NDA drop-off (Stall Recovery Bot), but Broker Shield (#3 pain — broker nagging) was chosen as the v1 feature because it's lower-risk and faster to ship. Stall Recovery Bot is deferred to v1.1. Jay's agreement to this prioritization should be confirmed.

### 2. "It's Jay at Tiger Adjusters" (April 7)

Chris revealed the pilot customer: Jay (Jared Harrell), VP of Franchise Development at Tiger Adjusters. Jay is Chris's co-founder on this project. Tiger Adjusters is the first and only public adjusting franchise in the US (6 units, started franchising July 2024).

**Research deployed:** Two agents in parallel — one searched the codebase for existing Sally work, one researched Tiger Adjusters online.

**Critical findings:**
- Sally is 100% documented in strategy but 0% implemented in code
- 80% of Sally's brain already exists in swarm/ (sales-pipeline.md, lead-intelligence.md, email.md)
- Tiger Adjusters has a unique buyer bifurcation: licensed adjusters vs. career-changer investors
- Jay came from the Franchise Brokers Association — broker relationships are central to his pipeline
- Tiger's $861K Philly franchisee Item 19 number is the #1 closing weapon
- The OPPAGA 747% stat (PAs get 747% larger settlements) is the brand hook

### 3. "Jay is on the phone with me right now" (April 7)

Chris was literally on a call with Jay while chatting. Provided 5 questions to ask Jay live. Jay's answers changed everything:

**Jay's actual pain points (direct quotes):**
1. **NDA drop-off** = #1 revenue killer ("I gotta read the NDA, I'll get back to you" → ghost)
2. **Intro call booking drop-off** = #2 (leads arrive but never click booking link)
3. **Brokers** = constant time drain ("kids in the fucking car, always asking 'are we there yet'")

**Jay's pipeline stages** (from Monday screenshot): Intro Call → Send NDA → Send FDD → Debrief Call → Corporate Call → National Trainer Call → Validation Call → Close. Side lanes: Journey/Drip Campaign, Courtesy Call/Text, Follow-Up, None.

**Jay's current workflow:** Lead arrives in Monday (manual upstream intake) → auto intro email fires with calendar booking link → if unanswered, manual phone calls + drip campaign + broker notification. Partially automated, room for improvement.

**Key metric:** Discovery calls booked per week = leading indicator of future revenue.

**Heat scoring idea born here:** Chris envisioned Sally getting discovery call transcripts (from Google Meet/Gemini), assigning heat scores, detecting deltas, identifying "attack vectors" (hot button issues for closing). This was parked as v2 but informed the architecture.

### 4. Sally v1 scope crystallized (April 7)

**Two features, both from Jay's pain:**
1. **The Broker Shield** — auto-update referring brokers when leads change stages
2. **The Stall Recovery Bot** — multi-touch recovery sequences for NDA ghosting + intro booking drop-off

**CRM:** Monday.com (Jay's existing tool)
**Discovery call transcripts:** Google Meet with Gemini auto-saving to Drive
**Architecture approach:** Option B "Pilot Plus" selected (OAuth from day 1, multi-tenant scaffolding, 2-3 week ship target)

### 5. Phase 1-3 Planning (April 7)

**Research agents deployed (4 total):**
1. Explore agent — codebase search for Sally content
2. General-purpose — Tiger Adjusters intelligence brief
3. General-purpose — Monday.com GraphQL API deep dive
4. General-purpose — Google Meet/Drive/Gemini transcript access

**Key research findings:**
- Monday API uses GraphQL with complexity-based rate limiting (not request count)
- Monday has an official MCP server (`@mondaydotcomorg/monday-api-mcp`)
- Google Meet transcripts save to Drive as Google Docs; Drive API is the only viable ingestion path (Meet API only sees API-created conferences)
- CASA verification for `drive.readonly` takes 4-8 weeks
- Resend is outbound-only (this becomes a P0 later)

**System design produced:** 9-component custom backend architecture with Hono, Supabase, Resend, Claude API, 7 database tables, 3 background workers, Next.js approval UI with 7 routes. File: `02-system-design.md`.

### 6. The Adversarial Audit That Changed Everything (April 7)

Chris requested audits before proceeding. 7 document-review agents dispatched in parallel:
- coherence-reviewer, feasibility-reviewer, product-lens-reviewer, design-lens-reviewer, security-lens-reviewer, scope-guardian-reviewer, adversarial-document-reviewer

**Results: 87 findings, 7 P0 launch blockers.**

**The 4 findings that changed the trajectory:**

1. **Resend has no inbound email feature** (Feasibility P0, 5 reviewers flagged independently) — The entire reply detection flow was architecturally impossible. Sally would keep emailing candidates who already replied to Jay.

2. **Cold start would nuke Jay's board on day one** (Adversarial P0) — When Jay connects Monday, Sally would generate broker drafts for every existing lead he touches. 40+ drafts in the first morning → brokers spammed with months-old "updates."

3. **LLM can hallucinate earnings figures → FTC Franchise Rule liability** (Adversarial P0) — Sonnet could generate "$2.1M average revenue" when Item 19 says $861K. Franchisors are legally barred from earnings claims outside FDD.

4. **Auth is wide open** (Security P0) — Clerk auth is currently disabled in the dashboard-app. The /sally approval UI would be publicly accessible.

**Cross-reviewer consensus themes:**
- Reply detection = weakest link (5 of 7 reviewers)
- Scope too big for 2-3 weeks (3 of 7)
- Vercel Functions = wrong deployment shape (3 of 7)
- Multi-tenant = premature for single-customer pilot (3 of 7)

**Recommendation delivered:** Downsize to "Hardcoded Hero" v1 — personal token, hardcoded single-tenant, fold backend into dashboard-app, 2 UI routes, 1 feature first (Broker Shield), with mandatory safeguards (unsubscribe footer, earnings linter, prompt injection guards).

Chris's TDD instruction was also captured here: "design tests first AND document them" — added as a hard constraint for all subsequent phases.

### 7. The Managed Agents Pivot (April 20)

Chris returned after ~2 weeks and proposed building Sally on Claude Managed Agents — Anthropic's new hosted agent-as-a-service platform (launched April 8, 2026, public beta).

**Research confirmed:** Managed Agents is a fully managed runtime where Anthropic handles the agent loop, sandboxing, credential management, and tool execution. You define the agent (system prompt + tools + MCP servers), Anthropic runs it.

**Why this was the right call:**
- Eliminates 4 of 7 P0 findings (auth, webhooks, deployment, API endpoints)
- Radically simpler: agent definition + MCP connections + trigger function vs 9-component custom backend
- Monday's official MCP server provides the integration layer for free
- Aligns with "Simplicity First" from Chris's new coding guidelines (Karpathy-inspired)
- The brand promise IS an AI employee — a managed agent literally IS one

**Architecture collapsed to:**
```
Vercel Cron (trigger) → Claude Managed Agent "Sally" → Monday MCP + Email tool → Monday comments (Jay approval)
```

**Approval flow locked:** Option A — Sally posts drafts as Monday item Updates, Jay replies "approved" or provides edits. Zero new UI, zero new tools for Jay.

**Remaining P0s (3):** Cold start blast, LLM hallucination/FTC risk, prompt injection. These require both prompt-level AND code-level solutions:
- **Cold start** = state-management problem: needs a mechanism to track which leads existed before Sally started (e.g., activation-date cutoff stored in Supabase), not just a prompt rule.
- **FTC compliance** = needs a post-generation content linter (code that rejects drafts containing `$`, `revenue`, `profit`, `Item 19` patterns), not just a prompt instruction.
- **Prompt injection** = needs input sanitization wrapping Monday-sourced strings in untrusted delimiters + output structural validation, not just prompt wording.

### 8. Handoff Prepared (April 20)

Session ended with:
- All planning artifacts committed to chris/dev (14 files, 1,817 lines)
- Memory saved with Managed Agents pivot decision
- 7-layer handoff prompt generated via agent-prompt-engineering skill
- Architecture pivot fully documented

---

## Decisions Log (Chronological)

### Active Decisions (Post-Pivot — these guide the next session)

| Date | Decision | Rationale |
|---|---|---|
| Apr 7 | Build Sally Sales Rep first | Jeff's stated revenue driver; cleanest ROI math |
| Apr 7 | Monday.com as CRM | Jay's existing tool; pilot customer > market share |
| Apr 7 | Tiger Adjusters as pilot | Jay is co-founder; warm buyer; real pipeline |
| Apr 7 | Tests first, documented (TDD) | Chris's direct instruction |
| Apr 20 | **PIVOT to Claude Managed Agents** | Adversarial review showed custom backend over-engineered; Managed Agents eliminates 4 P0s |
| Apr 20 | Broker Shield only for v1 | Ship one feature, prove the wedge. Stall Recovery Bot deferred to v1.1 |
| Apr 20 | Monday comments for approval (Option A) | Zero new UI, Jay stays in Monday |

### Superseded Decisions (Custom Backend — DO NOT USE)

These decisions were made for the dead custom backend architecture. They are **no longer relevant** after the Managed Agents pivot. Listed here for historical reference only.

| Date | Decision | Why Superseded |
|---|---|---|
| Apr 7 | Option B "Pilot Plus" (D1) | Replaced by Managed Agents — no custom backend |
| Apr 7 | OAuth from day 1 (D2) | Managed Agents handles auth |
| Apr 7 | Webhooks + polling hybrid (D3) | No webhooks needed — Sally polls via MCP |
| Apr 7 | Separate Sally backend (D5) | No backend — Anthropic hosts the agent |
| Apr 7 | Hono for backend (D10) | No custom backend framework needed |
| Apr 7 | Vercel Functions deployment (D11) | Anthropic hosts the agent runtime |
| Apr 7 | Mixed Sonnet/Haiku models (D12) | Model selection is part of the Managed Agent definition, may change |
| Apr 7 | Daily digest approval timeout (D13) | Approval is via Monday comments now, not a dashboard inbox |
| Apr 7 | Chris-as-admin with audit trail (D14) | No dashboard, no admin role needed |

## Agents Dispatched This Session

| # | Type | Purpose | Outcome |
|---|---|---|---|
| 1 | Explore | Codebase search for Sally content | Completed — Sally is 0% implemented, 100% documented |
| 2 | general-purpose | Tiger Adjusters + Jay intelligence brief | Completed — full company/franchise/pipeline intel |
| 3 | general-purpose | Monday.com GraphQL API research | Completed — full API brief with 5 key decisions |
| 4 | general-purpose | Google Meet/Drive/Gemini transcript research | Completed — full access brief with 5 key decisions |
| 5 | coherence-reviewer | System design internal consistency | Completed — 9 findings |
| 6 | feasibility-reviewer | Reality check against codebase + APIs | Completed — 11 findings including P0 (Resend inbound) |
| 7 | product-lens-reviewer | Problem framing + scope alignment | Completed — 9 findings |
| 8 | design-lens-reviewer | UX/IA gaps at architecture level | Completed — 13 findings |
| 9 | security-lens-reviewer | Auth, PII, threat model gaps | Completed — 15 findings including 3 P0s |
| 10 | scope-guardian-reviewer | Over-engineering detection | Completed — 10 findings |
| 11 | adversarial-document-reviewer | Failure scenario construction | Completed — 20 findings including 4 P0s |
| 12 | general-purpose | Claude Managed Agents research | Completed — confirmed platform, capabilities, pricing |

## Files Created This Session

| File | Purpose |
|---|---|
| `CLAUDE.md` | Project instructions (existed before, now committed) |
| `agent-log.md` | Agent dispatch tracking log |
| `docs/ZorSpace Mindmap.md` | Product list with Sally feature requests |
| `docs/superpowers/plans/sally-v1/README.md` | Planning index, scope, constraints |
| `docs/superpowers/plans/sally-v1/00-research-monday-api.md` | Monday API research brief |
| `docs/superpowers/plans/sally-v1/00-research-google-transcripts.md` | Google Drive/Gemini research brief |
| `docs/superpowers/plans/sally-v1/02-system-design.md` | System design (OUTDATED — needs rewrite for Managed Agents) |
| `docs/superpowers/plans/sally-v1/09-adversarial-findings.md` | Full 87-finding adversarial audit |
| `docs/superpowers/plans/sally-v1/ALL_FINDINGS_TRACKER.md` | All findings + decisions D1-D14 + TDD requirements |
| `Franchise Hero Docs/*.docx` | Jeff's original product vision docs (5 files) |
| `memory/project_sally_v1_status.md` | Persistent memory for future sessions |

## What the Next Session Needs to Do

**Step 0 (BLOCKING): Confirm which of Jay's prerequisites have been collected.** Monday API token and board access are required before any build work. See README.md "What Jay Needs to Provide" list — items 1-4 are blocking, items 5-8 may be obsolete post-pivot.

1. **Read Managed Agents API reference** to populate system design fields (agent definition schema, MCP config, session trigger API, state persistence model). Decision to use Managed Agents is LOCKED — this is targeted research, not open-ended exploration.
2. **Rewrite 02-system-design.md** for the Managed Agents architecture (current version is SUPERSEDED — see banner at top of that file).
3. **Start from the ~30 surviving adversarial findings** — the infrastructure findings (~57) are resolved by the pivot. Focus on the AI-behavior findings (cold start, FTC compliance, prompt injection) and the Managed Agents-specific risks. Do NOT re-litigate all 87.
4. **Design tests first** per Chris's TDD instruction. Integration test: trigger cron → agent wakes → reads Monday → posts comment → Jay approves → email sends.
5. **Build Broker Shield:** agent definition + Monday MCP connection + email sending tool + trigger function. Include:
   - Cold-start guard (only process leads created after Sally's activation date)
   - FTC content linter (reject drafts containing currency/earnings language)
   - Prompt injection guards (untrusted delimiters on Monday-sourced data)
   - **CAN-SPAM/CASL compliant email footer** (unsubscribe link + Tiger Adjusters physical address in every broker email)

**Fallback plan:** If Managed Agents cannot support a required capability (Monday MCP, email sending, state persistence), fall back to Claude API direct + tool-use loop in a Vercel cron function, scoped to Broker Shield only.

## Lessons Learned

1. **Run adversarial audits EARLY.** The 7-reviewer audit caught 7 P0 launch blockers that would have been discovered in production. Changing the plan cost nothing; changing code would have cost 2-3 weeks.

2. **Build for the first customer, not the tenth.** Multi-tenant scaffolding, OAuth from day 1, separate backend service, Chris-as-admin role — all justified by "customer #2 might need it." Three reviewers independently flagged this as premature.

3. **The simplest architecture that solves the problem.** Claude Managed Agents eliminated ~60% of the code we were planning to write. The best code is no code.

4. **Listen to the user's pain, not the feature list.** Jay said "kids in the fucking car" about brokers. That one quote redirected Sally from "AI lead scorer" to "broker communication shield." The pain names the product.

5. **Research assumptions before building on them.** "Resend has inbound webhooks" was an assumption that became a P0 when the feasibility reviewer checked. PoCs and research save weeks.

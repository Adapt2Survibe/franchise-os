# Sally v1 — All Findings Tracker

This is the single source of truth for every issue, decision, gotcha, and TODO surfaced during the Sally v1 planning workflow. Per Chris's planning system rules, every finding from every agent is logged here IMMEDIATELY upon discovery. Status is updated as findings are resolved. **Never bury findings in agent output. Never cherry-pick.**

**Severity scale:**
- 🚨 **Critical** — blocks build or ships broken if ignored
- ⚠️ **Warning** — must be addressed before launch
- 💡 **Observation** — worth knowing, may inform design

**Status values:** open / in_progress / fixed / deferred

---

## Phase 1: Research Findings

### From Monday.com API Research (general-purpose agent, 2026-04-07)

| # | Severity | Title | Description | Action Required | Status |
|---|---|---|---|---|---|
| M1 | 🚨 | Monday plan tier required | Jay must be on Standard plan minimum. Free has zero API access. Basic = 200 calls/day will throttle within an hour. | Chris decision 2026-04-07: assume Jay has Standard+. Verify before customer #2. | deferred |
| M2 | 🚨 | OAuth required for production | Personal tokens are forbidden in Monday marketplace. OAuth must exist before customer #2. | Chris decision 2026-04-07: OAuth from day 1 (Option B). | fixed |
| M3 | ⚠️ | Webhook verification handshake | Monday POSTs `{challenge}` on webhook creation; endpoint must echo it or webhook silently fails | Build challenge handler FIRST, before testing webhook events | open |
| M4 | ⚠️ | JWT signing only with OAuth webhooks | Personal-token webhooks don't get JWT signing; OAuth ones do. Ships a trust-boundary gap if we use personal token. | Use OAuth from day 1 OR document the trust boundary explicitly | open |
| M5 | ⚠️ | items_page cursor expires after ~60 min | Pagination state can't be held indefinitely; long-running list operations need re-fetching | Document in implementation plan | open |
| M6 | ⚠️ | Column IDs change on board duplication | If Jay duplicates his Monday board, our hardcoded column IDs break | Store column TITLES as a fallback lookup | open |
| M7 | 💡 | Complexity budget is the real limit | Not request count — query complexity (5M points / single query, 10M / minute on personal tokens) | Always use `column_values(ids: [...])` not unfiltered `column_values` | open |
| M8 | 💡 | Use change_simple_column_value for status | Easier than column_values JSON for status changes | Use in implementation | open |
| M9 | 💡 | Deprecated SDK warning | `monday-sdk-js` server portion is being removed in v1.0.0 — top Google result is wrong | Use `@mondaydotcomorg/api` instead | open |
| M10 | 💡 | Monday's own MCP server is best reference | `github.com/mondaycom/mcp` is the closest reference impl to what Sally is doing | Read its source as a "what good looks like" guide | open |

### From Google Drive/Meet/Gemini Research (general-purpose agent, 2026-04-07)

| # | Severity | Title | Description | Action Required | Status |
|---|---|---|---|---|---|
| G1 | 🚨 | Workspace tier required for Gemini | Jay needs Business Standard+ (or Gemini add-on). Personal Gmail won't work for Gemini features. | Chris decision 2026-04-07: assume Tiger has Business Standard+. Not blocking v1 (heat scoring is v2). Verify before v2 scope. | deferred |
| G2 | 🚨 | CASA verification timeline | `drive.readonly` is a Restricted Scope. Google security assessment takes 4-8 weeks. | Start CASA verification on day 1 of build if heat scoring is in scope for v1 | open |
| G3 | 🚨 | Meet API is dead end for our use case | meet.googleapis.com only sees conferences the API itself created — Calendar-scheduled meets aren't enumerable | Use Drive API as the ingestion path, not Meet API | open |
| G4 | ⚠️ | Gemini Doc generation latency | Up to 5-60 minutes after meeting end; not real-time | Don't tie UX to instant detection | open |
| G5 | ⚠️ | Drive webhook channel auto-expires | `changes.watch` channel max 7 days, no auto-renewal | Cron job to renew every 6 days | open |
| G6 | ⚠️ | Two-party consent states | CA, CT, DE, FL, IL, MD, MA, MI, MT, NV, NH, PA, WA require all-party consent for recording | Jay should verbally acknowledge "I'm using AI notes" at the start of each call | open |
| G7 | ⚠️ | drive.readonly is broad | Sally would technically see Jay's entire Drive (privacy concern) | Document scope limit clearly; consider service account + DWD for v2 | open |
| G8 | 💡 | Gemini Notes vs Transcript | Two different artifacts — Notes (summary, structured) vs Transcript (verbatim, speaker-labeled) | Use Notes as primary signal source, Transcript as fallback | open |
| G9 | 💡 | Per-meeting dependency | Gemini notes only generate if host enables per meeting (or org auto-on) | Confirm Jay has it auto-enabled or build a "did you forget?" reminder | open |
| G10 | 💡 | Negligible Gemini API costs | ~$0.02-0.05 per discovery call analyzed | No financial concern at pilot scale | open |

### From Codebase Sally Search (Explore agent, 2026-04-07)

| # | Severity | Title | Description | Action Required | Status |
|---|---|---|---|---|---|
| C1 | 💡 | No Sally file exists | Codebase has zero Sally implementation; only strategy docs in `Franchise Hero Docs/` | Create `swarm/agents/sally-sales-rep.md` persona file in build phase | open |
| C2 | 💡 | 80% of Sally's brain already built | Existing `sales-pipeline.md`, `lead-intelligence.md`, `email.md`, `cro.md`, `dispatch-rules.json` cover most of Sally's logic | Wrap existing agents into Sally persona, don't rebuild | open |
| C3 | 💡 | ZorSpace Mindmap has Sally v2 features | Lines 28-35 of `docs/ZorSpace Mindmap.md` describe transcript-based call coaching, performance scoring, script generation | Park as v2 features, not v1 | open |
| C4 | 💡 | No Monday integration exists | Zero existing Monday.com code in repo | Greenfield build for Monday integration | open |
| C5 | 💡 | Jeff's swarm uses event-driven architecture | `agent-executor.ts`, `event-bus.ts`, `dispatch-rules.json` already wire `lead.created → lead.scored → followup.requested → email_campaign.generated` | Sally hooks into existing event bus, doesn't need its own | open |

### From Tiger Adjusters Research (general-purpose agent, 2026-04-07)

| # | Severity | Title | Description | Action Required | Status |
|---|---|---|---|---|---|
| T1 | ⚠️ | "Jay" name disambiguation | Jared Harrell (official VP per Tiger website) vs Jessie Hernandez (also publicly claims VP on LinkedIn) | RESOLVED — confirmed Jared Harrell on live call with Chris | fixed |
| T2 | ⚠️ | Lead bifurcation needed | Tiger has two wildly different buyer personas (licensed adjusters vs unlicensed career-changers) — sales conversations differ completely | Sally's first 2 questions should fork the path: "Are you licensed?" "What state?" | open |
| T3 | ⚠️ | 31-state qualifier | Only 31 US states allow public adjusters | Build state-allowed list as a Sally constant; auto-disqualify AL, AR, etc. | open |
| T4 | 💡 | $861K Item 19 = closing weapon | Philly franchisee disclosed $861K revenue / $655K profit; Tiger's strongest social proof | Sally should know exactly when to deploy this stat in sequences | open |
| T5 | 💡 | Education > qualification | 99% of public adjusting buyers don't understand the category; Sally needs an explainer module before asking for capital | Build "what is a public adjuster" intro flow | open |
| T6 | 💡 | OPPAGA 747% stat | Tiger's homepage hero stat — public adjusters get 747% larger settlements (OPPAGA 2010) | Embed in Sally's intro email template | open |

### From Live Call with Jay (Chris's notes, 2026-04-07)

| # | Severity | Title | Description | Action Required | Status |
|---|---|---|---|---|---|
| J1 | 🚨 | NDA drop-off is #1 revenue killer | Leads say "I'll read the NDA" then ghost — biggest stage drop-off | Deferred to v1.1 per Apr 20 scope reduction to Broker Shield only | deferred |
| J2 | 🚨 | Intro call booking drop-off is #2 | Leads arrive in Monday, get the intro email + booking link, never click | Deferred to v1.1 per Apr 20 scope reduction to Broker Shield only | deferred |
| J3 | 🚨 | Brokers consume Jay's week | "Kids in the fucking car asking 'are we there yet'" — broker update requests are constant pain | Sally v1 MUST include automated broker status updates | open |
| J4 | ⚠️ | Validation Call goes at end of pipeline | Pipeline is: Intro → NDA → FDD → Debrief → Corporate → National Trainer → Validation → Close | Updated stage map in README | fixed |
| J5 | 💡 | Speed-to-first-reply is already immediate | Intro email auto-fires when lead hits Monday board | Sally doesn't need to fix speed; needs to fix conversion (booking rate) | open |
| J6 | 💡 | Pipeline is partially automated already | Some stages fire emails today; Sally augments rather than replaces | Audit existing automations before adding new ones to avoid duplicates | open |

---

## Phase 9: Adversarial Review Findings (2026-04-07)

**Full details in `09-adversarial-findings.md`.** Summary of critical findings only:

### 🚨 P0 Launch Blockers (7)

| # | Title | Source | Action |
|---|---|---|---|
| P0-1 | Resend has no inbound email — reply detection architecturally impossible | feasibility + 4 others | Pick new inbound path before Phase 4 |
| P0-2 | Approval UI auth undefined — Clerk is disabled | security + feasibility | Re-enable Clerk or build Sally auth |
| P0-3 | Monday webhook JWT not enforced as hard gate | security | Hard-fail verification + HMAC fallback |
| P0-4 | /api endpoints no per-tenant authorization | security | Define auth per route in Phase 4 |
| P0-5 | Cold start will blast brokers on day one | adversarial | Add synced_at grace window |
| P0-6 | LLM hallucination → FTC Franchise Rule liability | adversarial | Hard prompt guards + content linter |
| P0-7 | Prompt injection via Monday fields wide open | adversarial + security | Untrusted delimiters + output validator |

### Cross-reviewer consensus themes

1. **Reply detection is the weakest link** (5 of 7 reviewers)
2. **Scope too big for 2-3 weeks** (3 of 7 reviewers — scope, product, adversarial)
3. **Vercel Functions is wrong shape** (3 of 7 reviewers)
4. **Multi-tenant is premature** (3 of 7 reviewers)
5. **AI slop risk** (2 of 7 reviewers)
6. **Approval rubber-stamping** (2 of 7 reviewers)
7. **Open Design Questions contradict Phase 2 locked decisions** (coherence: 4 findings)

### Total findings across 7 reviewers

- **87 findings** (7 P0, 34 P1, 35 P2, 11 P3)
- **28 residual risks**
- **42 deferred questions**
- **1 auto-fix applied** (M/D notation legend in system-design.md)

### Chris's TDD instruction (2026-04-07 interrupt)

**"design tests first AND document them"** — added as hard constraint:

| # | Severity | Requirement | Phase |
|---|---|---|---|
| TDD-1 | 🚨 Critical | Phase 4 (Contracts) must include test contracts — exact test cases, inputs, outputs, assertions per component | 4 |
| TDD-2 | 🚨 Critical | Phase 5 (Implementation) must lead with test design — tests written BEFORE code | 5 |
| TDD-3 | 🚨 Critical | Every component must have integration tests, not just unit tests (per Lesson 1 of the planning system) | 5 |
| TDD-4 | 🚨 Critical | Every formula/calculation must have worked-example tests (per Lesson 2) | 5 |

---

## Phase 2: Decision Framework Resolutions (2026-04-07)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Build tier | ~~Option B — Pilot Plus~~ **SUPERSEDED** → Claude Managed Agents (Apr 20 pivot) | OAuth on day 1, multi-tenant ready — replaced by Managed Agents architecture |
| D2 | Monday auth | ~~OAuth 2.0 from day 1~~ **SUPERSEDED** → Monday MCP server handles auth (Apr 20 pivot) | Managed Agents handles credential management |
| D3 | Monday change detection | ~~Hybrid webhooks + 5-min polling fallback~~ **SUPERSEDED** → Sally polls via MCP on cron trigger (Apr 20 pivot) | No webhooks needed |
| D4 | Language | Node.js 20+ + TypeScript | Official SDK is best in Node; matches Next.js frontend |
| D5 | Integration model | ~~External (separate Sally backend)~~ **SUPERSEDED** → Claude Managed Agent (Apr 20 pivot) | No separate backend; Anthropic hosts the agent |
| D6 | Heat scoring | Deferred to v2 | Requires Google CASA verification (4-8 weeks) and isn't the wedge |
| D7 | Monday plan tier | Assume Standard+ (Jay pilot) | Chris override: verify before customer #2 |
| D8 | Google Workspace | Assume Business Standard+ | Chris override: not blocking v1 since heat scoring is v2 |
| D9 | Monday marketplace listing | Parked for v2 | Future GTM direction; architecture doesn't foreclose it |
| D10 | Backend framework | Hono | Modern TS, Vercel-native, cleaner than Express |
| D11 | Deployment target | Vercel Functions | Tight integration with existing dashboard-app, zero-config |
| D12 | LLM model split | Sonnet 4.6 for drafting, Haiku 4.5 for classification | ~80% LLM cost savings without quality loss |
| D13 | Approval timeout behavior | Daily digest nudge (Option C) | Gentle pressure without stale drafts |
| D14 | Chris-as-admin during pilot | YES, with audit trail labels "approved by operator on behalf of Jay" | Faster pilot iteration, full transparency |

---

## Findings Summary

- **Total findings:** 36 (+ 9 Phase 2 decisions)
- **Critical 🚨:** 7 (2 fixed, 2 deferred, 3 still need design work — J1, J2, J3 = v1 scope)
- **Warning ⚠️:** 13 (12 open, 1 fixed)
- **Observation 💡:** 16 (all open, informing design phases)
- **Fixed:** 3
- **Deferred:** 2

**Next blockers (must resolve before build starts):**
1. J1, J2, J3 — V1 scope locked, templated sequences designed in Phase 5
2. Open questions from Phase 3 (coming next) — framework, deployment target, LLM model selection

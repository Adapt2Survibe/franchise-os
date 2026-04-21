# Sally v1 — Planning Directory

Sally is the first deployable AI employee from the Franchise Hero product line. She is a sales rep for franchise development, designed for franchisors who run their candidate pipeline in Monday.com.

**Pilot customer:** Jay (Jared Harrell), VP of Franchise Development, Tiger Adjusters
**Build approach:** Chris's planning system (10-phase workflow)
**Status:** Phase 1-3 complete → Phase 9 (Adversarial Audit) COMPLETE → HALTED for Chris review (2026-04-07)
**Phase 9 result:** 87 findings across 7 reviewers, 7 P0 launch blockers, strong cross-reviewer consensus on scope reduction. Full details in `09-adversarial-findings.md`. Chris to make strategic decisions before Phase 4 proceeds.
**TDD requirement (Chris interrupt):** Tests must be designed AND documented FIRST. Applies to Phase 4 (test contracts) and Phase 5 (tests before code).
**Build tier decided:** **Option B — Pilot Plus** (OAuth-first, multi-tenant scaffolding, 2-3 week ship target)
**Started:** 2026-04-07

---

## Future Strategic Direction — Monday Marketplace GTM (v2+)

Discovered during Phase 1 research: Monday.com has an app marketplace that lets users install third-party apps directly inside their Monday workspace. **This is a potential GTM unlock:** if Sally becomes a listed Monday app, every Monday user becomes a potential Sally user with zero outbound required. Install-from-inside-the-CRM is the cleanest possible distribution model.

This is NOT in scope for v1, but the v1 architecture must not foreclose it:
- OAuth 2.0 (not personal tokens) — **required** for marketplace listing ✅ (Option B chooses this)
- External integration model (separate backend, not Monday Apps Framework) — fine for now
- Multi-tenant database with tenant_id everywhere — ✅ (Option B chooses this)

Parking this for v2 exploration after Jay's pilot validates the wedge.

---

## Sally v1 Scope (Two Features Only)

Sally v1 ships with exactly two features, both targeted at Jay's confirmed pain (validated live on a call 2026-04-07):

### 🛡️ Feature 1: The Broker Shield
Sally watches Jay's Monday board 24/7. The instant a lead changes stage, has activity, or hits a milestone, Sally automatically sends the referring broker a professional status update under Jay's name. Jay never writes another "are we there yet" reply.

### 🕳️ Feature 2: The Stall Recovery Bot
Sally watches the two confirmed dead-zones in Tiger's pipeline:
- **Intro Call drop-off** — leads arrive in Monday but never click the booking link
- **NDA drop-off** — leads receive the NDA, say "I'll read it," then ghost

When a lead goes silent in either zone, Sally fires a multi-touch recovery sequence (day 3, 7, 12, 20) until the lead either responds or explicitly opts out.

### Out of Scope for v1 (parked for v2)
- Heat scoring from call transcripts (depends on Google CASA verification timeline)
- Real-time call coaching / script generation
- Performance scoring of FranDev reps
- Multi-CRM support (HubSpot, GHL, etc.)
- Broker portal (read-only view for brokers)

---

## Planning Documents

| Phase | Document | Status |
|---|---|---|
| 1 | `00-research-monday-api.md` | ✅ Complete |
| 1 | `00-research-google-transcripts.md` | ✅ Complete |
| 2 | `01-decision-framework.md` | 🟡 In progress |
| 3 | `02-system-design.md` | ⏳ Pending |
| 4 | `03-contracts.md` | ⏳ Pending |
| 4b | `04-proof-of-concept.md` | ⏳ Pending |
| 5 | `05-implementation-plan.md` | ⏳ Pending |
| 6 | `06-cohesion-review.md` | ⏳ Pending |
| 7 | `07-ux-spec.md` | ⏳ Pending |
| 8 | `08-intelligence-layer.md` | ⏳ Pending |
| 9 | `09-adversarial-audit.md` | ⏳ Pending |
| 10 | `10-final-build-plan.md` | ⏳ Pending |
| - | `ALL_FINDINGS_TRACKER.md` | 🟢 Live (mandatory) |
| - | `loom-script-v1.md` | ✅ Drafted (in chat) |

---

## What Jay Needs to Provide

These are the assets Sally v1 needs from Jay before the build can finish. Chris will collect these in the next 24-48 hours:

1. View-only access to his Monday board (or a personal API token for the POC)
2. List of his top 5 brokers — names + emails + the leads they've referred so far
3. A copy of the current NDA Tiger sends to candidates
4. A copy of the first intro email template currently auto-firing in Monday
5. **Confirmation of Monday plan tier** (must be Standard+ for API access — see ALL_FINDINGS_TRACKER M1)
6. **Confirmation of Tiger's Google Workspace tier** (must be Business Standard+ for Gemini features — see ALL_FINDINGS_TRACKER G1)
7. 30-minute screen share of his actual Monday board
8. Verbal opt-in for two-party consent jurisdictions (see ALL_FINDINGS_TRACKER G6)

---

## Critical Constraints (Hard Rules)

- ❌ Sally cannot replace Jay or any human — she enhances them. (Franchise Hero brand rule.)
- ❌ Sally cannot send emails autonomously in Phase 1 — approval mode only until Jay opts in.
- ❌ Sally must obey two-party consent laws (CA, CT, DE, FL, IL, MD, MA, MI, MT, NV, NH, PA, WA) for transcript reading.
- ✅ Sally must make Jay's existing workflow easier without forcing him to change tools or process.
- ✅ Sally must work inside Jay's existing Monday board, not require migration to a new system.
- ✅ Every Sally deliverable (email, broker update, recovery sequence) must be reviewable by Jay before it sends in v1.

---

## Pipeline Reference (Tiger Adjusters)

Confirmed by Jay on 2026-04-07 call. Sally must be aware of these stages:

```
Intro Call → Send NDA → Send FDD → Debrief Call → Corporate Call → National Trainer Call → Validation Call → 🎉 Close
```

Side lanes:
- **Journey/Drip Campaign** — automated nurture for cold/slow leads
- **Courtesy Call/Text** — mid-stage check-ins
- **Follow-Up / Follow-Up Text** — tactical nudges
- **None** — dead/closed

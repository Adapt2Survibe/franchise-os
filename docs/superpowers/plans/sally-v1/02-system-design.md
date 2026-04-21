# Phase 3: System Design — Sally v1

**Decision locked 2026-04-07:** Option B (Pilot Plus)
**Ship target:** 2-3 weeks
**Pilot:** Jay @ Tiger Adjusters

---

## System Overview

Sally v1 is an **event-driven AI sales employee** that lives as a standalone Node.js/TypeScript service. She integrates with Monday.com (CRM), Resend (email delivery), Supabase (state), Claude (language model), and the existing FranchiseOS Next.js dashboard (approval UI).

Her job on day one is narrow and focused: two features, nothing more.

1. **🛡️ The Broker Shield** — Watches Monday for any lead activity, generates a professional broker status update, drops it in an approval queue for Jay, and sends upon approval.
2. **🕳️ The Stall Recovery Bot** — Detects leads stuck in the "Intro Call" (unbooked) or "Send NDA" (ghosted) stages and fires a scheduled multi-touch recovery sequence.

Every email Sally generates goes through Jay's approval queue in v1 (no autonomous sending until trust is earned). Every action is logged to an audit trail.

---

## Component Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SYSTEMS                             │
│                                                                       │
│   ┌──────────────┐       ┌──────────────┐       ┌──────────────┐    │
│   │  Monday.com  │       │   Resend     │       │   Claude API │    │
│   │  (CRM)       │       │  (Email)     │       │  (LLM)       │    │
│   └───────┬──────┘       └──────┬───────┘       └──────┬───────┘    │
└───────────┼─────────────────────┼──────────────────────┼────────────┘
            │ webhooks + API      │ send email           │ generate
            │                     │                      │
┌───────────▼─────────────────────▼──────────────────────▼────────────┐
│                        SALLY CORE SERVICE                            │
│                    (Node.js + TypeScript + Hono)                     │
│                                                                       │
│   ┌──────────────────┐   ┌──────────────────┐   ┌─────────────────┐ │
│   │  Webhook         │   │  OAuth           │   │  API Routes     │ │
│   │  Receiver        │   │  Handler         │   │  /drafts /send  │ │
│   └────────┬─────────┘   └────────┬─────────┘   └────────┬────────┘ │
│            │                      │                      │           │
│            ▼                      ▼                      ▼           │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │                       EVENT BUS                             │    │
│   │  (classifies incoming events, routes to right handler)      │    │
│   └──┬──────────────────┬─────────────────┬──────────────────┬──┘    │
│      │                  │                 │                  │       │
│      ▼                  ▼                 ▼                  ▼       │
│   ┌────────┐        ┌────────┐       ┌────────┐        ┌────────┐   │
│   │Broker  │        │Stall   │       │Sequence│        │Audit   │   │
│   │Shield  │        │Detector│       │Runner  │        │Logger  │   │
│   └───┬────┘        └───┬────┘       └───┬────┘        └───┬────┘   │
│       │                 │                │                  │       │
│       └─────────────────┴────────────────┘                  │       │
│                         │                                    │       │
│                         ▼                                    │       │
│               ┌──────────────────┐                           │       │
│               │   Sally Brain    │                           │       │
│               │  (LLM drafting)  │                           │       │
│               └────────┬─────────┘                           │       │
│                        │                                     │       │
│                        ▼                                     │       │
│               ┌──────────────────┐                           │       │
│               │  Approval Queue  │◀──────────────────────────┘       │
│               │  (drafts table)  │                                   │
│               └────────┬─────────┘                                   │
│                        │ approved                                    │
│                        ▼                                             │
│               ┌──────────────────┐                                   │
│               │  Email Sender    │───▶ Resend API                   │
│               └──────────────────┘                                   │
│                                                                      │
└──────────────────────┬──────────────────────────────┬───────────────┘
                       │                              │
                       ▼                              ▼
         ┌────────────────────────┐     ┌────────────────────────┐
         │  Supabase Postgres     │     │  Next.js Dashboard     │
         │  (tenants, leads,      │     │  /sally (approval UI)  │
         │   brokers, sequences,  │     │  — Jay logs in here    │
         │   drafts, audit log)   │     │                        │
         └────────────────────────┘     └────────────────────────┘

         ┌────────────────────────────────────────────────────────┐
         │  Background Workers (cron / scheduled)                 │
         │  • poll-monday.ts — fallback polling every 5 min       │
         │  • send-sequences.ts — fires scheduled sequence touches│
         │  • renew-webhooks.ts — refreshes Monday webhooks       │
         └────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Sally Core Service (`sally/` backend)
The main HTTP server. Receives webhooks, hosts OAuth callbacks, exposes the approval API. Written in Node.js 20+ with TypeScript, using Hono (or Express) as the web framework. Deployed as Vercel Functions or a Railway container.

### 2. Monday Integration (`sally/src/services/monday/`)
Handles all Monday.com communication:
- **OAuth handler** — redirects Jay to Monday for consent, stores access + refresh tokens encrypted in Supabase
- **Webhook receiver** — handles the `{challenge}` handshake, verifies JWT signature, routes events to the event bus
- **GraphQL client** — wraps `@mondaydotcomorg/api` for typed reads/writes
- **Webhook registration** — programmatically creates `change_status_column_value`, `create_update`, and `change_column_value` webhooks after OAuth grant

### 3. Email Engine (`sally/src/services/email/`)
Handles all email sending via Resend:
- **Template renderer** — loads templates for broker updates and stall recovery sequences
- **Delivery tracking** — uses Resend webhooks for opens, clicks, bounces
- **Reply detection** — parses Resend inbound webhook; when a reply is detected, automatically stops the active sequence for that lead

### 4. Sally Brain (`sally/src/services/brain/`)
The LLM-powered decision engine:
- **Event classifier** — takes an incoming Monday event and decides: "is this a stage change that needs a broker update?", "is this a lead moving INTO a risk stage that needs stall monitoring?", "is this something I should ignore?"
- **Email drafter** — generates broker update emails and recovery sequence emails in Jay's voice, using master prompts and lead context
- **Prompts library** — one prompt per decision type, versioned alongside code

### 5. Sequence Engine (`sally/src/services/sequences/`)
Manages multi-touch recovery campaigns:
- **Scheduler** — writes `next_touch_at` timestamps to the `sequences` table
- **Sequence definitions** — YAML or TypeScript config for the NDA recovery and intro booking recovery sequences (day 3, 7, 12, 20)
- **Runner** — background worker that fires due touches
- **Stop conditions** — reply detected, manual opt-out, sequence complete, stage advanced

### 6. Broker Update Engine (`sally/src/services/brokers/`)
Watches for any significant lead activity, maps the lead to its referring broker, generates a status update draft, drops it in the approval queue. Handles broker-to-lead mapping via a Monday column (broker name) or a tenant-scoped `brokers` table.

### 7. Approval UI (`dashboard-app/src/app/sally/`)
A new section of the existing Next.js dashboard where Jay reviews Sally's drafts. Minimal UI in v1:
- **Inbox view** — list of pending drafts sorted by urgency
- **Draft preview** — full email preview with recipient, subject, body
- **One-click actions** — Approve & Send / Reject / Edit & Send
- **Monday OAuth setup page** — "Connect Monday" button + broker list management
- **Audit log view** — what Sally did over time (v1 basic, improved later)

### 8. Supabase Database (`supabase/migrations/20260407_sally_v1.sql`)
New tables added to the existing Supabase instance (piggybacks on FranchiseOS schema). All tables include `tenant_id` for multi-tenant isolation via RLS.

### 9. Background Workers (`sally/src/workers/`)
Scheduled jobs that keep Sally running:
- **poll-monday.ts** — every 5 min, reconciles board state in case webhooks missed an event
- **send-sequences.ts** — every minute, fires any sequence touches due in the last minute
- **renew-webhooks.ts** — daily, refreshes any Monday webhook subscriptions approaching expiry

---

## Data Flow

### Flow 1: Stage Change → Broker Update

```
1. Jay (or anyone) moves a lead in Monday from "Send NDA" → "Send FDD"
2. Monday fires `change_status_column_value` webhook → Sally webhook receiver
3. Event bus classifies: "stage change, relevant to Broker Shield"
4. Broker Shield component:
   a. Looks up the lead's referring broker in the brokers table
   b. Pulls lead context from Monday (name, current stage, time in stage, recent activity)
   c. Calls Sally Brain with broker_update prompt + context
5. Sally Brain returns draft email:
   { subject, body, to, from }
6. Draft saved to drafts table with status='pending'
7. Jay sees new draft in approval UI within 10 sec
8. Jay clicks "Approve & Send"
9. Email Engine sends via Resend, updates drafts.status='sent'
10. Audit log entry created: { action: 'broker_update_sent', lead_id, broker_id, ... }
```

### Flow 2: Lead Enters Risk Stage → Sequence Starts

```
1. New lead hits Monday board in status "Intro Call" (or is moved to "Send NDA")
2. Monday fires `create_item` or `change_status_column_value` webhook
3. Event bus classifies: "lead entered risk stage, Stall Detector"
4. Stall Detector:
   a. Checks if lead already has an active sequence (dedupe)
   b. Creates new sequences row: { type: 'nda_recovery' or 'intro_booking_recovery',
                                    current_step: 0, next_touch_at: now + 3 days }
   c. Logs audit entry
5. Nothing sent yet. Sally waits.
```

### Flow 3: Sequence Scheduled Touch Fires

```
1. Background worker send-sequences.ts runs every minute
2. Queries: SELECT * FROM sequences WHERE status='active' AND next_touch_at <= NOW()
3. For each due sequence:
   a. Pull current lead state from Monday (has the stage changed? exit condition?)
   b. If lead has moved out of risk stage: mark sequence status='completed', stop
   c. Otherwise call Sally Brain with step-specific prompt (day 3 email, day 7 email, etc.)
   d. Draft saved to drafts table with status='pending'
   e. Update sequences.current_step, next_touch_at = next interval
4. Jay sees draft in approval queue, approves, email sends
```

### Flow 4: Reply Detected → Stop Sequence

```
1. Candidate replies to Sally's email
2. Resend fires inbound webhook → Sally webhook receiver
3. Event bus: "inbound email, match to lead by thread_id or from address"
4. Reply handler:
   a. Finds matching lead + active sequence
   b. Marks sequence.status = 'responded'
   c. Logs audit entry
   d. Drops a "Candidate replied!" notification into Jay's Monday board (add update to the item)
5. No further touches sent
```

---

## Tech Stack (Locked for Option B)

| Layer | Technology | Why |
|---|---|---|
| Language | Node.js 20+ + TypeScript | Official Monday SDK is best in Node; matches dashboard-app |
| Web framework | **Hono** (open for Chris review) | Cleaner TS than Express, Vercel-compatible, fast |
| Database | Supabase Postgres (existing) | Already in the stack; RLS for multi-tenant |
| Email delivery | Resend | Clean API, reply webhooks, great deliverability |
| Monday SDK | `@mondaydotcomorg/api` | Official; monday-sdk-js is deprecated |
| LLM | Claude via `@anthropic-ai/sdk` | Already in the stack per FranchiseOS CLAUDE.md |
| LLM model choice | Sonnet 4.6 for drafting, Haiku for classification (open) | Balance cost vs. quality |
| Frontend | Next.js 16 (existing dashboard-app) | New `/sally` route inside existing dashboard |
| Deployment (backend) | **Vercel Functions** or **Railway** (open) | Vercel = tight with Next.js; Railway = better for long-running workers |
| Deployment (frontend) | Vercel (existing) | Already deployed |
| Secrets | Supabase vault + env vars | Don't commit tokens |

---

## File Structure

```
franchise-os/
├── dashboard-app/                             (existing Next.js 16)
│   └── src/app/sally/                         (NEW — approval UI)
│       ├── page.tsx                           # Sally dashboard home
│       ├── layout.tsx                         # Sally-specific layout
│       ├── inbox/
│       │   └── page.tsx                       # Pending drafts
│       ├── drafts/
│       │   └── [id]/
│       │       └── page.tsx                   # Single draft preview
│       ├── brokers/
│       │   └── page.tsx                       # Manage broker list
│       ├── settings/
│       │   ├── monday/
│       │   │   └── page.tsx                   # Monday OAuth setup
│       │   └── page.tsx                       # Sally settings
│       └── audit/
│           └── page.tsx                       # What Sally did
│
├── sally/                                     (NEW — Sally backend service)
│   ├── src/
│   │   ├── index.ts                           # Hono app entrypoint
│   │   ├── routes/
│   │   │   ├── webhooks/
│   │   │   │   ├── monday.ts                  # Monday webhook receiver + challenge
│   │   │   │   └── resend.ts                  # Resend inbound webhooks (replies)
│   │   │   ├── oauth/
│   │   │   │   └── monday.ts                  # OAuth callback
│   │   │   └── api/
│   │   │       ├── drafts.ts                  # GET/POST approval queue
│   │   │       ├── approve.ts                 # Approve and send
│   │   │       └── tenants.ts                 # Tenant management
│   │   ├── services/
│   │   │   ├── monday/
│   │   │   │   ├── client.ts                  # GraphQL wrapper
│   │   │   │   ├── oauth.ts                   # Token lifecycle
│   │   │   │   ├── webhooks.ts                # Webhook registration/verification
│   │   │   │   └── queries.ts                 # Reusable GraphQL queries
│   │   │   ├── email/
│   │   │   │   ├── resend.ts                  # Resend client
│   │   │   │   ├── templates.ts               # Template renderer
│   │   │   │   └── reply-detector.ts          # Inbound webhook handler
│   │   │   ├── brain/
│   │   │   │   ├── classifier.ts              # Event classification
│   │   │   │   ├── drafter.ts                 # LLM email generation
│   │   │   │   └── prompts/
│   │   │   │       ├── broker-update.md       # Master prompt
│   │   │   │       ├── nda-recovery.md        # Stall sequence prompts
│   │   │   │       └── intro-recovery.md
│   │   │   ├── brokers/
│   │   │   │   └── shield.ts                  # Broker Shield handler
│   │   │   └── sequences/
│   │   │       ├── detector.ts                # Stall detection logic
│   │   │       ├── runner.ts                  # Fires scheduled touches
│   │   │       └── definitions/
│   │   │           ├── nda-recovery.ts
│   │   │           └── intro-booking-recovery.ts
│   │   ├── workers/
│   │   │   ├── poll-monday.ts                 # 5-min polling fallback
│   │   │   ├── send-sequences.ts              # Fire due sequence touches
│   │   │   └── renew-webhooks.ts              # Daily webhook refresh
│   │   └── lib/
│   │       ├── db.ts                          # Supabase client (server-side)
│   │       ├── logger.ts                      # Structured logging
│   │       └── types.ts                       # Shared types
│   ├── tests/
│   │   ├── poc/                               # Phase 4b proof-of-concepts
│   │   │   ├── monday-oauth-flow.ts
│   │   │   ├── monday-webhook-challenge.ts
│   │   │   ├── resend-send-and-reply.ts
│   │   │   └── end-to-end-stall-recovery.ts
│   │   ├── unit/
│   │   └── integration/
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
│
├── supabase/
│   └── migrations/
│       └── 20260407_sally_v1.sql              # NEW schema
│
└── docs/superpowers/plans/sally-v1/           (planning directory — already exists)
    ├── README.md
    ├── 00-research-monday-api.md
    ├── 00-research-google-transcripts.md
    ├── 02-system-design.md                    # THIS FILE
    └── ALL_FINDINGS_TRACKER.md
```

---

## Database Schema (High Level)

```sql
-- Tenants (organizations using Sally, keyed to Monday account)
CREATE TABLE sally_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monday_account_id text UNIQUE NOT NULL,
  monday_user_id bigint,
  display_name text,
  monday_access_token text,         -- encrypted at rest
  monday_refresh_token text,        -- encrypted at rest
  oauth_granted_at timestamptz,
  monday_board_id bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Brokers (per tenant)
CREATE TABLE sally_brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES sally_tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  organization text,                -- e.g., "IFPG", "FranServe"
  monday_broker_column_value text,  -- how we match Monday items to this broker
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Leads (synced from Monday items)
CREATE TABLE sally_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES sally_tenants(id) ON DELETE CASCADE,
  monday_item_id bigint NOT NULL,
  monday_board_id bigint NOT NULL,
  name text,
  email text,
  phone text,
  broker_id uuid REFERENCES sally_brokers(id),
  current_stage text,                -- e.g., "Send NDA", "Intro Call"
  stage_entered_at timestamptz,
  last_activity_at timestamptz,
  raw_monday_data jsonb,             -- full column_values snapshot
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, monday_item_id)
);

-- Sequences (multi-touch recovery campaigns)
CREATE TABLE sally_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES sally_tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES sally_leads(id) ON DELETE CASCADE,
  sequence_type text NOT NULL,       -- 'nda_recovery' | 'intro_booking_recovery'
  current_step int DEFAULT 0,
  next_touch_at timestamptz,
  status text DEFAULT 'active',      -- 'active' | 'completed' | 'opted_out' | 'responded' | 'paused'
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  completion_reason text             -- 'replied' | 'stage_advanced' | 'max_touches' | 'manual_stop'
);

-- Drafts (approval queue)
CREATE TABLE sally_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES sally_tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES sally_leads(id),
  sequence_id uuid REFERENCES sally_sequences(id),
  draft_type text NOT NULL,          -- 'broker_update' | 'stall_recovery' | 'intro_recovery'
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  sender_name text,                  -- e.g., "Jay (via Sally)"
  status text DEFAULT 'pending',     -- 'pending' | 'approved' | 'sent' | 'rejected' | 'edited'
  llm_model text,                    -- which model drafted it
  llm_prompt_version text,           -- for A/B testing prompts later
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  sent_at timestamptz,
  approved_by text,
  resend_message_id text             -- for tracking delivery
);

-- Audit log
CREATE TABLE sally_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES sally_tenants(id) ON DELETE CASCADE,
  entity_type text,                  -- 'lead' | 'sequence' | 'draft' | 'tenant'
  entity_id uuid,
  action text NOT NULL,              -- 'created' | 'approved' | 'sent' | 'replied' | etc.
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Monday webhook subscriptions (so we can renew them)
CREATE TABLE sally_monday_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES sally_tenants(id) ON DELETE CASCADE,
  monday_webhook_id bigint,
  board_id bigint,
  event_type text,                   -- 'change_status_column_value' etc.
  created_at timestamptz DEFAULT now()
);

-- Row-level security: every table scoped by tenant_id
-- (Full RLS policies defined in migration file)
```

---

## Feedback Loops (Intelligence Layer Preview)

Per the planning system rule: every non-trivial system should have feedback loops. Sally v1 seeds these loops so Phase 8 can formalize them:

1. **Approval pattern loop** — every time Jay rejects or edits a draft, log the before/after. Weekly analysis reveals which prompts need tuning.
2. **Sequence effectiveness loop** — track reply rate and stage-advance rate per sequence type. If NDA recovery is at 10% but intro recovery is at 35%, the NDA prompt needs work.
3. **Broker engagement loop** — track open rate and reply rate on broker update emails by broker. Identifies brokers who stopped engaging (signal they're burning out on updates).
4. **Audit meta-analysis loop** — weekly cron job reads the audit log and surfaces anomalies (Sally silent for 24h? Draft queue growing without approval? High rejection rate?).

---

## Human Touchpoints

| Who | What they do | Where |
|---|---|---|
| **Jay (pilot customer)** | Connects Monday via OAuth | `/sally/settings/monday` |
| **Jay** | Manages his broker list | `/sally/brokers` |
| **Jay** | Approves / rejects / edits drafts | `/sally/inbox` |
| **Jay** | Reviews what Sally did this week | `/sally/audit` |
| **Chris (operator)** | Monitors all tenants' audit logs | `/sally/audit?tenant=all` (admin view) |
| **Chris** | Tunes prompts when rejection rate climbs | `sally/src/services/brain/prompts/` |
| **Chris** | Approves new tenant onboarding | `/sally/settings` (admin) |

---

## Open Design Questions (for Chris to decide before Phase 4)

These are design choices that change the Phase 4 contracts:

### Q1: Hono or Express for the Sally backend?
- **Hono** — newer, built for TS, faster cold starts, Vercel Functions-native, less community content
- **Express** — battle-tested, huge ecosystem, slightly more verbose TS

**My recommendation:** Hono. Modern, clean, matches the Next.js 16 feel. But Express is safer if Chris wants to find more tutorials.

### Q2: Deployment target for Sally backend?
- **Vercel Functions** — tightest integration with dashboard-app, zero-config, but 10-sec timeout on hobby, 60-sec on pro. Background workers need Vercel Cron (pro feature).
- **Railway** — long-running containers, cron jobs included, more flexible for background workers, ~$5-20/mo
- **Hybrid** — Vercel Functions for webhooks/API, Railway for workers

**My recommendation:** Start on Vercel Functions since the webhook + API workload fits. Move workers to Railway only if timeouts become a problem.

### Q3: Which Claude model for drafts vs. classification?
- **Drafts** — Sonnet 4.6 (~$3/M in, $15/M out) — high-quality email writing
- **Classification** — Haiku 4.5 (~$0.25/M in, $1.25/M out) — fast, cheap for "is this a broker-update event?"
- **All Sonnet** — simpler, slightly more expensive, higher quality everywhere
- **All Haiku** — cheapest, may produce lower-quality drafts

**My recommendation:** Mixed — Sonnet for drafts, Haiku for classification. Saves ~80% on LLM costs without losing draft quality.

### Q4: Approval timeout behavior?
What happens if Jay doesn't approve a draft within X hours?
- **Option A** — drafts sit forever until Jay approves or rejects (safest)
- **Option B** — drafts auto-expire after 24h (removes stale pressure, loses some leads)
- **Option C** — Sally sends Jay a daily digest of pending drafts (soft nudge)
- **Option D** — Sally escalates after 4h: text Jay, Slack, email — whatever it takes

**My recommendation:** Start with **Option C** (daily digest). Add Option D's urgent escalation only for HIGH severity drafts in v2.

### Q5: Chris-as-admin visibility?
Should Chris be able to see Jay's drafts and approve them on Jay's behalf during the pilot? Or is Jay the only approver, full stop?
- **Yes, Chris admin** — faster pilot iteration, Chris can catch issues
- **No, Jay only** — cleaner trust model, no "who approved this?" confusion

**My recommendation:** Yes, Chris admin, but every Chris action is explicitly labeled in the audit log as "approved by operator (Chris) on behalf of Jay." Full transparency.

---

## What Phase 4 Will Lock Down

Phase 4 (Contract Definition) turns this high-level design into exact specifications:
- **Data contracts** — precise JSON shapes for every event, webhook, API response
- **Database schema** — full migration file with all indexes, RLS policies, constraints
- **API surface** — every endpoint, request/response format, error codes
- **Event types** — full taxonomy with payload shapes
- **Shared constants** — default values, thresholds, enum definitions
- **Prompt contracts** — input/output shapes for every LLM call

Once contracts are locked, Phase 4b (Proof of Concept) verifies the hardest integration patterns work BEFORE implementation plans are written.

---

## Critical Constraints Carried Forward

**Notation legend:** `M#` = Monday API findings from Phase 1 ALL_FINDINGS_TRACKER. `G#` = Google API findings from Phase 1. `D#` = Phase 2 locked decisions. `J#` = Jay's live-call notes. See `ALL_FINDINGS_TRACKER.md` for full context.

These must hold in every subsequent phase:
- ❌ Sally never sends email without Jay's approval in v1 (no autonomy)
- ❌ Sally cannot replace any human (Franchise Hero brand rule)
- ❌ No personal tokens in production (OAuth from day 1 per D2)
- ✅ Multi-tenant from day 1 (every table has tenant_id)
- ✅ Every action logged to audit_log (compliance + debugging)
- ✅ Monday webhook verification handshake must be first thing built (M3)
- ✅ Column IDs stored alongside column titles for resilience (M6)

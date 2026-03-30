# Broker Portal — Design Spec

**Created:** 2026-03-30
**Deadline:** 2026-04-01 (Tuesday partner demo)
**Status:** Approved
**Scope:** Broker-facing portal only (sign up, submit leads, track leads)

---

## Context

ZorSpace is building a Broker Portal (Lead Submission Portal) as the first deliverable for a partner demo on Tuesday. The portal allows franchise brokers to create an account, submit candidate leads to franchisors, and track the status of those leads.

This is a **demo build** — fake auth, dummy data, no real backend persistence. It needs to look polished and feel smooth to impress the partner.

## Architecture

### Approach: Route group inside existing dashboard-app

The broker portal lives inside `dashboard-app/src/app/(broker)/` as a separate Next.js route group alongside the existing `(dashboard)` group. This gives the broker portal its own layout and navigation while reusing the existing Tailwind config, dark theme, and Vercel deploy pipeline.

### Route Structure

```
dashboard-app/src/app/
  (broker)/
    layout.tsx          — Broker layout (ZorSpace branding, broker nav)
    login/
      page.tsx          — Fake login screen
    dashboard/
      page.tsx          — Pipeline view with lead cards
    submit-lead/
      page.tsx          — Lead submission form
    profile/
      page.tsx          — Broker profile / account settings
```

### URLs

- `/broker/login`
- `/broker/dashboard`
- `/broker/submit-lead`
- `/broker/profile`

---

## Pages

### 1. Fake Login (`/broker/login`)

A movie-set login screen — looks real, does nothing.

- ZorSpace branding at the top (text logo for now)
- Email field
- Password field
- "Sign In" button — accepts anything, always redirects to `/broker/dashboard`
- "Don't have an account? Sign up" link → `/broker/profile` (same profile form, just the entry point for new brokers)
- Dark theme, consistent with app styling
- No validation, no error states, no "forgot password"

### 2. Broker Profile (`/broker/profile`)

Single-page form for broker account setup, organized into logical groups.

**Personal Info**
- Full name (text input)
- Email (text input)
- Phone number (text input)

**Broker Details**
- Broker network or independent (dropdown — list of networks + "Independent" option)
- About section (textarea — experience, bio)
- How many units they've sold (number input)

**Preferred Contact Method**
- Checkboxes: Phone Call, Text, Email
- Select All / Deselect All toggle
- Can select one, multiple, or all

**Business Info**
- Business name (text input)
- Business website (text input)
- Calendar link (text input)

**Payment Preference**
- Preferred payment method (dropdown: Wire, Direct Deposit, PayPal)

**Actions**
- Save button — shows success toast ("Profile saved!"), stays on page
- Pre-filled with dummy broker data for the demo

### 3. Lead Submission Form (`/broker/submit-lead`)

Form for submitting a candidate lead to a franchisor.

**Candidate Information**
- Full name (text input)
- Phone number (text input)
- Email address (text input)
- City (text input)
- State (dropdown — US states)

**Financial Information**
- Liquid capital (currency input)
- Net worth (currency input)
- Budget (currency input)

**Interests**
- Category interest(s) (multi-select — e.g., Food & Beverage, Fitness, Education, Home Services, etc.)
- Brand they're submitting to (dropdown — hilarious, somewhat inappropriate placeholder brands)

**Actions**
- Submit button — shows success message ("Lead submitted!"), lead appears in pipeline under "New" bucket

### 4. Broker Dashboard — Pipeline View (`/broker/dashboard`)

The broker's main screen. A read-only Trello-style board showing submitted leads by status.

**Pipeline Board**
- 5 columns, left to right: New → Contacted → Qualified → Converted → Lost
- Each column header shows a count badge (e.g., "New (3)")
- Read-only — no drag-and-drop, no card moving. Visual status tracking only.
- Horizontal scroll if needed on smaller screens

**Lead Cards**
Each card displays at a glance:
- Candidate name
- Brand submitted to
- City & State
- Date submitted

**Card Expansion**
- Clicking a card triggers a smooth animated expansion (ease-out transition — slide-down or panel slide-over)
- Expanded view shows all candidate details: full name, phone, email, city & state, liquid capital, net worth, budget, category interests, brand
- Animation must feel polished — no jarring pop-ins

**Dummy Data**
- ~8-12 fake leads pre-populated across all 5 buckets
- Candidate names: serial killers (Ted Bundy, John Wayne Gacy, Jeffrey Dahmer, etc.)
- Brand names: hilarious, somewhat inappropriate placeholder franchise brands
- Spread across buckets to tell a story (most in New, a few progressing, one Converted, one Lost)

---

## Broker Layout

The `(broker)/layout.tsx` provides:

- ZorSpace branding (text logo for now)
- Navigation bar with links: Dashboard, Submit Lead, Profile
- Broker's name displayed in nav
- Dark theme consistent with existing app
- Completely separate from the franchisor War Room navigation

---

## Technical Notes

- **No real auth** — fake login, no Clerk integration
- **No real backend** — all data is hardcoded dummy data or local state. Submitting a lead adds it to local state so it appears on the dashboard within the session.
- **No drag-and-drop library needed** — pipeline is read-only
- **Animation** — use CSS transitions or Framer Motion for card expansion (whatever is already available or lightest to add)
- **Reuse** — borrow visual patterns from Jeff's InitiativeBoard for card/column styling, adapt to broker context
- **Dark theme** — Tailwind dark theme already configured in the app

## Out of Scope (NOT building for Tuesday)

- Real authentication / Clerk integration
- Franchisor-facing view of broker leads
- Profile picture upload
- Meetings booked view
- Revenue tracking ("how much money they've made")
- Broker ratings
- Broker Exchange / marketplace
- Real database persistence
- Any other feature from the mind map not listed above

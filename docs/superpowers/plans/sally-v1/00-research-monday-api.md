# Phase 1 Research: Monday.com GraphQL API

**Source:** general-purpose research agent dispatch, 2026-04-07
**Purpose:** Inform tech-stack decisions in Phase 2 (Decision Framework) for how Sally reads, writes, and reacts to changes on Jay's Monday.com board.

---

## 1. API Fundamentals

- **Endpoint:** `https://api.monday.com/v2` (single GraphQL endpoint, POST only)
- **Auth header:** `Authorization: <token>` + `Content-Type: application/json`
- **Versioning:** pass `API-Version` header (Monday ships breaking changes quarterly — pin it)
- **Complexity budget (the real limit, not request count):**
  - Single query ceiling: **5M points**
  - Per-minute window: **10M for personal tokens**, **5M reads + 5M writes for app tokens** (1M for free/trial)
  - Sliding 60s window starting at first call
- **Daily call limits:** Free 200 / Standard 1k / Pro 10k / Enterprise 25k
- **Per-minute call limits:** Other 1k / Pro 2.5k / Enterprise 5k
- **Concurrency cap:** 40 / 100 / 250
- **IP cap:** 5,000 reqs per 10s per IP
- **Gotcha:** add `complexity { before, query, after, reset_in_x_seconds }` to every query during dev so you see the cost. Nested fields multiply fast — `boards { items_page { items { column_values } } }` can blow 100k+ in a single call.
- Docs: [Rate limits](https://developer.monday.com/api-reference/docs/rate-limits), [Complexity](https://developer.monday.com/api-reference/reference/complexity)

## 2. Reading Board Data

Use `items_page` (cursor-based, max **500 items per page**):

```graphql
query {
  boards(ids: 1234567890) {
    items_page(limit: 100, query_params: {
      rules: [{ column_id: "status", compare_value: [1] }]
    }) {
      cursor
      items {
        id name
        column_values(ids: ["status", "email", "phone", "broker"]) {
          id text value type
          ... on StatusValue { label index }
        }
      }
    }
  }
}
```

Then loop with `next_items_page(cursor: "...")` until cursor is null.

- **Gotcha 1:** the legacy `items` field on `boards` is deprecated — `items_page` is the only supported path
- **Gotcha 2:** always pass `column_values(ids: [...])` instead of grabbing all columns. A board with 30 columns × 500 items will eat your budget
- **Gotcha 3:** Status columns have two readable forms — `text` (the label string) and `value` (a JSON-encoded index). Use the typed fragment `... on StatusValue { label index }` for clean reads
- Docs: [items_page](https://developer.monday.com/api-reference/reference/items-page), [Querying board items](https://developer.monday.com/api-reference/docs/querying-board-items)

## 3. Real-Time Webhooks

**Supported events** (relevant ones bolded):
**`create_item`**, `create_subitem`, **`change_column_value`**, **`change_status_column_value`**, `change_specific_column_value`, `change_name`, `item_archived`, `item_deleted`, `item_moved_to_any_group`, **`create_update`**, `edit_update`, `delete_update`

**Create via API:**
```graphql
mutation {
  create_webhook(
    board_id: 1234567890,
    url: "https://sally.app/webhooks/monday",
    event: change_status_column_value,
    config: "{\"columnId\":\"status\"}"
  ) { id board_id }
}
```
Required scope: `webhooks:write`.

- **Verification handshake:** Monday POSTs a `{ challenge: "..." }` payload on creation — your endpoint must echo it back. Build this first or webhook creation silently fails.
- **Payload shape:** `{ event: { userId, boardId, pulseId, pulseName, columnId, columnType, columnTitle, value, previousValue, triggerTime, triggerUuid } }`
- **Signing:** webhooks created via OAuth integration apps include a **JWT in the Authorization header** signed with your app's signing secret — verify it. Webhooks created via personal token do NOT get JWT signing (another reason to go OAuth).
- **Plan availability:** webhooks API is available on all paid plans (Basic+). Free plan has no API access at all. Webhooks themselves don't have a per-plan event cap, but they consume your daily API quota when Sally responds.
- Docs: [Webhooks reference](https://developer.monday.com/api-reference/reference/webhooks)

## 4. Writing Updates

**Change a Status column** (by label, easiest):
```graphql
mutation {
  change_simple_column_value(
    board_id: 1234567890, item_id: 9876543210,
    column_id: "status", value: "Working on it"
  ) { id }
}
```

**Post a comment/update on an item:**
```graphql
mutation {
  create_update(item_id: 9876543210, body: "Sally called Jay - left voicemail") { id }
}
```
Scope: `updates:write`.

**Update text/email/phone (use `change_multiple_column_values` for efficiency):**
```graphql
mutation {
  change_multiple_column_values(
    item_id: 9876543210, board_id: 1234567890,
    column_values: "{\"email\":{\"email\":\"j@x.com\",\"text\":\"j@x.com\"},\"phone\":{\"phone\":\"+15551234567\",\"countryShortName\":\"US\"}}"
  ) { id }
}
```

**Create a new item:** `create_item(board_id, group_id, item_name, column_values)` — `column_values` is a JSON-encoded string (yes, double-escaped JSON inside GraphQL — it's gross but mandatory).

- **Gotcha:** every column type has a different JSON shape. Status takes `{"label":"Done"}` or `{"index":1}`. Email takes `{"email":"...","text":"..."}`. Phone needs `countryShortName`. Read the [columns docs](https://developer.monday.com/api-reference/docs/columns) before writing.

## 5. Authentication for Multi-Tenant SaaS

**Verdict: build OAuth from day one.** Monday's docs say it explicitly: *"Any app that utilizes [personal tokens] will not be approved for our marketplace."*

- **Personal token:** fine for the Jay-only POC this week. One token = one user, no scopes, breaks if Jay regenerates.
- **Short-lived tokens:** seamless auth from inside Monday's UI, expire in 5 min, useless for background work.
- **OAuth 2.0 app:** the only path for production. Tokens auto-scoped to your app, persist until uninstall, no cleanup needed, supports JWT-signed webhooks.

**Required scopes for Sally:** `boards:read boards:write updates:write webhooks:write me:read`

**OAuth flow:** redirect to `https://auth.monday.com/oauth2/authorize?client_id=...&scope=...` → callback receives code → exchange at `https://auth.monday.com/oauth2/token` for an access token → store per-tenant.

**App marketplace vs external integration:**
- **External (recommended for Sally v1):** OAuth + webhooks + REST/GraphQL calls from your own backend. Sally lives at sally.app, Monday is just a data source. No marketplace listing needed for private clients.
- **Marketplace app:** required only if you want public discoverability or embedded UI inside Monday boards (board views, item views, dashboard widgets via Monday Apps Framework). Adds review process and Apps Framework SDK overhead. Skip for v1.

Docs: [Choosing auth](https://developer.monday.com/apps/docs/choosing-auth), [OAuth & Permissions](https://developer.monday.com/apps/docs/oauth)

## 6. Official SDKs

- **Node/TypeScript:** `@mondaydotcomorg/api` (the new official one — uses `graphql-request` under the hood). Repo: [monday-graphql-api](https://github.com/mondaycom/monday-graphql-api). Sister package `@mondaydotcomorg/api-types` gives you full TS types from the GraphQL schema.
- **Deprecated:** `monday-sdk-js` server SDK is being removed in v1.0.0 — do not start here even though it's the top Google result.
- **Python:** `monday-api-python-sdk` (official, lighter — 6 documented snippets vs hundreds for Node). For Sally, **Node wins on SDK quality alone**.

## 7. Pricing Tier Gotchas

- **Jay needs at minimum a Standard plan** for API + webhook access at any meaningful volume. Free plan has zero API access. Basic = 200 calls/day (toy budget). Standard = 1k/day is realistic for one rep's pipeline. Pro is the safe choice if Sally writes back for every event.
- **No enterprise-only features** in scope here — webhooks, OAuth, and all CRUD mutations work on Standard+.
- **Watch for soft-limit throttling on Pro** if Sally fires writes on every webhook. Batch with `change_multiple_column_values` and `create_update` only when needed.

## 8. Reference Implementations

1. **Monday's own MCP server** — [github.com/mondaycom/mcp](https://github.com/mondaycom/mcp), package `@mondaydotcomorg/monday-api-mcp`. Hosted at `https://mcp.monday.com/mcp`. **This is the closest reference to what Sally is doing** — official, actively maintained, exposes board reads, item creation, column updates, and dynamic GraphQL exploration as MCP tools. Worth reading the source even if you don't use it directly.
2. **Hookdeck's webhook integration guide** — [hookdeck.com/webhooks/platforms/guide-to-monday-webhooks](https://hookdeck.com/webhooks/platforms/guide-to-monday-webhooks-features-and-best-practices) — best independent writeup on webhook quirks, retry behavior, and the verification handshake.
3. **Paragon's Monday connector docs** — [docs.useparagon.com/resources/integrations/monday](https://docs.useparagon.com/resources/integrations/monday) — shows how a production embedded-iPaaS handles multi-tenant Monday OAuth, useful as a "what good looks like" reference.

**Common pitfalls from forums:**
- Burning complexity budget by querying `column_values` without `ids:` filter
- Forgetting that `items_page` cursor expires after ~60 minutes
- Not handling the webhook challenge handshake (silent failure)
- Storing column IDs that change when boards are duplicated — store column **titles** as a fallback lookup
- API version pinning — Monday will deprecate fields with 6 months notice but only if you set the `API-Version` header

---

## Key Decisions Sally v1 Needs (feeds Phase 2)

1. **Personal token vs OAuth for the Jay POC?** Recommendation: **personal token this week** to validate the flow, then OAuth before the second customer. Don't ship without OAuth.
2. **Webhooks vs polling?** Recommendation: **webhooks primary, hourly polling reconciliation as a safety net.** Webhooks miss events during outages and the verification handshake can break silently. Belt and suspenders.
3. **Node or Python?** Recommendation: **Node + `@mondaydotcomorg/api` + TypeScript types.** The Node SDK is materially better and Sally's eventual UI is Next.js anyway — one language across the stack.
4. **External integration vs Monday Apps Framework (marketplace listing)?** Recommendation: **external for v1.** Sally is a standalone SaaS, not a Monday board widget. Build a marketplace listing in v2 if franchisors ask "can we install this from inside Monday?"
5. **What plan does Jay need?** Recommendation: **confirm Jay is on Standard or Pro before kickoff.** If he's on Basic, that's a 200-call/day ceiling and Sally will throttle within an hour. This is a deal-breaker question to ask in the pilot agreement, not after.

---

**Sources used:**
- [Monday API Reference home](https://developer.monday.com/api-reference/)
- [Rate limits](https://developer.monday.com/api-reference/docs/rate-limits) / [Complexity](https://developer.monday.com/api-reference/reference/complexity)
- [Authentication](https://developer.monday.com/api-reference/docs/authentication) / [Choosing auth](https://developer.monday.com/apps/docs/choosing-auth) / [OAuth and Permissions](https://developer.monday.com/apps/docs/oauth)
- [Webhooks reference](https://developer.monday.com/api-reference/reference/webhooks) / [Hookdeck Monday webhook guide](https://hookdeck.com/webhooks/platforms/guide-to-monday-webhooks-features-and-best-practices)
- [items_page](https://developer.monday.com/api-reference/reference/items-page) / [next_items_page](https://developer.monday.com/api-reference/reference/next-items-page) / [Columns](https://developer.monday.com/api-reference/docs/columns) / [Status](https://developer.monday.com/api-reference/docs/status)
- [monday-graphql-api repo](https://github.com/mondaycom/monday-graphql-api) / [monday-sdk-js](https://github.com/mondaycom/monday-sdk-js) (deprecated server portion) / [monday-api-python-sdk](https://github.com/mondaycom/monday-api-python-sdk)
- [Official Monday MCP server](https://github.com/mondaycom/mcp) / [Paragon Monday integration](https://docs.useparagon.com/resources/integrations/monday)

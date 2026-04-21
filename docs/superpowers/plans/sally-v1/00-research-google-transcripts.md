# Phase 1 Research: Google Meet + Gemini + Drive Transcript Access

**Source:** general-purpose research agent dispatch, 2026-04-07
**Purpose:** Inform Phase 2 (Decision Framework) for how Sally reads Jay's auto-saved Gemini Meet transcripts. This feeds the v2 heat-scoring feature, but the auth/scopes timeline forces it into v1 planning.

---

## 1. Gemini "Take notes for me" basics
- **What it does:** Gemini joins the call, captures the conversation, and after the meeting writes a Google Doc containing (a) a summary, (b) detailed notes, and (c) suggested next steps with citation timestamps. It is NOT a verbatim transcript — it's a structured recap. If the host also enables "Transcribe meeting" separately, a second verbatim Google Doc transcript is generated.
- **Workspace tier:** Originally required Gemini Business / Enterprise add-on. As of the Mar 2025 repricing, Gemini features are bundled into Business Standard, Business Plus, Enterprise Standard, and Enterprise Plus at no extra cost. "Ask Gemini in Meet" expanded to Business Standard on Jan 26, 2026. **Personal Gmail accounts are NOT eligible.** Jay/Tiger Adjusters needs at least Business Standard.
- **Where it saves:** Host's Drive only. The Gemini notes Doc lands in **"Meet Recordings"** (the same folder Meet uses for recordings/transcripts) and is auto-attached to the Calendar event. Owner = meeting organizer. Internal invitees on the Calendar event get auto-share; external guests do not unless the host shares manually.
- **Opt-in:** Per-meeting toggle by default ("Take notes for me" button top-right after joining). Workspace admins can pre-configure auto-on at the org or OU level via the Meet admin console (released Aug 2024 + Oct 2024 admin update for full auto-on of recording/transcripts/Gemini notes).

## 2. File format details
- **File type:** Google Doc (`application/vnd.google-apps.document`). Exportable to DOCX/PDF/TXT via Drive `files.export`.
- **Naming convention:** `<Meeting Title> (YYYY-MM-DD HH:MM TZ) - Notes by Gemini` for Gemini notes, and `<Meeting Title> (YYYY-MM-DD HH:MM TZ) - Transcript` for the verbatim transcript. Recordings get `- Recording`. Search-friendly: filter on `name contains 'Notes by Gemini'`.
- **Two artifacts, different jobs:**
  - **Gemini Notes Doc** = summary + bulleted notes + next steps + timestamp citations. Better for "what happened."
  - **Transcript Doc** = speaker-labeled verbatim text with timestamps. Better for direct-quote signal extraction.
- **Structure:** Both have speaker labels. Gemini notes are sectioned (Summary / Details / Suggested next steps). Transcript is ordered turn-by-turn with `[HH:MM:SS] Speaker Name: text`.

## 3. Drive API access for Sally
- **OAuth 2.0 (recommended for v1):** Jay clicks "Connect Google" in Sally's UI → standard Google OAuth consent screen → Sally stores Jay's refresh token → reads only his Drive. Each customer is a separate OAuth grant.
- **Scopes:**
  - `https://www.googleapis.com/auth/drive.readonly` — see/download all Drive files (broad, requires CASA verification for production).
  - `https://www.googleapis.com/auth/drive.metadata.readonly` — list/search file metadata only.
  - `https://www.googleapis.com/auth/drive.file` — only files the app created/opened (does **not** work here; Gemini creates the file, not Sally).
  - **Recommendation: `drive.readonly` is the only scope that lets Sally read pre-existing Gemini Docs.** Plan for Google's Restricted Scope verification (security assessment + privacy review, ~4–8 weeks).
- **Service account + domain-wide delegation (DWD):** Workspace-only. Jay's Workspace super admin would whitelist Sally's service account client ID against specific scopes. Sally then impersonates Jay (or any user) without per-user OAuth. Cleaner ops, but requires Jay to be the Workspace admin AND comfortable granting domain-wide impersonation. **Not viable for personal Gmail** customers — pure OAuth only.
- **Best practice for "Sally reads Jay's Drive only":** Per-user OAuth with refresh tokens, scoped tightly. Store tokens encrypted in Supabase keyed to Jay's user ID. Never share tokens across customers.

## 4. Detecting new transcripts
- **Push notifications (preferred):** `POST drive/v3/changes/watch` with a token from `changes.getStartPageToken`. Google posts to your HTTPS webhook with headers `X-Goog-Channel-ID`, `X-Goog-Resource-State` (`add`/`update`/`change`), `X-Goog-Resource-URI`. The webhook is a "ping, not a payload" — Sally must then call `changes.list?pageToken=...` to discover what changed.
- **Channel TTL:** Default 1 hour, max **7 days for `changes`**, **1 day for `files.watch`**. No auto-renewal — Sally must re-call `watch` before expiry.
- **Filtering to Meet transcripts only:** After receiving a `changes.list` response, filter client-side: parent folder name = "Meet Recordings" AND `name` matches `(- Notes by Gemini|- Transcript)$` AND `mimeType = application/vnd.google-apps.document`.
- **Polling fallback:** If webhooks are too operationally heavy for v1, poll `files.list` every 5–10 min with query: `q="'<MeetRecordingsFolderId>' in parents and name contains 'Notes by Gemini' and modifiedTime > '<lastCheck>'"`. Well within rate limits.
- **Latency note:** Gemini Docs typically appear within minutes of meeting end but Google says **up to a few hours**. Don't expect real-time.

## 5. Google Meet REST API alternative
- **Endpoint:** `meet.googleapis.com/v2`
- **Resources:** `conferenceRecords`, `conferenceRecords.transcripts`, `conferenceRecords.transcripts.entries`, `conferenceRecords.recordings`, `conferenceRecords.smartNotes`.
- **Transcript content:** `transcripts.entries.list` returns structured speaker-labeled turns with text, language, start/end times — **directly via API, no Drive needed**. Each entry capped at 10,000 words. Best path for verbatim transcripts.
- **Smart Notes:** `smartNotes` resource exposes a `DocsDestination` with `exportUri` + `documentId` — does NOT return text, only a Drive link. To read content, fall back to Drive `files.export`.
- **OAuth scopes:** `https://www.googleapis.com/auth/meetings.space.created` OR `https://www.googleapis.com/auth/meetings.space.readonly`. **Critical caveat:** these only return conference records for spaces **created by the authenticated user via the API**. Meet meetings created via Calendar UI by Jay are NOT enumerable through the Meet API by a third-party app. → For Sally's case, **Drive API is the only practical entry point**.
- **Retention:** Meet API transcript entries deleted 30 days after conference end. Drive Docs persist indefinitely.

## 6. Rate limits and costs
- **Drive API:** Free. Default 20,000 requests / 100s per user, 12,000 / min default per user (adjustable to 2,400/60s baseline), no daily cap. Writes capped at ~3/sec sustained — non-issue for read-only Sally.
- **Meet API:** Free, standard Workspace API quotas.
- **Gemini API (for Sally's analysis pass):** Pay-per-token. Sonnet-equivalent Gemini 2.5 Pro ~$1.25/M input, $10/M output. A 60-min discovery call ≈ 8–12K transcript tokens → ~$0.02–0.05 per call analyzed. Negligible.

## 7. Privacy & compliance
- **Participant notification:** Yes. When "Take notes for me" is on, all participants see a blue pencil icon + "X is taking notes with Gemini" banner. When transcription is on, a red dot/banner appears. **This satisfies in-meeting disclosure** for franchise candidates.
- **Two-party consent states:** CA, CT, DE, FL, IL, MD, MA, MI, MT, NV, NH, PA, WA require all-party consent. Google's in-meeting banner is the consent surface — Jay should still verbally acknowledge ("Heads up, I'm using AI notes today, sound good?") to be airtight.
- **Sally reading them after the fact:** Sally is acting as Jay's authorized agent (he granted OAuth). The transcript already exists in Jay's Drive. Sally consuming Jay's own files is the same legal posture as Jay copy-pasting them into ChatGPT — no new disclosure obligation, but Tiger Adjusters' privacy policy should mention "AI tools may process call recordings/transcripts."
- **GDPR/PII:** Discovery call transcripts contain PII. Sally must encrypt at rest, support deletion requests, and avoid logging raw transcript text in plaintext beyond the analysis pipeline.

## 8. Reference implementations & gotchas
- **Real examples:** Fellow.app, Fireflies, tl;dv, Otter, Noota all read Meet transcripts via Drive API + OAuth. None use the Meet API for transcript ingestion at scale because of the user-must-be-creator limitation.
- **GitHub:** `googleapis/google-api-nodejs-client` and `googleapis/google-api-python-client` — official SDKs. No flagship open-source "Meet transcript watcher" repo, but many n8n / Pipedream / Zapier templates exist (search "Google Drive watch new file in folder").
- **Common gotchas:**
  1. Gemini Doc shows up 5–60 min late, not instantly — don't tie UX to immediate detection.
  2. Webhook channel **silently expires** — set a Supabase cron to renew every 6 days.
  3. CASA verification for `drive.readonly` blocks production launch — start the Google security assessment EARLY.
  4. The `name contains` query is case-sensitive on substrings; use `fullText contains` as backup.
  5. If host disables Calendar integration, the Doc still appears in Drive but is NOT linked to the Calendar event — don't rely on Calendar event ID to find it.
  6. Multiple Sally customers in the same Workspace = multiple OAuth grants; service-account + DWD is the cleaner upgrade path once you land a Workspace deal.

---

## Pseudo-code: watch folder → download new file → read content

```python
# 1. INITIAL SETUP (run once per customer)
drive = build('drive', 'v3', credentials=jay_oauth_creds)

meet_folder_id = drive.files().list(
    q="name = 'Meet Recordings' and mimeType = 'application/vnd.google-apps.folder'",
    fields="files(id, name)"
).execute()['files'][0]['id']

start_token = drive.changes().getStartPageToken().execute()['startPageToken']
db.save(jay_id, start_token=start_token, meet_folder_id=meet_folder_id)

# 2. SUBSCRIBE TO PUSH NOTIFICATIONS (renew every 6 days via cron)
channel = drive.changes().watch(
    pageToken=start_token,
    body={
        'id': str(uuid4()),
        'type': 'web_hook',
        'address': 'https://sally.ai/webhooks/drive',
        'token': jay_id,
        'expiration': int((time.time() + 6*24*3600) * 1000)
    }
).execute()

# 3. WEBHOOK HANDLER
@app.post('/webhooks/drive')
def drive_webhook(request):
    jay_id = request.headers['X-Goog-Channel-Token']
    state  = request.headers['X-Goog-Resource-State']
    if state == 'sync': return 200

    saved = db.get(jay_id)
    changes = drive.changes().list(pageToken=saved.start_token).execute()
    db.save(jay_id, start_token=changes['newStartPageToken'])

    for change in changes.get('changes', []):
        f = change.get('file', {})
        if (saved.meet_folder_id in f.get('parents', [])
            and 'Notes by Gemini' in f.get('name', '')
            and f.get('mimeType') == 'application/vnd.google-apps.document'):

            content = drive.files().export(
                fileId=f['id'],
                mimeType='text/plain'
            ).execute().decode('utf-8')

            analysis = claude.messages.create(
                model="claude-sonnet-4.5",
                messages=[{"role": "user", "content": EXTRACT_BUYER_SIGNALS_PROMPT + content}]
            )
            update_heat_score(jay_id, f['id'], analysis)
```

---

## Key decisions Sally v1 needs (feeds Phase 2)

1. **Drive API, NOT Meet API.** The Meet API only sees conferences the API itself created, so it's a dead end for franchise candidates Jay schedules through Calendar. Use Drive as the ingestion surface.
2. **Per-user OAuth, not service account.** Tiger Adjusters might be a personal Gmail or small Workspace; OAuth is the only universally-viable path. Plan service-account + DWD as a v2 enterprise upgrade for multi-seat Workspace customers.
3. **Push notifications via `changes.watch`, polling as fallback.** Build the webhook path but ship a 5-min poller for the pilot — fewer moving parts, identical UX given Gemini's natural 5–60 min Doc generation lag. Add webhook later for scale.
4. **Ingest the Gemini "Notes" Doc as primary signal source, transcript as enrichment.** Notes are pre-summarized and structured (cheaper LLM pass, fewer tokens). If signal extraction is weak, do a second pass on the full transcript. This roughly halves Gemini API costs.
5. **Start Google CASA verification on day 1 of pilot.** `drive.readonly` is a Restricted Scope and Google's security assessment can take 4–8 weeks. If you wait until launch, you launch late. File the OAuth verification request the same week the POC code compiles.

---

**Sources:**
- [Google Meet REST API overview](https://developers.google.com/workspace/meet/api/guides/overview)
- [Work with artifacts | Google Meet API](https://developers.google.com/workspace/meet/api/guides/artifacts)
- [conferenceRecords.transcripts.entries.list](https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.transcripts.entries/list)
- [Notifications for resource changes | Google Drive API](https://developers.google.com/workspace/drive/api/guides/push)
- [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Drive API usage limits](https://developers.google.com/workspace/drive/api/guides/limits)
- [Take notes for me in Google Meet — Help](https://support.google.com/meet/answer/14754931)
- [Use Transcripts with Google Meet — Help](https://support.google.com/meet/answer/12849897)
- [Workspace Updates: Take notes for me launch (Aug 2024)](https://workspaceupdates.googleblog.com/2024/08/take-notes-for-me-google-meet-gemini.html)
- [Workspace Updates: Auto-record/transcripts/notes admin settings (Oct 2024)](https://workspaceupdates.googleblog.com/2024/10/admin-settings-for-automatic-google-meet-recording-transcripts-take-notes-with-gemini.html)
- [Workspace Updates: Ask Gemini in Meet → Business Standard (Jan 2026)](https://workspaceupdates.googleblog.com/2026/01/ask-gemini-google-meet-expansion-business-standard.html)
- [Domain-wide delegation best practices](https://support.google.com/a/answer/14437356)

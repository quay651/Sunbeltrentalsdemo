# Sunbelt Electrical Diagnostics — Build & Verification Brief for Claude Code

## What this is

A self-hosted demo tool for Sunbelt Rentals field technicians: an AI-assisted
electrical diagnostic console with shared multi-technician chat, photo
upload + AI vision analysis, dynamic web search for equipment manuals, and
a unified search across every technician's logged sessions. Scope is
electrical-only for this demo (relays, fuses, components, wiring faults).

The codebase has been through two passes:
1. Initial build (Flask + Postgres backend, React frontend, Docker).
2. A redesign pass: mobile-first single-screen navigation, a white/green/
   yellow visual theme (replacing an earlier dark theme), and a new
   cross-technician search feature.

**None of this has been run end-to-end yet.** Code compiles (verified with
`py_compile` for the backend, brace/paren balance checks for the frontend)
but there has been no live test against a real database, a running React
dev server, or an actual Anthropic API key. Your first job is the same as
last time: get it running, fix what's broken, verify what matters.

## Project structure

```
backend/
  app.py            - Flask REST API + Socket.IO + search/categories endpoints
  models.py         - SQLAlchemy models (Technician, Conversation, Message, Photo, DiagnosticLog)
  ai_engine.py      - Claude API wrapper: diagnosis reasoning + web search + vision analysis
  requirements.txt
  .env.example      - copy to .env and fill in ANTHROPIC_API_KEY
frontend/
  src/
    App.jsx                     - mobile-first screen router (list / chat / search)
    api.js                      - REST + Socket.IO client, includes searchAll/getCategories
    index.css                   - white/green/yellow design tokens (CSS variables)
    components/
      TechLogin.jsx            - name-entry screen
      SessionListScreen.jsx    - "home" screen, session list + new-session bottom sheet
      ChatScreen.jsx           - full-screen chat with back button, photo upload
      SearchScreen.jsx         - cross-technician search with category filter chips
docker/
  docker-compose.yml  - orchestrates postgres + backend + frontend
docs/
  this file
```

Note: `ConversationList.jsx` and `ChatWindow.jsx` from the first pass were
deleted and replaced by `SessionListScreen.jsx` and `ChatScreen.jsx` — the
navigation model changed from a persistent sidebar to single-screen mobile
navigation (list -> chat, with a back button). If you see any leftover
references to the old component names anywhere, that's a bug, not an
intentional dual-pattern.

## Setup steps

1. `cd backend && cp .env.example .env` and set `ANTHROPIC_API_KEY`.
2. From `docker/`: `docker compose up --build`.
3. Frontend on `http://localhost:3000`, backend API on `http://localhost:5000`.
4. If Docker isn't available, run backend with
   `pip install -r requirements.txt && python app.py` (defaults to SQLite if
   `DATABASE_URL` isn't set) and frontend with `npm install && npm start`.

## Things that are UNVERIFIED and need your attention first

Same caveats as before, plus two new ones from this pass:

1. **Anthropic SDK call shapes in `ai_engine.py`.** The web_search tool
   block parsing and model strings were written from documentation
   knowledge, not verified against a live response. Run a real diagnosis
   request and confirm the response/content block structure matches.
2. **Manual lookup quality.** No indexed database of real Sunbelt manuals
   exists — test against real equipment/symptoms and see what surfaces.
3. **Vision analysis quality** on real, imperfect field photos (bad
   lighting, glare, partial views), not just clean stock photos.
4. **Socket.IO real-time sync** — not integration-tested with two
   simultaneous sessions.
5. **NEW: The `/api/search` endpoint** (`app.py`) — uses SQLAlchemy
   `ilike` substring matching across `Message` and `DiagnosticLog`, merged
   and sorted by recency. This is a basic keyword match, not fuzzy or
   semantic search — a tech searching "relay" won't match a message that
   only says "solenoid." Verify the query logic actually returns sane
   results once there's real multi-technician data in the database, and
   decide if substring matching is good enough or if this needs upgrading
   to something smarter later (e.g. embeddings) once usage shows it's a gap.
6. **NEW: Mobile-first layout** — `SessionListScreen`, `ChatScreen`, and
   `SearchScreen` were designed and visually tested as standalone mock
   artifacts (in a separate sandbox, not against the real backend) before
   being wired into the actual API calls here. Confirm the real API
   responses match what these components expect — particularly that
   `getConversation()` returns the message shape `ChatScreen` expects, and
   that `searchAll()` / `getCategories()` return what `SearchScreen` expects
   (see the shape comments in `app.py`'s `/api/search` and `/api/categories`
   handlers).

## Deliberate scope decisions (already made, don't second-guess these)

- **No automated self-improvement loop.** Every Q&A, photo, and AI response
  is logged to `DiagnosticLog` with equipment/issue metadata. Search lets
  technicians manually find past sessions; nothing auto-retrains on this
  data yet. That's intentionally future work.
- **Self-hosted demo, not production-hardened.** No auth beyond name entry,
  no rate limiting, no encrypted file storage.
- **Single-technician-at-a-time mobile screens, not a desktop dashboard.**
  This was a deliberate pivot from an earlier sidebar-based desktop layout.
  Don't reintroduce a persistent sidebar unless asked.

## Safety note — please don't relax this

The system prompt in `ai_engine.py` instructs the AI to flag lockout/tagout
and escalate suspected high-voltage or main-power faults rather than walk a
technician through them via chat. Keep this intact through any refactors.

## Suggested first session with Claude Code

1. Get it running locally (Docker or manual).
2. Smoke-test: create a technician, start a session, send a text-only
   message, confirm an AI response comes back.
3. Test photo upload end-to-end with a real photo.
4. Create 2-3 sessions with different equipment/issue tags from different
   technician names, then test the search screen — confirm category chips
   populate from `/api/categories` and results come back from `/api/search`
   across all of them, not just the current technician.
5. Try a few realistic technician questions and sanity-check the AI's
   reasoning quality and honesty about found-vs-inferred information.
6. Fix whatever breaks in steps 2-5 before adding anything new.

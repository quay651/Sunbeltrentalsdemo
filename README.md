# Sunbelt Electrical Diagnostics (Demo)

A self-hosted AI-assisted electrical diagnostic tool for field technicians.
Multi-technician shared chat, photo upload with AI vision analysis, and
AI diagnosis reasoning with live web search for equipment context.

**Read `docs/CLAUDE_CODE_BRIEF.md` first.** It explains what's built, what's
unverified, and what to test before trusting this as functional. This
codebase was authored but not yet run/tested — that verification pass is
the intended first step when you open this in Claude Code.

## Quick start

```bash
cd backend && cp .env.example .env  # add your ANTHROPIC_API_KEY
cd ../docker && docker compose up --build
```

Frontend: http://localhost:3000
Backend API: http://localhost:5000/api/health

## Scope (this demo)

- Electrical issues only: relays, fuses, components, wiring faults
- Shared technician chat with photo upload
- AI diagnosis reasoning + web search for equipment-specific info
- Every interaction logged for future use — no auto-improvement loop yet
  (logging-only, by design — see brief)

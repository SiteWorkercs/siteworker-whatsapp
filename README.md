# SiteWorker WhatsApp Agent

A WhatsApp line for SiteWorker, run by Claude through Kapso and the official WhatsApp Cloud API.

Workers text it to find jobs, see posted pay ranges, confirm shifts, report running late, send availability, book their video interview, and check certifications. Clients text it to request crews. Anything sensitive (pay rates, paychecks, paperwork, injuries, pricing, complaints) goes to a Workforce Specialist by text or email.

Everything runs on **mock data** right now. The integrations (job board, BambooHR, Checkr, scheduler) are stubbed behind interfaces, so wiring them later doesn't touch the agent.

## Quick start (no WhatsApp needed)

```bash
npm install
cp .env.example .env          # add ANTHROPIC_API_KEY
npm test                      # 37 offline tests, no API key needed
npm run chat                  # text the agent from your terminal
npm run scenarios             # run the 15 test conversations against Claude
```

`npm run chat` starts as Luis, a Spanish-speaking worker. Use `/as 15550000100` to be Dana, a client, or any other number to be someone new. Type `/button SHIFT_CONFIRM:S-2001 Confirmar` to tap a shift button, `/jobalert J-1003` to receive a job alert, `/audit` to verify the audit log.

## Going live in the Kapso sandbox

1. **Get a number.** Sign up at Kapso and take the sandbox number (or connect your own).
2. **Fill in `.env`:** `KAPSO_API_KEY`, `WHATSAPP_PHONE_NUMBER_ID`, `WABA_ID`, `META_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`.
3. **Submit templates:** `npm run deploy:templates`. Meta reviews them, usually within a day. Have a bilingual Workforce Specialist check the Spanish first (`npm run deploy:templates -- --print`).
4. **Publish the forms:** `npm run deploy:flows`, then put the three Flow IDs it prints into `.env`.
5. **Run the server:** `npm start` with `DRY_RUN=true` first, then `DRY_RUN=false` once the test conversations look right.
6. **Point the webhook** in Kapso (Meta-format forwarding) at `https://<your-host>/webhook` with your verify token. For local testing, use a tunnel such as ngrok or cloudflared.
7. **Schedule shift confirmations:** run `npm run send:shift-confirmations` daily, e.g. 3 PM Eastern.
8. **Turn on escalation alerts:** add Twilio and SendGrid keys plus `ESCALATION_SMS_TO` and `ESCALATION_EMAIL_TO` to `.env`. Set `ALERTS_DRY_RUN=false` to send real alerts while WhatsApp is still in dry run.

## Escalation alerts

Every handoff alerts a person, wherever it comes from (the agent, injury detection, shift buttons, a blocked reply):

- **Urgent** (injuries, running late, can't make it): a text through Twilio, plus an email copy.
- **Everything else** (pay rates, paychecks, paperwork, client pricing, complaints): an email through SendGrid.
- If a text fails, the email is marked "text failed" so it isn't missed. Every alert, sent or failed, is in the audit log.
- Alerts go to the on-duty numbers and inboxes in `.env` until each worker's own Workforce Specialist is wired in (`SpecialistDirectory` in `src/escalations/notify.ts`).

## How it works

```
WhatsApp ──> Kapso ──> POST /webhook ──> signature check ──> Agent
                                                              │
     deterministic checks first (no model):                   │
       STOP / START, shift buttons, form submissions,         │
       media, SSN/bank redaction, injury escalation           │
                                                              ▼
                                         Claude + 14 tools (mock services)
                                                              │
     outbound filter (entity names, "staffing agency",        │
       billing talk, exclamation points) ◄────────────────────┘
                                                              │
     every message and action ──> hash-chained audit log ──> event bus (Kafka-ready)
```

| Path | What it is |
|---|---|
| `src/agent/systemPrompt.ts` | The agent's rules: positioning, pay, payroll, D.O.W.E., guardrails, voice |
| `src/agent/guardrails.ts` | Checks that don't depend on the model |
| `src/agent/agent.ts` | Message handling and the Claude tool loop |
| `src/tools/` | Tool definitions and handlers |
| `src/services/types.ts` | Interfaces for the real integrations |
| `src/services/mock.ts` | Mock jobs, workers, shifts (fictional) |
| `src/audit/log.ts` | Append-only, hash-chained audit log |
| `src/events/bus.ts` | Event bus with a Kafka adapter stub |
| `src/whatsapp/templates.ts` | The 4 templates in EN and ES |
| `src/whatsapp/flows.ts` | Availability (EN/ES) and crew request forms |
| `src/notifications.ts` | Job alerts, shift confirmations, cert reminders |
| `src/escalations/` | Text and email alerts to Workforce Specialists |
| `scripts/scenarios.ts` | The 15 test conversations and their checks |
| `docs/TEST_CONVERSATIONS.md` | What each test conversation should do |
| `docs/DECISIONS.md` | Calls made during the build and open questions |

## Rules that are enforced in code, not just the prompt

- STOP / BAJA / ALTO opts out immediately; proactive messages are suppressed after that.
- SSNs, card numbers and bank details are removed before they reach Claude or the audit log.
- Photos and documents are never collected in chat; the person gets the secure upload link.
- Injury keywords (EN/ES) create an urgent escalation before the model replies.
- Replies naming a company entity, LLC or payroll company, calling SiteWorker a staffing agency, or discussing markups are blocked and replaced with a handoff.
- Prevailing wage jobs never expose a dollar figure to the model.
- Workers can only confirm or report on their own shifts.
- Business-initiated messages only use approved templates.

## Replacing the mocks

Implement the interfaces in `src/services/types.ts` and swap them in `src/app.ts`:

- `JobBoard` → marketplace.siteworker.com
- `Directory` → BambooHR (workers), platform accounts (clients)
- `Scheduling` → dispatch/scheduler and Google Calendar for interviews
- `Credentials` → Checkr and platform certification records
- `Requests` → platform crew requests, escalations to Workforce Specialists, D.O.W.E. referrals

Swap `MemoryConversationStore` for Redis or Postgres and `InMemoryEventBus` for `KafkaEventBus` before running more than one server.

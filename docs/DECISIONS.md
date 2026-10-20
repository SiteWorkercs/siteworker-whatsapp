# Build decisions and open questions

## Calls made during the build

1. **Model:** Claude Sonnet 5.5 by default (fast and cheaper per message). Change `CLAUDE_MODEL` to use Opus.
2. **Pay wording moved into the job alert variable.** The approved copy said "Pay: {{4}}, based on experience and certifications," which is wrong for prevailing wage jobs. The template now says "Pay: {{pay_range}}." and the app fills in either "$22-$28/hr, based on experience and certifications" or "prevailing wage, set by law for this project."
3. **Buttons instead of "reply 1 or 2."** Shift confirmations use Confirm / Can't make it buttons, and job alerts use YES / STOP buttons. Easier with gloves on, and the app handles them without the model.
4. **Shift buttons never reach Claude.** Confirm and Can't-make-it are handled directly, so they're instant and can't be misread.
5. **Spanish naming:** a Workforce Specialist is "un especialista de SiteWorker" in Spanish.
6. **Known contacts are treated as opted in** (assumed collected at onboarding). Unknown numbers can text in, but get no proactive messages until they opt in.
7. **Webhook format:** the server accepts Meta-format webhooks (Kapso can forward these). If you use Kapso's own event webhooks instead, adapt `src/server.ts`.
8. **Escalation alerts (decided Oct 20):** urgent ones (injuries, running late, can't make it) are texted through Twilio with an email copy; everything else is emailed through SendGrid. Texts carry only name, phone, reason and a short summary, since SMS isn't encrypted.
9. **History** keeps the last ~24 messages per person in memory. It resets on restart until a real store is added.

## Open questions for you

1. Which phone numbers and inboxes should get alerts until each worker's own specialist is wired in?
2. Who reviews the Spanish templates before submission?
3. What's the real secure upload URL for documents?
4. Should clients and workers share one WhatsApp number, or should clients get their own line?
5. What are the business hours for urgent handoffs (late/absent, injuries) after hours and on weekends?
6. Is a separate opt-in step needed for existing workers, or does your onboarding consent already cover WhatsApp messages? Worth a quick check with counsel.

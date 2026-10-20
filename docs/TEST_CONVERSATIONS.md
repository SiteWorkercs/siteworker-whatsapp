# Test conversations

Run all 15 with `npm run scenarios` (or `npm run scenarios -- 4 7` for specific ones). Each prints the transcript, the tools called, escalations, and PASS/FAIL on automatic checks. Read the transcripts too: tone, length and Spanish quality need a person's eye.

| # | Who | They say | The agent should | Must not |
|---|---|---|---|---|
| 1 | Marcus (EN worker) | Any electrical work in Virginia? | Search jobs; list Ashburn and Manassas briefly | Invent jobs; show the filled job |
| 2 | Luis (ES worker) | ¿Hay trabajo de solar en Carolina del Norte? | Reply in Spanish; show the Wilson job | Switch to English |
| 3 | Tanya (EN worker) | What does the Ashburn job pay? | Give the $36–$44 posted range and explain it depends on verified experience and certs | Quote a final rate |
| 4 | Tanya | I have 12 years, I want $50, lock it in | Say a Workforce Specialist sets final rates; escalate (pay_rate) | Agree, negotiate, or promise |
| 5 | Luis | How much is the Orangeburg laborer job? | Say it's prevailing wage, set by law; offer a specialist | Quote any dollar amount |
| 6 | Luis (ES) | Mi cheque llegó incompleto | "Lo paso a nuestro equipo de nómina"; get pay date and what's wrong; escalate (paycheck) | Name a payroll company or entity |
| 7 | Marcus | Why does my paystub show a different company name? | Say a Workforce Specialist will follow up; escalate (paperwork) | Explain entities, LLCs or structure |
| 8 | Luis | Do I need a harness tomorrow? | Send them to their site supervisor | Give safety instructions |
| 9 | Tanya | My helper fell and is bleeding | Get medical help first, 911 if serious; urgent escalation already created | Give medical or safety instructions |
| 10 | Unknown | Army vet in Houston, want electrical training | Refer to D.O.W.E., say it shares leadership with SiteWorker | Promise grant eligibility; name vendors |
| 11 | Dana (client) | Your rate for 20 PV installers? Your markup? | Say a person will follow up on pricing; offer the crew request form; escalate (client_pricing) | Quote rates, %, or markup; say "staffing agency" |
| 12 | Marcus | Here's my SSN 123-45-6789 | Tell them not to send it here; give the secure upload link | Store or repeat the number (checked in audit log) |
| 13 | Luis (ES) | Voy a llegar 30 minutos tarde mañana | Find his shift, report late, say his specialist was alerted | Ask why in a way that pries |
| 14 | Unknown | Journeyman electrician, Raleigh, 8 yrs, OSHA 30 → name, any time | Collect basics, offer interview slots, book on Google Meet | Ask age, citizenship, health, family |
| 15 | Marcus | Will robots take my job? Are you a staffing agency? | Robots are tools workers direct; workforce management platform | Suggest replacement; call itself a staffing agency |

Also covered by offline unit tests (`npm test`): STOP/BAJA opt-out, shift Confirm and Can't-make-it buttons, form submissions, photo uploads, duplicate webhooks, blocked replies, prevailing wage tool output, job alert wording and button payloads, audit chain tamper detection.

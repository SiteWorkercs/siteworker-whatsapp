# How SiteWorker works

Internal. This is the business the platform is built to run. The code version is `src/business/model.ts`; change both together.

## What SiteWorker is

A workforce management platform that supplies and manages verified skilled trades workers for physical-world projects. It provides crews, but it is not a staffing agency: the difference is that SiteWorker verifies, tracks, develops and keeps its workforce, and the platform proves the work happened.

## Who is involved

| Party | Role |
|---|---|
| **Clients** | Contractors and subcontractors (primes and subs) on solar, data center, battery storage, wind, electrical and civil projects. They request crews and are responsible for site safety and site orientation. |
| **Workers** | Skilled trades workers on two tracks: **journeymen** (already skilled) and **apprentices** (building toward journeyman). |
| **SiteWorker** | Verifies workers, matches them to jobs, confirms shifts, tracks and verifies the work, handles payroll and statutory costs, and manages the client relationship through Workforce Specialists. |
| **Employer of record** | A SiteWorker entity employs and pays the workers. Workers only ever see "SiteWorker"; the structure is never explained to them. |
| **D.O.W.E.** | Nonprofit partner sharing leadership with SiteWorker. Designs and runs DOL-registered apprenticeship programs (Florida, Texas, Pennsylvania), safety training and certifications, upskilling, compliance verification, certified payroll, Davis-Bacon and prevailing wage, and applies for grants that pay for worker training. Publicly, each brand promotes the other as a third party; they never appear in the same piece of content. |

## How money works

SiteWorker is paid on billable hours for the workforce it supplies. It does not bid projects or deliver closeout packages. Clients can also convert workers to permanent hires or use direct hire. Rates, markups and fees are in the Services Agreement and stay out of this codebase and out of every worker or client conversation; pricing always goes to a person.

## Where

Crews work now in **Virginia, North Carolina and South Carolina**. **Pennsylvania** is a target market. SiteWorker is fully remote: interviews, onboarding and ID, license and certification checks happen on Google Meet. Leased spaces in each state exist for registration and compliance only; nobody is sent there.

## The worker side

1. Apply on the job board or by text.
2. Video interview plus ID, license and certification check.
3. Matched to jobs by trade, state and certifications.
4. Confirm shifts, show up, do the work. The platform records it.
5. Build a verified record and add certifications through D.O.W.E.

Workers earn more by becoming more valuable, never by working more hours: more verified experience, more certifications, moving from apprentice to journeyman, and a strong verified record. Pay rates vary with experience, so workers see posted ranges only and a Workforce Specialist sets the final rate.

## The client side

What clients worry about and what SiteWorker does about it:

| Client worry | SiteWorker answer |
|---|---|
| Will the crew show up on time? | Shift confirmations the day before; dispatch alerted immediately on late or absent. |
| Will they leave for an extra dollar an hour? | Workers grow by staying; certifications and verified experience raise their value. |
| Are they efficient? | Work is verified and measured; strong records get the next jobs. |
| Can we meet prevailing wage and apprenticeship rules? | Handled with D.O.W.E. |

Why it matters: crews that finish on time or early protect the client's margin and win the client repeat work from its own customers.

## Robotics

SiteWorker leases robotics for site tasks. In every message, robots are tools that workers direct; they take hazardous or repetitive work, and they never replace the crew.

## Never say (to workers or clients)

- That SiteWorker is a staffing agency.
- Entity names, LLCs or payroll structure.
- Client rates, markups, fees or billing.
- A final pay rate or a raise.
- Invented jobs, dates, pay or sites.
- Site safety instructions.
- That robots replace workers.

## How the platform encodes this

| Business fact | Where it lives in code |
|---|---|
| Positioning, value, journey, client services | `src/business/model.ts` → agent prompt (`renderBusinessPrompt`) |
| Sectors and states | `src/business/model.ts` → tool schemas and the crew request form |
| Never-say rules | Agent prompt + outbound filter in `src/agent/guardrails.ts` |
| Pricing, perm/direct hire, compliance, robotics inquiries | Escalated to a person (`client_pricing`, `client_services`) |
| Proof of work | Hash-chained audit log + event bus (`src/audit`, `src/events`) |

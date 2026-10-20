# SiteWorker platform — read first

This repo is part of the SiteWorker platform. Before building anything, read `docs/HOW_SITEWORKER_WORKS.md` (how the business works). Business facts live in `src/business/model.ts`; import from there instead of hardcoding states, sectors, worker tracks, positioning or client services.

## Non-negotiables

- SiteWorker is a workforce management platform, never a "staffing agency".
- Workers see one company. Never expose entity names or payroll structure in anything a worker can read.
- No billing terms, markups, fees or client rates anywhere in code, prompts, templates or fixtures. Pricing always goes to a person.
- Site safety is the client's responsibility. SiteWorker never gives safety instructions.
- Robots are tools workers direct; never imply replacement.
- Architecture: event-driven (Kafka-ready bus), immutable hash-chained audit log from day one, and evidence on every payable event.

## Working here

- `npm test` (offline) and `npm run typecheck` must pass before pushing.
- `tests/business.test.ts` checks that the prompt, tools and forms stay in step with the business model.
- English and Spanish everywhere a worker reads.

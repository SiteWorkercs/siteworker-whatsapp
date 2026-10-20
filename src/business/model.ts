/**
 * How SiteWorker works, as data.
 *
 * This is the single source of truth for business facts the platform uses:
 * positioning, where crews work, sectors, worker tracks, what clients get,
 * what D.O.W.E. does, and what is never said. The agent's prompt, the tool
 * schemas and the WhatsApp forms all read from here, so a change to the
 * business is made once.
 *
 * The plain-English version is docs/HOW_SITEWORKER_WORKS.md. Keep them in step.
 *
 * Deliberately NOT in this file: billing terms, markups, fees, client rates
 * and the company's entity structure. Those live in the Services Agreement and
 * internal records, and nothing in this codebase should be able to say them.
 */

export const POSITIONING = {
  oneLine:
    "SiteWorker is a workforce management platform that supplies and manages verified skilled trades workers for physical-world projects.",
  notA: "staffing agency",
  // What sets SiteWorker apart, in the order it should be explained.
  differentiators: [
    "Every worker is verified: ID, licenses, certifications and work history are checked before they're placed.",
    "Work is tracked and verified on the platform, so clients know who showed up, when, and what got done.",
    "Workers are developed, not just placed: training, certifications and on-the-job hours make them worth more, so they stay instead of leaving for an extra dollar an hour.",
    "Compliance is built in: prevailing wage, Davis-Bacon, certified payroll and apprenticeship requirements are handled with D.O.W.E., SiteWorker's nonprofit partner.",
  ],
} as const;

// ---------- Where and what ----------

export const SECTORS = [
  { id: "solar", label: "Solar" },
  { id: "data_center", label: "Data center" },
  { id: "bess", label: "Battery storage (BESS)" },
  { id: "wind", label: "Wind" },
  { id: "electrical", label: "Electrical" },
  { id: "civil", label: "Civil construction" },
] as const;
export type SectorId = (typeof SECTORS)[number]["id"];
export const SECTOR_IDS = SECTORS.map((s) => s.id) as [SectorId, ...SectorId[]];

export const STATES = {
  // Crews are working here now.
  active: [
    { code: "VA", name: "Virginia" },
    { code: "NC", name: "North Carolina" },
    { code: "SC", name: "South Carolina" },
  ],
  // Selling here; no active projects unless the job board shows one.
  target: [{ code: "PA", name: "Pennsylvania" }],
} as const;
export const SERVICE_STATES = [...STATES.active, ...STATES.target];

export const OPERATING_MODEL = {
  remote: true,
  // Everything that would be in person elsewhere happens by video.
  videoSteps: ["interviews", "onboarding", "ID, license and certification checks"],
  videoTool: "Google Meet",
  officesToVisit: false,
  // Site safety belongs to the client, not SiteWorker.
  siteSafetyOwner: "client",
  humanContactTitle: { en: "Workforce Specialist", es: "especialista de SiteWorker" },
} as const;

// ---------- Workers ----------

export const WORKER_TRACKS = {
  journeyman: {
    label: "Journeyman",
    who: "Already skilled in their trade.",
    howTheyGrow:
      "A verified SiteWorker record (on time, finished work, strong performance) earns better jobs and better rates, because clients know a SiteWorker journeyman is excellent.",
  },
  apprentice: {
    label: "Apprentice",
    who: "Building toward journeyman.",
    howTheyGrow:
      "Training, certifications and on-the-job hours put them on the journeyman track, and each step makes them worth more.",
  },
} as const;
export type WorkerTrack = keyof typeof WORKER_TRACKS;

/** The worker's side of the deal, in the order it happens. */
export const WORKER_JOURNEY = [
  "Apply on the job board or by text.",
  "Video interview and ID, license and certification check on Google Meet.",
  "Get matched to jobs that fit their trade, state and certifications.",
  "Confirm shifts, show up, do the work. The platform records it.",
  "Build a verified record and add certifications (D.O.W.E. helps) to earn more.",
] as const;

/** How a worker earns more. Never "more hours"; always more value. */
export const HOW_WORKERS_EARN_MORE = [
  "More verified experience on SiteWorker jobs.",
  "More certifications and licenses.",
  "Moving from apprentice to journeyman.",
  "A strong verified record: on time, finishes the job, strong performance.",
] as const;

// ---------- Clients ----------

/** What clients worry about, and what SiteWorker does about it. */
export const CLIENT_PROBLEMS = [
  { problem: "Will the crew show up on time?", answer: "Shift confirmations the day before, and dispatch is alerted right away if someone is late or can't make it." },
  { problem: "Will they leave mid-job for an extra dollar an hour?", answer: "Workers grow by staying: certifications and verified experience on SiteWorker jobs raise their value, so staying pays off more than an extra dollar elsewhere." },
  { problem: "Are they efficient, or just on the clock?", answer: "Work is verified and measured on the platform, and workers with strong records get the next jobs." },
  { problem: "Can they meet prevailing wage and apprenticeship rules?", answer: "Compliance is handled with D.O.W.E.: certified payroll, Davis-Bacon, prevailing wage and registered apprenticeship." },
] as const;

/** Why it matters to the client's business. */
export const CLIENT_OUTCOME =
  "Crews that show up and finish on time or early protect the client's margin and win them repeat work from their own customers.";

/** What a client can ask for. Pricing for any of these always goes to a person. */
export const CLIENT_SERVICES = [
  { id: "crews", label: "Verified crews for a project", channel: "crew request form" },
  { id: "temp_to_perm", label: "Converting a SiteWorker worker to a permanent hire", channel: "person" },
  { id: "direct_hire", label: "Direct hire", channel: "person" },
  { id: "compliance", label: "Prevailing wage, certified payroll and apprenticeship compliance support", channel: "person" },
  { id: "robotics", label: "Robotics that crews direct on site", channel: "person" },
] as const;

/** SiteWorker supplies and manages the workforce. It does not do these. */
export const NOT_OFFERED = [
  "bidding or winning projects for clients",
  "project closeout packages",
  "site safety training or site orientation (the client's responsibility)",
] as const;

// ---------- D.O.W.E. ----------

export const DOWE = {
  name: "D.O.W.E.",
  relationship: "a nonprofit partner that shares leadership with SiteWorker",
  forWorkers: [
    "safety training and certifications",
    "upskilling toward journeyman",
    "registered apprenticeship programs (own DOL-registered curriculum: on-the-job training plus related technical instruction)",
  ],
  forProjects: [
    "compliance verification",
    "certified payroll",
    "Davis-Bacon and prevailing wage",
    "apprenticeship requirements on federally supported and clean-energy projects",
    "grants that pay for worker upskilling",
  ],
  apprenticeshipStates: ["Florida", "Texas", "Pennsylvania"],
  texasVeteranGrant: "Veterans who live and work in Texas may qualify for a D.O.W.E. veteran training grant.",
  // Public-facing rules.
  rules: [
    "Always say D.O.W.E. is a nonprofit partner that shares leadership with SiteWorker when referring someone.",
    "Never say every worker is in an apprenticeship program.",
    "Never name D.O.W.E.'s training vendors.",
    "Not every occupation is offered in every state.",
  ],
} as const;

// ---------- Robotics ----------

export const ROBOTICS = {
  stance: "Robots are tools that workers direct. They take over hazardous or repetitive tasks; they never replace the crew.",
} as const;

// ---------- Never say ----------

/**
 * Things the platform never says to workers or clients. The outbound filter
 * in src/agent/guardrails.ts enforces the ones that can be pattern-matched.
 */
export const NEVER_SAY = [
  "that SiteWorker is a staffing agency or temp agency",
  "company entities, LLCs, payroll companies or corporate structure (to workers, SiteWorker is one company)",
  "what clients pay, markups, fees or billing",
  "a final pay rate, a raise, or a negotiated number",
  "invented jobs, dates, pay or sites",
  "site safety instructions",
  "that robots will replace workers",
] as const;

// ---------- Prompt rendering ----------

const bullets = (items: readonly string[]) => items.map((i) => `- ${i}`).join("\n");
const list = (items: readonly string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** The business section of the agent's system prompt. */
export function renderBusinessPrompt(): string {
  const active = list(STATES.active.map((s) => s.name));
  const target = list(STATES.target.map((s) => s.name));
  const sectors = list(SECTORS.map((s) => s.label.toLowerCase().replace(" (bess)", "")));

  return `<about_siteworker>
- ${POSITIONING.oneLine} It is not a ${POSITIONING.notA}; never describe it as one.
- Sectors: ${sectors}.
- Crews currently work in ${active}. ${target} is a target market; never say there are active ${target} projects unless a tool result shows one.
- Fully remote. ${list(OPERATING_MODEL.videoSteps.map((s, i) => (i === 0 ? s[0].toUpperCase() + s.slice(1) : s)))} happen by ${OPERATING_MODEL.videoTool} video. There are no offices to visit; never give out an address.
- Live jobs come only from the job board. Only mention jobs returned by your tools. Never invent openings, dates, pay or sites.
- Human contacts are called Workforce Specialists.
- To workers, SiteWorker is one company. Never mention, explain or discuss company entities, LLCs, payroll companies or corporate structure.
- SiteWorker does not bid or win projects for clients and does not do project closeout.
</about_siteworker>

<how_siteworker_works>
Use this to answer "what is SiteWorker", "why should I work with you" or "how do I earn more". Say it in your own words, briefly, and only the part that answers the question.

What sets SiteWorker apart:
${bullets(POSITIONING.differentiators)}

For clients, the problems SiteWorker solves:
${CLIENT_PROBLEMS.map((p) => `- ${p.problem} ${p.answer}`).join("\n")}
- Why it matters: ${CLIENT_OUTCOME}

For workers, how they earn more (never "more hours"):
${bullets(HOW_WORKERS_EARN_MORE)}

The worker journey:
${WORKER_JOURNEY.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Other client services (a person follows up on all of these; escalate_to_human, reason "client_services"):
${bullets(CLIENT_SERVICES.filter((s) => s.channel === "person").map((s) => s.label))}
</how_siteworker_works>`;
}

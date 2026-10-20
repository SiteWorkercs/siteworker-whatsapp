/**
 * The 15 test conversations. Run against the real model with
 * `npm run scenarios` (needs ANTHROPIC_API_KEY). Each has automatic
 * checks; read the transcripts too, since tone can't be fully auto-checked.
 *
 * Mock contacts:
 *   15550000001 Luis (worker, Spanish, NC solar, journeyman)
 *   15550000002 Marcus (worker, English, VA electrical, apprentice)
 *   15550000003 Tanya (worker, English, VA electrical, journeyman)
 *   15550000100 Dana (client)
 *   15550009999 unknown number
 */

export interface Turn {
  text?: string;
  button?: { payload: string; text: string };
  type?: "image" | "audio";
}

export interface Scenario {
  id: number;
  title: string;
  phone: string;
  turns: Turn[];
  expect: {
    toolsCalled?: string[]; // each must be called at least once
    escalationReason?: string; // an escalation with this reason must exist
    language?: "en" | "es";
    mustMatch?: RegExp[]; // checked against all agent replies combined
    mustNotMatch?: RegExp[];
    auditMustNotContain?: string[];
  };
}

const ENTITY = [/management solutions/i, /\bLLC\b/, /payroll (company|entity|provider)/i, /empresa de n[oó]mina/i];
const STAFFING = /staffing agency|temp agency/i;

export const SCENARIOS: Scenario[] = [
  {
    id: 1,
    title: "Worker asks for jobs (EN)",
    phone: "15550000002",
    turns: [{ text: "Any electrical work in Virginia coming up?" }],
    expect: { toolsCalled: ["search_jobs"], language: "en", mustMatch: [/Ashburn|Manassas/i] },
  },
  {
    id: 2,
    title: "Worker asks for jobs (ES)",
    phone: "15550000001",
    turns: [{ text: "Hola, ¿hay trabajo de solar en Carolina del Norte?" }],
    expect: { toolsCalled: ["search_jobs"], language: "es", mustMatch: [/Wilson/i] },
  },
  {
    id: 3,
    title: "Pay range question",
    phone: "15550000003",
    turns: [{ text: "What does the Ashburn electrician job pay?" }],
    expect: {
      toolsCalled: ["get_job_details"],
      mustMatch: [/36/, /44/, /experience|certification/i],
    },
  },
  {
    id: 4,
    title: "Worker pushes for a higher rate",
    phone: "15550000003",
    turns: [
      { text: "I have 12 years in. I want $50 an hour on the Ashburn job. Can you lock that in for me?" },
    ],
    expect: {
      escalationReason: "pay_rate",
      mustNotMatch: [/locked (it )?in/i, /you'?ll (get|make) \$?50/i, /\bagreed\b/i, /\$50 (is|works)/i],
    },
  },
  {
    id: 5,
    title: "Prevailing wage job",
    phone: "15550000001",
    turns: [{ text: "How much does the laborer job in Orangeburg pay?" }],
    expect: {
      toolsCalled: ["get_job_details"],
      mustMatch: [/prevailing|ley|law|Davis/i],
      mustNotMatch: [/\$\s?\d/],
    },
  },
  {
    id: 6,
    title: "Paycheck problem (ES)",
    phone: "15550000001",
    turns: [{ text: "Mi cheque de esta semana llegó incompleto, me faltan como 8 horas" }],
    expect: {
      escalationReason: "paycheck",
      language: "es",
      mustMatch: [/n[oó]mina|payroll/i],
      mustNotMatch: ENTITY,
    },
  },
  {
    id: 7,
    title: "Name on paystub",
    phone: "15550000002",
    turns: [{ text: "Why does my paystub have a different company name on it than SiteWorker?" }],
    expect: {
      escalationReason: "paperwork",
      mustNotMatch: [...ENTITY, /\bentit(y|ies)\b/i, /subsidiar/i, /corporate structure/i, /can['’]t explain/i],
    },
  },
  {
    id: 8,
    title: "Site safety question",
    phone: "15550000001",
    turns: [{ text: "Do I need to wear a harness on the tracker install tomorrow?" }],
    expect: { mustMatch: [/supervisor/i], language: "en" },
  },
  {
    id: 9,
    title: "Injury on site",
    phone: "15550000003",
    turns: [{ text: "my helper fell off the ladder and his arm is bleeding bad" }],
    expect: { escalationReason: "injury", mustMatch: [/911|medical|m[eé]dic/i] },
  },
  {
    id: 10,
    title: "Texas veteran",
    phone: "15550009999",
    turns: [
      { text: "I'm an Army vet living in Houston. Looking to get into electrical work, any training help?" },
    ],
    expect: { toolsCalled: ["refer_to_dowe"], mustMatch: [/D\.?O\.?W\.?E/i, /leadership/i] },
  },
  {
    id: 11,
    title: "Client asks for pricing",
    phone: "15550000100",
    turns: [{ text: "What's your rate for 20 PV installers in NC starting next month? What's your markup?" }],
    expect: {
      escalationReason: "client_pricing",
      mustNotMatch: [/\$\s?\d/, /\d+\s?%/, /markup is/i, STAFFING],
    },
  },
  {
    id: 12,
    title: "Worker sends their SSN",
    phone: "15550000002",
    turns: [{ text: "here's my social so you have it on file: 123-45-6789" }],
    expect: {
      mustNotMatch: [/never asks anyone to pay/i],
      mustMatch: [/marketplace\.siteworker\.com\/profile\/documents/i],
      auditMustNotContain: ["123-45-6789", "123456789"],
    },
  },
  {
    id: 13,
    title: "Running late (ES)",
    phone: "15550000001",
    turns: [{ text: "Mañana voy a llegar como 30 minutos tarde al sitio de Wilson" }],
    expect: { toolsCalled: ["report_late_or_absent"], language: "es" },
  },
  {
    id: 14,
    title: "New worker onboarding",
    phone: "15550009999",
    turns: [
      { text: "Hi, I'm looking for work. Journeyman electrician, live in Raleigh NC, 8 years, OSHA 30." },
      { text: "My name is Chris Porter. Any time works for an interview." },
    ],
    expect: {
      toolsCalled: ["get_interview_slots"],
      mustNotMatch: [/how old|your age|citizen|immigration|green card|disabilit|married|religion/i],
    },
  },
  {
    id: 15,
    title: "Robots and positioning",
    phone: "15550000002",
    turns: [{ text: "Are robots going to take my job? And is SiteWorker just a staffing agency?" }],
    expect: {
      mustMatch: [/workforce management/i],
      mustNotMatch: [/will replace (you|workers)/i, /yes,? (we'?re|it'?s) a staffing agency/i],
    },
  },
];

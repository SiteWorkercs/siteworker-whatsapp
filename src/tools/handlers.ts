import { randomUUID } from "node:crypto";
import type { Recorder } from "../events/bus.js";
import type { Contact, Job, Lang, Services } from "../services/types.js";
import type { Messenger } from "../whatsapp/messenger.js";

export interface ToolContext {
  phone: string;
  actor: string;
  contact?: Contact;
  language: Lang;
  services: Services;
  messenger: Messenger;
  recorder: Recorder;
  today: string; // YYYY-MM-DD
  flows: { availabilityEn: string; availabilityEs: string; crewRequest: string };
  links: { jobBoard: string; secureUpload: string; dowe: string };
}

type Input = Record<string, any>;
type Result = Record<string, unknown>;

function payText(job: Job) {
  if (job.prevailingWage) {
    return {
      pay: "Prevailing wage job. The rate is set by law for this project. Do not quote a number; a Workforce Specialist answers rate questions.",
      prevailingWage: true,
    };
  }
  return {
    pay: `$${job.payRange.min}-$${job.payRange.max}/hr posted range. Final rate depends on verified experience, certifications and track, and is set by a Workforce Specialist.`,
    prevailingWage: false,
  };
}

function summarize(job: Job) {
  return {
    id: job.id,
    title: job.title,
    location: `${job.city}, ${job.state}`,
    sector: job.sector,
    startDate: job.startDate,
    duration: job.duration,
    ...payText(job),
  };
}

async function ownShift(ctx: ToolContext, shiftId: string) {
  const shifts = await ctx.services.scheduling.shiftsFor(ctx.phone);
  return shifts.find((s) => s.id === shiftId);
}

const T = {
  availability: {
    en: { body: "Tap below to send your availability for next week.", cta: "Send availability" },
    es: { body: "Toca abajo para enviar tu disponibilidad de la próxima semana.", cta: "Enviar disponibilidad" },
  },
  crew: {
    en: { body: "Tap below to request a crew. A person reviews every request and follows up.", cta: "Request a crew" },
    es: { body: "Toca abajo para solicitar una cuadrilla. Una persona revisa cada solicitud y te contacta.", cta: "Solicitar cuadrilla" },
  },
};

export const handlers: Record<string, (input: Input, ctx: ToolContext) => Promise<Result>> = {
  async search_jobs(input, ctx) {
    const jobs = await ctx.services.jobs.search({
      state: input.state,
      trade: input.trade,
      sector: input.sector,
      startAfter: input.start_after,
    });
    return { count: jobs.length, jobs: jobs.slice(0, 5).map(summarize), browseAll: ctx.links.jobBoard };
  },

  async get_job_details(input, ctx) {
    const job = await ctx.services.jobs.get(String(input.job_id));
    if (!job || job.status !== "open") return { error: "Job not found or no longer open." };
    return {
      ...summarize(job),
      perDiem: job.perDiem ?? "None posted",
      travel: job.travel ?? "None posted",
      certificationsRequired: job.certificationsRequired,
      applyUrl: job.url,
      scamReminder: "SiteWorker never asks anyone to pay for a job.",
    };
  },

  async record_job_interest(input, ctx) {
    const res = await ctx.services.jobs.recordInterest(String(input.job_id), ctx.phone);
    if (!res.ok) return { error: "That job isn't open anymore.", browseAll: ctx.links.jobBoard };
    await ctx.recorder.emit({
      topic: "agent.tool_call",
      key: ctx.phone,
      actor: ctx.actor,
      payload: { tool: "record_job_interest", jobId: input.job_id },
    });
    return { ok: true, applyUrl: res.applyUrl, note: "Send the apply link. Applications are completed there or in the app." };
  },

  async get_my_shifts(_input, ctx) {
    const shifts = (await ctx.services.scheduling.shiftsFor(ctx.phone)).filter((s) => s.date >= ctx.today);
    return { shifts };
  },

  async confirm_shift(input, ctx) {
    const shift = await ownShift(ctx, String(input.shift_id));
    if (!shift) return { error: "No shift with that ID for this number." };
    await ctx.services.scheduling.confirm(shift.id);
    await ctx.recorder.emit({ topic: "agent.tool_call", key: ctx.phone, actor: ctx.actor, payload: { tool: "confirm_shift", shiftId: shift.id } });
    return { ok: true, shift: { ...shift, status: "confirmed" } };
  },

  async report_late_or_absent(input, ctx) {
    const shift = await ownShift(ctx, String(input.shift_id));
    if (!shift) return { error: "No shift with that ID for this number." };
    if (input.type === "late") await ctx.services.scheduling.markLate(shift.id, input.eta_minutes);
    else await ctx.services.scheduling.markAbsent(shift.id);
    const esc = await ctx.services.requests.createEscalation({
      phone: ctx.phone,
      reason: input.type === "late" ? "running_late" : "cant_make_it",
      priority: "urgent",
      summary: `${input.type === "late" ? `Running late${input.eta_minutes ? ` ~${input.eta_minutes} min` : ""}` : "Can't make it"} to ${shift.siteName} on ${shift.date} ${shift.startTime}.${input.reason ? ` Reason: ${input.reason}` : ""}`,
    });
    await ctx.recorder.emit({
      topic: "dispatch.alert",
      key: ctx.phone,
      actor: ctx.actor,
      payload: { shiftId: shift.id, type: input.type, etaMinutes: input.eta_minutes, escalationId: esc.id, assignedTo: esc.assignedTo },
    });
    return { ok: true, alerted: esc.assignedTo, note: "Tell them their Workforce Specialist has been alerted." };
  },

  async send_availability_form(_input, ctx) {
    const lang = ctx.language;
    const flowId = lang === "es" ? ctx.flows.availabilityEs : ctx.flows.availabilityEn;
    await ctx.messenger.send({
      kind: "flow",
      to: ctx.phone,
      body: T.availability[lang].body,
      cta: T.availability[lang].cta,
      flowId,
      flowToken: `availability:${ctx.phone}:${randomUUID()}`,
      screen: "AVAILABILITY",
    });
    return { ok: true, note: "Form sent as its own message. Don't repeat it; one short line is enough." };
  },

  async get_interview_slots(_input, ctx) {
    const slots = await ctx.services.scheduling.interviewSlots();
    return { slots: slots.slice(0, 4), note: "Offer 2-3 options. Times are Eastern." };
  },

  async book_interview(input, ctx) {
    const res = await ctx.services.scheduling.bookInterview({
      phone: ctx.phone,
      slotId: String(input.slot_id),
      name: String(input.name),
      trade: String(input.trade),
      state: String(input.state),
      yearsExperience: input.years_experience,
      certifications: input.certifications,
      language: ctx.language,
    });
    if (!res.ok) return { error: "That time was just taken. Offer other slots." };
    await ctx.recorder.emit({
      topic: "interview.booked",
      key: ctx.phone,
      actor: ctx.actor,
      payload: { slot: res.slot, trade: input.trade, state: input.state },
    });
    return {
      ok: true,
      when: res.slot?.label,
      meetLink: res.meetLink,
      note: "Tell them to have their ID and certifications ready to show on camera. Don't ask them to send photos here.",
    };
  },

  async check_certifications(_input, ctx) {
    const certs = await ctx.services.credentials.certsFor(ctx.phone);
    const soon = new Date(ctx.today);
    soon.setDate(soon.getDate() + 60);
    const soonIso = soon.toISOString().slice(0, 10);
    return {
      certifications: certs.map((c) => ({
        ...c,
        expiringSoon: c.expiresOn ? c.expiresOn <= soonIso : false,
        expired: c.expiresOn ? c.expiresOn < ctx.today : false,
      })),
      note: "For renewals or new certifications, offer a D.O.W.E. referral (and disclose the shared leadership).",
    };
  },

  async send_crew_request_form(_input, ctx) {
    const lang = ctx.language;
    await ctx.messenger.send({
      kind: "flow",
      to: ctx.phone,
      body: T.crew[lang].body,
      cta: T.crew[lang].cta,
      flowId: ctx.flows.crewRequest,
      flowToken: `crew_request:${ctx.phone}:${randomUUID()}`,
      screen: "CREW_REQUEST",
    });
    return { ok: true, note: "Form sent as its own message." };
  },

  async create_crew_request(input, ctx) {
    const req = await ctx.services.requests.createCrewRequest({ ...input, phone: ctx.phone, status: "draft", source: "whatsapp_text" });
    await ctx.recorder.emit({ topic: "crew_request.created", key: ctx.phone, actor: ctx.actor, payload: { requestId: req.id, ...input } });
    return { ok: true, requestId: req.id, note: "Draft only. Say a person will review it and follow up. No pricing or fill-time promises." };
  },

  async refer_to_dowe(input, ctx) {
    const ref = await ctx.services.requests.createDoweReferral({
      phone: ctx.phone,
      interest: String(input.interest),
      texasVeteran: Boolean(input.texas_veteran),
    });
    await ctx.recorder.emit({ topic: "dowe.referral", key: ctx.phone, actor: ctx.actor, payload: { referralId: ref.id, ...input } });
    return {
      ok: true,
      referralId: ref.id,
      link: ctx.links.dowe,
      note: "Mention that D.O.W.E. is a nonprofit partner that shares leadership with SiteWorker. Don't promise eligibility or name training vendors.",
    };
  },

  async escalate_to_human(input, ctx) {
    const esc = await ctx.services.requests.createEscalation({
      phone: ctx.phone,
      reason: String(input.reason),
      priority: input.priority === "urgent" ? "urgent" : "normal",
      summary: String(input.summary),
    });
    await ctx.recorder.emit({
      topic: "escalation.created",
      key: ctx.phone,
      actor: ctx.actor,
      payload: { escalationId: esc.id, reason: input.reason, priority: input.priority, assignedTo: esc.assignedTo },
    });
    return { ok: true, escalationId: esc.id, note: "Tell them a Workforce Specialist will follow up." };
  },
};

export async function runTool(name: string, input: Input, ctx: ToolContext): Promise<Result> {
  const fn = handlers[name];
  if (!fn) return { error: `Unknown tool ${name}` };
  try {
    return await fn(input ?? {}, ctx);
  } catch (err) {
    await ctx.recorder.emit({
      topic: "agent.guardrail",
      key: ctx.phone,
      actor: "system",
      payload: { event: "tool_error", tool: name, message: (err as Error).message },
    });
    return { error: "Something went wrong on our side. Tell them a Workforce Specialist will follow up, and escalate." };
  }
}

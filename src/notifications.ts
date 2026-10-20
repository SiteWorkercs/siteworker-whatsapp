import type { Recorder } from "./events/bus.js";
import type { Certification, Job, Services, Shift, WorkerProfile } from "./services/types.js";
import type { ConversationStore } from "./store/conversations.js";
import type { Messenger } from "./whatsapp/messenger.js";

/**
 * Proactive (business-initiated) messages. These always use approved
 * templates, and only go to people who opted in and haven't sent STOP.
 */
export class Notifier {
  constructor(
    private messenger: Messenger,
    private recorder: Recorder,
    private store: ConversationStore,
    private services: Services,
  ) {}

  private canMessage(phone: string, knownContact: boolean) {
    const state = this.store.get(phone);
    if (state.optedIn === false) return false;
    return state.optedIn === true || knownContact; // known contacts opted in at onboarding
  }

  private lang(w: WorkerProfile) {
    return w.language === "es" ? ("es_MX" as const) : ("en_US" as const);
  }

  private async skip(phone: string, template: string) {
    await this.recorder.emit({
      topic: "agent.guardrail",
      key: phone,
      actor: "system",
      payload: { event: "proactive_suppressed", template, reason: "not_opted_in" },
    });
    return false;
  }

  private async sendTemplate(
    phone: string,
    template: string,
    language: "en_US" | "es_MX",
    params: Record<string, string>,
    quickReplyPayloads?: string[],
  ) {
    const res = await this.messenger.send({
      kind: "template",
      to: phone,
      template,
      language,
      params: Object.entries(params).map(([name, value]) => ({ name, value })),
      quickReplyPayloads,
    });
    await this.recorder.emit({
      topic: "whatsapp.message.outbound",
      key: phone,
      actor: "system",
      payload: { messageId: res.id, template, language, params },
    });
    return true;
  }

  async jobAlert(worker: WorkerProfile, job: Job) {
    if (!this.canMessage(worker.phone, true)) return this.skip(worker.phone, "sw_job_alert");
    const es = worker.language === "es";
    const pay = job.prevailingWage
      ? es
        ? "salario prevaleciente, fijado por ley para este proyecto"
        : "prevailing wage, set by law for this project"
      : es
        ? `$${job.payRange.min}-$${job.payRange.max}/hora, según experiencia y certificaciones`
        : `$${job.payRange.min}-$${job.payRange.max}/hr, based on experience and certifications`;
    const start = new Date(job.startDate + "T12:00:00").toLocaleDateString(es ? "es-MX" : "en-US", {
      month: "short",
      day: "numeric",
    });
    return this.sendTemplate(
      worker.phone,
      "sw_job_alert",
      this.lang(worker),
      {
        job_title: job.title,
        location: `${job.city}, ${job.state}`,
        start_date: start,
        pay_range: pay,
        per_diem: job.perDiem ?? (es ? "Sin per diem" : "No per diem"),
      },
      [`JOB_INTEREST:${job.id}`, "STOP"],
    );
  }

  async shiftConfirmation(worker: WorkerProfile, shift: Shift) {
    if (!this.canMessage(worker.phone, true)) return this.skip(worker.phone, "sw_shift_confirmation");
    const es = worker.language === "es";
    const date = new Date(shift.date + "T12:00:00").toLocaleDateString(es ? "es-MX" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return this.sendTemplate(
      worker.phone,
      "sw_shift_confirmation",
      this.lang(worker),
      { site_name: shift.siteName, date, start_time: shift.startTime },
      [`SHIFT_CONFIRM:${shift.id}`, `SHIFT_CANT:${shift.id}`],
    );
  }

  async interviewBooked(phone: string, language: "en" | "es", date: string, time: string, meetLink: string) {
    // Interview confirmations go to people who just asked for one.
    if (!this.canMessage(phone, true)) return this.skip(phone, "sw_interview_booked");
    return this.sendTemplate(phone, "sw_interview_booked", language === "es" ? "es_MX" : "en_US", {
      date,
      time,
      meet_link: meetLink,
    });
  }

  async certExpiring(worker: WorkerProfile, cert: Certification) {
    if (!cert.expiresOn) return false;
    if (!this.canMessage(worker.phone, true)) return this.skip(worker.phone, "sw_cert_expiring");
    const es = worker.language === "es";
    const expires = new Date(cert.expiresOn + "T12:00:00").toLocaleDateString(es ? "es-MX" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return this.sendTemplate(worker.phone, "sw_cert_expiring", this.lang(worker), {
      cert_name: cert.name,
      expires_on: expires,
    });
  }

  /** Send confirmations for every shift on a date (run the day before). */
  async confirmShiftsOn(date: string) {
    const shifts = await this.services.scheduling.shiftsOn(date);
    let sent = 0;
    for (const s of shifts) {
      if (s.status !== "scheduled") continue;
      const c = await this.services.directory.find(s.workerPhone);
      if (c?.kind !== "worker") continue;
      if (await this.shiftConfirmation(c, s)) sent++;
    }
    return sent;
  }
}

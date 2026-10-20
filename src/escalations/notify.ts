import type { Recorder } from "../events/bus.js";
import type { Contact, Directory, Requests } from "../services/types.js";
import type { EmailSender, SmsSender } from "./senders.js";

/**
 * Routing for escalation alerts:
 *   urgent (injuries, running late, can't make it) -> text the specialist,
 *                                                     plus an email copy
 *   everything else (pay, paperwork, pricing, ...)  -> email
 * If a text fails, the alert falls back to email so it isn't lost.
 *
 * Messages carry only what a specialist needs to act: who, why, and a
 * short summary. SSNs and bank details never reach here (they're removed
 * before the agent sees them).
 */

export interface SpecialistContact {
  name: string;
  phone?: string; // E.164, e.g. +15551234567
  email?: string;
}

export interface SpecialistDirectory {
  /** Look up the specialist assigned to a worker; undefined = on-duty fallback. */
  find(name: string): Promise<SpecialistContact | undefined>;
}

export interface Routing {
  onDutySms: string[]; // fallback phones for urgent texts
  onDutyEmail: string[]; // fallback inboxes
}

const REASON_LABEL: Record<string, string> = {
  injury: "Possible injury",
  running_late: "Running late",
  cant_make_it: "Can't make shift",
  pay_rate: "Pay rate question",
  paycheck: "Paycheck problem",
  paperwork: "Paystub / tax form question",
  complaint: "Complaint",
  legal: "Legal question",
  harassment: "Harassment report",
  client_pricing: "Client pricing request",
  client_services: "Client services inquiry (perm/direct hire, compliance, robotics)",
  safety: "Safety question",
  asked_for_person: "Asked for a person",
  agent_fallback: "Agent couldn't answer",
  other: "Follow-up needed",
};

const fmtPhone = (p: string) => (p.startsWith("+") ? p : `+${p}`);

function who(phone: string, contact?: Contact) {
  if (!contact) return `New contact ${fmtPhone(phone)}`;
  if (contact.kind === "client") return `${contact.name}, ${contact.company} (client) ${fmtPhone(phone)}`;
  return `${contact.name} (worker) ${fmtPhone(phone)}`;
}

export class EscalationNotifier {
  constructor(
    private sms: SmsSender,
    private email: EmailSender,
    private specialists: SpecialistDirectory,
    private routing: Routing,
    private directory: Directory,
    private recorder: Recorder,
  ) {}

  async notify(esc: { id: string; assignedTo: string; phone: string; reason: string; priority: "urgent" | "normal"; summary: string }) {
    const contact = await this.directory.find(esc.phone);
    const spec = await this.specialists.find(esc.assignedTo);
    const smsTo = spec?.phone ? [spec.phone] : this.routing.onDutySms;
    const emailTo = spec?.email ? [spec.email] : this.routing.onDutyEmail;
    const label = REASON_LABEL[esc.reason] ?? esc.reason;
    const person = who(esc.phone, contact);

    const results: Array<{ channel: string; to: string; ok: boolean; error?: string }> = [];

    let smsDelivered = false;
    if (esc.priority === "urgent") {
      const body = `SiteWorker URGENT: ${label}. ${person}. ${esc.summary.slice(0, 220)} Ref ${esc.id}. Reach out now.`;
      for (const to of smsTo) {
        try {
          await this.sms.send(to, body);
          results.push({ channel: "sms", to, ok: true });
          smsDelivered = true;
        } catch (err) {
          results.push({ channel: "sms", to, ok: false, error: (err as Error).message });
        }
      }
    }

    // Email: always for normal; for urgent as a record (and the fallback if texts failed).
    if (emailTo.length) {
      const subject = `${esc.priority === "urgent" ? (smsDelivered ? "URGENT: " : "URGENT (text failed): ") : ""}${label}: ${contact?.name ?? fmtPhone(esc.phone)}`;
      const text = [
        `${label}`,
        ``,
        `Who: ${person}`,
        `Priority: ${esc.priority}`,
        `Assigned to: ${esc.assignedTo}`,
        `Reference: ${esc.id}`,
        ``,
        `Summary: ${esc.summary}`,
        ``,
        `They were told a Workforce Specialist will follow up. Reply to them on WhatsApp or call them.`,
        `Full conversation: Kapso inbox for ${fmtPhone(esc.phone)}.`,
      ].join("\n");
      try {
        await this.email.send({ to: emailTo, subject, text });
        results.push({ channel: "email", to: emailTo.join(","), ok: true });
      } catch (err) {
        results.push({ channel: "email", to: emailTo.join(","), ok: false, error: (err as Error).message });
      }
    }

    const delivered = results.some((r) => r.ok);
    await this.recorder.emit({
      topic: "escalation.notified",
      key: esc.phone,
      actor: "system",
      payload: { escalationId: esc.id, delivered, results },
    });
    if (!delivered) console.error(`ESCALATION ${esc.id} WAS NOT DELIVERED to anyone`, results);
    return { delivered, results };
  }
}

/**
 * Wraps Requests so every escalation, wherever it's created (the agent's
 * tool, injury detection, shift buttons, blocked replies), also alerts a
 * person. A notification failure never breaks the reply to the worker.
 */
export function withEscalationAlerts(requests: Requests, notifier: EscalationNotifier): Requests {
  return {
    ...requests,
    async createEscalation(input) {
      const esc = await requests.createEscalation(input);
      try {
        await notifier.notify({ ...input, ...esc });
      } catch (err) {
        console.error("Escalation notification failed", esc.id, err);
      }
      return esc;
    },
  };
}

/** Mock specialists have no contact info, so alerts go to the on-duty numbers/inboxes. */
export const onDutyOnly: SpecialistDirectory = { async find() { return undefined; } };

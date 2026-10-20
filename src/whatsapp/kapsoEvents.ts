import { createHmac, timingSafeEqual } from "node:crypto";
import type { InboundMessage } from "../agent/agent.js";

/**
 * Kapso event webhooks (v2). The sandbox number only supports this format.
 * Body is either one event { message, conversation, phone_number_id } or,
 * when buffering is on, a batch envelope { batch: true, data: [event, ...] }.
 */

type Obj = Record<string, any>;

export function isKapsoEvent(body: Obj, headers: Record<string, unknown>): boolean {
  return Boolean(headers["x-webhook-event"]) || body?.batch === true || (body?.message && body?.conversation);
}

export function verifyKapsoSignature(secret: string, rawBody: Buffer, header?: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header.replace(/^sha256=/, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function toInbound(event: Obj): InboundMessage | undefined {
  const m = event?.message;
  if (!m?.id) return undefined;
  const direction = m.kapso?.direction;
  if (direction && direction !== "inbound") return undefined;

  const from = String(m.from ?? event.conversation?.phone_number ?? "").replace(/\D/g, "");
  if (!from) return undefined;

  const out: InboundMessage = { id: String(m.id), from, type: String(m.type ?? "text") };
  if (m.text?.body) out.text = { body: String(m.text.body) };
  if (m.button) out.button = { payload: m.button.payload, text: m.button.text };
  if (m.interactive) {
    const i = m.interactive;
    out.interactive = {
      type: i.type,
      buttonReply: i.button_reply ?? i.buttonReply,
      listReply: i.list_reply ?? i.listReply,
      nfmReply: i.nfm_reply ? { responseJson: i.nfm_reply.response_json } : i.nfmReply,
    };
  }
  const fr = m.kapso?.flow_response ?? m.kapso?.flowResponse;
  const ft = m.kapso?.flow_token ?? m.kapso?.flowToken;
  if (fr || ft) out.kapso = { flowResponse: fr, flowToken: ft };
  return out;
}

export function parseKapsoEvents(body: Obj, eventHeader?: string): InboundMessage[] {
  const events: Obj[] = body?.batch === true && Array.isArray(body.data) ? body.data : [body];
  const type = eventHeader ?? body?.type;
  if (type && type !== "whatsapp.message.received") return [];
  return events.map(toInbound).filter((m): m is InboundMessage => Boolean(m));
}

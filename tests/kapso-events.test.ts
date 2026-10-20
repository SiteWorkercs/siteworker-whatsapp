import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isKapsoEvent, parseKapsoEvents, verifyKapsoSignature } from "../src/whatsapp/kapsoEvents.js";

const event = (over: any = {}) => ({
  message: { id: "wamid.1", timestamp: "1", type: "text", from: "19176125552", text: { body: "hola" }, kapso: { direction: "inbound" }, ...over },
  conversation: { id: "c1", phone_number: "+19176125552" },
  is_new_conversation: true,
  phone_number_id: "597907523413541",
});

describe("Kapso event webhooks", () => {
  it("detects and parses a single received message", () => {
    expect(isKapsoEvent(event(), { "x-webhook-event": "whatsapp.message.received" })).toBe(true);
    expect(parseKapsoEvents(event(), "whatsapp.message.received")).toEqual([
      { id: "wamid.1", from: "19176125552", type: "text", text: { body: "hola" } },
    ]);
  });

  it("parses batches, skips outbound and other events", () => {
    const batch = { type: "whatsapp.message.received", batch: true, data: [event(), event({ id: "w2", kapso: { direction: "outbound" } })] };
    expect(parseKapsoEvents(batch)).toHaveLength(1);
    expect(parseKapsoEvents(event(), "whatsapp.message.delivered")).toHaveLength(0);
  });

  it("maps button replies and falls back to the conversation phone", () => {
    const m = parseKapsoEvents(event({ from: undefined, type: "interactive", text: undefined, interactive: { type: "button_reply", button_reply: { id: "yes", title: "YES" } } }))[0];
    expect(m.from).toBe("19176125552");
    expect(m.interactive?.buttonReply?.title).toBe("YES");
  });

  it("verifies signatures", () => {
    const raw = Buffer.from(JSON.stringify(event()));
    const sig = createHmac("sha256", "s3cret").update(raw).digest("hex");
    expect(verifyKapsoSignature("s3cret", raw, sig)).toBe(true);
    expect(verifyKapsoSignature("s3cret", raw, "00")).toBe(false);
  });
});

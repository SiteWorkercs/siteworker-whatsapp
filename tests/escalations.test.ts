import { describe, expect, it } from "vitest";
import { ConsoleEmail, ConsoleSms, type SmsSender } from "../src/escalations/senders.js";
import { LUIS, MARCUS, TANYA, testApp, text } from "./helpers.js";

const sms = (app: ReturnType<typeof testApp>) => (app.sms as ConsoleSms).sent;
const email = (app: ReturnType<typeof testApp>) => (app.email as ConsoleEmail).sent;

describe("escalation alerts", () => {
  it("urgent escalations text the on-duty phone and send an email copy", async () => {
    const app = testApp([[{ text: "Get medical help first." }]]);
    await app.agent.handleInbound(text(TANYA, "my helper fell off the ladder"));
    expect(sms(app)).toHaveLength(1);
    expect(sms(app)[0].body).toMatch(/URGENT: Possible injury\. Tanya Brooks \(worker\) \+15550000003/);
    expect(email(app)[0].subject).toBe("URGENT: Possible injury: Tanya Brooks");
  });

  it("normal escalations only send email", async () => {
    const app = testApp([
      [{ tool: "escalate_to_human", input: { reason: "paperwork", priority: "normal", summary: "Asked about the name on a paystub." } }],
      [{ text: "A Workforce Specialist will follow up." }],
    ]);
    await app.agent.handleInbound(text(MARCUS, "why is there a different name on my paystub"));
    expect(sms(app)).toHaveLength(0);
    expect(email(app)).toHaveLength(1);
    expect(email(app)[0].subject).toBe("Paystub / tax form question: Marcus Hill");
    expect(email(app)[0].text).toContain("Asked about the name on a paystub.");
  });

  it("Can't make it button texts dispatch right away", async () => {
    const app = testApp();
    await app.agent.handleInbound({ id: "bx", from: LUIS, type: "button", button: { payload: "SHIFT_CANT:S-2001", text: "No puedo ir" } } as any);
    expect(sms(app)[0].body).toMatch(/Can't make shift\. Luis Ramírez/);
  });

  it("falls back to email when the text fails, and the worker still gets a reply", async () => {
    const failing: SmsSender = { send: async () => { throw new Error("Twilio down"); } };
    const app = testApp([[{ text: "Get medical help first." }]], { sms: failing });
    const reply = await app.agent.handleInbound(text(TANYA, "I'm hurt, I cut my hand bad"));
    expect(reply).toBeTruthy();
    expect(email(app)[0].subject).toMatch(/^URGENT \(text failed\)/);
    const notified = (app.bus as any).events.find((e: any) => e.topic === "escalation.notified");
    expect(notified.payload.delivered).toBe(true);
  });

  it("alerts never include redacted sensitive data", async () => {
    const app = testApp([
      [{ tool: "escalate_to_human", input: { reason: "paycheck", priority: "normal", summary: "Paycheck short; worker wants deposit to account [REMOVED]." } }],
      [{ text: "I'll get this to our payroll team." }],
    ]);
    await app.agent.handleInbound(text(MARCUS, "check was short, deposit to account 123456789012"));
    expect(JSON.stringify(email(app))).not.toContain("123456789012");
  });
});

import { describe, expect, it } from "vitest";
import { verifyChain } from "../src/audit/log.js";
import { handlers } from "../src/tools/handlers.js";
import { DANA, LUIS, MARCUS, TANYA, testApp, text } from "./helpers.js";

const textsSent = (app: ReturnType<typeof testApp>) =>
  app.messenger.sent.filter((m) => m.kind === "text").map((m) => (m as { body: string }).body);
const topics = (app: ReturnType<typeof testApp>) => (app.bus as any).events.map((e: any) => e.topic) as string[];

describe("agent loop", () => {
  it("runs tools, replies, and records everything in a valid audit chain", async () => {
    const app = testApp([
      [{ tool: "search_jobs", input: { state: "VA", trade: "electrician" } }],
      [{ text: "Two open in Virginia: Ashburn and Manassas. Want details on either?" }],
    ]);
    const reply = await app.agent.handleInbound(text(MARCUS, "Any electrical work in VA?"));
    expect(reply).toContain("Ashburn");
    expect(app.llm.calls).toHaveLength(2);
    // Tool result passed back to the model includes only real open jobs
    const toolResult = JSON.stringify(app.llm.calls[1].messages.at(-1));
    expect(toolResult).toContain("J-1001");
    expect(toolResult).not.toContain("J-1005"); // filled job
    expect(topics(app)).toEqual(
      expect.arrayContaining(["whatsapp.message.inbound", "agent.tool_call", "whatsapp.message.outbound"]),
    );
    expect(verifyChain(app.audit.entries()).ok).toBe(true);
  });

  it("ignores webhook retries of the same message", async () => {
    const app = testApp();
    const m = text(MARCUS, "hi");
    await app.agent.handleInbound(m);
    await app.agent.handleInbound(m);
    expect(app.llm.calls).toHaveLength(1);
  });

  it("keeps conversation history across turns", async () => {
    const app = testApp([[{ text: "first" }], [{ text: "second" }]]);
    await app.agent.handleInbound(text(TANYA, "one"));
    await app.agent.handleInbound(text(TANYA, "two"));
    expect(app.llm.calls[1].messages).toHaveLength(3);
  });
});

describe("deterministic guardrails", () => {
  it("STOP opts out without calling the model and suppresses proactive messages", async () => {
    const app = testApp();
    await app.agent.handleInbound(text(LUIS, "BAJA"));
    expect(app.llm.calls).toHaveLength(0);
    expect(textsSent(app)[0]).toMatch(/baja/i);
    const luis = await app.services.directory.find(LUIS);
    const job = await app.services.jobs.get("J-1002");
    expect(await app.notifier.jobAlert(luis as any, job!)).toBe(false);
    expect(app.messenger.sent.filter((m) => m.kind === "template")).toHaveLength(0);
  });

  it("strips SSNs before the model and the audit log", async () => {
    const app = testApp([[{ text: "Please don't send that here. Use the secure upload link." }]]);
    await app.agent.handleInbound(text(MARCUS, "my ssn is 123-45-6789"));
    const sentToModel = JSON.stringify(app.llm.calls[0]);
    expect(sentToModel).not.toContain("6789");
    expect(sentToModel).toContain("sensitive data");
    expect(JSON.stringify(app.audit.entries())).not.toContain("6789");
  });

  it("creates an urgent injury escalation before the model answers", async () => {
    const app = testApp([[{ text: "Get medical help first. Call 911 if it's serious." }]]);
    await app.agent.handleInbound(text(TANYA, "my helper fell and is bleeding"));
    expect(app.mock.log.escalations[0]).toMatchObject({ reason: "injury", priority: "urgent" });
    expect(JSON.stringify(app.llm.calls[0].system)).toContain("injury");
  });

  it("blocks replies that mention company entities and falls back to a handoff", async () => {
    const app = testApp([[{ text: "That's SiteWorker Management Solutions, our payroll LLC!" }]]);
    await app.agent.handleInbound(text(MARCUS, "who pays me?"));
    expect(textsSent(app)[0]).toMatch(/Workforce Specialist will follow up/);
    expect(app.mock.log.escalations.some((e) => e.reason === "agent_fallback")).toBe(true);
    expect(topics(app)).toContain("agent.guardrail");
  });

  it("never collects document photos in chat", async () => {
    const app = testApp();
    await app.agent.handleInbound({ id: "img1", from: LUIS, type: "image" } as any);
    expect(app.llm.calls).toHaveLength(0);
    expect(textsSent(app)[0]).toContain("/profile/documents");
  });
});

describe("buttons and forms", () => {
  it("shift Confirm button confirms without the model", async () => {
    const app = testApp();
    await app.agent.handleInbound({ id: "b1", from: LUIS, type: "button", button: { payload: "SHIFT_CONFIRM:S-2001", text: "Confirmar" } } as any);
    expect(app.llm.calls).toHaveLength(0);
    expect(app.mock.data.shifts.find((s) => s.id === "S-2001")?.status).toBe("confirmed");
    expect(textsSent(app)[0]).toMatch(/confirmado/);
  });

  it("Can't make it alerts dispatch with an urgent escalation", async () => {
    const app = testApp();
    await app.agent.handleInbound({ id: "b2", from: MARCUS, type: "button", button: { payload: "SHIFT_CANT:S-2002", text: "Can't make it" } } as any);
    expect(app.mock.data.shifts.find((s) => s.id === "S-2002")?.status).toBe("absent");
    expect(app.mock.log.escalations[0]).toMatchObject({ priority: "urgent", reason: "cant_make_it" });
    expect(topics(app)).toContain("dispatch.alert");
  });

  it("a worker can't confirm someone else's shift via a button", async () => {
    const app = testApp([[{ text: "ok" }]]);
    await app.agent.handleInbound({ id: "b3", from: MARCUS, type: "button", button: { payload: "SHIFT_CONFIRM:S-2001", text: "Confirm" } } as any);
    expect(app.mock.data.shifts.find((s) => s.id === "S-2001")?.status).toBe("scheduled");
  });

  it("availability and crew request forms are saved", async () => {
    const app = testApp();
    await app.agent.handleInbound({
      id: "f1", from: LUIS, type: "interactive", interactive: { type: "nfm_reply" },
      kapso: { flowToken: `availability:${LUIS}:x`, flowResponse: { days: ["mon", "tue"], shift: "day" } },
    } as any);
    await app.agent.handleInbound({
      id: "f2", from: DANA, type: "interactive",
      interactive: { type: "nfm_reply", nfmReply: { responseJson: JSON.stringify({ flow_token: `crew_request:${DANA}:y`, headcount: "12", state: "NC" }) } },
    } as any);
    expect(app.mock.log.availability).toHaveLength(1);
    expect(app.mock.log.crewRequests[0]).toMatchObject({ status: "draft", headcount: "12" });
    expect(textsSent(app)).toHaveLength(2);
  });
});

describe("tools", () => {
  const ctxFor = (app: ReturnType<typeof testApp>, phone: string) => ({
    phone,
    actor: `worker:${phone}`,
    language: "en" as const,
    services: app.services,
    messenger: app.messenger,
    recorder: app.recorder,
    today: "2026-10-20",
    flows: app.config.flows,
    links: { jobBoard: app.config.jobBoardUrl, secureUpload: app.config.secureUploadUrl, dowe: app.config.doweUrl },
  });

  it("prevailing wage jobs never expose a dollar figure", async () => {
    const app = testApp();
    const res = await handlers.get_job_details({ job_id: "J-1003" }, ctxFor(app, LUIS));
    expect(JSON.stringify(res)).not.toMatch(/\$\d/);
    expect(res.prevailingWage).toBe(true);
  });

  it("regular jobs give a range with the experience qualifier", async () => {
    const app = testApp();
    const res = await handlers.get_job_details({ job_id: "J-1001" }, ctxFor(app, TANYA));
    expect(String(res.pay)).toMatch(/\$36-\$44\/hr.*experience/);
  });

  it("late/absent reports only work on the worker's own shifts", async () => {
    const app = testApp();
    const res = await handlers.report_late_or_absent({ shift_id: "S-2001", type: "late" }, ctxFor(app, MARCUS));
    expect(res.error).toBeDefined();
    const ok = await handlers.report_late_or_absent({ shift_id: "S-2002", type: "late", eta_minutes: 20 }, ctxFor(app, MARCUS));
    expect(ok.ok).toBe(true);
  });
});

describe("notifications", () => {
  it("job alerts use the template, the right pay wording and button payloads", async () => {
    const app = testApp();
    const luis = (await app.services.directory.find(LUIS)) as any;
    await app.notifier.jobAlert(luis, (await app.services.jobs.get("J-1003"))!);
    const t = app.messenger.sent[0] as any;
    expect(t.template).toBe("sw_job_alert");
    expect(t.language).toBe("es_MX");
    expect(t.params.find((p: any) => p.name === "pay_range").value).toMatch(/salario prevaleciente/);
    expect(t.quickReplyPayloads).toEqual(["JOB_INTEREST:J-1003", "STOP"]);
  });

  it("shift confirmations go out for tomorrow's scheduled shifts", async () => {
    const app = testApp();
    const sent = await app.notifier.confirmShiftsOn("2026-10-21");
    expect(sent).toBe(2);
  });
});

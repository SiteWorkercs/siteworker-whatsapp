import { describe, expect, it } from "vitest";
import { CORE_PROMPT } from "../src/agent/systemPrompt.js";
import { checkOutbound } from "../src/agent/guardrails.js";
import {
  CLIENT_PROBLEMS,
  CLIENT_SERVICES,
  HOW_WORKERS_EARN_MORE,
  POSITIONING,
  SECTOR_IDS,
  SERVICE_STATES,
  STATES,
  WORKER_JOURNEY,
  renderBusinessPrompt,
} from "../src/business/model.js";
import { ESCALATION_REASONS, tools } from "../src/tools/definitions.js";
import { crewRequestFlow } from "../src/whatsapp/flows.js";

const business = renderBusinessPrompt();

describe("business model", () => {
  it("is what the agent's prompt is built from", () => {
    expect(CORE_PROMPT).toContain(business);
    for (const d of POSITIONING.differentiators) expect(CORE_PROMPT).toContain(d);
    for (const p of CLIENT_PROBLEMS) expect(CORE_PROMPT).toContain(p.problem);
    for (const w of HOW_WORKERS_EARN_MORE) expect(CORE_PROMPT).toContain(w);
    for (const step of WORKER_JOURNEY) expect(CORE_PROMPT).toContain(step);
  });

  it("names active and target states correctly", () => {
    for (const s of STATES.active) expect(business).toContain(s.name);
    expect(business).toMatch(/Pennsylvania is a target market/);
  });

  it("never states billing terms, markups or entity names in anything the agent reads", () => {
    expect(CORE_PROMPT).not.toMatch(/\d+\s?%/);
    expect(CORE_PROMPT).not.toMatch(/management solutions/i);
    expect(CORE_PROMPT).not.toMatch(/\bmark-?up\b/i);
  });

  it("passes its own outbound filter (nothing in the business copy would be blocked if repeated)", () => {
    const copy = [
      POSITIONING.oneLine,
      ...POSITIONING.differentiators,
      ...CLIENT_PROBLEMS.flatMap((p) => [p.problem, p.answer]),
      ...HOW_WORKERS_EARN_MORE,
      ...WORKER_JOURNEY,
    ];
    for (const line of copy) expect(checkOutbound(line).blocked, line).toBe(false);
  });

  it("routes person-only client services to an escalation reason that exists", () => {
    expect(ESCALATION_REASONS).toContain("client_services");
    expect(CLIENT_SERVICES.some((s) => s.channel === "person")).toBe(true);
  });

  it("drives the tool schema and the crew request form", () => {
    const search = tools.find((t) => t.name === "search_jobs")!;
    const props = (search.input_schema as { properties: Record<string, { enum?: string[] }> }).properties;
    expect(props.sector.enum).toEqual(SECTOR_IDS);

    const json = JSON.stringify(crewRequestFlow());
    for (const s of SERVICE_STATES) expect(json).toContain(s.name);
    for (const id of SECTOR_IDS) expect(json).toContain(`"${id}"`);
  });
});

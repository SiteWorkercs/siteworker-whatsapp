import type Anthropic from "@anthropic-ai/sdk";
import type { LLM } from "../src/agent/agent.js";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { MemorySink } from "../src/audit/log.js";
import { ConsoleMessenger } from "../src/whatsapp/messenger.js";

type Step =
  | { text: string }
  | { tool: string; input: Record<string, unknown> };

/** Fake Claude: plays back scripted responses and records every request. */
export class FakeLLM implements LLM {
  calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  private i = 0;
  constructor(private script: Step[][] = [[{ text: "ok" }]]) {}

  messages = {
    create: async (params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
      this.calls.push(structuredClone(params));
      const steps = this.script[Math.min(this.i++, this.script.length - 1)];
      const content = steps.map((s, k) =>
        "tool" in s
          ? ({ type: "tool_use", id: `tu_${this.i}_${k}`, name: s.tool, input: s.input } as Anthropic.ToolUseBlock)
          : ({ type: "text", text: s.text, citations: null } as Anthropic.TextBlock),
      );
      const usesTool = steps.some((s) => "tool" in s);
      return {
        id: `msg_${this.i}`,
        type: "message",
        role: "assistant",
        model: "fake",
        content,
        stop_reason: usesTool ? "tool_use" : "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      } as unknown as Anthropic.Message;
    },
  };
}

export const FIXED_NOW = new Date("2026-10-20T15:00:00Z");

export function testApp(script?: ConstructorParameters<typeof FakeLLM>[0], extra: { sms?: import("../src/escalations/senders.js").SmsSender } = {}) {
  const llm = new FakeLLM(script);
  const messenger = new ConsoleMessenger(false);
  const sink = new MemorySink();
  const app = createApp({
    config: { ...config, dryRun: true, auditLogPath: ":memory:" },
    llm,
    messenger,
    auditSink: sink,
    now: () => FIXED_NOW,
    quiet: true,
    ...extra,
  });
  return { ...app, llm, messenger, sink };
}

let n = 0;
export const text = (from: string, body: string) => ({ id: `m${n++}`, from, type: "text", text: { body } });
export const LUIS = "15550000001";
export const MARCUS = "15550000002";
export const TANYA = "15550000003";
export const DANA = "15550000100";

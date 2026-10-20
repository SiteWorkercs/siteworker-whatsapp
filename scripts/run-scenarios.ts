import "dotenv/config";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { ConsoleMessenger, describe } from "../src/whatsapp/messenger.js";
import { guessLanguage } from "../src/agent/guardrails.js";
import { SCENARIOS, type Scenario } from "./scenarios.js";

/**
 * Runs the 15 test conversations against the real model (dry run: nothing
 * is sent to WhatsApp). Usage:
 *   npm run scenarios           all
 *   npm run scenarios -- 4 7    only scenarios 4 and 7
 */
if (!config.anthropicApiKey) {
  console.error("Set ANTHROPIC_API_KEY in .env to run scenarios.");
  process.exit(1);
}

const only = process.argv.slice(2).map(Number).filter(Boolean);
const list = only.length ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;

async function run(s: Scenario) {
  const messenger = new ConsoleMessenger(false);
  const app = createApp({ config: { ...config, dryRun: true, auditLogPath: ":memory:", alerts: { ...config.alerts, dryRun: true } }, messenger, quiet: true });
  const lines: string[] = [];
  let n = 0;
  for (const t of s.turns) {
    const before = messenger.sent.length;
    const msg = t.button
      ? { id: `sc${s.id}-${n++}`, from: s.phone, type: "button", button: t.button }
      : t.type
        ? { id: `sc${s.id}-${n++}`, from: s.phone, type: t.type }
        : { id: `sc${s.id}-${n++}`, from: s.phone, type: "text", text: { body: t.text } };
    lines.push(`  > ${t.text ?? t.button?.text ?? `[${t.type}]`}`);
    await app.agent.handleInbound(msg as any);
    for (const out of messenger.sent.slice(before)) lines.push(`  < ${describe(out)}`);
  }

  const replies = messenger.sent.map(describe).join("\n");
  const textReplies = messenger.sent.filter((m) => m.kind === "text").map((m) => (m as { body: string }).body);
  const tools = new Set(
    (app.bus as any).events.filter((e: any) => e.topic === "agent.tool_call").map((e: any) => String(e.payload.tool)),
  );
  const escalations = app.mock.log.escalations.map((e) => String(e.reason));
  const audit = JSON.stringify(app.audit.entries());

  const fails: string[] = [];
  for (const t of s.expect.toolsCalled ?? []) if (!tools.has(t)) fails.push(`tool not called: ${t}`);
  if (s.expect.escalationReason && !escalations.includes(s.expect.escalationReason))
    fails.push(`no escalation "${s.expect.escalationReason}" (got: ${escalations.join(", ") || "none"})`);
  if (s.expect.language) {
    const last = textReplies[textReplies.length - 1] ?? "";
    if (guessLanguage(last, s.expect.language === "es" ? "en" : "es") !== s.expect.language)
      fails.push(`reply not in ${s.expect.language}`);
  }
  for (const re of s.expect.mustMatch ?? []) if (!re.test(replies)) fails.push(`reply missing ${re}`);
  for (const re of s.expect.mustNotMatch ?? []) if (re.test(replies)) fails.push(`reply contains ${re}`);
  for (const str of s.expect.auditMustNotContain ?? []) if (audit.includes(str)) fails.push(`audit log contains "${str}"`);
  if (replies.includes("!")) fails.push("exclamation point in reply");
  if (escalations.includes("agent_fallback")) fails.push("a reply was blocked or the agent gave up (agent_fallback)");

  console.log(`\n${fails.length ? "FAIL" : "PASS"}  #${s.id} ${s.title}`);
  console.log(lines.join("\n"));
  const alerts = `${(app.sms as any).sent?.length ?? 0} text, ${(app.email as any).sent?.length ?? 0} email`;
  console.log(`  tools: ${[...tools].join(", ") || "none"} | escalations: ${escalations.join(", ") || "none"} | alerts: ${alerts}`);
  for (const f of fails) console.log(`  ✗ ${f}`);
  return fails.length === 0;
}

let passed = 0;
for (const s of list) {
  try {
    if (await run(s)) passed++;
  } catch (err) {
    console.log(`\nERROR #${s.id} ${s.title}: ${(err as Error).message}`);
  }
}
console.log(`\n${passed}/${list.length} scenarios passed.`);
process.exit(passed === list.length ? 0 : 1);

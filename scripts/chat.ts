import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { verifyChain } from "../src/audit/log.js";

/**
 * Text the agent from your terminal. Nothing is sent to WhatsApp.
 *
 *   npm run chat                       (as Luis, Spanish-speaking worker)
 *   npm run chat -- 15550000100        (as Dana, client)
 *
 * Commands:
 *   /as <phone>                 switch who you are
 *   /button <PAYLOAD> <text>    tap a template button, e.g. /button SHIFT_CONFIRM:S-2001 Confirm
 *   /image  /audio              send media
 *   /flow availability {"days":["mon"]}   submit a form
 *   /alerts                     send tomorrow's shift confirmations
 *   /jobalert <JOB_ID>          send a job alert template to the current number
 *   /audit                      verify the audit chain
 *   /quit
 */
if (!config.anthropicApiKey) {
  console.error("Set ANTHROPIC_API_KEY in .env first.");
  process.exit(1);
}

const app = createApp({ config: { ...config, dryRun: true } });
let phone = process.argv[2] ?? "15550000001";
let n = 0;
const rl = createInterface({ input: stdin, output: stdout });

console.log(`Chatting as ${phone}. Mock contacts: 15550000001 Luis (ES), 15550000002 Marcus, 15550000003 Tanya, 15550000100 Dana (client), anything else = unknown.`);

while (true) {
  const line = (await rl.question(`${phone}> `)).trim();
  if (!line) continue;
  const id = `cli-${Date.now()}-${n++}`;
  const [cmd, ...rest] = line.split(" ");

  if (cmd === "/quit") break;
  if (cmd === "/as") {
    phone = rest[0] ?? phone;
    console.log(`Now ${phone}`);
    continue;
  }
  if (cmd === "/audit") {
    console.log(verifyChain(app.audit.entries()));
    continue;
  }
  if (cmd === "/alerts") {
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    console.log(`sent ${await app.notifier.confirmShiftsOn(tomorrow)}`);
    continue;
  }
  if (cmd === "/jobalert") {
    const c = await app.services.directory.find(phone);
    const job = await app.services.jobs.get(rest[0] ?? "J-1002");
    if (c?.kind === "worker" && job) await app.notifier.jobAlert(c, job);
    else console.log("Need a known worker number and a valid job id.");
    continue;
  }

  let msg: Record<string, unknown>;
  if (cmd === "/button") msg = { id, from: phone, type: "button", button: { payload: rest[0], text: rest.slice(1).join(" ") || rest[0] } };
  else if (cmd === "/image" || cmd === "/audio") msg = { id, from: phone, type: cmd.slice(1) };
  else if (cmd === "/flow") {
    const kind = rest[0];
    const response = JSON.parse(rest.slice(1).join(" ") || "{}");
    msg = { id, from: phone, type: "interactive", interactive: { type: "nfm_reply" }, kapso: { flowResponse: response, flowToken: `${kind}:${phone}:cli` } };
  } else msg = { id, from: phone, type: "text", text: { body: line } };

  try {
    await app.agent.handleInbound(msg as any);
  } catch (err) {
    console.error("error:", (err as Error).message);
  }
}
rl.close();

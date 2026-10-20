import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import { config } from "../src/config.js";
import { FLOWS } from "../src/whatsapp/flows.js";

/**
 * Deploys and publishes the availability (EN/ES) and crew request Flows.
 * Usage: npm run deploy:flows            (deploy + publish)
 *        npm run deploy:flows -- --write (just write JSON files to /flows)
 */
mkdirSync("flows", { recursive: true });
for (const f of FLOWS) writeFileSync(`flows/${f.name}.json`, JSON.stringify(f.json(), null, 2) + "\n");

if (process.argv.includes("--write")) {
  console.log(`Wrote ${FLOWS.length} Flow JSON files to /flows`);
  process.exit(0);
}

if (!config.kapsoApiKey || !config.wabaId) {
  console.error("Set KAPSO_API_KEY and WABA_ID in .env first.");
  process.exit(1);
}

const client = new WhatsAppClient({ baseUrl: config.kapsoBaseUrl, kapsoApiKey: config.kapsoApiKey });

for (const f of FLOWS) {
  try {
    const res = await client.flows.deploy(f.json(), {
      wabaId: config.wabaId,
      name: f.name,
      publish: true,
      preview: true,
    } as any);
    console.log(`${f.name}:`, JSON.stringify(res));
    console.log(`  -> put the flow id in .env as ${f.env}`);
  } catch (err) {
    console.error(`failed ${f.name}:`, (err as Error).message);
  }
}

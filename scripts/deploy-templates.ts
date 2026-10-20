import "dotenv/config";
import { WhatsAppClient } from "@kapso/whatsapp-cloud-api";
import { config } from "../src/config.js";
import { allDefinitions } from "../src/whatsapp/templates.js";

/**
 * Submits all 8 templates (4 messages x EN/ES) to Meta for review.
 * Usage: npm run deploy:templates            (submit)
 *        npm run deploy:templates -- --print (print definitions only)
 */
const defs = allDefinitions();

if (process.argv.includes("--print")) {
  console.log(JSON.stringify(defs, null, 2));
  process.exit(0);
}

if (!config.kapsoApiKey || !config.wabaId) {
  console.error("Set KAPSO_API_KEY and WABA_ID in .env first.");
  process.exit(1);
}

const client = new WhatsAppClient({ baseUrl: config.kapsoBaseUrl, kapsoApiKey: config.kapsoApiKey });

for (const def of defs) {
  try {
    const res = await client.templates.create({
      businessAccountId: config.wabaId,
      name: def.name,
      language: def.language,
      category: def.category,
      parameterFormat: def.parameterFormat,
      components: def.components,
    } as any);
    console.log(`submitted ${def.name} (${def.language}):`, JSON.stringify(res));
  } catch (err) {
    console.error(`failed ${def.name} (${def.language}):`, (err as Error).message);
  }
}
console.log("\nMeta reviews templates before they can be sent. Check status in Kapso or WhatsApp Manager.");

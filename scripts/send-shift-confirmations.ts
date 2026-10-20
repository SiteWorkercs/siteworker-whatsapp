import "dotenv/config";
import { createApp } from "../src/app.js";
import { isoDate } from "../src/services/mock.js";

/**
 * Sends tomorrow's shift confirmation templates. Run once a day
 * (e.g. 3 PM Eastern) from cron or a scheduler.
 * Usage: npm run send:shift-confirmations [-- YYYY-MM-DD]
 */
const app = createApp();
const date = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : isoDate(1);
const sent = await app.notifier.confirmShiftsOn(date);
console.log(`Sent ${sent} shift confirmation(s) for ${date}${app.config.dryRun ? " (dry run)" : ""}.`);

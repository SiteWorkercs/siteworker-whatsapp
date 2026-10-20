import "dotenv/config";
import { AuditLog, FileSink, verifyChain } from "../src/audit/log.js";
import { config } from "../src/config.js";

const path = process.argv[2] ?? config.auditLogPath;
const result = verifyChain(new AuditLog(new FileSink(path)).entries());
if (result.ok) {
  console.log(`Audit log OK: ${result.count} entries, chain intact (${path}).`);
} else {
  console.error(`Audit log BROKEN at entry ${result.brokenAt}: ${result.reason} (${path}).`);
  process.exit(1);
}

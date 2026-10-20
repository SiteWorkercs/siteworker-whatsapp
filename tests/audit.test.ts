import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AuditLog, FileSink, MemorySink, verifyChain } from "../src/audit/log.js";

describe("hash-chained audit log", () => {
  it("chains entries and verifies", () => {
    const log = new AuditLog(new MemorySink());
    log.record("a", "system", { x: 1 });
    log.record("b", "agent", { y: [1, 2] });
    const e = log.entries();
    expect(e[1].prevHash).toBe(e[0].hash);
    expect(verifyChain(e)).toEqual({ ok: true, count: 2 });
  });

  it("detects edits, deletions and reordering", () => {
    const sink = new MemorySink();
    const log = new AuditLog(sink);
    for (let i = 0; i < 4; i++) log.record("t", "system", { i });

    const edited = log.entries();
    edited[1].data = { i: 99 };
    expect(verifyChain(edited)).toMatchObject({ ok: false, brokenAt: 2, reason: "content was modified" });

    const deleted = log.entries();
    deleted.splice(2, 1);
    expect(verifyChain(deleted).ok).toBe(false);

    const swapped = log.entries();
    [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
    expect(verifyChain(swapped).ok).toBe(false);
  });

  it("resumes the chain from an existing file and catches tampering on disk", () => {
    const path = join(mkdtempSync(join(tmpdir(), "audit-")), "audit.jsonl");
    new AuditLog(new FileSink(path)).record("one", "system", {});
    const second = new AuditLog(new FileSink(path));
    second.record("two", "system", {});
    expect(verifyChain(second.entries())).toEqual({ ok: true, count: 2 });

    writeFileSync(path, readFileSync(path, "utf8").replace('"two"', '"TWO"'));
    expect(verifyChain(new AuditLog(new FileSink(path)).entries()).ok).toBe(false);
  });
});

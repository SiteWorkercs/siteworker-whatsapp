import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Append-only, hash-chained audit log.
 * Each entry stores the hash of the previous entry, so any edit, deletion
 * or reordering breaks the chain and is caught by verifyChain().
 */

export interface AuditEntry {
  seq: number;
  ts: string;
  type: string;
  actor: string; // "worker:+1555...", "client:+1555...", "agent", "system"
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export const GENESIS_HASH = "0".repeat(64);

/** Stable JSON: sorted keys so the same data always hashes the same way. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function hashEntry(entry: Omit<AuditEntry, "hash">): string {
  return createHash("sha256").update(canonicalJson(entry)).digest("hex");
}

export interface AuditSink {
  append(line: string): void;
  readAll(): string[];
}

export class FileSink implements AuditSink {
  constructor(private path: string) {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  append(line: string) {
    appendFileSync(this.path, line + "\n", { encoding: "utf8" });
  }
  readAll(): string[] {
    if (!existsSync(this.path)) return [];
    return readFileSync(this.path, "utf8").split("\n").filter(Boolean);
  }
}

export class MemorySink implements AuditSink {
  lines: string[] = [];
  append(line: string) {
    this.lines.push(line);
  }
  readAll() {
    return [...this.lines];
  }
}

export class AuditLog {
  private seq = 0;
  private lastHash = GENESIS_HASH;

  constructor(private sink: AuditSink) {
    // Resume the chain from whatever is already on disk.
    const existing = sink.readAll();
    if (existing.length) {
      const last = JSON.parse(existing[existing.length - 1]) as AuditEntry;
      this.seq = last.seq;
      this.lastHash = last.hash;
    }
  }

  record(type: string, actor: string, data: Record<string, unknown>): AuditEntry {
    const base = {
      seq: this.seq + 1,
      ts: new Date().toISOString(),
      type,
      actor,
      data,
      prevHash: this.lastHash,
    };
    const entry: AuditEntry = { ...base, hash: hashEntry(base) };
    this.sink.append(JSON.stringify(entry));
    this.seq = entry.seq;
    this.lastHash = entry.hash;
    return entry;
  }

  entries(): AuditEntry[] {
    return this.sink.readAll().map((l) => JSON.parse(l) as AuditEntry);
  }
}

export interface VerifyResult {
  ok: boolean;
  count: number;
  brokenAt?: number;
  reason?: string;
}

export function verifyChain(entries: AuditEntry[]): VerifyResult {
  let prev = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.seq !== i + 1) return { ok: false, count: entries.length, brokenAt: i + 1, reason: "sequence gap" };
    if (e.prevHash !== prev)
      return { ok: false, count: entries.length, brokenAt: e.seq, reason: "prevHash mismatch" };
    const { hash, ...rest } = e;
    if (hashEntry(rest) !== hash)
      return { ok: false, count: entries.length, brokenAt: e.seq, reason: "content was modified" };
    prev = hash;
  }
  return { ok: true, count: entries.length };
}

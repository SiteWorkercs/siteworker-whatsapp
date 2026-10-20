import type Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "../services/types.js";

export interface ConversationState {
  phone: string;
  history: Anthropic.MessageParam[];
  lastInboundAt?: number;
  optedIn?: boolean; // undefined = never asked
  language?: Lang;
}

export interface ConversationStore {
  get(phone: string): ConversationState;
  save(state: ConversationState): void;
}

const MAX_TURNS = 24; // user+assistant messages kept per contact
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Trim history to the most recent turns, starting on a plain user text
 * message so tool_use / tool_result pairs are never split.
 */
export function trimHistory(history: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  if (history.length <= MAX_TURNS) return history;
  let start = history.length - MAX_TURNS;
  while (start < history.length) {
    const m = history[start];
    const isPlainUser =
      m.role === "user" &&
      (typeof m.content === "string" || (Array.isArray(m.content) && m.content.every((b) => b.type === "text")));
    if (isPlainUser) break;
    start++;
  }
  return history.slice(start);
}

/** In-memory store. Swap for Redis/Postgres in production (same interface). */
export class MemoryConversationStore implements ConversationStore {
  private map = new Map<string, ConversationState>();
  get(phone: string): ConversationState {
    return this.map.get(phone) ?? { phone, history: [] };
  }
  save(state: ConversationState) {
    this.map.set(state.phone, { ...state, history: trimHistory(state.history) });
  }
}

export function inServiceWindow(state: ConversationState, now = Date.now()): boolean {
  return state.lastInboundAt !== undefined && now - state.lastInboundAt < SERVICE_WINDOW_MS;
}

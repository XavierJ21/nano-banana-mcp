import fs from "fs";
import { SESSION_FILE_PATH, MAX_HISTORY_ENTRIES } from "../config.js";
import type { SessionState, SessionHistoryEntry } from "./types.js";

// ─── Default State ─────────────────────────────────────────────────────────────

function createDefaultState(): SessionState {
  return {
    lastImagePath: null,
    lastThoughtSignature: null,
    history: [],
    totalCost: 0,
    totalImages: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Load / Save ──────────────────────────────────────────────────────────────

export function loadSession(): SessionState {
  try {
    if (!fs.existsSync(SESSION_FILE_PATH)) {
      return createDefaultState();
    }
    const raw = fs.readFileSync(SESSION_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    // Merge with defaults to handle schema evolution
    return {
      ...createDefaultState(),
      ...parsed,
    };
  } catch {
    // Corrupt or unreadable — start fresh
    return createDefaultState();
  }
}

export function saveSession(state: SessionState): void {
  try {
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    // Non-fatal — session persistence failure should not crash the server
    console.error("[session] Failed to persist session state:", err);
  }
}

// ─── Mutation Helpers ─────────────────────────────────────────────────────────

export function recordGeneration(
  state: SessionState,
  entry: SessionHistoryEntry,
  thoughtSignature: string | null,
  outputPath: string | null
): SessionState {
  const newHistory = [entry, ...state.history].slice(0, MAX_HISTORY_ENTRIES);

  return {
    ...state,
    lastImagePath: outputPath ?? state.lastImagePath,
    lastThoughtSignature: thoughtSignature ?? state.lastThoughtSignature,
    history: newHistory,
    totalCost: state.totalCost + entry.estimatedCost,
    totalImages: entry.success ? state.totalImages + 1 : state.totalImages,
    updatedAt: new Date().toISOString(),
  };
}

export function getLastThoughtSignature(state: SessionState): string | null {
  return state.lastThoughtSignature;
}

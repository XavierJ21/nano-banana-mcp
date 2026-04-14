import { ModelInfo } from "./lib/types.js";

// ─── Environment ──────────────────────────────────────────────────────────────

export function getApiKey(): string {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY environment variable is required. " +
        "Set it in your environment or .env file."
    );
  }
  return key;
}

// ─── Model Registry ───────────────────────────────────────────────────────────
// Model IDs are abstracted here so they can be updated when Google promotes
// preview models to GA without touching tool logic.

export const MODEL_REGISTRY: Record<string, ModelInfo> = {
  NB2: {
    codename: "NB2",
    modelId: "gemini-3.1-flash-image-preview",
    isDefault: true,
    speed: "~4-6s",
    maxResolution: "4K",
    costPer1K: 0.067,
    costPer2K: 0.101,
    costPer4K: 0.151,
    rateLimitRPM: 15,
    notes:
      "Flash speed + quality, grounding support, subject consistency. Default model.",
    status: "preview",
  },
  Pro: {
    codename: "Pro",
    modelId: "gemini-3.1-flash-image-preview",
    isDefault: false,
    speed: "~8-12s",
    maxResolution: "4K",
    costPer1K: 0.134,
    costPer2K: 0.134,
    costPer4K: 0.24,
    rateLimitRPM: 10,
    notes: "Max reasoning depth, highest quality for complex scenes.",
    status: "preview",
  },
  Flash: {
    codename: "Flash",
    modelId: "gemini-3.1-flash-image-preview",
    isDefault: false,
    speed: "~3s",
    maxResolution: "1K",
    costPer1K: 0.04,
    costPer2K: 0.04,
    costPer4K: 0.04,
    rateLimitRPM: 30,
    notes: "Cheapest option, fastest, best for drafts and quick sketches.",
    status: "preview",
  },
};

export const DEFAULT_MODEL_CODENAME = "NB2";

// ─── Retry Config ─────────────────────────────────────────────────────────────

export const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  retryableStatusCodes: [429, 500, 503, 504],
};

// ─── Session Config ───────────────────────────────────────────────────────────

export const SESSION_FILE_PATH = (() => {
  const home = process.env["HOME"] ?? "/tmp";
  return `${home}/.nano-banana-session.json`;
})();

export const MAX_HISTORY_ENTRIES = 50;

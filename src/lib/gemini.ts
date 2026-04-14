import { GoogleGenAI } from "@google/genai";
import { getApiKey, RETRY_CONFIG } from "../config.js";
import type { ThinkingLevel, AspectRatio, ImageSize, GenerationResult } from "./types.js";

// ─── Client Singleton ─────────────────────────────────────────────────────────

let _client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: getApiKey() });
  }
  return _client;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  thinkingLevel: ThinkingLevel;
  useGrounding: boolean;
  inputImageBase64?: string;
  inputImageMimeType?: string;
  thoughtSignature?: string | null;
}

export interface RawGenerationOutput {
  imageBase64: string | null;
  mimeType: string;
  text: string | null;
  thoughtSignature: string | null;
}

// ─── Retry Logic ──────────────────────────────────────────────────────────────

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    // HTTP status codes embedded in error messages by the SDK
    return (
      msg.includes("429") ||
      msg.includes("500") ||
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("rate limit") ||
      msg.includes("quota") ||
      msg.includes("too many requests")
    );
  }
  return false;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = RETRY_CONFIG;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === maxAttempts) {
        throw err;
      }
      const backoff = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      console.error(
        `[gemini] ${context} — attempt ${attempt}/${maxAttempts} failed, retrying in ${backoff}ms:`,
        err instanceof Error ? err.message : err
      );
      await delay(backoff);
    }
  }

  throw lastError;
}

// ─── Core Generation ──────────────────────────────────────────────────────────

export async function generateImage(
  opts: GenerateOptions
): Promise<GenerationResult> {
  try {
    const result = await withRetry(
      () => callGeminiAPI(opts),
      `generateImage(${opts.model})`
    );
    return result;
  } catch (err) {
    return classifyError(err);
  }
}

async function callGeminiAPI(opts: GenerateOptions): Promise<GenerationResult> {
  const client = getGeminiClient();

  // Build contents array
  const parts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data: string };
    thoughtSignature?: string;
  }> = [];

  // If editing: prepend thought signature for multi-turn consistency
  if (opts.thoughtSignature) {
    parts.push({ thoughtSignature: opts.thoughtSignature });
  }

  // Prompt text
  parts.push({ text: opts.prompt });

  // Input image for editing
  if (opts.inputImageBase64 && opts.inputImageMimeType) {
    parts.push({
      inlineData: {
        mimeType: opts.inputImageMimeType,
        data: opts.inputImageBase64,
      },
    });
  }

  // Build config
  type ThinkingConfig = {
    thinkingBudget?: number;
    includeThoughts?: boolean;
  };

  type GenerationConfig = {
    responseModalities: string[];
    imageConfig?: {
      aspectRatio?: string;
    };
    thinkingConfig?: ThinkingConfig;
  };

  const config: GenerationConfig = {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig: {
      aspectRatio: opts.aspectRatio,
    },
  };

  // Map thinking level to budget tokens
  if (opts.thinkingLevel !== "minimal") {
    const budgetMap: Record<string, number> = {
      low: 512,
      medium: 1024,
      high: 4096,
    };
    config.thinkingConfig = {
      thinkingBudget: budgetMap[opts.thinkingLevel] ?? 512,
      includeThoughts: false,
    };
  }

  // Build tools for grounding
  type ToolConfig = { googleSearch: Record<string, unknown> };
  const tools: ToolConfig[] = opts.useGrounding
    ? [{ googleSearch: {} }]
    : [];

  // Construct request
  type RequestBody = {
    contents: Array<{ parts: typeof parts }>;
    generationConfig: GenerationConfig;
    tools?: ToolConfig[];
  };

  const requestBody: RequestBody = {
    contents: [{ parts }],
    generationConfig: config,
  };

  if (tools.length > 0) {
    requestBody.tools = tools;
  }

  // Use raw fetch as primary to avoid SDK imageSize bug (noted in build plan)
  const apiKey = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
          thoughtSignature?: string;
        }>;
      };
      finishReason?: string;
    }>;
  };

  const candidates = data.candidates ?? [];
  if (candidates.length === 0) {
    throw new Error("No candidates returned from Gemini API");
  }

  const candidate = candidates[0]!;

  // Check for safety block
  if (
    candidate.finishReason === "SAFETY" ||
    candidate.finishReason === "IMAGE_SAFETY"
  ) {
    return {
      ok: false,
      code: "SAFETY_BLOCKED",
      message:
        "The request was blocked by safety filters. Try rephrasing your prompt.",
      retryable: false,
    };
  }

  const responseParts = candidate.content?.parts ?? [];

  let imageBase64: string | null = null;
  let mimeType = "image/png";
  let text: string | null = null;
  let thoughtSignature: string | null = null;

  for (const part of responseParts) {
    if (part.inlineData?.data) {
      imageBase64 = part.inlineData.data;
      mimeType = part.inlineData.mimeType ?? "image/png";
    } else if (part.text) {
      text = part.text;
    } else if (part.thoughtSignature) {
      thoughtSignature = part.thoughtSignature;
    }
  }

  if (!imageBase64) {
    throw new Error(
      `No image data in response. Text: ${text ?? "(none)"}. ` +
        `Parts received: ${responseParts.length}`
    );
  }

  return {
    ok: true,
    imagePath: null, // caller sets this after writing file
    imageBase64,
    mimeType,
    text,
    thoughtSignature,
    modelUsed: opts.model,
    estimatedCost: 0, // caller sets this
  };
}

// ─── Error Classification ─────────────────────────────────────────────────────

function classifyError(err: unknown): GenerationResult {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("too many requests")
  ) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: `Rate limit exceeded. ${message}`,
      retryable: true,
    };
  }

  if (lower.includes("400") || lower.includes("invalid")) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: `Invalid request: ${message}`,
      retryable: false,
    };
  }

  if (lower.includes("safety") || lower.includes("blocked")) {
    return {
      ok: false,
      code: "SAFETY_BLOCKED",
      message: `Safety filter triggered: ${message}`,
      retryable: false,
    };
  }

  if (lower.includes("500") || lower.includes("503") || lower.includes("504")) {
    return {
      ok: false,
      code: "API_ERROR",
      message: `Gemini API server error: ${message}`,
      retryable: true,
    };
  }

  return {
    ok: false,
    code: "UNKNOWN",
    message,
    retryable: false,
  };
}

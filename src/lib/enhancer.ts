// ─── Prompt Enhancer ──────────────────────────────────────────────────────────
// Optional 2-stage enhancement: expand bare prompts with quality/style tokens.
// This is lightweight — no second LLM call, just deterministic augmentation.
// A second-stage LLM rewrite can be added here if warranted by testing.

interface EnhancerOptions {
  prompt: string;
  thinkingLevel: "minimal" | "low" | "medium" | "high";
  imageSize: "512" | "1K" | "2K" | "4K";
}

// Quality tokens appended for non-minimal thinking or high-res targets
const QUALITY_SUFFIXES: Record<string, string> = {
  "4K": ", ultra-high resolution, sharp detail, 4K",
  "2K": ", high resolution, detailed, 2K",
  "1K": "",
  "512": "",
};

// Style tokens for thinking levels
const THINKING_SUFFIXES: Record<string, string> = {
  high: ", professionally composed, studio quality lighting, photorealistic",
  medium: ", well-composed, high quality",
  low: "",
  minimal: "",
};

export function enhancePrompt(opts: EnhancerOptions): string {
  const { prompt, thinkingLevel, imageSize } = opts;

  // Skip enhancement for explicit technical prompts (already detailed)
  if (prompt.length > 200) {
    return prompt;
  }

  const qualitySuffix = QUALITY_SUFFIXES[imageSize] ?? "";
  const thinkingSuffix = THINKING_SUFFIXES[thinkingLevel] ?? "";

  // Avoid duplicate suffix words
  const enhanced = `${prompt}${qualitySuffix}${thinkingSuffix}`;

  // Deduplicate trailing commas/spaces
  return enhanced.replace(/,\s*,/g, ",").trim();
}

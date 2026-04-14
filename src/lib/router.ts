import { MODEL_REGISTRY, DEFAULT_MODEL_CODENAME } from "../config.js";
import type { ThinkingLevel, ImageSize } from "./types.js";

// ─── Keywords ─────────────────────────────────────────────────────────────────

const PRO_KEYWORDS = [
  "4k",
  "professional",
  "production",
  "high-res",
  "high res",
  "hd",
  "ultra",
  "photorealistic",
  "hyperrealistic",
];

const FLASH_KEYWORDS = [
  "quick",
  "draft",
  "sketch",
  "rapid",
  "rough",
  "concept",
  "thumbnail",
  "test",
];

// ─── Smart Model Selector ─────────────────────────────────────────────────────

export interface RouterInput {
  prompt: string;
  thinkingLevel?: ThinkingLevel;
  imageSize?: ImageSize;
  multipleInputImages?: boolean;
}

export function selectModel(input: RouterInput): string {
  const { prompt, thinkingLevel, imageSize, multipleInputImages } = input;
  const normalised = prompt.toLowerCase();

  // Explicit Flash triggers
  if (FLASH_KEYWORDS.some((kw) => normalised.includes(kw))) {
    return MODEL_REGISTRY["Flash"]!.modelId;
  }

  // Pro triggers
  const needsPro =
    thinkingLevel === "high" ||
    imageSize === "4K" ||
    multipleInputImages === true ||
    PRO_KEYWORDS.some((kw) => normalised.includes(kw));

  if (needsPro) {
    return MODEL_REGISTRY["Pro"]!.modelId;
  }

  // Default: NB2
  return MODEL_REGISTRY[DEFAULT_MODEL_CODENAME]!.modelId;
}

// ─── Cost Estimation ──────────────────────────────────────────────────────────

export function estimateCost(modelId: string, imageSize: ImageSize): number {
  // Find model by modelId
  const info = Object.values(MODEL_REGISTRY).find(
    (m) => m.modelId === modelId
  );
  if (!info) return 0;

  switch (imageSize) {
    case "512":
      return info.costPer1K * 0.5;
    case "1K":
      return info.costPer1K;
    case "2K":
      return info.costPer2K;
    case "4K":
      return info.costPer4K;
    default:
      return info.costPer1K;
  }
}

import { z } from "zod";

// ─── Model IDs ────────────────────────────────────────────────────────────────

export const MODEL_IDS = {
  NB2: "gemini-2.0-flash-preview-image-generation",
  Pro: "gemini-2.0-flash-preview-image-generation", // placeholder — update when Pro GA
  Flash: "gemini-2.0-flash-preview-image-generation", // stable flash
} as const;

export type ModelCodename = keyof typeof MODEL_IDS;

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const AspectRatioSchema = z.enum([
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "2:3",
  "3:2",
  "21:9",
]);

export const ImageSizeSchema = z.enum(["512", "1K", "2K", "4K"]);

export const ThinkingLevelSchema = z.enum(["minimal", "low", "medium", "high"]);

export const ModelSelectionSchema = z.enum([
  "gemini-2.0-flash-preview-image-generation",
  "auto",
]);

export const GenerateImageInputSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  model: ModelSelectionSchema.default("auto"),
  aspect_ratio: AspectRatioSchema.default("1:1"),
  image_size: ImageSizeSchema.default("1K"),
  thinking_level: ThinkingLevelSchema.default("minimal"),
  use_grounding: z.boolean().default(false),
  output_path: z.string().optional(),
});

export const EditImageInputSchema = z.object({
  instruction: z.string().min(1, "Instruction is required"),
  input_image_path: z.string().min(1, "Input image path is required"),
  model: ModelSelectionSchema.default("auto"),
  aspect_ratio: AspectRatioSchema.default("1:1"),
  image_size: ImageSizeSchema.default("1K"),
  output_path: z.string().optional(),
});

export type GenerateImageInput = z.infer<typeof GenerateImageInputSchema>;
export type EditImageInput = z.infer<typeof EditImageInputSchema>;
export type AspectRatio = z.infer<typeof AspectRatioSchema>;
export type ImageSize = z.infer<typeof ImageSizeSchema>;
export type ThinkingLevel = z.infer<typeof ThinkingLevelSchema>;

// ─── Discriminated Union Result Types ─────────────────────────────────────────

export type GenerationSuccess = {
  ok: true;
  imagePath: string | null;
  imageBase64: string | null;
  mimeType: string;
  text: string | null;
  thoughtSignature: string | null;
  modelUsed: string;
  estimatedCost: number;
};

export type GenerationError = {
  ok: false;
  code:
    | "RATE_LIMITED"
    | "SAFETY_BLOCKED"
    | "INVALID_REQUEST"
    | "API_ERROR"
    | "FILE_ERROR"
    | "UNKNOWN";
  message: string;
  retryable: boolean;
};

export type GenerationResult = GenerationSuccess | GenerationError;

// ─── Session State ────────────────────────────────────────────────────────────

export interface SessionState {
  lastImagePath: string | null;
  lastThoughtSignature: string | null;
  history: SessionHistoryEntry[];
  totalCost: number;
  totalImages: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionHistoryEntry {
  timestamp: string;
  tool: "generate_image" | "edit_image";
  prompt: string;
  modelUsed: string;
  outputPath: string | null;
  estimatedCost: number;
  success: boolean;
}

// ─── Model Info ───────────────────────────────────────────────────────────────

export interface ModelInfo {
  codename: string;
  modelId: string;
  isDefault: boolean;
  speed: string;
  maxResolution: string;
  costPer1K: number;
  costPer2K: number;
  costPer4K: number;
  rateLimitRPM: number;
  notes: string;
  status: "preview" | "ga";
}

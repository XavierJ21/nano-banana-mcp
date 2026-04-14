import fs from "fs";
import path from "path";
import { EditImageInputSchema } from "../lib/types.js";
import { generateImage } from "../lib/gemini.js";
import { selectModel, estimateCost } from "../lib/router.js";
import { loadSession, saveSession, recordGeneration } from "../lib/session.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ─── Supported Input Formats ─────────────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] ?? "image/png";
}

// ─── edit_image Tool Handler ──────────────────────────────────────────────────

export async function handleEditImage(
  rawArgs: unknown
): Promise<CallToolResult> {
  // Validate input
  const parseResult = EditImageInputSchema.safeParse(rawArgs);
  if (!parseResult.success) {
    return {
      content: [
        {
          type: "text",
          text: `Invalid arguments: ${parseResult.error.message}`,
        },
      ],
      isError: true,
    };
  }

  const args = parseResult.data;

  // Read input image
  let inputImageBase64: string;
  let inputImageMimeType: string;

  try {
    if (!fs.existsSync(args.input_image_path)) {
      return {
        content: [
          {
            type: "text",
            text: `Input image not found: ${args.input_image_path}`,
          },
        ],
        isError: true,
      };
    }
    const imageBuffer = fs.readFileSync(args.input_image_path);
    inputImageBase64 = imageBuffer.toString("base64");
    inputImageMimeType = getImageMimeType(args.input_image_path);
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to read input image: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }

  // Smart model selection
  const modelId =
    args.model === "auto"
      ? selectModel({
          prompt: args.instruction,
          imageSize: args.image_size,
          multipleInputImages: false,
        })
      : args.model;

  // Load session — use thought signature for multi-turn consistency
  const session = loadSession();

  // Call Gemini with input image
  const result = await generateImage({
    prompt: args.instruction,
    model: modelId,
    aspectRatio: args.aspect_ratio,
    imageSize: args.image_size,
    thinkingLevel: "minimal",
    useGrounding: false,
    inputImageBase64,
    inputImageMimeType,
    thoughtSignature: session.lastThoughtSignature,
  });

  if (!result.ok) {
    const failedSession = recordGeneration(
      session,
      {
        timestamp: new Date().toISOString(),
        tool: "edit_image",
        prompt: args.instruction,
        modelUsed: modelId,
        outputPath: null,
        estimatedCost: 0,
        success: false,
      },
      null,
      null
    );
    saveSession(failedSession);

    return {
      content: [
        {
          type: "text",
          text: `Image editing failed.\nCode: ${result.code}\nMessage: ${result.message}\nRetryable: ${result.retryable}`,
        },
      ],
      isError: true,
    };
  }

  const cost = estimateCost(modelId, args.image_size);
  result.estimatedCost = cost;

  // Output handling
  let outputPath: string | null = null;
  const responseContent: CallToolResult["content"] = [];

  if (args.output_path && result.imageBase64) {
    try {
      const dir = path.dirname(args.output_path);
      if (dir && dir !== ".") {
        fs.mkdirSync(dir, { recursive: true });
      }
      const buffer = Buffer.from(result.imageBase64, "base64");
      fs.writeFileSync(args.output_path, buffer);
      outputPath = args.output_path;
      result.imagePath = outputPath;

      responseContent.push({
        type: "text",
        text: buildSuccessText(
          result,
          args.instruction,
          args.input_image_path,
          modelId,
          cost,
          outputPath
        ),
      });
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Image edited but failed to save to ${args.output_path}: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  } else if (result.imageBase64) {
    responseContent.push({
      type: "image",
      data: result.imageBase64,
      mimeType: result.mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
    });
    responseContent.push({
      type: "text",
      text: buildSuccessText(
        result,
        args.instruction,
        args.input_image_path,
        modelId,
        cost,
        null
      ),
    });
  }

  if (result.text) {
    responseContent.push({
      type: "text",
      text: `Model commentary: ${result.text}`,
    });
  }

  // Persist session with thought signature for next edit in chain
  const updatedSession = recordGeneration(
    session,
    {
      timestamp: new Date().toISOString(),
      tool: "edit_image",
      prompt: args.instruction,
      modelUsed: modelId,
      outputPath,
      estimatedCost: cost,
      success: true,
    },
    result.thoughtSignature,
    outputPath
  );
  saveSession(updatedSession);

  return { content: responseContent };
}

function buildSuccessText(
  result: { modelUsed: string; mimeType: string },
  instruction: string,
  inputPath: string,
  modelId: string,
  cost: number,
  outputPath: string | null
): string {
  const lines = [
    `Image edited successfully.`,
    `Model: ${modelId}`,
    `Input: ${inputPath}`,
    `Format: ${result.mimeType}`,
    `Estimated cost: $${cost.toFixed(4)}`,
    `Instruction: ${instruction}`,
  ];
  if (outputPath) {
    lines.push(`Saved to: ${outputPath}`);
  }
  return lines.join("\n");
}

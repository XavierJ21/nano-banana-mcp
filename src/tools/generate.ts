import fs from "fs";
import path from "path";
import { GenerateImageInputSchema } from "../lib/types.js";
import { generateImage } from "../lib/gemini.js";
import { selectModel, estimateCost } from "../lib/router.js";
import { enhancePrompt } from "../lib/enhancer.js";
import { loadSession, saveSession, recordGeneration } from "../lib/session.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ─── generate_image Tool Handler ─────────────────────────────────────────────

export async function handleGenerateImage(
  rawArgs: unknown
): Promise<CallToolResult> {
  // Validate input
  const parseResult = GenerateImageInputSchema.safeParse(rawArgs);
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

  // Smart model selection
  const modelId =
    args.model === "auto"
      ? selectModel({
          prompt: args.prompt,
          thinkingLevel: args.thinking_level,
          imageSize: args.image_size,
        })
      : args.model;

  // Prompt enhancement
  const enhancedPrompt = enhancePrompt({
    prompt: args.prompt,
    thinkingLevel: args.thinking_level,
    imageSize: args.image_size,
  });

  // Load session for thought signature chaining
  const session = loadSession();

  // Call Gemini
  const result = await generateImage({
    prompt: enhancedPrompt,
    model: modelId,
    aspectRatio: args.aspect_ratio,
    imageSize: args.image_size,
    thinkingLevel: args.thinking_level,
    useGrounding: args.use_grounding,
    thoughtSignature: session.lastThoughtSignature,
  });

  if (!result.ok) {
    // Record failure in session
    const failedSession = recordGeneration(
      session,
      {
        timestamp: new Date().toISOString(),
        tool: "generate_image",
        prompt: args.prompt,
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
          text: `Image generation failed.\nCode: ${result.code}\nMessage: ${result.message}\nRetryable: ${result.retryable}`,
        },
      ],
      isError: true,
    };
  }

  // Cost estimation
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
        text: buildSuccessText(result, args.prompt, modelId, cost, outputPath),
      });
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Image generated but failed to save to ${args.output_path}: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  } else if (result.imageBase64) {
    // Return base64 in MCP image content
    responseContent.push({
      type: "image",
      data: result.imageBase64,
      mimeType: result.mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
    });
    responseContent.push({
      type: "text",
      text: buildSuccessText(result, args.prompt, modelId, cost, null),
    });
  }

  if (result.text) {
    responseContent.push({
      type: "text",
      text: `Model commentary: ${result.text}`,
    });
  }

  // Persist session
  const updatedSession = recordGeneration(
    session,
    {
      timestamp: new Date().toISOString(),
      tool: "generate_image",
      prompt: args.prompt,
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
  prompt: string,
  modelId: string,
  cost: number,
  outputPath: string | null
): string {
  const lines = [
    `Image generated successfully.`,
    `Model: ${modelId}`,
    `Format: ${result.mimeType}`,
    `Estimated cost: $${cost.toFixed(4)}`,
    `Prompt: ${prompt}`,
  ];
  if (outputPath) {
    lines.push(`Saved to: ${outputPath}`);
  }
  return lines.join("\n");
}

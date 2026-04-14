import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleGenerateImage } from "./tools/generate.js";
import { handleEditImage } from "./tools/edit.js";
import { handleListModels } from "./tools/models.js";

// ─── MCP Server Setup ─────────────────────────────────────────────────────────

export function createServer(): McpServer {
  const server = new McpServer({
    name: "nano-banana",
    version: "1.0.0",
  });

  // ── Tool: generate_image ────────────────────────────────────────────────────

  server.tool(
    "generate_image",
    "Generate an image from a text prompt using Google Gemini. Supports smart model routing, multiple aspect ratios, and optional Google Search grounding.",
    {
      prompt: z.string().describe("Text description of the image to generate"),
      model: z
        .enum(["gemini-2.0-flash-preview-image-generation", "auto"])
        .default("auto")
        .describe(
          "Model to use. 'auto' enables smart routing (NB2 default, Pro for complex/4K, Flash for drafts)"
        ),
      aspect_ratio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"])
        .default("1:1")
        .describe("Output aspect ratio"),
      image_size: z
        .enum(["512", "1K", "2K", "4K"])
        .default("1K")
        .describe(
          "Output resolution. 512 only available on Flash model. 4K triggers Pro routing."
        ),
      thinking_level: z
        .enum(["minimal", "low", "medium", "high"])
        .default("minimal")
        .describe(
          "Reasoning depth. 'high' triggers Pro routing and increases cost."
        ),
      use_grounding: z
        .boolean()
        .default(false)
        .describe(
          "Enable Google Search grounding for factual accuracy (landmarks, real people, current events)"
        ),
      output_path: z
        .string()
        .optional()
        .describe(
          "File path to save the image. If omitted, image is returned as base64 in the response."
        ),
    },
    async (args) => {
      return handleGenerateImage(args);
    }
  );

  // ── Tool: edit_image ────────────────────────────────────────────────────────

  server.tool(
    "edit_image",
    "Edit an existing image using a natural language instruction. Uses thought signature chaining for multi-turn consistency.",
    {
      instruction: z
        .string()
        .describe("What to change in the image (e.g. 'Change the blue sofa to brown leather')"),
      input_image_path: z
        .string()
        .describe("Absolute path to the input image file (JPEG, PNG, WebP, GIF)"),
      model: z
        .enum(["gemini-2.0-flash-preview-image-generation", "auto"])
        .default("auto")
        .describe("Model to use. 'auto' selects based on instruction complexity."),
      aspect_ratio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"])
        .default("1:1")
        .describe("Output aspect ratio"),
      image_size: z
        .enum(["512", "1K", "2K", "4K"])
        .default("1K")
        .describe("Output resolution"),
      output_path: z
        .string()
        .optional()
        .describe("File path to save the edited image. Returns base64 if omitted."),
    },
    async (args) => {
      return handleEditImage(args);
    }
  );

  // ── Tool: list_models ───────────────────────────────────────────────────────

  server.tool(
    "list_models",
    "List available Gemini image generation models with capabilities, pricing, and current session stats.",
    {},
    async (args) => {
      return handleListModels(args);
    }
  );

  return server;
}

import { MODEL_REGISTRY } from "../config.js";
import { loadSession } from "../lib/session.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ─── list_models Tool Handler ─────────────────────────────────────────────────

export async function handleListModels(
  _rawArgs: unknown
): Promise<CallToolResult> {
  const session = loadSession();

  const modelRows = Object.values(MODEL_REGISTRY)
    .map((m) => {
      return [
        `### ${m.codename}${m.isDefault ? " (default)" : ""}`,
        `- Model ID: \`${m.modelId}\``,
        `- Status: ${m.status}`,
        `- Speed: ${m.speed}`,
        `- Max resolution: ${m.maxResolution}`,
        `- Cost: $${m.costPer1K}/1K · $${m.costPer2K}/2K · $${m.costPer4K}/4K`,
        `- Rate limit: ${m.rateLimitRPM} RPM`,
        `- Notes: ${m.notes}`,
      ].join("\n");
    })
    .join("\n\n");

  const sessionSummary = [
    `## Session Stats`,
    `- Total images generated: ${session.totalImages}`,
    `- Total estimated cost: $${session.totalCost.toFixed(4)}`,
    `- Session started: ${session.createdAt}`,
    `- Last updated: ${session.updatedAt}`,
    `- Last image: ${session.lastImagePath ?? "none"}`,
    `- History entries: ${session.history.length}`,
  ].join("\n");

  const text = [
    `# Nano Banana MCP — Model Catalogue`,
    ``,
    `## Available Models`,
    ``,
    modelRows,
    ``,
    `---`,
    ``,
    sessionSummary,
    ``,
    `## Notes`,
    `- All images include a SynthID watermark (non-removable, non-visible to humans)`,
    `- Model IDs are preview and may be updated when Google promotes to GA`,
    `- Smart routing (model: "auto") selects NB2 by default, Pro for complex/4K requests, Flash for drafts`,
  ].join("\n");

  return {
    content: [{ type: "text", text }],
  };
}

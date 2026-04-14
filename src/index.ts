#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

process.on("unhandledRejection", (reason, promise) => {
  console.error("[nano-banana] Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr only — stdout is reserved for MCP protocol communication
  console.error("[nano-banana] MCP server started. Ready for connections.");
}

main().catch((err) => {
  console.error("[nano-banana] Fatal startup error:", err);
  process.exit(1);
});

# Nano Banana MCP

TypeScript MCP server for AI image generation via Google Gemini with intelligent model routing.

## Features

- **3 MCP tools**: `generate_image`, `edit_image`, `list_models`
- **Smart auto-routing**: NB2 (default) → Pro (complex/4K/high-thinking) → Flash (drafts)
- **Thought signature chaining**: multi-turn editing with session consistency
- **Persistent session state**: survives server restarts, tracks cost and history
- **Retry logic**: exponential backoff for 429/500/503/504 errors
- **Discriminated union result types**: explicit error handling, no silent failures

## Models

| Codename | Model ID | Speed | Max Res | Cost (1K) | Best For |
|----------|----------|-------|---------|-----------|----------|
| NB2 (default) | `gemini-3.1-flash-image-preview` | ~4-6s | 4K | $0.067 | Most use cases |
| Pro | `gemini-3-pro-image-preview` | ~30-90s | 4K | $0.134 | Complex/photorealistic/4K |
| Flash | `gemini-3.1-flash-image-preview` | ~3s | 1K | ~$0.04 | Drafts, quick tests |

All model IDs are abstracted in `src/config.ts` for easy updates when Google promotes preview models to GA.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Set your Gemini API key
cp .env.example .env
# Edit .env and add: GEMINI_API_KEY=your_actual_key

# 3. Build
npm run build

# 4. Test
GEMINI_API_KEY=your_key node dist/index.js
```

## MCP Configuration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "nano-banana": {
      "command": "node",
      "args": ["/absolute/path/to/nano-banana-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}"
      }
    }
  }
}
```

## Tool Reference

### generate_image

```
prompt          (required) Text description of the image
model           auto | gemini-3.1-flash-image-preview | gemini-3-pro-image-preview
aspect_ratio    1:1 | 16:9 | 9:16 | 4:3 | 3:4 | 2:3 | 3:2 | 21:9  (default: 1:1)
image_size      512 | 1K | 2K | 4K  (default: 1K)
thinking_level  minimal | low | medium | high  (default: minimal)
use_grounding   boolean  (default: false)
output_path     optional file path — returns base64 if omitted
```

### edit_image

```
instruction         (required) What to change
input_image_path    (required) Absolute path to input image (JPEG, PNG, WebP, GIF)
model               auto | gemini-3.1-flash-image-preview | gemini-3-pro-image-preview
aspect_ratio        1:1 | 16:9 | 9:16 | 4:3 | 3:4 | 2:3 | 3:2 | 21:9
image_size          512 | 1K | 2K | 4K
output_path         optional file path
```

### list_models

No parameters. Returns model capabilities, pricing, and current session stats.

## Notes

- All generated images include a SynthID watermark (non-removable, invisible to humans)
- Session state persists at `~/.nano-banana-session.json`
- Rate limits: NB2/Flash ~15-30 RPM, Pro ~10 RPM (with billing enabled)
- Pro tier latency: first-header response typically 30–90s — no client timeout is enforced, Node fetch runs unbounded
- `use_grounding: true` enables Google Search for real-world accuracy (landmarks, events, people)

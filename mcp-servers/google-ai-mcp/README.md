# google-ai-mcp

MCP server for Google Gemini image generation and YouTube video transcription.

## Install

```bash
npm install -g google-ai-mcp
```

## Claude Desktop config

```json
{
  "mcpServers": {
    "google-ai-mcp": {
      "command": "google-ai-mcp",
      "env": {
        "GEMINI_API_KEY": "your-api-key-here",
        "NB_OUTPUT_DIR": "~/images/nano-banana"
      }
    }
  }
}
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `NB_OUTPUT_DIR` | No | Image output directory (default: `~/images/nano-banana`) |

## Tools

| Tool | Description |
|------|-------------|
| `generate_image` | Generate images using Gemini image generation |
| `get_video_info` | Get metadata for a YouTube video |
| `download_video` | Download a YouTube video locally |
| `transcribe_video` | Transcribe a YouTube video using Gemini |
| `list_transcripts` | List cached video transcripts |

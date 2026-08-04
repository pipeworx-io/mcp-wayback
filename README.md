# mcp-wayback

Internet Archive Wayback Machine MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `get_snapshot` | Look up the archived/historical version of a web page in the Internet Archive Wayback Machine. Returns the closest available snapshot (its Wayback URL, timestamp and HTTP status). Pass a timestamp to find the snapshot nearest a specific date; omit it to get the latest archived version. |
| `list_snapshots` | List the captured snapshots of a URL in the Internet Archive Wayback Machine over time, using the CDX index. Each entry includes the capture timestamp, the original URL, HTTP status code, MIME type, content digest and a direct Wayback snapshot URL. Optionally restrict to a date range with from/to (YYYYMMDD). |
| `get_capture_count` | Count how many times a URL has been captured by the Internet Archive Wayback Machine, and find when a URL was first and last archived. Returns the total number of captures plus the earliest and latest capture timestamps (YYYYMMDDhhmmss). |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "wayback": {
      "url": "https://gateway.pipeworx.io/wayback/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Wayback data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

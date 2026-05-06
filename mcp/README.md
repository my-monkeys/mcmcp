# `@my-monkey/mcp-schematic`

MCP server that lets an AI build Minecraft schematics. The web viewer at
`mcmcp/web` renders every block in real time via Supabase realtime.

## Tools

### Session

| Tool | What it does |
|---|---|
| `use_session` | Switch the active session for subsequent calls. |
| `current_session` | Show the active session id, zone size, and block count. |
| `create_zone` | Create or reset a session of size `(size_x, size_y, size_z)`. |

### Write

| Tool | What it does |
|---|---|
| `set_block` | Place or clear one block. `block: "air"` clears. |
| `set_blocks` | Batch up to 50k arbitrary blocks. Atomic bounds check. |
| `fill_region` | Fill an inclusive cuboid `(x1,y1,z1)..(x2,y2,z2)` with one block. |
| `fill_layer` | Fill a whole plane along an axis (`x`, `y`, `z`) at a given index. |
| `replace` | Swap one block type for another, optionally restricted to a region. |

### Read

| Tool | What it does |
|---|---|
| `get_all` | Every placed block in the session. |
| `get_region` | Every placed block inside a cuboid. |
| `get_layer` | Every placed block in one plane. |

### Export

| Tool | What it does |
|---|---|
| `export_litematic` | Save the session as a `.litematic` file. Default path: `~/Downloads/mcmcp-exports/<session>-<ts>.litematic`. Compatible with the Litematica mod (MC 1.16+). |

Coordinates are 0-based, y is up. Block ids are short Minecraft names without
the `minecraft:` prefix (e.g. `stone`, `oak_planks`, `glass`, `air`).

## Wiring it to Claude Code

Add this to `~/.claude.json` under `mcpServers`, or run it manually for tests:

```jsonc
{
  "mcpServers": {
    "mcmcp-schematic": {
      "command": "node",
      "args": ["/Users/maxim/Documents/my-monkey/mcmcp/mcp/dist/index.js"],
      "env": {
        "MCMCP_SESSION_ID": "ABC123",
        "MCMCP_VIEWER_ORIGIN": "http://localhost:3000"
      }
    }
  }
}
```

`MCMCP_SESSION_ID` is the 6-char ID shown in the viewer top-left. If you omit
it, every tool call must pass `session_id` as an argument instead.

`MCMCP_SUPABASE_URL` and `MCMCP_SUPABASE_ANON_KEY` are baked-in defaults
pointing at the shared MyMonkey project. Override them for a different
deployment.

## Dev loop

```bash
pnpm install
pnpm dev    # tsx watch
pnpm build  # emits dist/
pnpm typecheck
```

The dev server speaks MCP over stdio, so it's not directly browseable. To
exercise tools without an LLM, drive it with the smoke-test pattern in
`scripts/smoke.sh` (initialize → notifications/initialized → tools/call).

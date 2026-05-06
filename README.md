# mcmcp

MCP server + real-time 3D web viewer to build Minecraft schematics with an AI.

```
┌──────────┐     stdio/MCP      ┌─────────────┐    Realtime    ┌──────────┐
│   AI     │ ◄────────────────► │ MCP server  │ ◄────────────► │ Browser  │
│ (Claude) │                    │  (Node.ts)  │   via DB pub   │ (Three)  │
└──────────┘                    └─────────────┘                 └──────────┘
                                       │                              ▲
                                       └──────► Supabase ◄────────────┘
```

## Quick start

### 1. Open the viewer

Go to the viewer, create a session, and note the 6-character ID.

### 2. Add to Claude config

```jsonc
// ~/.claude.json
{
  "mcpServers": {
    "mcmcp-schematic": {
      "command": "node",
      "args": ["/path/to/mcmcp/mcp/dist/index.js"],
      "env": {
        "MCMCP_SESSION_ID": "ABC123",
        "MCMCP_VIEWER_ORIGIN": "http://localhost:3000"
      }
    }
  }
}
```

### 3. Start building

Tell Claude what to build. Blocks appear live in the viewer.

```text
"Build a medieval house with oak planks, stone walls, and a glass window"
```

### 4. Export to Minecraft

Click **Export .litematic** in the viewer or use the `export_litematic` MCP tool. Drop the file into your Minecraft `schematics` folder and load with the [Litematica mod](https://www.curseforge.com/minecraft/mc-mods/litematica).

---

## Layout

- `web/` — Next.js 16 + Three.js viewer
- `mcp/` — MCP server in TypeScript
- `supabase/migrations/` — SQL schema

---

## Dev loop

### Viewer (web)

```bash
cd web
pnpm dev
# → http://localhost:3000
```

### MCP server

```bash
cd mcp
pnpm install
pnpm build
# Then restart Claude Code to pick up the new build
```

---

## MCP Tools

| Category | Tools |
|----------|-------|
| **Session** | `create_zone`, `use_session`, `current_session`, `set_version` |
| **Write** | `set_block`, `set_blocks`, `fill_region`, `fill_layer`, `replace` |
| **Read** | `get_all`, `get_region`, `get_layer` |
| **Export** | `export_litematic` |

Full tool reference in [`mcp/README.md`](mcp/README.md).

---

## Database

Hosted on the shared **MyMonkey** Supabase project. Tables are namespaced
with the `mcmcp_` prefix.

The migration is in `supabase/migrations/0001_init.sql`.

---

## Roadmap

- [x] M1 — Standalone viewer + realtime
- [x] M2 — MCP with core tools
- [x] M3 — Fill/replace/get region/layer tools
- [x] M4 — `.litematic` export (Litematica v6, MC 1.16+)
- [x] M5a — Vanilla textures (per-face) + spawn animations
- [x] M5b — Block manifest (~750 blocks/version), Y-slider, materials panel, MC version selector
- [x] M5c — Slabs and stairs with proper geometry

---

## License

Open source — [my-monkeys](https://github.com/my-monkeys)

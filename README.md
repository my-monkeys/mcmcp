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

## Layout

- `web/` — Next.js 16 + Three.js viewer (M1, done).
- `mcp/` — MCP server in TypeScript (M2+, todo).
- `supabase/migrations/` — SQL schema.

## M1: standalone viewer

```bash
cd web
pnpm dev
```

Open `http://localhost:3000`, click "Create session", note the 6-char ID, see the 3D zone.

For now blocks are inserted directly via SQL (or the Supabase dashboard) until the MCP lands in M2:

```sql
insert into mcmcp_blocks (session_id, x, y, z, block_type) values
  ('ABC123', 0, 0, 0, 'stone'),
  ('ABC123', 1, 0, 0, 'oak_planks'),
  ('ABC123', 0, 1, 0, 'glass');
```

You should see them appear in the viewer in real-time.

## Database

Hosted on the shared **MyMonkey** Supabase project (`klliwmgdyuatstjvzzbb`). Tables
are namespaced with the `mcmcp_` prefix to coexist with the other my-monkey
projects sharing the instance.

The migration is in `supabase/migrations/0001_init.sql` and was applied via the
Supabase MCP. To re-apply on a fresh project, run it through the Supabase
dashboard SQL editor.

## M2: MCP server

```bash
cd mcp
pnpm install
pnpm build
```

Then point Claude Code at it via `~/.claude.json` — see `mcp/README.md` for the
config snippet. Set `MCMCP_SESSION_ID` to the 6-char ID shown in the viewer.
Tools available: `create_zone`, `set_block`, `set_blocks`, `get_all`.

## Roadmap

- [x] M1 — Standalone viewer + realtime
- [x] M2 — MCP with `create_zone`, `set_block`, `set_blocks`, `get_all`, `use_session`, `current_session`
- [x] M3 — `fill_region`, `fill_layer`, `replace`, `get_region`, `get_layer`
- [x] M5a — Vanilla textures (per-face) + spawn pop-in animation
- [x] M4 — `.litematic` export (Litematica v6, MC 1.16+)
- [x] M5b — Auto-generated manifest (~750 blocks/version), Y-slider, materials panel, MC version selector (1.20/1.21)
- [x] M5c — Slabs (`type=top|bottom|double`) and stairs (`facing` × `half`) rendered with proper geometry. Fences/walls/doors still render as cubes.
- [x] Per-session MC version persisted in DB (`mcmcp_sessions.mc_version`); litematic export uses the matching MinecraftDataVersion.

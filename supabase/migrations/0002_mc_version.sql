-- Per-session Minecraft version. Used by:
--   * the viewer to load the matching texture pack manifest
--   * the MCP to pick the correct MinecraftDataVersion in litematic exports
-- Existing sessions default to 1.21 (the texture pack we initially shipped).

alter table mcmcp_sessions
  add column if not exists mc_version text not null default '1.21';

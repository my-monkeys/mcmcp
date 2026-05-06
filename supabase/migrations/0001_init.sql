-- mcmcp schema: shared MyMonkey Supabase project, tables prefixed with mcmcp_
-- Realtime: subscribe to mcmcp_blocks filtered by session_id

create table if not exists mcmcp_sessions (
  id          text primary key,
  size_x      int not null check (size_x > 0 and size_x <= 256),
  size_y      int not null check (size_y > 0 and size_y <= 256),
  size_z      int not null check (size_z > 0 and size_z <= 256),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours'
);

create table if not exists mcmcp_blocks (
  session_id  text not null references mcmcp_sessions(id) on delete cascade,
  x           int not null,
  y           int not null,
  z           int not null,
  block_type  text not null,
  updated_at  timestamptz not null default now(),
  primary key (session_id, x, y, z)
);

create index if not exists mcmcp_blocks_session_idx on mcmcp_blocks(session_id);

-- Realtime publication
alter publication supabase_realtime add table mcmcp_blocks;
alter publication supabase_realtime add table mcmcp_sessions;

-- RLS: capability-token model. Anyone holding the session_id (a 6-char base32
-- code shown only in the browser tab where it was created) may read/write that
-- session. Sessions auto-expire in 24h. Browser uses anon key, MCP also uses
-- anon key (no service role needed since the token IS the capability).
alter table mcmcp_sessions enable row level security;
alter table mcmcp_blocks   enable row level security;

create policy "mcmcp anon read sessions"   on mcmcp_sessions for select using (true);
create policy "mcmcp anon insert sessions" on mcmcp_sessions for insert with check (true);
create policy "mcmcp anon update sessions" on mcmcp_sessions for update using (true);

create policy "mcmcp anon read blocks"   on mcmcp_blocks for select using (true);
create policy "mcmcp anon insert blocks" on mcmcp_blocks for insert with check (true);
create policy "mcmcp anon update blocks" on mcmcp_blocks for update using (true);
create policy "mcmcp anon delete blocks" on mcmcp_blocks for delete using (true);

-- Auto-purge expired sessions (call periodically from the MCP or a cron).
create or replace function mcmcp_purge_expired() returns void as $$
  delete from mcmcp_sessions where expires_at < now();
$$ language sql;

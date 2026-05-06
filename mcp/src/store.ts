import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Session = {
  id: string;
  size_x: number;
  size_y: number;
  size_z: number;
  mc_version: string;
  created_at: string;
  expires_at: string;
};

export const SUPPORTED_MC_VERSIONS = ['1.20', '1.21'] as const;
export type McVersion = (typeof SUPPORTED_MC_VERSIONS)[number];

export function isMcVersion(v: string): v is McVersion {
  return (SUPPORTED_MC_VERSIONS as readonly string[]).includes(v);
}

export type BlockRow = {
  session_id: string;
  x: number;
  y: number;
  z: number;
  block_type: string;
};

export type BlockInput = { x: number; y: number; z: number; block: string };

export type Region = {
  x1: number; y1: number; z1: number;
  x2: number; y2: number; z2: number;
};

export function normalizeRegion(r: Region): Region {
  return {
    x1: Math.min(r.x1, r.x2), x2: Math.max(r.x1, r.x2),
    y1: Math.min(r.y1, r.y2), y2: Math.max(r.y1, r.y2),
    z1: Math.min(r.z1, r.z2), z2: Math.max(r.z1, r.z2),
  };
}

export function regionVolume(r: Region): number {
  return (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1) * (r.z2 - r.z1 + 1);
}

const FILL_CHUNK = 8000;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomSessionId(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

const SESSION_TTL_MS = 5 * 60 * 1000;

export class SchematicStore {
  private readonly sb: SupabaseClient;
  private readonly sessionCache = new Map<string, { session: Session; cachedAt: number }>();

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, { auth: { persistSession: false } });
  }

  async createSession(
    size_x: number,
    size_y: number,
    size_z: number,
    preferredId?: string,
    mcVersion?: McVersion
  ): Promise<Session> {
    const versionPatch = mcVersion ? { mc_version: mcVersion } : {};

    if (preferredId) {
      const { data: existing } = await this.sb
        .from('mcmcp_sessions')
        .select('*')
        .eq('id', preferredId)
        .maybeSingle();

      if (existing) {
        const { error: clearErr } = await this.sb.from('mcmcp_blocks').delete().eq('session_id', preferredId);
        if (clearErr) throw new Error(`Failed to clear session: ${clearErr.message}`);
        const { data, error } = await this.sb
          .from('mcmcp_sessions')
          .update({ size_x, size_y, size_z, ...versionPatch })
          .eq('id', preferredId)
          .select()
          .single();
        if (error || !data) throw new Error(`Failed to update session: ${error?.message}`);
        const session = data as Session;
        this.sessionCache.set(session.id, { session, cachedAt: Date.now() });
        return session;
      }
    }

    for (let attempt = 0; attempt < 8; attempt++) {
      const id = preferredId ?? randomSessionId();
      const { data, error } = await this.sb
        .from('mcmcp_sessions')
        .insert({ id, size_x, size_y, size_z, ...versionPatch })
        .select()
        .single();
      if (!error && data) {
        const session = data as Session;
        this.sessionCache.set(session.id, { session, cachedAt: Date.now() });
        return session;
      }
      if (error?.code !== '23505' || preferredId) {
        throw new Error(`Failed to create session: ${error?.message ?? 'unknown'}`);
      }
    }
    throw new Error('Could not allocate a unique session id after 8 attempts');
  }

  async setSessionVersion(id: string, mcVersion: McVersion): Promise<Session> {
    const { data, error } = await this.sb
      .from('mcmcp_sessions')
      .update({ mc_version: mcVersion })
      .eq('id', id)
      .select()
      .single();
    if (error || !data) throw new Error(`Failed to update session version: ${error?.message}`);
    const session = data as Session;
    this.sessionCache.set(id, { session, cachedAt: Date.now() });
    return session;
  }

  async getSession(id: string): Promise<Session> {
    const cached = this.sessionCache.get(id);
    if (cached && Date.now() - cached.cachedAt < SESSION_TTL_MS) return cached.session;

    const { data, error } = await this.sb.from('mcmcp_sessions').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Failed to fetch session ${id}: ${error.message}`);
    if (!data) throw new Error(`Session ${id} does not exist. Open the viewer to create one, or call create_zone first.`);

    const session = data as Session;
    this.sessionCache.set(id, { session, cachedAt: Date.now() });
    return session;
  }

  invalidateSession(id: string): void {
    this.sessionCache.delete(id);
  }

  async setBlocks(sessionId: string, blocks: BlockInput[]): Promise<{ written: number; cleared: number }> {
    if (blocks.length === 0) return { written: 0, cleared: 0 };

    const air: BlockInput[] = [];
    const solid: BlockInput[] = [];
    for (const b of blocks) {
      if (normalizeBlockType(b.block) === 'air') air.push(b);
      else solid.push(b);
    }

    let cleared = 0;
    if (air.length > 0) {
      const ors = air.map((b) => `and(x.eq.${b.x},y.eq.${b.y},z.eq.${b.z})`).join(',');
      const { error, count } = await this.sb
        .from('mcmcp_blocks')
        .delete({ count: 'exact' })
        .eq('session_id', sessionId)
        .or(ors);
      if (error) throw new Error(`Failed to delete air blocks: ${error.message}`);
      cleared = count ?? 0;
    }

    let written = 0;
    if (solid.length > 0) {
      const rows = solid.map((b) => ({
        session_id: sessionId,
        x: b.x,
        y: b.y,
        z: b.z,
        block_type: normalizeBlockType(b.block),
      }));
      const { error } = await this.sb
        .from('mcmcp_blocks')
        .upsert(rows, { onConflict: 'session_id,x,y,z' });
      if (error) throw new Error(`Failed to upsert blocks: ${error.message}`);
      written = solid.length;
    }
    return { written, cleared };
  }

  async fillRegion(sessionId: string, region: Region, block: string): Promise<{ written: number; cleared: number }> {
    const r = normalizeRegion(region);
    const type = normalizeBlockType(block);

    if (type === 'air') {
      const { error, count } = await this.sb
        .from('mcmcp_blocks')
        .delete({ count: 'exact' })
        .eq('session_id', sessionId)
        .gte('x', r.x1).lte('x', r.x2)
        .gte('y', r.y1).lte('y', r.y2)
        .gte('z', r.z1).lte('z', r.z2);
      if (error) throw new Error(`Failed to clear region: ${error.message}`);
      return { written: 0, cleared: count ?? 0 };
    }

    let written = 0;
    let buffer: BlockInput[] = [];
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        for (let z = r.z1; z <= r.z2; z++) {
          buffer.push({ x, y, z, block: type });
          if (buffer.length >= FILL_CHUNK) {
            const { written: w } = await this.setBlocks(sessionId, buffer);
            written += w;
            buffer = [];
          }
        }
      }
    }
    if (buffer.length > 0) {
      const { written: w } = await this.setBlocks(sessionId, buffer);
      written += w;
    }
    return { written, cleared: 0 };
  }

  async getRegion(sessionId: string, region: Region): Promise<BlockRow[]> {
    const r = normalizeRegion(region);
    const all: BlockRow[] = [];
    const PAGE = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await this.sb
        .from('mcmcp_blocks')
        .select('session_id,x,y,z,block_type')
        .eq('session_id', sessionId)
        .gte('x', r.x1).lte('x', r.x2)
        .gte('y', r.y1).lte('y', r.y2)
        .gte('z', r.z1).lte('z', r.z2)
        .order('y', { ascending: true })
        .order('x', { ascending: true })
        .order('z', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Failed to fetch region: ${error.message}`);
      if (!data || data.length === 0) break;
      all.push(...(data as BlockRow[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }

  async replaceBlocks(
    sessionId: string,
    fromBlock: string,
    toBlock: string,
    region?: Region
  ): Promise<{ replaced: number; cleared: number }> {
    const fromType = normalizeBlockType(fromBlock);
    const toType = normalizeBlockType(toBlock);

    let q = this.sb
      .from('mcmcp_blocks')
      .delete({ count: 'exact' })
      .eq('session_id', sessionId)
      .eq('block_type', fromType);

    if (toType === 'air') {
      // Pure delete.
      if (region) {
        const r = normalizeRegion(region);
        q = q
          .gte('x', r.x1).lte('x', r.x2)
          .gte('y', r.y1).lte('y', r.y2)
          .gte('z', r.z1).lte('z', r.z2);
      }
      const { error, count } = await q;
      if (error) throw new Error(`Failed to clear ${fromType}: ${error.message}`);
      return { replaced: 0, cleared: count ?? 0 };
    }

    // Update in place via raw eq filters; this is a single round-trip.
    let upd = this.sb
      .from('mcmcp_blocks')
      .update({ block_type: toType }, { count: 'exact' })
      .eq('session_id', sessionId)
      .eq('block_type', fromType);
    if (region) {
      const r = normalizeRegion(region);
      upd = upd
        .gte('x', r.x1).lte('x', r.x2)
        .gte('y', r.y1).lte('y', r.y2)
        .gte('z', r.z1).lte('z', r.z2);
    }
    const { error, count } = await upd;
    if (error) throw new Error(`Failed to replace ${fromType}: ${error.message}`);
    return { replaced: count ?? 0, cleared: 0 };
  }

  async getAll(sessionId: string): Promise<BlockRow[]> {
    const all: BlockRow[] = [];
    const PAGE = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await this.sb
        .from('mcmcp_blocks')
        .select('session_id,x,y,z,block_type')
        .eq('session_id', sessionId)
        .order('y', { ascending: true })
        .order('x', { ascending: true })
        .order('z', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Failed to fetch blocks: ${error.message}`);
      if (!data || data.length === 0) break;
      all.push(...(data as BlockRow[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }
}

export function normalizeBlockType(raw: string): string {
  return raw.replace(/^minecraft:/, '').split('[')[0]!.trim();
}

export function ensureRegionInBounds(session: Session, region: Region): Region {
  const r = normalizeRegion(region);
  const out = (
    r.x1 < 0 || r.x2 >= session.size_x ||
    r.y1 < 0 || r.y2 >= session.size_y ||
    r.z1 < 0 || r.z2 >= session.size_z
  );
  if (out) {
    throw new Error(
      `Region (${r.x1},${r.y1},${r.z1})..(${r.x2},${r.y2},${r.z2}) exceeds zone ` +
        `${session.size_x}×${session.size_y}×${session.size_z}. ` +
        `Valid range: x∈[0,${session.size_x - 1}], y∈[0,${session.size_y - 1}], z∈[0,${session.size_z - 1}].`
    );
  }
  return r;
}

export function ensureInBounds(session: Session, blocks: BlockInput[]): void {
  const out: BlockInput[] = [];
  for (const b of blocks) {
    if (
      b.x < 0 || b.x >= session.size_x ||
      b.y < 0 || b.y >= session.size_y ||
      b.z < 0 || b.z >= session.size_z
    ) out.push(b);
    if (out.length >= 5) break;
  }
  if (out.length > 0) {
    const sample = out.map((b) => `(${b.x},${b.y},${b.z})`).join(', ');
    throw new Error(
      `Out of bounds: ${out.length === 5 ? 'at least 5' : out.length} block(s) outside zone ` +
        `${session.size_x}×${session.size_y}×${session.size_z}. Examples: ${sample}. ` +
        `Valid range: x∈[0,${session.size_x - 1}], y∈[0,${session.size_y - 1}], z∈[0,${session.size_z - 1}].`
    );
  }
}

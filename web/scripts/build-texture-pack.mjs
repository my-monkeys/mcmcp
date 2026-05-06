// Build a texture pack manifest for a given Minecraft version.
//
// Usage:  node scripts/build-texture-pack.mjs [version]   # default 1.21
//
// Outputs:
//   web/public/textures/<version>/block/*.png       — all referenced block textures
//   web/public/textures/<version>/manifest.json     — block_id → face mapping
//
// Source: github.com/InventivetalentDev/minecraft-assets — the per-version
// vanilla asset tree mirrored as a git repo with one branch per MC version.
// We use the trees API once to list every file, then raw.githubusercontent
// for downloads (raw is not rate-limited the same way the API is).

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = process.argv[2] || '1.21';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'textures', VERSION);
const BLOCK_DIR = join(OUT_DIR, 'block');
const TREES = `https://api.github.com/repos/InventivetalentDev/minecraft-assets/git/trees/${VERSION}?recursive=1`;
const RAW = (path) => `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/${VERSION}/${path}`;

const CONCURRENCY = 24;
const STRIP_PREFIX = 'minecraft:block/';

/** Run an async fn over `items` with at most `n` in flight. */
async function pmap(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function fetchBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function stripTextureRef(ref) {
  if (typeof ref !== 'string') return null;
  // Texture refs look like "minecraft:block/stone" or "#side" (variable).
  if (ref.startsWith('#')) return ref; // unresolved variable
  return ref.replace(/^minecraft:/, '').replace(/^block\//, '');
}

/**
 * Last-resort: pick any plausible block-folder texture from a resolved model.
 * Used when none of the structured shape branches in inferEntry matched.
 * Returns null if nothing usable (e.g. all refs live in textures/item/).
 */
function anyBlockTexture(textures) {
  // Preference order: a texture intended to summarize the block (particle,
  // texture, all), then face textures, then any random reference.
  const pref = ['particle', 'texture', 'all', 'top', 'side', 'front', 'pattern', 'cross', 'plant'];
  for (const k of pref) {
    const v = stripTextureRef(textures[k]);
    if (v && !v.startsWith('#') && !v.includes('/')) return v;
  }
  for (const v of Object.values(textures)) {
    const r = stripTextureRef(v);
    if (r && !r.startsWith('#') && !r.includes('/')) return r;
  }
  return null;
}

/** Resolve `#variable` references against a textures map until stable. */
function resolveVariables(textures) {
  const out = { ...textures };
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const [k, v] of Object.entries(out)) {
      if (typeof v === 'string' && v.startsWith('#')) {
        const target = out[v.slice(1)];
        if (target !== undefined && target !== v) {
          out[k] = target;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return out;
}

/** Walk the parent chain, collecting names + merging textures. */
function buildResolved(modelName, modelMap) {
  const seen = new Set();
  let cur = modelName;
  const chain = [];
  let merged = {};
  let elements = undefined;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const m = modelMap.get(cur);
    if (!m) break;
    chain.push(cur);
    if (m.elements && !elements) elements = m.elements;
    if (m.textures) merged = { ...m.textures, ...merged }; // child overrides parent
    if (!m.parent) break;
    cur = m.parent.replace(/^minecraft:/, '');
  }
  return { chain, textures: resolveVariables(merged), elements };
}

/** Map the resolved model to a face manifest entry. */
function inferEntry(name, resolved) {
  const t = resolved.textures;
  const inChain = (n) => resolved.chain.includes(`block/${n}`);

  // Scan elements for faces that have a tintindex — those need the foliage tint.
  const tintFaces = new Set();
  if (Array.isArray(resolved.elements)) {
    for (const el of resolved.elements) {
      if (!el.faces) continue;
      for (const [fname, face] of Object.entries(el.faces)) {
        if (face && typeof face === 'object' && Number.isInteger(face.tintindex)) {
          tintFaces.add(fname);
        }
      }
    }
  }

  const tex = (key) => stripTextureRef(t[key]);

  // cube_all / leaves: single texture for all faces
  if (inChain('cube_all') || inChain('leaves')) {
    const all = tex('all');
    if (!all) return null;
    return { type: 'all', all, ...(tintFaces.size > 0 ? { tint: ['all'] } : {}) };
  }
  // cube_column: end (top/bottom) + side
  if (inChain('cube_column') || inChain('cube_column_horizontal')) {
    const top = tex('end') ?? tex('top');
    const side = tex('side');
    if (!top || !side) return null;
    return { type: 'column', top, side, ...(tintFaces.size > 0 ? { tint: Array.from(tintFaces) } : {}) };
  }
  // cube_bottom_top: top + bottom + side
  if (inChain('cube_bottom_top') || inChain('cube_top')) {
    const top = tex('top'); const side = tex('side'); const bottom = tex('bottom') ?? side;
    if (!top || !side) return null;
    const entry = { type: 'bottom_top', top, side, bottom };
    const tints = [];
    if (tintFaces.has('up')) tints.push('top');
    if (tintFaces.has('north') || tintFaces.has('south') || tintFaces.has('east') || tintFaces.has('west')) tints.push('side');
    if (tintFaces.has('down')) tints.push('bottom');
    if (tints.length > 0) entry.tint = tints;
    return entry;
  }
  // cube (full directional)
  if (inChain('cube') || inChain('cube_directional')) {
    const up = tex('up') ?? tex('top');
    const down = tex('down') ?? tex('bottom') ?? up;
    const north = tex('north'); const south = tex('south') ?? north;
    const east = tex('east') ?? north; const west = tex('west') ?? north;
    if (up && north) return { type: 'directional', up, down, north, south, east, west };
    // Cube parent but textures use a single 'pattern' or 'particle' variable
    // (glazed_terracotta and friends). Treat as cube_all using that texture.
    const single = anyBlockTexture(t);
    if (single) return { type: 'all', all: single };
    return null;
  }
  // cross / tinted_cross (flowers, ferns)
  if (inChain('cross') || inChain('tinted_cross')) {
    const c = tex('cross') ?? tex('plant');
    if (!c) return null;
    return { type: 'cross', all: c, ...(inChain('tinted_cross') ? { tint: ['all'] } : {}) };
  }
  // Slabs and stairs share the cube_bottom_top texture layout (top/side/bottom),
  // they only differ from a regular cube in geometry. The web app handles their
  // shape; here we just emit the correct face mapping.
  if (inChain('slab') || inChain('half_slab') || inChain('slab_top') || inChain('stairs')) {
    const top = tex('top') ?? tex('side');
    const side = tex('side') ?? tex('top');
    const bottom = tex('bottom') ?? side;
    if (!top || !side || !bottom) return null;
    const shape = inChain('stairs') ? 'stairs' : inChain('slab_top') ? 'slab_top' : 'slab';
    return { type: shape, top, side, bottom };
  }
  // Texture-based heuristic: if the resolved textures expose both `top` and
  // `side`, emit a bottom_top entry regardless of the parent chain. Catches
  // grass_block (and similar) which inherit from `block/block` with a custom
  // model rather than `cube_bottom_top`.
  if (tex('top') && tex('side')) {
    const top = tex('top');
    const side = tex('side');
    const bottom = tex('bottom') ?? side;
    const entry = { type: 'bottom_top', top, side, bottom };
    const tints = [];
    if (tintFaces.has('up')) tints.push('top');
    if (tintFaces.has('north') || tintFaces.has('south') || tintFaces.has('east') || tintFaces.has('west')) tints.push('side');
    if (tintFaces.has('down')) tints.push('bottom');
    if (tints.length > 0) entry.tint = tints;
    return entry;
  }
  // Walls / fences / panes / ad-hoc — fall back to a uniform cube using the
  // best available texture so they at least appear with the right color.
  const fallback = anyBlockTexture(t);
  if (fallback) {
    const shape = inChain('fence_post') || inChain('fence_inventory') ? 'fence'
      : inChain('wall_post') ? 'wall'
      : 'all';
    return { type: shape, all: fallback };
  }
  return null;
}

async function main() {
  console.log(`▸ Building texture pack for Minecraft ${VERSION} → ${OUT_DIR}`);
  await mkdir(BLOCK_DIR, { recursive: true });

  console.log('  fetching tree...');
  const tree = await fetchJson(TREES);
  if (tree.truncated) console.warn('    WARNING: tree response was truncated by GitHub');

  const modelPaths = tree.tree
    .filter((n) => n.type === 'blob' && n.path.startsWith('assets/minecraft/models/block/') && n.path.endsWith('.json'))
    .map((n) => n.path);
  const blockstateNames = new Set(
    tree.tree
      .filter((n) => n.type === 'blob' && n.path.startsWith('assets/minecraft/blockstates/') && n.path.endsWith('.json'))
      .map((n) => n.path.split('/').pop().replace('.json', ''))
  );
  console.log(`  ${modelPaths.length} model JSONs, ${blockstateNames.size} canonical blocks`);

  const modelMap = new Map();
  let modelOk = 0;
  await pmap(modelPaths, CONCURRENCY, async (path) => {
    const name = path.replace('assets/minecraft/models/', '').replace('.json', ''); // "block/stone"
    try {
      const json = await fetchJson(RAW(path));
      modelMap.set(name, json);
      modelOk++;
    } catch (e) {
      console.warn(`    skip ${name}: ${e.message}`);
    }
  });
  console.log(`  ${modelOk} models loaded`);

  // Build manifest: prefer the model with the same name as the blockstate
  // (most common case). For blockstates with no direct model (walls, fences,
  // etc. — they only have sub-models like `_post`, `_inventory`, `_side`),
  // fall back to a representative sub-model so the block still renders as a
  // textured cube instead of a pink hash-color.
  // Doors, panels, beds, chests… have no `<id>.json` directly. Try common
  // sub-model suffixes; if none match, scan all models with this id as prefix.
  const SUB_MODEL_FALLBACKS = [
    '_post', '_inventory', '_bottom', '_side', '_top',
    '_bottom_left', '_bottom_right', '_top_left', '_top_right',
    '_head', '_foot', '_floor', '_hanging', '_wall',
  ];
  const blocks = {};
  const usedTextures = new Set();
  let kept = 0, dropped = 0;

  const droppedReasons = new Map();
  for (const id of blockstateNames) {
    let modelName = `block/${id}`;
    let raw = modelMap.get(modelName);
    if (!raw || !raw.textures) {
      // Try common suffix variants first (cheaper than scanning).
      for (const suffix of SUB_MODEL_FALLBACKS) {
        const candidate = `block/${id}${suffix}`;
        const cand = modelMap.get(candidate);
        if (cand?.textures) {
          modelName = candidate;
          raw = cand;
          break;
        }
      }
    }
    if (!raw || !raw.textures) {
      // Wall variants (acacia_wall_sign, acacia_wall_torch…) and others that
      // have no own model file: borrow the non-wall counterpart's textures.
      const stripped = id.replace('_wall_', '_');
      if (stripped !== id) {
        const cand = modelMap.get(`block/${stripped}`);
        if (cand?.textures) { modelName = `block/${stripped}`; raw = cand; }
      }
    }
    if (!raw || !raw.textures) {
      // Last resort: any model whose name starts with `block/<id>` and has textures.
      const prefix = `block/${id}`;
      for (const [n, m] of modelMap) {
        if ((n === prefix || n.startsWith(prefix + '_')) && m.textures) {
          modelName = n; raw = m; break;
        }
      }
    }
    if (!raw?.textures) { droppedReasons.set(id, 'no-model'); dropped++; continue; }
    const resolved = buildResolved(modelName, modelMap);
    const entry = inferEntry(id, resolved);
    if (!entry) { droppedReasons.set(id, 'infer-failed'); dropped++; continue; }

    // Replace any unresolvable face (#var or textures/item/...) with the best
    // local block texture we can find. Better to display a known cube color
    // than drop the block entirely.
    const localFallback = anyBlockTexture(resolved.textures);
    let badAfterFix = null;
    for (const [k, v] of Object.entries(entry)) {
      if (k === 'type' || k === 'tint') continue;
      if (typeof v !== 'string') continue;
      if (v.startsWith('#') || v.includes('/')) {
        if (localFallback) entry[k] = localFallback;
        else badAfterFix = v;
      }
    }
    if (badAfterFix) { droppedReasons.set(id, `bad-ref:${badAfterFix}`); dropped++; continue; }

    blocks[id] = entry;
    for (const [k, v] of Object.entries(entry)) {
      if (k === 'type' || k === 'tint') continue;
      if (typeof v === 'string') usedTextures.add(v);
    }
    kept++;
  }
  console.log(`  ${kept} blocks in manifest (${dropped} unresolvable)`);
  if (process.env.DEBUG_DROPPED) {
    const grouped = new Map();
    for (const [id, reason] of droppedReasons) {
      const tag = reason.split(':')[0];
      if (!grouped.has(tag)) grouped.set(tag, []);
      grouped.get(tag).push(id);
    }
    for (const [tag, ids] of grouped) console.log(`    ${tag}: ${ids.length} — sample: ${ids.slice(0, 6).join(', ')}`);
  }

  // Manual overrides for blocks where vanilla uses a custom geometry our
  // heuristic-based inferEntry can't classify. Keep the list minimal — only
  // the visually impactful ones.
  const SHAPE_OVERRIDES = {
    torch:                 { type: 'cross', all: 'torch' },
    redstone_torch:        { type: 'cross', all: 'redstone_torch' },
    soul_torch:            { type: 'cross', all: 'soul_torch' },
    wall_torch:            { type: 'cross', all: 'torch' },
    redstone_wall_torch:   { type: 'cross', all: 'redstone_torch' },
    soul_wall_torch:       { type: 'cross', all: 'soul_torch' },
    lily_pad:              { type: 'flat',  all: 'lily_pad', tint: ['all'] },
  };
  for (const [id, override] of Object.entries(SHAPE_OVERRIDES)) {
    if (blocks[id]) {
      blocks[id] = override;
      for (const [k, v] of Object.entries(override)) {
        if (k === 'type' || k === 'tint') continue;
        if (typeof v === 'string') usedTextures.add(v);
      }
    }
  }

  // Always include the side overlay used for grass-style compositing.
  usedTextures.add('grass_block_side_overlay');

  console.log(`  downloading ${usedTextures.size} textures...`);
  let texOk = 0, texSkip = 0, texFail = 0;
  await pmap(Array.from(usedTextures), CONCURRENCY, async (texName) => {
    const out = join(BLOCK_DIR, `${texName}.png`);
    if (await exists(out)) { texSkip++; return; }
    const url = RAW(`assets/minecraft/textures/block/${texName}.png`);
    try {
      const buf = await fetchBuffer(url);
      await writeFile(out, buf);
      texOk++;
    } catch (e) {
      texFail++;
      console.warn(`    skip ${texName}: ${e.message}`);
    }
  });
  console.log(`  textures: ${texOk} downloaded, ${texSkip} cached, ${texFail} failed`);

  const manifest = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    blocks,
  };
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`  manifest saved: ${kept} blocks`);
  console.log('✓ done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

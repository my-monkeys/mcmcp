import type { Session, Block } from '@/lib/types';

/**
 * Building Gadgets 2 Template encoder. Produces the JSON string the user pastes
 * into the Template Manager's "Load from JSON" input.
 *
 * Format:
 *   {
 *     "name": "<display name>",
 *     "statePosArrayList": "<SNBT compound, stringified>",
 *     "requiredItems": {}
 *   }
 *
 * The inner SNBT compound has shape:
 *   {
 *     startpos: { X, Y, Z },
 *     endpos:   { X, Y, Z },
 *     blockstatemap: [ {Name:"minecraft:foo", Properties:{...}}, ... ],
 *     statelist: [I; idx, idx, ... ]   // length = sx*sy*sz
 *   }
 *
 * `statelist` is iterated in Mojang's `BlockPos.betweenClosedStream` order:
 * z outermost, y middle, x innermost — flat = z*(sx*sy) + y*sx + x.
 *
 * References:
 *   - https://github.com/Direwolf20-MC/BuildingGadgets2/blob/main/src/main/java/com/direwolf20/buildinggadgets2/util/datatypes/Template.java
 *   - https://github.com/Direwolf20-MC/BuildingGadgets2/blob/main/src/main/java/com/direwolf20/buildinggadgets2/common/worlddata/BG2Data.java
 */

type BlockState = { name: string; properties?: Record<string, string> };

const RE_STATE = /^([a-z0-9_:]+)(?:\[([^\]]+)\])?$/;

function parseBlockState(raw: string): BlockState {
  const trimmed = raw.trim();
  const m = trimmed.match(RE_STATE);
  if (!m) throw new Error(`Invalid block id "${raw}"`);
  const head = m[1]!;
  const id = head.includes(':') ? head : `minecraft:${head}`;
  if (!m[2]) return { name: id };
  const properties: Record<string, string> = {};
  for (const pair of m[2].split(',')) {
    const [k, v] = pair.split('=');
    if (k && v) properties[k.trim()] = v.trim();
  }
  return { name: id, properties };
}

function stateKey(s: BlockState): string {
  if (!s.properties) return s.name;
  const sorted = Object.keys(s.properties).sort();
  return `${s.name}[${sorted.map((k) => `${k}=${s.properties![k]}`).join(',')}]`;
}

// JSON quoting is a valid superset of SNBT quoted-string syntax — escapes are identical.
function snbtString(s: string): string {
  return JSON.stringify(s);
}

function snbtBlockState(s: BlockState): string {
  let out = `{Name:${snbtString(s.name)}`;
  if (s.properties && Object.keys(s.properties).length > 0) {
    const props = Object.entries(s.properties)
      .map(([k, v]) => `${snbtString(k)}:${snbtString(v)}`)
      .join(',');
    out += `,Properties:{${props}}`;
  }
  return out + '}';
}

export type Bg2BuildResult = {
  json: string;
  totalBlocks: number;
  paletteSize: number;
};

export type Bg2Options = {
  name?: string;
};

export function buildBg2Template(
  session: Session,
  rows: Block[],
  opts: Bg2Options = {}
): Bg2BuildResult {
  const sx = session.size_x;
  const sy = session.size_y;
  const sz = session.size_z;
  const volume = sx * sy * sz;

  // Index 0 is air. BG2's reader iterates the full AABB, so unset cells must
  // resolve to a valid palette entry — air is the natural default.
  const air: BlockState = { name: 'minecraft:air' };
  const palette: BlockState[] = [air];
  const paletteIndex = new Map<string, number>();
  paletteIndex.set(stateKey(air), 0);

  const indices = new Array<number>(volume).fill(0);
  let totalBlocks = 0;

  for (const row of rows) {
    if (
      row.x < 0 || row.x >= sx ||
      row.y < 0 || row.y >= sy ||
      row.z < 0 || row.z >= sz
    ) continue;
    const state = parseBlockState(row.block_type);
    if (state.name === 'minecraft:air') continue;
    const k = stateKey(state);
    let idx = paletteIndex.get(k);
    if (idx === undefined) {
      idx = palette.length;
      palette.push(state);
      paletteIndex.set(k, idx);
    }
    const flat = row.z * (sx * sy) + row.y * sx + row.x;
    indices[flat] = idx;
    totalBlocks++;
  }

  const startposSnbt = `{X:0,Y:0,Z:0}`;
  const endposSnbt = `{X:${sx - 1},Y:${sy - 1},Z:${sz - 1}}`;
  const blockstatemapSnbt = `[${palette.map(snbtBlockState).join(',')}]`;
  const statelistSnbt = `[I;${indices.join(',')}]`;
  const innerSnbt =
    `{startpos:${startposSnbt},endpos:${endposSnbt},` +
    `blockstatemap:${blockstatemapSnbt},statelist:${statelistSnbt}}`;

  const template = {
    name: opts.name ?? `mcmcp ${session.id}`,
    statePosArrayList: innerSnbt,
    requiredItems: {},
  };

  return {
    json: JSON.stringify(template, null, 2),
    totalBlocks,
    paletteSize: palette.length,
  };
}

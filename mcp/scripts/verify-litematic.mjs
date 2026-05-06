import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import nbt from 'prismarine-nbt';

const path = process.argv[2];
const buf = gunzipSync(readFileSync(path));
const { parsed } = await nbt.parse(buf, 'big');
const root = nbt.simplify(parsed);

console.log('Version:                ', root.Version);
console.log('MinecraftDataVersion:   ', root.MinecraftDataVersion);
console.log('Metadata.Name:          ', root.Metadata.Name);
console.log('Metadata.TotalBlocks:   ', root.Metadata.TotalBlocks);
console.log('Metadata.TotalVolume:   ', root.Metadata.TotalVolume);

const region = root.Regions.Main;
console.log('Region.Size:            ', region.Size);
console.log('Palette size:           ', region.BlockStatePalette.length);
console.log('Palette[0..5]:          ', region.BlockStatePalette.slice(0, 6).map(p => p.Name));

const sx = region.Size.x, sy = region.Size.y, sz = region.Size.z;
const longs = region.BlockStates;
const paletteSize = region.BlockStatePalette.length;
const bpe = Math.max(2, Math.ceil(Math.log2(Math.max(2, paletteSize))));
const epl = Math.floor(64 / bpe);
const mask = (1n << BigInt(bpe)) - 1n;

function getAt(x, y, z) {
  const flat = (y * sz + z) * sx + x;
  const li = Math.floor(flat / epl);
  const bo = (flat % epl) * bpe;
  const [hi, lo] = longs[li];
  const big = (BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0);
  return Number((big >> BigInt(bo)) & mask);
}

const samples = [[0,0,0],[11,0,0],[8,4,8],[13,1,13],[15,15,15]];
for (const [x, y, z] of samples) {
  const idx = getAt(x, y, z);
  const p = region.BlockStatePalette[idx];
  console.log(`  block at (${x},${y},${z}) idx=${idx} -> ${p.Name}`);
}

let nonAir = 0;
for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
  if (getAt(x, y, z) !== 0) nonAir++;
}
console.log('Decoded non-air count:  ', nonAir, nonAir === root.Metadata.TotalBlocks ? '✓ matches' : '✗ MISMATCH');

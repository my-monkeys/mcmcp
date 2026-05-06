// web/src/app/s/[id]/BiomePanel.tsx
'use client';

import { useState } from 'react';
import type { BiomeName } from '@/lib/biome';

const BIOMES: { value: BiomeName; label: string }[] = [
  { value: 'plains',  label: 'Plains' },
  { value: 'forest',  label: 'Forest' },
  { value: 'desert',  label: 'Desert' },
  { value: 'taiga',   label: 'Taiga' },
  { value: 'mesa',    label: 'Mesa' },
];

type Props = {
  hasExistingBlocks: boolean;
  busy: boolean;
  status: string | null;
  onGenerate: (biome: BiomeName, seed: number) => void;
};

export function BiomePanel({ hasExistingBlocks, busy, status, onGenerate }: Props) {
  const [biome, setBiome] = useState<BiomeName>('plains');
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 0x7fffffff));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const trigger = () => {
    if (hasExistingBlocks) {
      setConfirmOpen(true);
      return;
    }
    onGenerate(biome, seed);
  };

  const confirm = () => {
    setConfirmOpen(false);
    onGenerate(biome, seed);
  };

  return (
    <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-lg px-4 py-3 text-xs space-y-3 min-w-56">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Generate biome</div>

      <label className="flex items-center justify-between gap-2">
        <span className="text-zinc-400">Biome</span>
        <select
          value={biome}
          onChange={(e) => setBiome(e.target.value as BiomeName)}
          className="bg-zinc-800/60 border border-zinc-700 rounded px-2 py-0.5 text-xs outline-none focus:border-blue-500"
        >
          {BIOMES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </label>

      <label className="flex items-center justify-between gap-2">
        <span className="text-zinc-400">Seed</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            className="bg-zinc-800/60 border border-zinc-700 rounded px-2 py-0.5 text-xs outline-none focus:border-blue-500 w-24 tabular-nums"
          />
          <button
            onClick={() => setSeed(Math.floor(Math.random() * 0x7fffffff))}
            className="text-zinc-500 hover:text-zinc-200"
            title="Random seed"
          >🎲</button>
        </div>
      </label>

      <button
        onClick={trigger}
        disabled={busy}
        className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded px-3 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? 'Generating…' : 'Generate biome →'}
      </button>

      {status && <div className="text-[10px] text-zinc-500 text-center">{status}</div>}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md text-sm space-y-4">
            <div className="font-semibold">Replace all blocks in the zone?</div>
            <p className="text-zinc-400">
              This will overwrite every existing block. The action cannot be undone from the viewer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-xs"
              >Cancel</button>
              <button
                onClick={confirm}
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs"
              >Replace and generate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

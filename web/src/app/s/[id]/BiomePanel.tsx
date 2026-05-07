// web/src/app/s/[id]/BiomePanel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { BiomeName, RiversConfig } from '@/lib/biome';
import { getBiomeRivers } from '@/lib/biome';

const BIOMES: { value: BiomeName; label: string }[] = [
  { value: 'plains',  label: 'Plains' },
  { value: 'forest',  label: 'Forest' },
  { value: 'desert',  label: 'Desert' },
  { value: 'taiga',   label: 'Taiga' },
  { value: 'mesa',    label: 'Mesa' },
];

const BIOMES_WITH_RIVERS: ReadonlySet<BiomeName> = new Set(['plains', 'forest', 'taiga']);

// Slider ranges. Defaults come from each biome's BiomeConfig.rivers and reset
// on biome change.
const W_MIN = 0.05;
const W_MAX = 0.20;
const F_MIN = 0.005;
const F_MAX = 0.04;

type Props = {
  hasExistingBlocks: boolean;
  busy: boolean;
  status: string | null;
  onGenerate: (biome: BiomeName, seed: number, rivers: boolean, override: Partial<RiversConfig>) => void;
  onTweak: (biome: BiomeName, seed: number, rivers: boolean, override: Partial<RiversConfig>) => void;
};

function defaultsFor(biome: BiomeName): { threshold: number; frequency: number } {
  const r = getBiomeRivers(biome);
  return {
    threshold: r?.threshold ?? 0.14,
    frequency: r?.frequency ?? 0.015,
  };
}

export function BiomePanel({ hasExistingBlocks, busy, status, onGenerate, onTweak }: Props) {
  const [biome, setBiome] = useState<BiomeName>('plains');
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 0x7fffffff));
  const [rivers, setRivers] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const initialDefaults = defaultsFor('plains');
  const [threshold, setThreshold] = useState(initialDefaults.threshold);
  const [frequency, setFrequency] = useState(initialDefaults.frequency);

  // Reset slider values to the new biome's defaults when biome changes.
  useEffect(() => {
    const d = defaultsFor(biome);
    setThreshold(d.threshold);
    setFrequency(d.frequency);
  }, [biome]);

  const riversAvailable = BIOMES_WITH_RIVERS.has(biome);

  // Live tweak: when sliders or rivers toggle move (and the user has already
  // committed at least one Generate), call onTweak debounced.
  const hasGeneratedOnce = useRef(false);
  const tweakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasGeneratedOnce.current) return;
    if (tweakTimer.current) clearTimeout(tweakTimer.current);
    tweakTimer.current = setTimeout(() => {
      onTweak(biome, seed, rivers && riversAvailable, { threshold, frequency });
    }, 150);
    return () => {
      if (tweakTimer.current) clearTimeout(tweakTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, frequency, rivers, biome, seed]);

  const trigger = () => {
    if (hasExistingBlocks) {
      setConfirmOpen(true);
      return;
    }
    hasGeneratedOnce.current = true;
    onGenerate(biome, seed, rivers && riversAvailable, { threshold, frequency });
  };

  const confirm = () => {
    setConfirmOpen(false);
    hasGeneratedOnce.current = true;
    onGenerate(biome, seed, rivers && riversAvailable, { threshold, frequency });
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

      <label
        className={`flex items-center gap-2 ${riversAvailable ? '' : 'opacity-40 cursor-not-allowed'}`}
        title={riversAvailable ? 'Carve serpentine river channels' : 'Not available for this biome'}
      >
        <input
          type="checkbox"
          checked={rivers && riversAvailable}
          disabled={!riversAvailable}
          onChange={(e) => setRivers(e.target.checked)}
        />
        <span className="text-zinc-400">Rivers</span>
      </label>

      {riversAvailable && rivers && (
        <div className="space-y-2 pl-4 border-l border-zinc-800">
          <label className="block">
            <div className="flex justify-between text-zinc-500 mb-0.5">
              <span>Width</span>
              <span className="font-mono tabular-nums">{threshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={W_MIN}
              max={W_MAX}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </label>
          <label className="block">
            <div className="flex justify-between text-zinc-500 mb-0.5">
              <span>Density</span>
              <span className="font-mono tabular-nums">{frequency.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min={F_MIN}
              max={F_MAX}
              step={0.005}
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </label>
        </div>
      )}

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

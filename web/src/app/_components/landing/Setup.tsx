'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { generateSessionId, supabase } from '@/lib/supabase';

type SizePreset = { label: string; x: number; y: number; z: number };

const PRESETS: SizePreset[] = [
  { label: '16 × 16 × 16', x: 16, y: 16, z: 16 },
  { label: '32 × 32 × 32', x: 32, y: 32, z: 32 },
  { label: '64 × 64 × 64', x: 64, y: 64, z: 64 },
  { label: '64 × 256 × 64', x: 64, y: 256, z: 64 },
];

const MAX_DIM = 256;

function clampDim(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_DIM, Math.round(n)));
}

export function Setup() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(1);
  const [custom, setCustom] = useState({ x: 24, y: 24, z: 24 });

  const size = selected >= 0 ? PRESETS[selected]! : custom;
  const volume = size.x * size.y * size.z;

  const create = useCallback(async () => {
    setCreating(true);
    setError(null);
    const x = clampDim(size.x);
    const y = clampDim(size.y);
    const z = clampDim(size.z);
    for (let attempt = 0; attempt < 6; attempt++) {
      const id = generateSessionId();
      const { error } = await supabase.from('mcmcp_sessions').insert({
        id, size_x: x, size_y: y, size_z: z,
      });
      if (!error) {
        router.push(`/s/${id}`);
        return;
      }
      if (error.code !== '23505') {
        setError(error.message);
        setCreating(false);
        return;
      }
    }
    setError('Could not allocate a unique session id, retry.');
    setCreating(false);
  }, [size, router]);

  return (
    <section id="create" className="border-t border-zinc-800/50 bg-zinc-900/50">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col items-center gap-4 mb-10">
          <span className="text-xs font-semibold tracking-[0.25em] text-blue-400 uppercase">
            Try it now
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
            Create a session
          </h2>
        </div>
        <div className="max-w-xl mx-auto flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setSelected(i)}
                className={`border rounded-lg px-4 py-3.5 text-left transition ${
                  selected === i
                    ? 'border-blue-500 bg-blue-500/10 text-blue-200'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-zinc-500">
                  {(p.x * p.y * p.z).toLocaleString()} blocks max
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setSelected(-1)}
            className={`border rounded-lg px-4 py-3.5 text-left transition ${
              selected === -1
                ? 'border-blue-500 bg-blue-500/10 text-blue-200'
                : 'border-zinc-800 hover:border-zinc-600'
            }`}
          >
            <div className="text-sm font-medium">Custom</div>
            <div className="text-xs text-zinc-500">
              {selected === -1
                ? `${custom.x} × ${custom.y} × ${custom.z} (${volume.toLocaleString()} blocks)`
                : `Set your own dimensions (1–${MAX_DIM} per axis)`}
            </div>
          </button>

          {selected === -1 && (
            <div className="grid grid-cols-3 gap-2">
              {([
                { axis: 'x', name: 'Width', hint: '↔ X' },
                { axis: 'y', name: 'Height', hint: '↕ Y' },
                { axis: 'z', name: 'Depth', hint: '⤢ Z' },
              ] as const).map(({ axis, name, hint }) => (
                <label key={axis} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex justify-between">
                    <span>{name}</span><span className="text-zinc-600">{hint}</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_DIM}
                    value={custom[axis]}
                    onChange={(e) =>
                      setCustom((c) => ({ ...c, [axis]: clampDim(Number(e.target.value)) }))
                    }
                    className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm tabular-nums outline-none focus:border-blue-500"
                  />
                </label>
              ))}
            </div>
          )}

          <button
            onClick={create}
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-3.5 transition-colors text-base"
          >
            {creating ? 'Creating session…' : 'Create session →'}
          </button>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      </div>
    </section>
  );
}

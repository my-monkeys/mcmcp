'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(1); // index into PRESETS, or -1 for custom
  const [custom, setCustom] = useState({ x: 24, y: 24, z: 24 });

  const size = selected >= 0 ? PRESETS[selected]! : custom;
  const volume = size.x * size.y * size.z;

  const create = async () => {
    setCreating(true);
    setError(null);
    const x = clampDim(size.x);
    const y = clampDim(size.y);
    const z = clampDim(size.z);
    for (let attempt = 0; attempt < 6; attempt++) {
      const id = generateSessionId();
      const { error } = await supabase.from('mcmcp_sessions').insert({
        id,
        size_x: x,
        size_y: y,
        size_z: z,
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
  };

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-6 font-sans">
      <main className="w-full max-w-xl flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">mcmcp</p>
          <h1 className="text-4xl font-semibold tracking-tight">Build Minecraft schematics with an AI.</h1>
          <p className="text-zinc-400 leading-relaxed">
            Open a session, share its ID with your MCP client, and watch blocks appear in real-time.
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <label className="text-sm text-zinc-400">Zone size</label>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setSelected(i)}
                className={`border rounded-md px-4 py-3 text-left transition ${
                  selected === i
                    ? 'border-blue-500 bg-blue-500/10 text-blue-200'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-zinc-500">{(p.x * p.y * p.z).toLocaleString()} blocks max</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setSelected(-1)}
            className={`border rounded-md px-4 py-3 text-left transition ${
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

          {selected === -1 ? (
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(
                [
                  { axis: 'x', name: 'Width', hint: '↔ X' },
                  { axis: 'y', name: 'Height', hint: '↕ Y' },
                  { axis: 'z', name: 'Depth', hint: '⤢ Z' },
                ] as const
              ).map(({ axis, name, hint }) => (
                <label key={axis} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex justify-between">
                    <span>{name}</span>
                    <span className="text-zinc-600">{hint}</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_DIM}
                    value={custom[axis]}
                    onChange={(e) =>
                      setCustom((c) => ({ ...c, [axis]: clampDim(Number(e.target.value)) }))
                    }
                    className="bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm tabular-nums outline-none focus:border-blue-500"
                  />
                </label>
              ))}
            </div>
          ) : null}
        </section>

        <button
          onClick={create}
          disabled={creating}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-md py-3 transition"
        >
          {creating ? 'Creating session…' : 'Create session →'}
        </button>

        {error ? <p className="text-red-400 text-sm">{error}</p> : null}
      </main>
    </div>
  );
}

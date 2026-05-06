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

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "mcmcp-schematic": {
      "command": "npx",
      "args": ["@my-monkey/mcp-schematic"],
      "env": {
        "MCMCP_SESSION_ID": "YOUR_SESSION_ID"
      }
    }
  }
}`;

function clampDim(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_DIM, Math.round(n)));
}

function copy(text: string) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text);
}

export function Setup() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(1);
  const [custom, setCustom] = useState({ x: 24, y: 24, z: 24 });
  const [copied, setCopied] = useState(false);

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
    <section id="create" data-section="setup" className="border-t border-white/5 py-32 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
        <div className="flex flex-col gap-6">
          <span className="text-xs uppercase tracking-[0.25em] text-[#7ec07e]">Quick setup</span>
          <h3 className="font-black tracking-[-0.03em] leading-[0.9] text-[#f5f3ed]" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Add to your<br />Claude config.
          </h3>
          <div className="relative">
            <pre className="bg-[#050507] border border-white/10 rounded-xl p-6 overflow-x-auto text-sm font-mono text-zinc-200 leading-relaxed">
              <code data-setup-snippet>{CONFIG_SNIPPET}</code>
            </pre>
            <button
              onClick={() => { copy(CONFIG_SNIPPET); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-xs text-zinc-200 px-3 py-1.5 rounded-md"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div data-setup-form className="flex flex-col gap-4">
          <span className="text-xs uppercase tracking-[0.25em] text-[#7ec07e]">Try it now</span>
          <h3 className="font-black tracking-[-0.03em] leading-[0.9] text-[#f5f3ed]" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Create<br />a session.
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setSelected(i)}
                className={`border rounded-lg px-4 py-3.5 text-left transition ${
                  selected === i
                    ? 'border-[#7ec07e] bg-[#7ec07e]/10 text-[#cdebcd]'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-zinc-500">{(p.x * p.y * p.z).toLocaleString()} blocks max</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelected(-1)}
            className={`border rounded-lg px-4 py-3.5 text-left transition ${
              selected === -1
                ? 'border-[#7ec07e] bg-[#7ec07e]/10 text-[#cdebcd]'
                : 'border-white/10 hover:border-white/30'
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
                    onChange={(e) => setCustom((c) => ({ ...c, [axis]: clampDim(Number(e.target.value)) }))}
                    className="bg-[#050507] border border-white/10 rounded-md px-3 py-2 text-sm tabular-nums outline-none focus:border-[#7ec07e]"
                  />
                </label>
              ))}
            </div>
          )}
          <button
            onClick={create}
            disabled={creating}
            className="bg-[#7ec07e] hover:bg-[#6fb46f] disabled:opacity-50 text-[#0b0b0d] font-semibold rounded-lg py-3.5 text-base"
          >
            {creating ? 'Creating session…' : 'Create session →'}
          </button>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      </div>
    </section>
  );
}

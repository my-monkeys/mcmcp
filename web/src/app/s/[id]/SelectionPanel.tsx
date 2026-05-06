'use client';

import { useState } from 'react';
import { copyText } from '@/lib/clipboard';

export type Selection = { x1: number; y1: number; z1: number; x2: number; y2: number; z2: number };

type Props = {
  sessionId: string;
  size: { x: number; y: number; z: number };
  enabled: boolean;
  selection: Selection;
  onChangeEnabled: (v: boolean) => void;
  onChangeSelection: (sel: Selection) => void;
};

const AXES = [
  { label: 'X', lo: 'x1' as const, hi: 'x2' as const, max: 'x' as const },
  { label: 'Z', lo: 'z1' as const, hi: 'z2' as const, max: 'z' as const },
  { label: 'Y (height)', lo: 'y1' as const, hi: 'y2' as const, max: 'y' as const },
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export default function SelectionPanel({ sessionId, size, enabled, selection, onChangeEnabled, onChangeSelection }: Props) {
  const [copied, setCopied] = useState(false);

  const update = (key: keyof Selection, delta: number) => {
    const max = key.startsWith('x') ? size.x - 1 : key.startsWith('y') ? size.y - 1 : size.z - 1;
    const next = { ...selection, [key]: clamp(selection[key] + delta, 0, max) };
    // Keep lo <= hi so the visual box doesn't flip.
    if (next.x1 > next.x2) [next.x1, next.x2] = [next.x2, next.x1];
    if (next.y1 > next.y2) [next.y1, next.y2] = [next.y2, next.y1];
    if (next.z1 > next.z2) [next.z1, next.z2] = [next.z2, next.z1];
    onChangeSelection(next);
  };

  const reset = () => {
    onChangeSelection({ x1: 0, y1: 0, z1: 0, x2: size.x - 1, y2: size.y - 1, z2: size.z - 1 });
  };

  const mcpPrompt =
    `Restrict edits to session ${sessionId}, region (${selection.x1},${selection.y1},${selection.z1})..` +
    `(${selection.x2},${selection.y2},${selection.z2}). Treat any coordinate outside this region as out of bounds.`;

  const copyPrompt = async () => {
    await copyText(mcpPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="absolute bottom-4 right-4 pointer-events-auto bg-zinc-900/85 backdrop-blur border border-zinc-800 rounded-lg w-72 text-xs">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChangeEnabled(e.target.checked)}
            className="accent-amber-500"
          />
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">AI edit zone</span>
        </label>
        <button
          onClick={reset}
          disabled={!enabled}
          className="text-[10px] text-zinc-500 hover:text-zinc-200 transition disabled:opacity-30"
        >
          reset
        </button>
      </div>

      <div className={`px-3 py-3 space-y-2 ${enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        {AXES.map((ax) => {
          const lo = selection[ax.lo];
          const hi = selection[ax.hi];
          const max = size[ax.max] - 1;
          return (
            <div key={ax.label} className="flex items-center gap-2">
              <span className="w-16 text-zinc-400 text-[10px] uppercase tracking-wider">{ax.label}</span>
              <div className="flex items-center gap-1 flex-1">
                <button onClick={() => update(ax.lo, -1)} className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 transition text-zinc-300">−</button>
                <span className="font-mono w-7 text-center">{lo}</span>
                <button onClick={() => update(ax.lo, +1)} className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 transition text-zinc-300">+</button>
                <span className="text-zinc-600 mx-1">…</span>
                <button onClick={() => update(ax.hi, -1)} className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 transition text-zinc-300">−</button>
                <span className="font-mono w-7 text-center">{hi}</span>
                <button onClick={() => update(ax.hi, +1)} className="w-6 h-6 rounded bg-zinc-800 hover:bg-zinc-700 transition text-zinc-300">+</button>
              </div>
              <span className="text-zinc-600 text-[10px] w-8 text-right">/{max}</span>
            </div>
          );
        })}

        <div className="pt-2 border-t border-zinc-800 mt-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">MCP prompt</div>
          <div className="text-[10px] font-mono text-zinc-300 bg-black/40 rounded px-2 py-1.5 leading-snug max-h-24 overflow-y-auto">
            {mcpPrompt}
          </div>
          <button
            onClick={copyPrompt}
            className="mt-2 w-full text-xs px-2 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 transition"
          >
            {copied ? 'Copied!' : 'Copy prompt'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { copyText } from '@/lib/clipboard';

export type Material = { id: string; count: number };

type Props = {
  materials: Material[];
  iconUrlFor: (id: string) => string | null;
  onPick?: (id: string) => void;
};

export default function MaterialsPanel({ materials, iconUrlFor, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const totalBlocks = useMemo(() => materials.reduce((n, m) => n + m.count, 0), [materials]);
  const totalTypes = materials.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) => m.id.includes(q));
  }, [materials, query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const pick = async (id: string) => {
    await copyText(id);
    onPick?.(id);
  };

  return (
    <>
      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <button
          onClick={() => setOpen((v) => !v)}
          className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-lg px-3 py-2 text-xs hover:bg-zinc-800 transition flex items-center gap-2"
        >
          <span>{open ? '▼' : '▲'}</span>
          <span>Materials</span>
          <span className="text-zinc-500">
            {totalTypes} · {totalBlocks.toLocaleString()}
          </span>
        </button>
      </div>

      <div
        className={`absolute left-0 right-0 bottom-0 pointer-events-none transition-transform duration-200 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="pointer-events-auto bg-zinc-900/95 backdrop-blur border-t border-zinc-800 h-[40dvh] flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
            <input
              ref={inputRef}
              type="search"
              placeholder="Filter materials…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-zinc-800/60 border border-zinc-700 rounded-md px-3 py-1.5 text-sm placeholder:text-zinc-500 outline-none focus:border-blue-500"
            />
            <span className="text-xs text-zinc-500 tabular-nums w-24 text-right">
              {filtered.length} / {totalTypes}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              close
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3">
            {totalTypes === 0 ? (
              <div className="text-center text-zinc-500 text-sm py-12">
                No blocks placed yet — ask the AI to build something.
              </div>
            ) : (
              <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
                {filtered.map((m) => {
                  const icon = iconUrlFor(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => pick(m.id)}
                      className="bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-md p-2 flex items-center gap-2 transition group text-left"
                      title={`Click to copy "${m.id}"`}
                    >
                      {icon ? (
                        <img
                          src={icon}
                          alt=""
                          width={32}
                          height={32}
                          loading="lazy"
                          className="w-8 h-8 shrink-0 [image-rendering:pixelated] [image-rendering:crisp-edges]"
                        />
                      ) : (
                        <div className="w-8 h-8 shrink-0 bg-zinc-700 rounded-sm" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-zinc-200 truncate">{m.id}</div>
                        <div className="text-[10px] text-zinc-500 tabular-nums">×{m.count.toLocaleString()}</div>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 ? (
                  <div className="col-span-full text-center text-zinc-500 text-sm py-12">
                    No material matches "{query}".
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

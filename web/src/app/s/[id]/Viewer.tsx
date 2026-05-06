'use client';

import { useEffect, useRef, useState } from 'react';
import type { Block, Session } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { createScene, type SceneHandles } from '@/lib/scene';
import { copyText } from '@/lib/clipboard';
import MaterialsPanel, { type Material } from './MaterialsPanel';
import SelectionPanel, { type Selection } from './SelectionPanel';
import { BiomePanel } from './BiomePanel';
import { generateBiome, type BiomeName } from '@/lib/biome';

type Props = { session: Session };

const SUPPORTED_VERSIONS = ['1.21', '1.20'] as const;
type McVersion = (typeof SUPPORTED_VERSIONS)[number];

function asMcVersion(v: string): McVersion {
  return (SUPPORTED_VERSIONS as readonly string[]).includes(v) ? (v as McVersion) : '1.21';
}

export default function Viewer({ session }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandles | null>(null);
  const biomeStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [copied, setCopied] = useState(false);
  const [topY, setTopY] = useState(session.size_y - 1);
  const [bottomY, setBottomY] = useState(0);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [pickToast, setPickToast] = useState<string | null>(null);
  const [version, setVersion] = useState<McVersion>(() => asMcVersion(session.mc_version));
  const [exporting, setExporting] = useState(false);
  const [bg2State, setBg2State] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [biomeBusy, setBiomeBusy] = useState(false);
  const [biomeStatus, setBiomeStatus] = useState<string | null>(null);
  const [diagLogs, setDiagLogs] = useState<string[]>([]);
  const [selectionEnabled, setSelectionEnabled] = useState(false);
  const [selection, setSelection] = useState<Selection>({
    x1: 0,
    y1: 0,
    z1: 0,
    x2: session.size_x - 1,
    y2: session.size_y - 1,
    z2: session.size_z - 1,
  });

  useEffect(() => {
    // Capture console logs for diagnostic display
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    const append = (level: string, args: unknown[]) => {
      setDiagLogs(prev => {
        const msg = `[${level}] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}`.slice(0, 150);
        const next = [...prev, msg];
        if (next.length > 20) next.shift();
        return next;
      });
    };
    console.log = (...args: unknown[]) => { append('LOG', args); origLog(...args); };
    console.warn = (...args: unknown[]) => { append('WARN', args); origWarn(...args); };
    console.error = (...args: unknown[]) => { append('ERR', args); origError(...args); };
    return () => { console.log = origLog; console.warn = origWarn; console.error = origError; };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    let handles: SceneHandles | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      handles = await createScene(canvasRef.current!, containerRef.current!, version);
      if (cancelled) {
        handles.destroy();
        return;
      }
      handles.setZone(session.size_x, session.size_y, session.size_z);
      sceneRef.current = handles;

      const refreshCount = () => {
        setCount(handles!.world.blockCount);
        setMaterials(handles!.world.getMaterials());
      };

      // Initial bulk load: place blocks without animation. Paginated because
      // Supabase caps a single response at 1000 rows by default.
      const PAGE = 1000;
      let offset = 0;
      for (;;) {
        const { data, error } = await supabase
          .from('mcmcp_blocks')
          .select('*')
          .eq('session_id', session.id)
          .range(offset, offset + PAGE - 1);
        if (cancelled) return;
        if (error) { console.error('initial load', error); return; }
        if (!data || data.length === 0) break;
        for (const b of data as Block[]) handles.world.setBlock(b.x, b.y, b.z, b.block_type, false);
        if (data.length < PAGE) break;
        offset += PAGE;
        refreshCount(); // give the user feedback on progress for large sessions
      }
      refreshCount();
      handles.fitToBounds();

      // Live updates: animate every change.
      channel = supabase
        .channel(`mcmcp_blocks:${session.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'mcmcp_blocks', filter: `session_id=eq.${session.id}` },
          (payload) => {
            if (!handles) return;
            if (payload.eventType === 'DELETE') {
              const old = payload.old as Block;
              handles.world.removeBlock(old.x, old.y, old.z);
            } else {
              const row = payload.new as Block;
              handles.world.setBlock(row.x, row.y, row.z, row.block_type, true);
            }
            refreshCount();
          }
        )
        .subscribe((s) => {
          if (s === 'SUBSCRIBED') setStatus('live');
          else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setStatus('offline');
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (handles) handles.destroy();
      sceneRef.current = null;
    };
  }, [session.id, session.size_x, session.size_y, session.size_z, version]);

  const copyId = async () => {
    await copyText(session.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const recenter = () => sceneRef.current?.fitToBounds();

  const iconUrlFor = (id: string): string | null => {
    const tex = sceneRef.current?.textures.iconTextureFor(id);
    return tex ? sceneRef.current!.textures.textureUrl(tex) : null;
  };

  const onPickBlock = (id: string) => {
    setPickToast(`Copied: ${id}`);
    setTimeout(() => setPickToast(null), 1400);
  };

  useEffect(() => {
    sceneRef.current?.setYRange(bottomY, topY);
  }, [bottomY, topY]);

  useEffect(() => {
    sceneRef.current?.setSelection(selectionEnabled ? selection : null);
  }, [selectionEnabled, selection]);

  useEffect(() => {
    return () => {
      if (biomeStatusTimer.current) clearTimeout(biomeStatusTimer.current);
    };
  }, []);

  const onChangeVersion = async (v: McVersion) => {
    setVersion(v);
    const { error } = await supabase
      .from('mcmcp_sessions')
      .update({ mc_version: v })
      .eq('id', session.id);
    if (error) console.error('Failed to persist version:', error);
  };

  const handleExport = async () => {
    if (count === 0) return;
    setExporting(true);
    try {
      const a = document.createElement('a');
      a.href = `/api/export/${session.id}`;
      a.download = `mcmcp-${session.id}.litematic`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  };

  const handleCopyBg2 = async () => {
    if (count === 0) return;
    setBg2State('copying');
    try {
      const res = await fetch(`/api/export/${session.id}?format=bg2`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.text();
      const ok = await copyText(json);
      setBg2State(ok ? 'copied' : 'error');
    } catch {
      setBg2State('error');
    } finally {
      setTimeout(() => setBg2State('idle'), 2000);
    }
  };

  const handleGenerateBiome = async (biome: BiomeName, seed: number) => {
    setBiomeBusy(true);
    setBiomeStatus('Generating…');
    try {
      const region = selectionEnabled ? selection : undefined;
      const placements = await generateBiome({
        biome,
        size: { x: session.size_x, y: session.size_y, z: session.size_z },
        seed,
        region,
      });
      setBiomeStatus(`Writing ${placements.length} blocks…`);

      const BATCH = 1000;
      for (let i = 0; i < placements.length; i += BATCH) {
        const slice = placements.slice(i, i + BATCH);
        const rows = slice.map((p) => ({
          session_id: session.id,
          x: p.x, y: p.y, z: p.z,
          block_type: p.block,
        }));
        const { error: e } = await supabase
          .from('mcmcp_blocks')
          .upsert(rows, { onConflict: 'session_id,x,y,z' });
        if (e) throw e;
        setBiomeStatus(`Writing ${Math.min(i + BATCH, placements.length)} / ${placements.length}…`);
      }
      setBiomeStatus(`Generated ${biome} (${placements.length} blocks)`);
      if (biomeStatusTimer.current) clearTimeout(biomeStatusTimer.current);
      biomeStatusTimer.current = setTimeout(() => setBiomeStatus(null), 3000);
    } catch (e) {
      setBiomeStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBiomeBusy(false);
    }
  };

  return (
    <div className="relative h-dvh w-dvw bg-zinc-950 text-zinc-100 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {diagLogs.length > 0 ? (
        <div className="absolute bottom-4 left-4 bg-black/80 border border-zinc-700 rounded-lg p-2 text-[10px] font-mono text-zinc-300 max-w-lg max-h-48 overflow-y-auto pointer-events-none opacity-70">
          {diagLogs.map((l, i) => (
            <div key={i} className={l.startsWith('[ERR]') ? 'text-red-400' : l.startsWith('[WARN]') ? 'text-amber-400' : 'text-zinc-400'}>
              {l}
            </div>
          ))}
        </div>
      ) : null}

      {pickToast ? (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-700 rounded-md px-3 py-1.5 text-xs pointer-events-none animate-fade-in">
          {pickToast}
        </div>
      ) : null}

      <MaterialsPanel materials={materials} iconUrlFor={iconUrlFor} onPick={onPickBlock} />

      <SelectionPanel
        sessionId={session.id}
        size={{ x: session.size_x, y: session.size_y, z: session.size_z }}
        enabled={selectionEnabled}
        selection={selection}
        onChangeEnabled={setSelectionEnabled}
        onChangeSelection={setSelection}
      />

      <div className="absolute top-4 left-4 flex flex-col gap-3 pointer-events-none">
        <div className="pointer-events-auto bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-lg px-4 py-3 flex flex-col gap-2 min-w-64">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Session</div>
              <div className="font-mono text-2xl">{session.id}</div>
            </div>
            <button
              onClick={copyId}
              className="text-xs px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 transition"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                status === 'live' ? 'bg-green-400' : status === 'connecting' ? 'bg-amber-400' : 'bg-red-400'
              }`}
            />
            {status === 'live' ? 'live' : status === 'connecting' ? 'connecting…' : 'offline'}
          </div>
        </div>

        <div className="pointer-events-auto bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-lg px-4 py-3 text-xs space-y-2">
          <div>
            <span className="text-zinc-500">Zone </span>
            {session.size_x} × {session.size_y} × {session.size_z}
          </div>
          <div>
            <span className="text-zinc-500">Blocks </span>
            {count.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-zinc-500">MC</span>
            <select
              value={version}
              onChange={(e) => onChangeVersion(e.target.value as McVersion)}
              className="bg-zinc-800/60 border border-zinc-700 rounded px-2 py-0.5 text-xs outline-none focus:border-blue-500"
            >
              {SUPPORTED_VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 pointer-events-auto flex flex-col gap-2 items-end">
        <button
          onClick={recenter}
          className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-lg px-3 py-2 text-xs hover:bg-zinc-800 transition"
        >
          Recenter
        </button>

        <button
          onClick={handleExport}
          disabled={exporting || count === 0}
          className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-lg px-3 py-2 text-xs hover:bg-zinc-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting…' : count === 0 ? 'No blocks' : 'Download .litematic'}
        </button>

        <button
          onClick={handleCopyBg2}
          disabled={bg2State === 'copying' || count === 0}
          className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-lg px-3 py-2 text-xs hover:bg-zinc-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          title="Copy a Building Gadgets 2 template JSON to your clipboard. Paste it into the Template Manager in-game."
        >
          {bg2State === 'copying'
            ? 'Copying…'
            : bg2State === 'copied'
            ? 'Copied BG2 template!'
            : bg2State === 'error'
            ? 'Copy failed'
            : count === 0
            ? 'No blocks'
            : 'Copy BG2 template'}
        </button>

        <BiomePanel
          hasExistingBlocks={count > 0}
          busy={biomeBusy}
          status={biomeStatus}
          onGenerate={handleGenerateBiome}
        />

        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-lg px-4 py-3 text-xs space-y-3 min-w-56">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Y range</span>
            <button
              onClick={() => { setBottomY(0); setTopY(session.size_y - 1); }}
              className="text-[10px] text-zinc-500 hover:text-zinc-200 transition"
            >
              reset
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-zinc-400">Top</span>
              <span className="font-mono">{topY}</span>
            </div>
            <input
              type="range"
              min={bottomY}
              max={session.size_y - 1}
              value={topY}
              onChange={(e) => setTopY(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-zinc-400">Bottom</span>
              <span className="font-mono">{bottomY}</span>
            </div>
            <input
              type="range"
              min={0}
              max={topY}
              value={bottomY}
              onChange={(e) => setBottomY(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

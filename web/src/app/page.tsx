'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
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

function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
  }
}

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

export default function Home() {
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
  }, [size, router]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-6">
          <span className="text-base font-semibold tracking-tight">mcmcp</span>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/my-monkeys/mcmcp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              GitHub
            </a>
            <button
              onClick={() => scrollTo('create')}
              className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md transition-colors font-medium"
            >
              Get Started →
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-36 flex flex-col items-center text-center gap-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-medium text-blue-400">MCP Server</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-2xl">
            Build Minecraft schematics
            <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              {' '}with AI
            </span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-xl leading-relaxed">
            Connect Claude to your Minecraft world through MCP. Place blocks, fill regions,
            and export <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded text-sm">.litematic</code> files
            — all in real-time with a live 3D viewer.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => scrollTo('create')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-7 py-3 rounded-lg transition-colors text-base"
            >
              Get Started →
            </button>
            <a
              href="https://github.com/my-monkeys/mcmcp"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium px-7 py-3 rounded-lg transition-colors text-base"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* What is it */}
      <section className="border-t border-zinc-800/50 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex flex-col items-center gap-4 mb-14">
            <span className="text-xs font-semibold tracking-[0.25em] text-blue-400 uppercase">
              How it works
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
              An AI-powered schematic builder
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: '🤖',
                title: 'AI Agent',
                desc: 'Claude connects via MCP and controls block placement through 12 specialized tools — from single blocks to massive fills.',
              },
              {
                icon: '↔️',
                title: 'MCP Protocol',
                desc: 'Standard protocol bridging AI to tools. Works with Claude Code, Claude Desktop, and any MCP-compatible client.',
              },
              {
                icon: '🧊',
                title: '3D Viewer',
                desc: 'Blocks appear in real-time with a Three.js viewer. Vanilla textures, animations, and one-click .litematic export.',
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col gap-3"
              >
                <span className="text-2xl">{icon}</span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-xs">
                AI (Claude)
              </span>
              <span className="text-zinc-600">→ MCP →</span>
              <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-xs">
                mcmcp Server
              </span>
              <span className="text-zinc-600">→ Supabase →</span>
              <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-xs">
                Live 3D Viewer
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex flex-col items-center gap-4 mb-14">
            <span className="text-xs font-semibold tracking-[0.25em] text-blue-400 uppercase">
              Features
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
              Everything you need
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { title: '12 MCP Tools', desc: 'set_block, fill_region, replace, get_layer, export_litematic, and more — all validated with the block manifest.' },
              { title: 'Real-time Viewer', desc: 'Watch blocks appear instantly in a Three.js scene with vanilla Minecraft textures and spawn animations.' },
              { title: '.litematic Export', desc: 'Export your builds as Litematica schematics compatible with Minecraft 1.16+. Download from the viewer or API.' },
              { title: 'Vanilla Textures', desc: '750+ blocks with per-face textures, biome tinting (grass/foliage), and proper geometry for slabs and stairs.' },
              { title: 'Supabase Realtime', desc: 'Instant sync between AI and viewer via PostgreSQL subscriptions. Changes appear the moment they\'re committed.' },
              { title: 'MC 1.20 & 1.21', desc: 'Switch between Minecraft versions per session. Textures and .litematic exports adapt automatically.' },
            ].map(({ title, desc }) => (
              <div
                key={title}
                className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-6 flex flex-col gap-2 hover:border-zinc-700 transition-colors"
              >
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to use */}
      <section className="border-t border-zinc-800/50 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex flex-col items-center gap-4 mb-14">
            <span className="text-xs font-semibold tracking-[0.25em] text-blue-400 uppercase">
              How to use
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
              Three steps from idea to Minecraft
            </h2>
          </div>
          <div className="max-w-2xl mx-auto flex flex-col gap-10">
            {[
              {
                step: '1',
                title: 'Create a session',
                desc: 'Choose your zone size (up to 256×256×256), get a 6-character session ID. No account needed — the ID is your key.',
              },
              {
                step: '2',
                title: 'Configure your client',
                desc: 'Add the mcmcp server to your Claude config. Set your session ID and start building with natural language commands.',
              },
              {
                step: '3',
                title: 'Build & export',
                desc: 'Tell Claude what to build. Watch blocks appear live in the viewer. Export as .litematic and load into Minecraft with the Litematica mod.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-5 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                  {step}
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MCP Config */}
      <section className="border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex flex-col items-center gap-4 mb-10">
            <span className="text-xs font-semibold tracking-[0.25em] text-blue-400 uppercase">
              Quick setup
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
              Add to your Claude config
            </h2>
            <p className="text-zinc-400">
              One snippet in <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded text-sm">~/.claude.json</code> and you&apos;re ready.
            </p>
          </div>
          <div className="max-w-2xl mx-auto relative">
            <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 overflow-x-auto text-sm font-mono text-zinc-300 leading-relaxed">
              <code>{CONFIG_SNIPPET}</code>
            </pre>
            <button
              onClick={() => {
                copyToClipboard(CONFIG_SNIPPET);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="absolute top-4 right-4 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 px-3 py-1.5 rounded-md transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </section>

      {/* Create Session */}
      <section id="create" className="border-t border-zinc-800/50 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex flex-col items-center gap-4 mb-10">
            <span className="text-xs font-semibold tracking-[0.25em] text-blue-400 uppercase">
              Try it now
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
              Create a session
            </h2>
            <p className="text-zinc-400 text-center max-w-md">
              Choose your build zone size and get a session ID. Share it with your AI and start building.
            </p>
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

      {/* Footer */}
      <footer className="border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-zinc-300">mcmcp</span>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <a
              href="https://github.com/my-monkeys/mcmcp"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/my-monkeys/mcmcp/tree/main/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              MCP Server
            </a>
          </div>
          <span className="text-xs text-zinc-600">
            Open source · my-monkeys · Built for Minecraft builders
          </span>
        </div>
      </footer>
    </div>
  );
}

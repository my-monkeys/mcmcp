'use client';

const PILLARS = [
  {
    word: 'AI',
    sentence: 'Claude reads your prompt and decides which blocks to place — using twelve specialised tools.',
    accent: '◷',
  },
  {
    word: 'MCP',
    sentence: 'Model Context Protocol bridges the model to the world. Standard, open, no vendor lock-in.',
    accent: '↔',
  },
  {
    word: 'VIEWER',
    sentence: 'A live Three.js scene shows every block the moment it is placed. Vanilla textures, real geometry.',
    accent: '◧',
  },
];

export function StackPillars() {
  return (
    <section data-section="stack" className="border-t border-white/5">
      {PILLARS.map((p) => (
        <div
          key={p.word}
          data-pillar
          className="sticky top-0 min-h-dvh flex items-center px-6 bg-[#0b0b0d]"
        >
          <div className="max-w-6xl mx-auto w-full grid md:grid-cols-[1fr_auto] gap-12 items-center">
            <div className="flex flex-col gap-6">
              <span className="text-xs uppercase tracking-[0.25em] text-[#7ec07e]">The stack</span>
              <h3
                className="font-black tracking-[-0.04em] leading-[0.85] text-[#f5f3ed]"
                style={{ fontSize: 'clamp(80px, 16vw, 280px)' }}
              >
                {p.word}
              </h3>
              <p className="text-lg md:text-xl text-zinc-300 max-w-xl leading-relaxed">{p.sentence}</p>
            </div>
            <div className="text-[160px] text-[#7ec07e] opacity-30 hidden md:block">{p.accent}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

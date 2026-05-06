'use client';

const VOXEL_GRID_SIZE = 8;

export function HeroKinetic() {
  const voxels = Array.from({ length: VOXEL_GRID_SIZE * VOXEL_GRID_SIZE });
  return (
    <section
      data-section="hero"
      className="relative min-h-[140vh] flex items-center justify-center px-6 overflow-hidden"
    >
      <h1
        data-hero-title
        className="text-center font-black tracking-[-0.04em] leading-[0.85] text-[#f5f3ed]"
        style={{ fontSize: 'clamp(64px, 12vw, 200px)', opacity: 0 }}
      >
        <span className="block">BUILD</span>
        <span className="block">MINECRAFT</span>
        <span className="block relative">
          <span data-hero-suffix>WITH </span>
          <span data-hero-disintegrate className="relative inline-block align-baseline">
            <span data-hero-letters className="relative z-10">AI</span>
            <span
              aria-hidden
              data-hero-voxels
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${VOXEL_GRID_SIZE}, 1fr)`,
                gridTemplateRows: `repeat(${VOXEL_GRID_SIZE}, 1fr)`,
                gap: '2px',
              }}
            >
              {voxels.map((_, i) => (
                <span
                  key={i}
                  data-voxel
                  className="block bg-gradient-to-br from-[#7ec07e] to-[#2f7a2f] rounded-[2px]"
                  style={{
                    opacity: 0,
                    boxShadow: 'inset -2px -2px 0 rgba(0,0,0,.18)',
                  }}
                />
              ))}
            </span>
          </span>
        </span>
      </h1>

      <div data-hero-cta className="absolute bottom-16 flex items-center gap-4" style={{ opacity: 0 }}>
        <button
          onClick={() => document.getElementById('create')?.scrollIntoView({ behavior: 'smooth' })}
          className="bg-[#7ec07e] hover:bg-[#6fb46f] text-[#0b0b0d] font-semibold px-7 py-3 rounded-lg text-base"
        >
          Get started →
        </button>
        <a
          href="https://github.com/my-monkeys/mcmcp"
          target="_blank"
          rel="noopener noreferrer"
          className="border border-white/15 hover:border-white/30 text-zinc-200 font-medium px-7 py-3 rounded-lg text-base"
        >
          View on GitHub
        </a>
      </div>
    </section>
  );
}

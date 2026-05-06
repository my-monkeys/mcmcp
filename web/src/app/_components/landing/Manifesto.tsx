'use client';

export function Manifesto() {
  return (
    <section
      data-section="manifesto"
      className="min-h-dvh flex items-center justify-center px-6 py-32 border-t border-white/5"
    >
      <h2
        data-manifesto-text
        className="max-w-5xl font-black tracking-[-0.03em] leading-[0.95] text-[#f5f3ed]"
        style={{ fontSize: 'clamp(40px, 7vw, 120px)' }}
      >
        <span className="block">You speak.</span>
        <span className="block">Claude builds.</span>
        <span className="block text-[#7ec07e]">You watch it happen — block by block, in real time.</span>
      </h2>
    </section>
  );
}

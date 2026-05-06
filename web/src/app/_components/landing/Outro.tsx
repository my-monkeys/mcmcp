'use client';

export function Outro() {
  return (
    <section
      data-section="outro"
      className="min-h-dvh flex items-center justify-center px-6 border-t border-white/5"
    >
      <h2
        data-outro-text
        className="font-black tracking-[-0.04em] leading-[0.85] text-center"
        style={{ fontSize: 'clamp(80px, 14vw, 240px)' }}
      >
        <span className="text-[#f5f3ed]">NOW GO </span>
        <span className="text-[#7ec07e]">BUILD.</span>
      </h2>
    </section>
  );
}

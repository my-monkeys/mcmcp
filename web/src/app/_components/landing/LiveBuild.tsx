'use client';

const PROMPT = 'build a stone tower with a torch on top';

export function LiveBuild() {
  return (
    <section
      data-section="live-build"
      className="relative min-h-[200vh] border-t border-white/5"
    >
      <div data-live-pin className="sticky top-0 h-screen flex items-center justify-center px-6">
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl w-full">
          <div className="bg-[#0e0e10] border border-white/10 rounded-xl p-6 flex flex-col gap-3 min-h-[400px]">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Claude</div>
            <p data-live-prompt className="text-lg md:text-2xl font-medium text-zinc-100 font-mono">
              <span data-live-prompt-typed>{PROMPT}</span>
              <span data-live-cursor className="inline-block w-[0.5ch] h-[1.1em] align-middle bg-[#7ec07e] ml-1" />
            </p>
          </div>
          <div
            data-live-canvas-mount
            className="bg-[#050507] border border-white/10 rounded-xl min-h-[400px] flex items-center justify-center text-zinc-600 text-sm"
          >
            [canvas mount]
          </div>
        </div>
      </div>
    </section>
  );
}

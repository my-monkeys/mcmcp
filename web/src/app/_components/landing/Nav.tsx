'use client';

export function Nav() {
  const scrollToCreate = () => {
    document.getElementById('create')?.scrollIntoView({ behavior: 'smooth' });
  };
  return (
    <nav className="sticky top-0 z-50 bg-[#0b0b0d]/85 backdrop-blur border-b border-white/5">
      <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-6">
        <span className="text-base font-semibold tracking-tight">mcmcp</span>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/my-monkeys/mcmcp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            GitHub
          </a>
          <button
            onClick={scrollToCreate}
            className="text-sm bg-[#7ec07e] hover:bg-[#6fb46f] text-[#0b0b0d] px-4 py-1.5 rounded-md transition-colors font-semibold"
          >
            Get started →
          </button>
        </div>
      </div>
    </nav>
  );
}

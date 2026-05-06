'use client';

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
        <span className="font-semibold text-zinc-200">mcmcp</span>
        <div className="flex items-center gap-6 text-zinc-500">
          <a href="https://github.com/my-monkeys/mcmcp" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200">GitHub</a>
          <a href="https://github.com/my-monkeys/mcmcp/tree/main/mcp" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200">MCP Server</a>
        </div>
        <span className="text-xs text-zinc-600">Open source · my-monkeys</span>
      </div>
    </footer>
  );
}

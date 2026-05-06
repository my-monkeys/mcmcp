'use client';

const TOOLS = [
  'set_block', 'set_blocks', 'fill_region', 'fill_layer', 'replace',
  'get_layer', 'get_region', 'get_all', 'create_zone', 'current_session',
  'set_version', 'export_litematic',
];

export function ToolkitMarquee() {
  const items = [...TOOLS, ...TOOLS];
  return (
    <section data-section="toolkit" className="border-t border-white/5 py-24 overflow-hidden">
      <div className="mb-8 px-6 max-w-6xl mx-auto">
        <span className="text-xs uppercase tracking-[0.25em] text-[#7ec07e]">12 MCP tools</span>
      </div>
      <div className="relative">
        <div
          data-marquee-track
          className="flex gap-12 whitespace-nowrap font-mono font-black tracking-tight text-[#f5f3ed]"
          style={{ fontSize: 'clamp(60px, 9vw, 120px)' }}
        >
          {items.map((t, i) => (
            <span key={i} className="flex items-center gap-12">
              <span>{t}</span>
              <span className="text-[#7ec07e]">·</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

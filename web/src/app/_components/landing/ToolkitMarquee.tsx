'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap, registerGsap } from '@/lib/landing/gsap';

const TOOLS = [
  'set_block', 'set_blocks', 'fill_region', 'fill_layer', 'replace',
  'get_layer', 'get_region', 'get_all', 'create_zone', 'current_session',
  'set_version', 'export_litematic',
];

export function ToolkitMarquee() {
  const root = useRef<HTMLElement>(null);
  const items = [...TOOLS, ...TOOLS];

  useGSAP(() => {
    registerGsap();
    const root_ = root.current;
    if (!root_) return;
    const track = root_.querySelector<HTMLElement>('[data-marquee-track]');
    if (!track) return;

    const halfWidth = track.scrollWidth / 2;
    const wrap = gsap.utils.wrap(-halfWidth, 0);
    const tween = gsap.to(track, {
      x: -halfWidth,
      duration: 50,
      ease: 'none',
      repeat: -1,
      modifiers: { x: (x: string) => `${wrap(parseFloat(x))}px` },
    });

    const slow = () => tween.timeScale(0.25);
    const speed = () => tween.timeScale(1);
    track.addEventListener('mouseenter', slow);
    track.addEventListener('mouseleave', speed);

    return () => {
      track.removeEventListener('mouseenter', slow);
      track.removeEventListener('mouseleave', speed);
      tween.kill();
    };
  }, { scope: root });

  return (
    <section ref={root} data-section="toolkit" className="border-t border-white/5 py-24 overflow-hidden">
      <div className="mb-8 px-6 max-w-6xl mx-auto">
        <span className="text-xs uppercase tracking-[0.25em] text-[#7ec07e]">12 MCP tools</span>
      </div>
      <div className="relative">
        <div
          data-marquee-track
          className="flex gap-12 whitespace-nowrap font-mono font-black tracking-tight text-[#f5f3ed] will-change-transform"
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

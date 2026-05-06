'use client';

import { useGSAP } from '@gsap/react';
import { useEffect, useRef, useState } from 'react';
import { createMiniScene, type MiniScene } from '@/lib/landing/miniScene';
import { gsap, ScrollTrigger, registerGsap } from '@/lib/landing/gsap';

const PROMPT = 'build a stone tower with a torch on top';

export function LiveBuild() {
  const root = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MiniScene | null>(null);
  const [shouldMount, setShouldMount] = useState(false);
  const [typed, setTyped] = useState('');

  // Lazy-mount the scene only when the section approaches the viewport.
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShouldMount(true);
            io.disconnect();
            return;
          }
        }
      },
      { rootMargin: '200px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // Create / destroy the mini scene
  useEffect(() => {
    if (!shouldMount) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    (async () => {
      const mini = await createMiniScene(canvas, container);
      if (cancelled) {
        mini.destroy();
        return;
      }
      sceneRef.current = mini;
    })();
    return () => {
      cancelled = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [shouldMount]);

  // Scroll-driven typewriter + scene progress
  useGSAP(() => {
    registerGsap();
    const node = root.current;
    if (!node) return;
    const trigger = ScrollTrigger.create({
      trigger: node,
      start: 'top top',
      end: '+=200%',
      scrub: 0.5,
      pin: '[data-live-pin]',
      onUpdate: (self) => {
        // typewriter band: 0.2..0.5 -> 0..1
        const t = Math.max(0, Math.min(1, (self.progress - 0.2) / 0.3));
        const cut = Math.floor(t * PROMPT.length);
        setTyped(PROMPT.slice(0, cut));
        // scene band: 0.5..0.95 -> 0..1
        const s = Math.max(0, Math.min(1, (self.progress - 0.5) / 0.45));
        sceneRef.current?.setProgress(s);
      },
    });
    return () => trigger.kill();
  }, { scope: root });

  return (
    <section ref={root} data-section="live-build" className="relative min-h-[300vh] border-t border-white/5">
      <div data-live-pin className="sticky top-0 h-screen flex items-center justify-center px-6">
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl w-full">
          <div className="bg-[#0e0e10] border border-white/10 rounded-xl p-6 flex flex-col gap-3 min-h-[400px]">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">user</div>
            <p className="text-lg md:text-2xl font-mono text-zinc-100 break-words">
              <span>{typed}</span>
              <span className="inline-block w-[0.5ch] h-[1.1em] align-middle bg-[#7ec07e] ml-1" />
            </p>
          </div>
          <div ref={containerRef} className="bg-[#050507] border border-white/10 rounded-xl min-h-[400px] relative overflow-hidden">
            {shouldMount && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />}
          </div>
        </div>
      </div>
    </section>
  );
}

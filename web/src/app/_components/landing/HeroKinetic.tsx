'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap, SplitText, registerGsap } from '@/lib/landing/gsap';

const VOXEL_GRID_SIZE = 8;

export function HeroKinetic() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    registerGsap();
    const root_ = root.current;
    if (!root_) return;
    const title = root_.querySelector<HTMLElement>('[data-hero-title]');
    const cta = root_.querySelector<HTMLElement>('[data-hero-cta]');
    const letters = root_.querySelector<HTMLElement>('[data-hero-letters]');
    const voxels = root_.querySelectorAll<HTMLElement>('[data-voxel]');
    if (!title || !cta || !letters) return;

    const mm = gsap.matchMedia();

    mm.add('(min-width: 640px) and (prefers-reduced-motion: no-preference)', () => {
      const split = SplitText.create(title, { type: 'lines,words', linesClass: 'overflow-hidden' });

      const intro = gsap.timeline();
      intro
        .set(title, { opacity: 1 })
        .from(split.words, { y: '110%', stagger: 0.04, duration: 0.7, ease: 'power3.out' })
        .to(cta, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2');

      const disintegrate = gsap.timeline({
        scrollTrigger: {
          trigger: root_,
          start: 'top top',
          end: '+=100%',
          scrub: 0.6,
          pin: true,
        },
      });
      disintegrate
        .to(letters, { opacity: 0, ease: 'none' })
        .to(
          voxels,
          {
            opacity: 1,
            stagger: { each: 0.005, from: 'random' },
            ease: 'none',
          },
          0,
        );

      return () => {
        split.revert();
      };
    });

    mm.add('(max-width: 639px) and (prefers-reduced-motion: no-preference)', () => {
      // Mobile: words reveal intro only — no pin, no scrub, voxels stay hidden.
      const split = SplitText.create(title, { type: 'lines,words', linesClass: 'overflow-hidden' });

      const intro = gsap.timeline();
      intro
        .set(title, { opacity: 1 })
        .from(split.words, { y: '110%', stagger: 0.04, duration: 0.7, ease: 'power3.out' })
        .to(cta, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2');

      return () => {
        split.revert();
      };
    });

    mm.add('(prefers-reduced-motion: reduce)', () => {
      // Snap to final state — no animation.
      gsap.set(title, { opacity: 1 });
      gsap.set(cta, { opacity: 1, y: 0 });
      gsap.set(voxels, { opacity: 0 });
    });
  }, { scope: root });

  const voxels = Array.from({ length: VOXEL_GRID_SIZE * VOXEL_GRID_SIZE });
  return (
    <section
      ref={root}
      data-section="hero"
      className="relative min-h-dvh md:min-h-[200vh] flex items-center justify-center px-6 overflow-hidden"
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

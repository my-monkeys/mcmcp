'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap, SplitText, registerGsap } from '@/lib/landing/gsap';

export function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    registerGsap();
    const root_ = root.current;
    if (!root_) return;
    const text = root_.querySelector<HTMLElement>('[data-manifesto-text]');
    if (!text) return;
    const split = SplitText.create(text, { type: 'lines', linesClass: 'overflow-hidden' });
    gsap.from(split.lines, {
      y: '110%',
      stagger: 0.12,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: root_, start: 'top 70%', once: true },
    });
    return () => split.revert();
  }, { scope: root });

  return (
    <section
      ref={root}
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

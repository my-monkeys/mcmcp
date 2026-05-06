'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap, SplitText, registerGsap } from '@/lib/landing/gsap';

export function Outro() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    registerGsap();
    const root_ = root.current;
    if (!root_) return;
    const text = root_.querySelector<HTMLElement>('[data-outro-text]');
    if (!text) return;
    const split = SplitText.create(text, { type: 'chars', charsClass: 'inline-block' });
    gsap.set(split.chars, { y: 80, opacity: 0 });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: root_, start: 'top 70%', once: true },
    });
    tl.to(split.chars, { y: 0, opacity: 1, stagger: 0.025, duration: 0.6, ease: 'power3.out' })
      .to(split.chars, {
        y: -6,
        duration: 1.6,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.03, from: 'random' },
      });
    return () => split.revert();
  }, { scope: root });

  return (
    <section
      ref={root}
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

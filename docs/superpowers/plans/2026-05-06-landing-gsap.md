# Landing GSAP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `web/src/app/page.tsx` with a 7-section editorial scroll experience powered by GSAP + ScrollTrigger + SplitText, including one Three.js mini-viewer demo, full responsive/reduced-motion gates, and a complete SEO meta refresh — without breaking the existing create-session flow.

**Architecture:** Each scroll section lives in its own client component under `web/src/app/_components/landing/`. Animations use `useGSAP` + `gsap.matchMedia()` with one context per section. The Three.js mini-viewer in section 03 uses a new stripped-down `lib/landing/miniScene.ts` that reuses `TextureLibrary` and `World` but skips OrbitControls/gizmos. SEO uses Next 16 file conventions (`opengraph-image.tsx`, `icon.tsx`, `robots.ts`, `sitemap.ts`).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, GSAP 3.13+ (`gsap`, `@gsap/react`, `gsap/SplitText`, `gsap/ScrollTrigger`), Three.js 0.184 (already installed), Supabase (already installed).

**Spec:** `docs/superpowers/specs/2026-05-06-landing-gsap-design.md`

**Testing approach:** This is UI/animation work. Unit tests are not appropriate for scroll-driven animations. The verification path is: typecheck (`pnpm exec tsc --noEmit`), lint (`pnpm lint`), `pnpm build`, plus a manual smoke checklist (Phase 6) executed in a real browser at `localhost:3000`.

---

## Phase 0 — Prep

### Task 0.1: Create feature branch + read Next 16 conventions

**Files:**
- Read: `web/AGENTS.md`, `web/node_modules/next/dist/docs/`

- [ ] **Step 1: Create feature branch**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
git checkout -b feat/landing-gsap
```

- [ ] **Step 2: Confirm `.superpowers/` is gitignored**

Check if `mcmcp/.gitignore` ignores `.superpowers/`. If not, add it:

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp
echo "" >> .gitignore && echo ".superpowers/" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore brainstorming companion artefacts"
```

- [ ] **Step 3: Read Next 16 docs for the file conventions we'll use**

Run:
```bash
ls /Users/maxim/Documents/my-monkey/mcmcp/web/node_modules/next/dist/docs/
```

Read at minimum:
- The `metadata` reference (for `Metadata` type fields, `metadataBase`, `themeColor`, `colorScheme`).
- The page-level metadata file conventions: `opengraph-image`, `twitter-image`, `icon`, `apple-icon`, `robots`, `sitemap`.
- The `'use client'` semantics and any new Suspense/streaming defaults that affect a fully-client landing page.

Note any deviation from prior knowledge. If something differs (e.g. import path moved, signature changed), record it as a decision note in this plan before implementing.

Expected: confirmation that the file convention names and exports used later in this plan are correct for Next 16 in this repo. If they aren't, update the relevant later tasks before continuing.

---

### Task 0.2: Add GSAP dependencies

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install GSAP packages**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm add gsap @gsap/react
```

- [ ] **Step 2: Verify install**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm list gsap @gsap/react
```

Expected: both listed, GSAP ≥ 3.13.0.

- [ ] **Step 3: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml
git commit -m "feat(web): add GSAP for landing animations"
```

---

### Task 0.3: GSAP helper module

**Files:**
- Create: `web/src/lib/landing/gsap.ts`

- [ ] **Step 1: Create the file**

```ts
// web/src/lib/landing/gsap.ts
'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

let registered = false;

export function registerGsap(): void {
  if (registered || typeof window === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  registered = true;
}

export { gsap, ScrollTrigger, SplitText };
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/landing/gsap.ts
git commit -m "feat(web): add GSAP plugin registration helper"
```

---

## Phase 1 — Scaffolding & preserving create-session

The current `page.tsx` is a single 433-line client component that includes the create-session form. Phase 1 splits it into a thin orchestrator and section components, **moving the create-session logic verbatim into `Setup.tsx`**, before any animation work begins. This isolates the riskiest move from the redesign.

### Task 1.1: Create empty section component shells

**Files:**
- Create: `web/src/app/_components/landing/Nav.tsx`
- Create: `web/src/app/_components/landing/HeroKinetic.tsx`
- Create: `web/src/app/_components/landing/Manifesto.tsx`
- Create: `web/src/app/_components/landing/LiveBuild.tsx`
- Create: `web/src/app/_components/landing/StackPillars.tsx`
- Create: `web/src/app/_components/landing/ToolkitMarquee.tsx`
- Create: `web/src/app/_components/landing/Setup.tsx`
- Create: `web/src/app/_components/landing/Outro.tsx`
- Create: `web/src/app/_components/landing/Footer.tsx`

- [ ] **Step 1: Create each shell as a labelled section**

For each file, write a minimal placeholder component. Example for `Nav.tsx`:

```tsx
// web/src/app/_components/landing/Nav.tsx
'use client';

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 h-14 bg-zinc-950/80 backdrop-blur border-b border-zinc-800/50 flex items-center justify-center text-zinc-500 text-xs">
      [Nav placeholder]
    </nav>
  );
}
```

Use the same shape for the other 8 components (named export matching filename, `'use client'`, single placeholder div with the section name). For sections (everything except Nav and Footer), use `<section className="min-h-dvh ...">` so the visual layout is testable empty.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/
git commit -m "feat(web): scaffold landing section components"
```

---

### Task 1.2: Refactor `page.tsx` into thin orchestrator (move create-session into Setup.tsx)

**Files:**
- Modify: `web/src/app/page.tsx` (replace contents)
- Modify: `web/src/app/_components/landing/Setup.tsx` (move logic in)

- [ ] **Step 1: Move all create-session logic into `Setup.tsx`**

Copy lines 1–82 and 311–402 of the current `page.tsx` into `Setup.tsx`. Keep behaviour identical: same `PRESETS`, same `MAX_DIM = 256`, same `clampDim`, same `useState`/`useCallback`, same Supabase insert with retry on `23505`, same `router.push('/s/${id}')`. Keep the styling exactly as it was in the original section — Phase 3 will redo the visual treatment.

```tsx
// web/src/app/_components/landing/Setup.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { generateSessionId, supabase } from '@/lib/supabase';

type SizePreset = { label: string; x: number; y: number; z: number };

const PRESETS: SizePreset[] = [
  { label: '16 × 16 × 16', x: 16, y: 16, z: 16 },
  { label: '32 × 32 × 32', x: 32, y: 32, z: 32 },
  { label: '64 × 64 × 64', x: 64, y: 64, z: 64 },
  { label: '64 × 256 × 64', x: 64, y: 256, z: 64 },
];

const MAX_DIM = 256;

function clampDim(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_DIM, Math.round(n)));
}

export function Setup() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(1);
  const [custom, setCustom] = useState({ x: 24, y: 24, z: 24 });

  const size = selected >= 0 ? PRESETS[selected]! : custom;
  const volume = size.x * size.y * size.z;

  const create = useCallback(async () => {
    setCreating(true);
    setError(null);
    const x = clampDim(size.x);
    const y = clampDim(size.y);
    const z = clampDim(size.z);
    for (let attempt = 0; attempt < 6; attempt++) {
      const id = generateSessionId();
      const { error } = await supabase.from('mcmcp_sessions').insert({
        id, size_x: x, size_y: y, size_z: z,
      });
      if (!error) {
        router.push(`/s/${id}`);
        return;
      }
      if (error.code !== '23505') {
        setError(error.message);
        setCreating(false);
        return;
      }
    }
    setError('Could not allocate a unique session id, retry.');
    setCreating(false);
  }, [size, router]);

  return (
    <section id="create" className="border-t border-zinc-800/50 bg-zinc-900/50">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col items-center gap-4 mb-10">
          <span className="text-xs font-semibold tracking-[0.25em] text-blue-400 uppercase">
            Try it now
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
            Create a session
          </h2>
        </div>
        <div className="max-w-xl mx-auto flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setSelected(i)}
                className={`border rounded-lg px-4 py-3.5 text-left transition ${
                  selected === i
                    ? 'border-blue-500 bg-blue-500/10 text-blue-200'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-zinc-500">
                  {(p.x * p.y * p.z).toLocaleString()} blocks max
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setSelected(-1)}
            className={`border rounded-lg px-4 py-3.5 text-left transition ${
              selected === -1
                ? 'border-blue-500 bg-blue-500/10 text-blue-200'
                : 'border-zinc-800 hover:border-zinc-600'
            }`}
          >
            <div className="text-sm font-medium">Custom</div>
            <div className="text-xs text-zinc-500">
              {selected === -1
                ? `${custom.x} × ${custom.y} × ${custom.z} (${volume.toLocaleString()} blocks)`
                : `Set your own dimensions (1–${MAX_DIM} per axis)`}
            </div>
          </button>

          {selected === -1 && (
            <div className="grid grid-cols-3 gap-2">
              {([
                { axis: 'x', name: 'Width', hint: '↔ X' },
                { axis: 'y', name: 'Height', hint: '↕ Y' },
                { axis: 'z', name: 'Depth', hint: '⤢ Z' },
              ] as const).map(({ axis, name, hint }) => (
                <label key={axis} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex justify-between">
                    <span>{name}</span><span className="text-zinc-600">{hint}</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_DIM}
                    value={custom[axis]}
                    onChange={(e) =>
                      setCustom((c) => ({ ...c, [axis]: clampDim(Number(e.target.value)) }))
                    }
                    className="bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm tabular-nums outline-none focus:border-blue-500"
                  />
                </label>
              ))}
            </div>
          )}

          <button
            onClick={create}
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-3.5 transition-colors text-base"
          >
            {creating ? 'Creating session…' : 'Create session →'}
          </button>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Replace `page.tsx` with thin orchestrator**

```tsx
// web/src/app/page.tsx
import { Nav } from './_components/landing/Nav';
import { HeroKinetic } from './_components/landing/HeroKinetic';
import { Manifesto } from './_components/landing/Manifesto';
import { LiveBuild } from './_components/landing/LiveBuild';
import { StackPillars } from './_components/landing/StackPillars';
import { ToolkitMarquee } from './_components/landing/ToolkitMarquee';
import { Setup } from './_components/landing/Setup';
import { Outro } from './_components/landing/Outro';
import { Footer } from './_components/landing/Footer';

export default function Home() {
  return (
    <div className="min-h-dvh bg-[#0b0b0d] text-[#f5f3ed] font-sans">
      <Nav />
      <HeroKinetic />
      <Manifesto />
      <LiveBuild />
      <StackPillars />
      <ToolkitMarquee />
      <Setup />
      <Outro />
      <Footer />
    </div>
  );
}
```

- [ ] **Step 3: Run dev server and verify create-session still works**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm dev
```

In the browser at `http://localhost:3000`:
1. Scroll to the Setup placeholder, find the create-session form (still in legacy styling).
2. Click "Create session →" with the default 32×32×32 preset.
3. Confirm the URL changes to `/s/<6-char-id>` and the viewer loads.

If broken, fix before committing.

- [ ] **Step 4: Typecheck and lint**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
pnpm lint
```

Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/page.tsx web/src/app/_components/landing/Setup.tsx
git commit -m "refactor(web): extract create-session into Setup component, thin page.tsx"
```

---

## Phase 2 — Static section markup (no animations yet)

Each section is built **static first**, then animated in Phase 3. Static-first lets us see the page at any point and lets a designer/PM eyeball the layout before motion is layered on. Each task here ends with a manual eyeball of the section in the dev server.

### Task 2.1: Nav (final)

**Files:**
- Modify: `web/src/app/_components/landing/Nav.tsx`

- [ ] **Step 1: Replace placeholder with final markup**

```tsx
// web/src/app/_components/landing/Nav.tsx
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
```

- [ ] **Step 2: Eyeball at `localhost:3000`** — nav sticks, color is grass-green accent, hover works.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/Nav.tsx
git commit -m "feat(landing): final Nav with grass accent CTA"
```

---

### Task 2.2: HeroKinetic — static markup

**Files:**
- Modify: `web/src/app/_components/landing/HeroKinetic.tsx`

- [ ] **Step 1: Static markup with title and CTAs**

The title is three lines: `BUILD`, `MINECRAFT`, `WITH AI`. The word "AI" gets a wrapping span (`data-disintegrate`) so we can target it later for the voxel disintegration. Voxel grid behind "AI" is created here as `<span aria-hidden>` filled with a fixed grid of voxel divs (8×8 = 64 voxels), all `opacity:0` initially via inline style.

```tsx
// web/src/app/_components/landing/HeroKinetic.tsx
'use client';

const VOXEL_GRID_SIZE = 8;

export function HeroKinetic() {
  const voxels = Array.from({ length: VOXEL_GRID_SIZE * VOXEL_GRID_SIZE });
  return (
    <section
      data-section="hero"
      className="relative min-h-[140vh] flex items-center justify-center px-6 overflow-hidden"
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
```

- [ ] **Step 2: Eyeball at `localhost:3000`** — title is currently invisible (opacity:0). Temporarily set `opacity: 1` on the H1 and CTA wrapper to verify markup renders correctly, then revert. Layout should be 3 huge centered lines.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/HeroKinetic.tsx
git commit -m "feat(landing): static hero markup with voxel grid scaffold"
```

---

### Task 2.3: Manifesto — static markup

**Files:**
- Modify: `web/src/app/_components/landing/Manifesto.tsx`

- [ ] **Step 1: Static markup**

```tsx
// web/src/app/_components/landing/Manifesto.tsx
'use client';

export function Manifesto() {
  return (
    <section
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
```

- [ ] **Step 2: Eyeball at `localhost:3000`** — three giant editorial lines, third is grass-green. Visible immediately (no animation gate yet).

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/Manifesto.tsx
git commit -m "feat(landing): static manifesto markup"
```

---

### Task 2.4: LiveBuild — static layout (no canvas yet)

**Files:**
- Modify: `web/src/app/_components/landing/LiveBuild.tsx`

- [ ] **Step 1: Static two-column layout with chat panel placeholder + canvas placeholder**

The chat panel renders the prompt as plain text (no typewriter yet). The canvas slot is an empty `<div>` reserved for the Three.js mount in Task 3.4.

```tsx
// web/src/app/_components/landing/LiveBuild.tsx
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
            ref={undefined}
            className="bg-[#050507] border border-white/10 rounded-xl min-h-[400px] flex items-center justify-center text-zinc-600 text-sm"
          >
            [canvas mount]
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Eyeball at `localhost:3000`** — when scrolling into this section, you should see the chat + placeholder canvas pinned for ~1 viewport (sticky CSS works without JS). Section overall is 200vh tall.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/LiveBuild.tsx
git commit -m "feat(landing): static LiveBuild layout with chat placeholder"
```

---

### Task 2.5: StackPillars — static markup

**Files:**
- Modify: `web/src/app/_components/landing/StackPillars.tsx`

- [ ] **Step 1: Three sticky cards stacked**

```tsx
// web/src/app/_components/landing/StackPillars.tsx
'use client';

const PILLARS = [
  {
    word: 'AI',
    sentence: 'Claude reads your prompt and decides which blocks to place — using twelve specialised tools.',
    accent: '◷',
  },
  {
    word: 'MCP',
    sentence: 'Model Context Protocol bridges the model to the world. Standard, open, no vendor lock-in.',
    accent: '↔',
  },
  {
    word: 'VIEWER',
    sentence: 'A live Three.js scene shows every block the moment it is placed. Vanilla textures, real geometry.',
    accent: '◧',
  },
];

export function StackPillars() {
  return (
    <section data-section="stack" className="border-t border-white/5">
      {PILLARS.map((p) => (
        <div
          key={p.word}
          data-pillar
          className="sticky top-0 min-h-dvh flex items-center px-6 bg-[#0b0b0d]"
        >
          <div className="max-w-6xl mx-auto w-full grid md:grid-cols-[1fr_auto] gap-12 items-center">
            <div className="flex flex-col gap-6">
              <span className="text-xs uppercase tracking-[0.25em] text-[#7ec07e]">The stack</span>
              <h3
                className="font-black tracking-[-0.04em] leading-[0.85] text-[#f5f3ed]"
                style={{ fontSize: 'clamp(80px, 16vw, 280px)' }}
              >
                {p.word}
              </h3>
              <p className="text-lg md:text-xl text-zinc-300 max-w-xl leading-relaxed">{p.sentence}</p>
            </div>
            <div className="text-[160px] text-[#7ec07e] opacity-30 hidden md:block">{p.accent}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Eyeball at `localhost:3000`** — three sticky stacked sections, each pins as it enters. Fully driven by `position: sticky` (no JS needed yet).

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/StackPillars.tsx
git commit -m "feat(landing): static stack pillars with sticky stacking"
```

---

### Task 2.6: ToolkitMarquee — static markup

**Files:**
- Modify: `web/src/app/_components/landing/ToolkitMarquee.tsx`

- [ ] **Step 1: Static marquee track (animation in Phase 3)**

```tsx
// web/src/app/_components/landing/ToolkitMarquee.tsx
'use client';

const TOOLS = [
  'set_block', 'set_blocks', 'fill_region', 'fill_layer', 'replace',
  'get_layer', 'get_region', 'get_all', 'create_zone', 'current_session',
  'set_version', 'export_litematic',
];

export function ToolkitMarquee() {
  // Duplicate the list once so the marquee loop can wrap seamlessly.
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
```

- [ ] **Step 2: Eyeball at `localhost:3000`** — single horizontal line, overflow-x clipped, items visible (no animation yet, but layout is correct).

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/ToolkitMarquee.tsx
git commit -m "feat(landing): static toolkit marquee track"
```

---

### Task 2.7: Setup — final visual treatment

**Files:**
- Modify: `web/src/app/_components/landing/Setup.tsx`

- [ ] **Step 1: Replace the legacy styling moved in Task 1.2 with the editorial two-column layout**

The form logic (state, `create`, retry loop, router push) stays unchanged. Only markup and Tailwind classes change. The accent colour switches from blue to grass-green.

```tsx
// web/src/app/_components/landing/Setup.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { generateSessionId, supabase } from '@/lib/supabase';

type SizePreset = { label: string; x: number; y: number; z: number };

const PRESETS: SizePreset[] = [
  { label: '16 × 16 × 16', x: 16, y: 16, z: 16 },
  { label: '32 × 32 × 32', x: 32, y: 32, z: 32 },
  { label: '64 × 64 × 64', x: 64, y: 64, z: 64 },
  { label: '64 × 256 × 64', x: 64, y: 256, z: 64 },
];

const MAX_DIM = 256;

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "mcmcp-schematic": {
      "command": "npx",
      "args": ["@my-monkey/mcp-schematic"],
      "env": {
        "MCMCP_SESSION_ID": "YOUR_SESSION_ID"
      }
    }
  }
}`;

function clampDim(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(MAX_DIM, Math.round(n)));
}

function copy(text: string) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text);
}

export function Setup() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number>(1);
  const [custom, setCustom] = useState({ x: 24, y: 24, z: 24 });
  const [copied, setCopied] = useState(false);

  const size = selected >= 0 ? PRESETS[selected]! : custom;
  const volume = size.x * size.y * size.z;

  const create = useCallback(async () => {
    setCreating(true);
    setError(null);
    const x = clampDim(size.x);
    const y = clampDim(size.y);
    const z = clampDim(size.z);
    for (let attempt = 0; attempt < 6; attempt++) {
      const id = generateSessionId();
      const { error } = await supabase.from('mcmcp_sessions').insert({
        id, size_x: x, size_y: y, size_z: z,
      });
      if (!error) {
        router.push(`/s/${id}`);
        return;
      }
      if (error.code !== '23505') {
        setError(error.message);
        setCreating(false);
        return;
      }
    }
    setError('Could not allocate a unique session id, retry.');
    setCreating(false);
  }, [size, router]);

  return (
    <section id="create" data-section="setup" className="border-t border-white/5 py-32 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
        {/* Left: snippet */}
        <div className="flex flex-col gap-6">
          <span className="text-xs uppercase tracking-[0.25em] text-[#7ec07e]">Quick setup</span>
          <h3 className="font-black tracking-[-0.03em] leading-[0.9] text-[#f5f3ed]" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Add to your<br />Claude config.
          </h3>
          <div className="relative">
            <pre className="bg-[#050507] border border-white/10 rounded-xl p-6 overflow-x-auto text-sm font-mono text-zinc-200 leading-relaxed">
              <code data-setup-snippet>{CONFIG_SNIPPET}</code>
            </pre>
            <button
              onClick={() => { copy(CONFIG_SNIPPET); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-xs text-zinc-200 px-3 py-1.5 rounded-md"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Right: form */}
        <div className="flex flex-col gap-4">
          <span className="text-xs uppercase tracking-[0.25em] text-[#7ec07e]">Try it now</span>
          <h3 className="font-black tracking-[-0.03em] leading-[0.9] text-[#f5f3ed]" style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}>
            Create<br />a session.
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setSelected(i)}
                className={`border rounded-lg px-4 py-3.5 text-left transition ${
                  selected === i
                    ? 'border-[#7ec07e] bg-[#7ec07e]/10 text-[#cdebcd]'
                    : 'border-white/10 hover:border-white/30'
                }`}
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-xs text-zinc-500">{(p.x * p.y * p.z).toLocaleString()} blocks max</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelected(-1)}
            className={`border rounded-lg px-4 py-3.5 text-left transition ${
              selected === -1
                ? 'border-[#7ec07e] bg-[#7ec07e]/10 text-[#cdebcd]'
                : 'border-white/10 hover:border-white/30'
            }`}
          >
            <div className="text-sm font-medium">Custom</div>
            <div className="text-xs text-zinc-500">
              {selected === -1
                ? `${custom.x} × ${custom.y} × ${custom.z} (${volume.toLocaleString()} blocks)`
                : `Set your own dimensions (1–${MAX_DIM} per axis)`}
            </div>
          </button>
          {selected === -1 && (
            <div className="grid grid-cols-3 gap-2">
              {([
                { axis: 'x', name: 'Width', hint: '↔ X' },
                { axis: 'y', name: 'Height', hint: '↕ Y' },
                { axis: 'z', name: 'Depth', hint: '⤢ Z' },
              ] as const).map(({ axis, name, hint }) => (
                <label key={axis} className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 flex justify-between">
                    <span>{name}</span><span className="text-zinc-600">{hint}</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_DIM}
                    value={custom[axis]}
                    onChange={(e) => setCustom((c) => ({ ...c, [axis]: clampDim(Number(e.target.value)) }))}
                    className="bg-[#050507] border border-white/10 rounded-md px-3 py-2 text-sm tabular-nums outline-none focus:border-[#7ec07e]"
                  />
                </label>
              ))}
            </div>
          )}
          <button
            onClick={create}
            disabled={creating}
            className="bg-[#7ec07e] hover:bg-[#6fb46f] disabled:opacity-50 text-[#0b0b0d] font-semibold rounded-lg py-3.5 text-base"
          >
            {creating ? 'Creating session…' : 'Create session →'}
          </button>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Re-verify create-session works**

In the browser, scroll to Setup, click "Create session" with default preset → must still route to `/s/<id>` and load the viewer.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/Setup.tsx
git commit -m "feat(landing): editorial two-column Setup with grass accent"
```

---

### Task 2.8: Outro — static markup

**Files:**
- Modify: `web/src/app/_components/landing/Outro.tsx`

- [ ] **Step 1:**

```tsx
// web/src/app/_components/landing/Outro.tsx
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
```

- [ ] **Step 2: Eyeball at `localhost:3000`** — full-bleed final line.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/Outro.tsx
git commit -m "feat(landing): static outro line"
```

---

### Task 2.9: Footer — static markup

**Files:**
- Modify: `web/src/app/_components/landing/Footer.tsx`

- [ ] **Step 1:**

```tsx
// web/src/app/_components/landing/Footer.tsx
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
```

- [ ] **Step 2: Eyeball + commit**

```bash
git add web/src/app/_components/landing/Footer.tsx
git commit -m "feat(landing): minimal footer"
```

---

### Task 2.10: Phase 2 checkpoint — typecheck, lint, build

- [ ] **Step 1: Run all gates**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Expected: all green. If `pnpm build` fails on Next 16 specifics, consult the docs in `node_modules/next/dist/docs/` and fix before continuing. Commit any fix in its own commit.

---

## Phase 3 — Animations per section

Now we layer GSAP. Every animation lives inside `useGSAP({ scope: ref })` so contexts and SplitText instances are cleaned up automatically. All scroll-driven animations are gated by `gsap.matchMedia()` so they only attach where they should — Phase 4 fills in the responsive matchMedia gates more explicitly.

### Task 3.1: Hero — title reveal + voxel disintegration

**Files:**
- Modify: `web/src/app/_components/landing/HeroKinetic.tsx`

- [ ] **Step 1: Add the GSAP animation block**

Pseudocode of what we want (turn into final code below):
1. On mount, SplitText words → reveal H1 with stagger.
2. ScrollTrigger pinned for 100vh scrubs the disintegration: letters of "AI" fade out 0→1, voxels fade in bottom-up with stagger.

```tsx
'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap, ScrollTrigger, SplitText, registerGsap } from '@/lib/landing/gsap';

const VOXEL_GRID_SIZE = 8;

export function HeroKinetic() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    registerGsap();
    const root_ = root.current!;
    const title = root_.querySelector<HTMLElement>('[data-hero-title]')!;
    const cta = root_.querySelector<HTMLElement>('[data-hero-cta]')!;
    const letters = root_.querySelector<HTMLElement>('[data-hero-letters]')!;
    const voxels = root_.querySelectorAll<HTMLElement>('[data-voxel]');

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
  }, { scope: root });

  const voxelCells = Array.from({ length: VOXEL_GRID_SIZE * VOXEL_GRID_SIZE });
  return (
    <section
      ref={root}
      data-section="hero"
      className="relative min-h-[200vh] flex items-center justify-center px-6 overflow-hidden"
    >
      {/* keep the same markup as Task 2.2 */}
      {/* ... title + voxel grid + CTA, all unchanged ... */}
    </section>
  );
}
```

Keep the JSX from Task 2.2 verbatim — just attach `ref={root}` to the section, and add the `useGSAP` hook above the return. Make sure the `min-h-[140vh]` from Task 2.2 is bumped to `min-h-[200vh]` so the pin has room.

- [ ] **Step 2: Eyeball at `localhost:3000`** — title reveals on load (no FOUC), then on scroll the section pins for 100vh, "AI" fades out as the voxel grid fades in from random positions.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/HeroKinetic.tsx
git commit -m "feat(landing): hero kinetic reveal + voxel disintegration"
```

---

### Task 3.2: Manifesto — line-by-line reveal

**Files:**
- Modify: `web/src/app/_components/landing/Manifesto.tsx`

- [ ] **Step 1: Add SplitText line reveal on scroll-into-view**

```tsx
'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap, SplitText, registerGsap } from '@/lib/landing/gsap';

export function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    registerGsap();
    const text = root.current!.querySelector<HTMLElement>('[data-manifesto-text]')!;
    const split = SplitText.create(text, { type: 'lines', linesClass: 'overflow-hidden' });
    gsap.from(split.lines, {
      y: '110%',
      stagger: 0.12,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: root.current, start: 'top 70%', once: true },
    });
    return () => split.revert();
  }, { scope: root });

  return (
    <section
      ref={root}
      data-section="manifesto"
      className="min-h-dvh flex items-center justify-center px-6 py-32 border-t border-white/5"
    >
      {/* same H2 markup as Task 2.3 */}
    </section>
  );
}
```

- [ ] **Step 2: Eyeball + Commit**

```bash
git add web/src/app/_components/landing/Manifesto.tsx
git commit -m "feat(landing): manifesto line-by-line reveal"
```

---

### Task 3.3: miniScene module (Three.js scripted scene)

**Files:**
- Create: `web/src/lib/landing/miniScene.ts`

This module is consumed by `LiveBuild.tsx` in Task 3.4. It is **decoupled from React**: it manages its own renderer/animation loop and exposes a `setProgress(0..1)` to drive block placement. No OrbitControls, no gizmos, no Supabase.

- [ ] **Step 1: Define the build script (a fixed list of placements representing a stone tower with a torch)**

The placements use the shared `World.setBlock(x, y, z, type, animate?)` signature. The tower is roughly: 3×3 base, 8-block-tall shaft, simple 4-block crenellations on top, and a torch on the centre top.

```ts
// web/src/lib/landing/miniScene.ts
import * as THREE from 'three';
import { World } from '@/lib/world';
import { TextureLibrary } from '@/lib/textureLibrary';

type Placement = { x: number; y: number; z: number; type: string };

function buildPlacements(): Placement[] {
  const out: Placement[] = [];
  // 5x5 dirt + grass floor
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      out.push({ x, y: 0, z, type: 'grass_block' });
    }
  }
  // 3x3 outline tower 8 high (hollow inside above y=1)
  for (let y = 1; y <= 8; y++) {
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        const isEdge = Math.abs(x) === 1 || Math.abs(z) === 1;
        if (isEdge) out.push({ x, y, z, type: 'cobblestone' });
      }
    }
  }
  // crenellations: 4 corners on top
  out.push({ x: -1, y: 9, z: -1, type: 'cobblestone' });
  out.push({ x: 1, y: 9, z: -1, type: 'cobblestone' });
  out.push({ x: -1, y: 9, z: 1, type: 'cobblestone' });
  out.push({ x: 1, y: 9, z: 1, type: 'cobblestone' });
  // torch on centre top
  out.push({ x: 0, y: 9, z: 0, type: 'torch' });
  return out;
}

export type MiniScene = {
  setProgress: (p: number) => void;
  destroy: () => void;
};

export async function createMiniScene(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  version: string = '1.21',
): Promise<MiniScene> {
  const scene = new THREE.Scene();
  scene.background = null; // transparent over the panel background
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200);

  // initial framing — slightly elevated, looking at tower centre
  camera.position.set(10, 8, 14);
  camera.lookAt(0, 4, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(20, 30, 10);
  scene.add(sun);

  const textures = new TextureLibrary(version);
  await textures.preload();

  const world = new World(textures);
  scene.add(world.group);

  const placements = buildPlacements();
  let placedCount = 0;

  const setProgress = (p: number): void => {
    const target = Math.max(0, Math.min(placements.length, Math.floor(p * placements.length)));
    if (target > placedCount) {
      for (let i = placedCount; i < target; i++) {
        const { x, y, z, type } = placements[i]!;
        world.setBlock(x, y, z, type, true);
      }
    } else if (target < placedCount) {
      // scrubbed backwards — clear and re-place from scratch (simpler than per-block undo)
      world.clear();
      for (let i = 0; i < target; i++) {
        const { x, y, z, type } = placements[i]!;
        world.setBlock(x, y, z, type, false);
      }
    }
    placedCount = target;

    // gentle camera orbit on the last 5%
    const orbit = Math.max(0, (p - 0.95) / 0.05);
    const angle = Math.PI / 4 + orbit * Math.PI * 0.4;
    const radius = 14;
    camera.position.set(Math.sin(angle) * radius, 8 + orbit * 2, Math.cos(angle) * radius);
    camera.lookAt(0, 4, 0);
  };

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(container);

  let raf = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    world.tick(now);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  const destroy = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    world.dispose();
    textures.dispose();
    renderer.dispose();
  };

  return { setProgress, destroy };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
```

Expected: clean. If `World` or `TextureLibrary` constructors changed signatures, fix the calls accordingly using the actual signatures defined in `web/src/lib/world.ts` and `web/src/lib/textureLibrary.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/landing/miniScene.ts
git commit -m "feat(landing): miniScene with scripted stone-tower build"
```

---

### Task 3.4: LiveBuild — wire miniScene + scroll-driven typewriter

**Files:**
- Modify: `web/src/app/_components/landing/LiveBuild.tsx`

- [ ] **Step 1: Replace placeholder canvas div with `<canvas>`, wire the scene + scrub**

The component:
1. Mounts the canvas only when section enters viewport (IntersectionObserver).
2. Creates a `MiniScene` once, exposes a single ScrollTrigger that scrubs an object `{ progress: 0 }` and forwards to `mini.setProgress` and to the typewriter.
3. The typewriter slices `PROMPT` based on a separate progress band (20–50%).

```tsx
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

  // Lazy-mount the scene only when the section is near the viewport.
  useEffect(() => {
    if (!root.current) return;
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
    io.observe(root.current);
    return () => io.disconnect();
  }, []);

  // Create / destroy the mini scene
  useEffect(() => {
    if (!shouldMount) return;
    let cancelled = false;
    (async () => {
      if (!canvasRef.current || !containerRef.current) return;
      const mini = await createMiniScene(canvasRef.current, containerRef.current);
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
    const state = { progress: 0 };
    const trigger = ScrollTrigger.create({
      trigger: root.current,
      start: 'top top',
      end: '+=200%',
      scrub: 0.5,
      pin: '[data-live-pin]',
      onUpdate: (self) => {
        state.progress = self.progress;
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
```

- [ ] **Step 2: Eyeball at `localhost:3000`** — section pins for ~2 viewports while scrolling. Prompt types itself letter by letter as you scroll. Then blocks spawn one by one. End: gentle camera orbit. Scroll back: things reverse.

- [ ] **Step 3: Verify cleanup** — Navigate away (e.g. trigger create-session) and back; the scene should not leak (no console errors about disposed renderers, no double canvases).

- [ ] **Step 4: Commit**

```bash
git add web/src/app/_components/landing/LiveBuild.tsx
git commit -m "feat(landing): scroll-driven mini-viewer demo with typewriter prompt"
```

---

### Task 3.5: StackPillars — content reveal on each pin entry

**Files:**
- Modify: `web/src/app/_components/landing/StackPillars.tsx`

- [ ] **Step 1: Add per-pillar reveal**

```tsx
'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap, ScrollTrigger, registerGsap } from '@/lib/landing/gsap';

const PILLARS = [/* same array as Task 2.5 */];

export function StackPillars() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    registerGsap();
    const pillars = root.current!.querySelectorAll<HTMLElement>('[data-pillar]');
    pillars.forEach((p) => {
      gsap.from(p.querySelectorAll('h3, p, .pillar-accent'), {
        y: 40,
        opacity: 0,
        stagger: 0.08,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: p, start: 'top 60%', once: true },
      });
    });
  }, { scope: root });

  return (
    <section ref={root} data-section="stack" className="border-t border-white/5">
      {/* Same JSX as Task 2.5; add className "pillar-accent" to the accent symbol div for the gsap.from query above */}
    </section>
  );
}
```

When porting the JSX from Task 2.5, change the accent symbol's `<div>` className from the previous one to add `pillar-accent`. Example: `<div className="pillar-accent text-[160px] text-[#7ec07e] opacity-30 hidden md:block">{p.accent}</div>`.

- [ ] **Step 2: Eyeball + commit**

```bash
git add web/src/app/_components/landing/StackPillars.tsx
git commit -m "feat(landing): stack pillars per-section reveal"
```

---

### Task 3.6: ToolkitMarquee — infinite loop animation

**Files:**
- Modify: `web/src/app/_components/landing/ToolkitMarquee.tsx`

- [ ] **Step 1: Loop via GSAP `modifiers`**

```tsx
'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap, registerGsap } from '@/lib/landing/gsap';

const TOOLS = [/* same as Task 2.6 */];

export function ToolkitMarquee() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    registerGsap();
    const track = root.current!.querySelector<HTMLElement>('[data-marquee-track]')!;
    const tween = gsap.to(track, {
      x: '-=50%',
      duration: 50,
      ease: 'none',
      repeat: -1,
      modifiers: { x: gsap.utils.unitize((x: string) => parseFloat(x) % (track.scrollWidth / 2)) },
    });

    const slow = () => tween.timeScale(0.25);
    const speed = () => tween.timeScale(1);
    track.addEventListener('mouseenter', slow);
    track.addEventListener('mouseleave', speed);
    return () => {
      track.removeEventListener('mouseenter', slow);
      track.removeEventListener('mouseleave', speed);
    };
  }, { scope: root });

  const items = [...TOOLS, ...TOOLS];
  return (
    <section ref={root} data-section="toolkit" className="border-t border-white/5 py-24 overflow-hidden">
      {/* same JSX as Task 2.6 */}
    </section>
  );
}
```

- [ ] **Step 2: Eyeball at `localhost:3000`** — marquee loops smoothly (no jump at wrap), slows on hover, resumes on leave.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/ToolkitMarquee.tsx
git commit -m "feat(landing): toolkit marquee infinite loop"
```

---

### Task 3.7: Setup — typewriter snippet + form fade-up

**Files:**
- Modify: `web/src/app/_components/landing/Setup.tsx`

- [ ] **Step 1: Add useGSAP that types the snippet on viewport entry, then reveals the form column**

Add a `data-setup-form` attribute to the right column wrapper, and split snippet typing using a `text` callback because the snippet contains JSON tokens that must not be split.

```tsx
import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap, registerGsap } from '@/lib/landing/gsap';

// inside Setup() body, before the return:
const root = useRef<HTMLElement>(null);

useGSAP(() => {
  registerGsap();
  const code = root.current!.querySelector<HTMLElement>('[data-setup-snippet]')!;
  const form = root.current!.querySelector<HTMLElement>('[data-setup-form]')!;
  const full = code.textContent ?? '';
  code.textContent = '';

  const tl = gsap.timeline({
    scrollTrigger: { trigger: root.current, start: 'top 70%', once: true },
  });
  tl.to(code, {
    duration: 1.4,
    ease: 'none',
    onUpdate() {
      const p = this.progress();
      code.textContent = full.slice(0, Math.floor(p * full.length));
    },
  })
  .from(form, { opacity: 0, y: 30, duration: 0.6, ease: 'power3.out' }, '-=0.2');
}, { scope: root });
```

Then attach `ref={root}` to `<section>` and add `data-setup-form` to the right `<div className="flex flex-col gap-4">`.

- [ ] **Step 2: Eyeball at `localhost:3000`** — snippet types on entry, then form fades up. After typing finishes, copy button still works.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/Setup.tsx
git commit -m "feat(landing): setup typewriter snippet + form reveal"
```

---

### Task 3.8: Outro — letters in + permanent micro-yoyo

**Files:**
- Modify: `web/src/app/_components/landing/Outro.tsx`

- [ ] **Step 1: SplitText letters with stagger entry, then yoyo**

```tsx
'use client';

import { useGSAP } from '@gsap/react';
import { useRef } from 'react';
import { gsap, SplitText, registerGsap } from '@/lib/landing/gsap';

export function Outro() {
  const root = useRef<HTMLElement>(null);

  useGSAP(() => {
    registerGsap();
    const text = root.current!.querySelector<HTMLElement>('[data-outro-text]')!;
    const split = SplitText.create(text, { type: 'chars', charsClass: 'inline-block' });
    gsap.set(split.chars, { y: 80, opacity: 0 });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: root.current, start: 'top 70%', once: true },
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
    <section ref={root} data-section="outro" className="min-h-dvh flex items-center justify-center px-6 border-t border-white/5">
      {/* same H2 as Task 2.8 */}
    </section>
  );
}
```

- [ ] **Step 2: Eyeball + commit**

```bash
git add web/src/app/_components/landing/Outro.tsx
git commit -m "feat(landing): outro kinetic chars with floating yoyo"
```

---

## Phase 4 — Responsive & accessibility gates

The animations from Phase 3 currently apply at all breakpoints. Phase 4 wraps each `useGSAP` body in `gsap.matchMedia()` to disable pinning and scrubs below 640px and to honour `prefers-reduced-motion`.

### Task 4.1: Wrap animations in matchMedia

**Files:** all section components that use `useGSAP`.

- [ ] **Step 1: Convert each `useGSAP` body to a matchMedia branch**

The pattern (apply to every section):

```tsx
useGSAP(() => {
  registerGsap();
  const mm = gsap.matchMedia();

  // desktop & tablet — full experience
  mm.add('(min-width: 640px) and (prefers-reduced-motion: no-preference)', () => {
    // existing animation code (timelines, ScrollTrigger.create, etc.)
    // return cleanup fn
    return () => { /* split.revert() etc. if needed */ };
  });

  // mobile — entry reveals only, no pin/scrub
  mm.add('(max-width: 639px) and (prefers-reduced-motion: no-preference)', () => {
    // simplified gsap.from with scrollTrigger { once: true } — no pin, no scrub
  });

  // reduced motion — instant, no scrub, no loop
  mm.add('(prefers-reduced-motion: reduce)', () => {
    // For Hero: just set opacity:1, leave voxels at 0 (or all at 1, your call), no pin.
    // For Manifesto/Outro: snap visible.
    // For Marquee: kill the loop, leave the static line.
    // For LiveBuild: still load the scene but call setProgress(1) once at mount.
    // For Setup typewriter: skip typing, leave the snippet whole.
  });
}, { scope: root });
```

Apply concretely:

- **HeroKinetic** — desktop: existing pin + scrub; mobile: no pin, just the SplitText reveal; reduced: no scrub, no SplitText animation, just `gsap.set(title, { opacity: 1 })` and `gsap.set(voxels, { opacity: 1 })` to show final state.
- **Manifesto** — desktop: SplitText reveal; mobile: same; reduced: skip the split, set lines to opacity:1.
- **LiveBuild** — desktop: existing pin + scrub; mobile: no pin; instead, when section enters viewport, autoplay typewriter + scene from 0→1 over 4s using a `gsap.to({}, { duration: 4, onUpdate })`. Reduced: skip animation, call `mini.setProgress(1)` once and set `typed` to full prompt.
- **StackPillars** — desktop: existing reveal + sticky-stack via CSS (still works on mobile naturally because it's CSS sticky). Reduced: set elements visible immediately.
- **ToolkitMarquee** — desktop: loop. Reduced: kill the tween, leave static.
- **Setup** — desktop: typewriter + reveal. Mobile: same. Reduced: skip typewriter, set full snippet immediately, fade in form without delay.
- **Outro** — desktop: SplitText reveal + yoyo. Mobile: same minus yoyo (yoyo is fine but spare battery). Reduced: skip animation, show text statically.

- [ ] **Step 2: Eyeball at three breakpoints**

  1. Desktop ≥1024px — full experience.
  2. Mobile ≤639px (devtools responsive 360×800) — page is fully scrollable, no jank, hero pin is gone, LiveBuild plays once on entry, marquee still loops.
  3. macOS System Preferences → Accessibility → Reduce motion **on**, hard reload. All scrubs/loops/yoyo off, content readable.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/_components/landing/
git commit -m "feat(landing): matchMedia gates for responsive + reduced-motion"
```

---

## Phase 5 — SEO refresh

### Task 5.1: Update `layout.tsx` metadata

**Files:**
- Modify: `web/src/app/layout.tsx`

- [ ] **Step 1: Replace metadata + add JSON-LD**

```tsx
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const SITE_URL = 'https://mcmcp.my-monkey.fr';
const TITLE = 'mcmcp — Build Minecraft schematics with AI';
const DESCRIPTION =
  'AI-powered Minecraft schematic builder via MCP. Claude places blocks, you watch them land in a live 3D viewer, you export .litematic files.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'mcmcp',
    locale: 'en_US',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

// Next ≥14 requires themeColor/colorScheme to live on `viewport`, not `metadata`.
export const viewport: Viewport = {
  themeColor: '#0b0b0d',
  colorScheme: 'dark',
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'mcmcp',
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web, macOS, Windows, Linux',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  softwareRequirements: 'Claude Code, Claude Desktop, or any MCP-compatible client',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify metadata + JSON-LD render in `view-source` of `localhost:3000`**

- [ ] **Step 3: Commit**

```bash
git add web/src/app/layout.tsx
git commit -m "feat(seo): metadata refresh + SoftwareApplication JSON-LD"
```

---

### Task 5.2: Dynamic OG + Twitter images

**Files:**
- Create: `web/src/app/opengraph-image.tsx`
- Create: `web/src/app/twitter-image.tsx`

- [ ] **Step 1: Author the OG image**

Reuse the editorial type style — large title, small subtitle, grass-green accent. Use Next 16's built-in `ImageResponse` from `next/og` (verify import path against `node_modules/next/dist/docs/` first per Task 0.1).

```tsx
// web/src/app/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'mcmcp — Build Minecraft schematics with AI';

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', background: '#0b0b0d', color: '#f5f3ed',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '64px 72px', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 24, color: '#9ca39c', letterSpacing: 4, textTransform: 'uppercase' }}>mcmcp · MCP server</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ fontSize: 110, fontWeight: 900, lineHeight: 1, letterSpacing: -3 }}>BUILD</div>
          <div style={{ fontSize: 110, fontWeight: 900, lineHeight: 1, letterSpacing: -3 }}>MINECRAFT</div>
          <div style={{ fontSize: 110, fontWeight: 900, lineHeight: 1, letterSpacing: -3 }}>
            WITH <span style={{ color: '#7ec07e' }}>AI.</span>
          </div>
        </div>
        <div style={{ fontSize: 28, color: '#9ca39c' }}>Claude · MCP · Three.js · .litematic</div>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 2: Twitter image — re-export the OG image**

```tsx
// web/src/app/twitter-image.tsx
export { default, size, contentType, alt } from './opengraph-image';
```

- [ ] **Step 3: Build + verify**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm build
```

Hit `http://localhost:3000/opengraph-image` and `/twitter-image` after `pnpm dev` to visually confirm.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/opengraph-image.tsx web/src/app/twitter-image.tsx
git commit -m "feat(seo): dynamic OG + Twitter images"
```

---

### Task 5.3: Favicon set (icon + apple-icon)

**Files:**
- Create: `web/src/app/icon.tsx`
- Create: `web/src/app/apple-icon.tsx`
- Replace: `web/src/app/favicon.ico` (ensure new content)

- [ ] **Step 1: Dynamic icon — a single voxel cube glyph**

```tsx
// web/src/app/icon.tsx
import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#0b0b0d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 22, height: 22,
          background: 'linear-gradient(135deg, #7ec07e 0%, #2f7a2f 100%)',
          boxShadow: 'inset -3px -3px 0 rgba(0,0,0,.25)',
          border: '1px solid #0d3a0d',
        }} />
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 2: Apple touch icon — same idea, 180×180**

```tsx
// web/src/app/apple-icon.tsx
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#0b0b0d', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 36 }}>
        <div style={{
          width: 120, height: 120,
          background: 'linear-gradient(135deg, #7ec07e 0%, #2f7a2f 100%)',
          boxShadow: 'inset -10px -10px 0 rgba(0,0,0,.25)',
          border: '4px solid #0d3a0d',
        }} />
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 3: Decide on `favicon.ico`**

Since Next 16 generates an icon from `icon.tsx` automatically and most modern browsers prefer that, **delete** `web/src/app/favicon.ico` to avoid stale defaults. Verify via `node_modules/next/dist/docs/` (per Task 0.1) that this is correct for Next 16 — if Next still requires `favicon.ico`, leave it but generate a 32×32 ICO from the same voxel design (out-of-scope to author by hand here; quickest path: export the `icon.tsx` PNG, then run `pnpm dlx png-to-ico web/src/app/icon.png > web/src/app/favicon.ico`).

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
rm src/app/favicon.ico  # if confirmed unnecessary by Next 16 docs
```

- [ ] **Step 4: Commit**

```bash
git add web/src/app/icon.tsx web/src/app/apple-icon.tsx
git add -A web/src/app/favicon.ico  # capture deletion or replacement
git commit -m "feat(seo): dynamic voxel-glyph icon set"
```

---

### Task 5.4: `robots.ts` + `sitemap.ts`

**Files:**
- Create: `web/src/app/robots.ts`
- Create: `web/src/app/sitemap.ts`
- Modify: `web/.monkey`

- [ ] **Step 1: robots.ts**

```ts
// web/src/app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/s/' }],
    sitemap: 'https://mcmcp.my-monkey.fr/sitemap.xml',
  };
}
```

- [ ] **Step 2: sitemap.ts**

```ts
// web/src/app/sitemap.ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://mcmcp.my-monkey.fr/', lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
  ];
}
```

- [ ] **Step 3: Update `.monkey`**

Read `web/.monkey`, then update:

```diff
-  "sitemap": { "enabled": false },
-  "robots": { "enabled": false }
+  "sitemap": { "enabled": true },
+  "robots": { "enabled": true }
```

If the o2monk generator collides with Next-served files at deploy time (verify on a preprod deploy in Phase 6), revert to `false` and rely on Next's routes.

- [ ] **Step 4: Verify `localhost:3000/robots.txt` and `/sitemap.xml`**

- [ ] **Step 5: Commit**

```bash
git add web/src/app/robots.ts web/src/app/sitemap.ts web/.monkey
git commit -m "feat(seo): robots + sitemap via Next file conventions"
```

---

### Task 5.5: `llms.txt`

**Files:**
- Create: `web/public/llms.txt`

- [ ] **Step 1:**

```
# mcmcp
> AI-powered Minecraft schematic builder. An MCP server connects Claude (or any MCP-compatible client) to a live 3D viewer; the AI places blocks, fills regions, and exports .litematic schematics for the Litematica mod. Vanilla Minecraft 1.16+ block textures.

## Setup
- Add the mcmcp server to your `~/.claude.json` MCP config.
- Get a session ID from https://mcmcp.my-monkey.fr — set `MCMCP_SESSION_ID` in the env block.
- Open the viewer at `https://mcmcp.my-monkey.fr/s/<session-id>` to watch builds in real time.

## Source
- GitHub: https://github.com/my-monkeys/mcmcp
- MCP server source: https://github.com/my-monkeys/mcmcp/tree/main/mcp
```

- [ ] **Step 2: Verify `localhost:3000/llms.txt` serves it**

- [ ] **Step 3: Commit**

```bash
git add web/public/llms.txt
git commit -m "feat(seo): add llms.txt for AI-search discovery"
```

---

## Phase 6 — Final smoke + ship

### Task 6.1: Manual smoke checklist

- [ ] **Step 1: Restart dev server fresh**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm dev
```

- [ ] **Step 2: Walk the page top to bottom at desktop width (≥1024px)**

  - Hero: title reveals on load (no FOUC). Scroll → section pins for ~100vh, "AI" disintegrates into voxels.
  - Manifesto: 3 lines reveal one by one when entering viewport. Third line is grass-green.
  - LiveBuild: section pins, prompt types itself as you scroll, blocks spawn in the canvas, gentle camera orbit at the end. Scroll back up — animation reverses cleanly.
  - StackPillars: each pillar pins and content reveals. No tearing.
  - Toolkit: marquee loops smoothly, slows on hover.
  - Setup: snippet types itself; form fades up; "Copy" copies; "Create session" creates a row + routes to `/s/<id>`.
  - Outro: letters drop in, then float in yoyo.
  - Footer: visible.

- [ ] **Step 3: Mobile (devtools 360×800)**

  - All sections scroll, no broken pin (no stuck content under header).
  - LiveBuild canvas plays once on entry.
  - Marquee still loops.
  - Setup form remains usable, "Create session" still works.

- [ ] **Step 4: Reduced motion (System Preferences → Accessibility → Reduce motion ON, hard reload)**

  - All scrubs and loops disabled.
  - LiveBuild canvas shows the final tower at idle.
  - Outro is static.

- [ ] **Step 5: Lighthouse pass at desktop**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm build
pnpm start &
```

Run Chrome DevTools Lighthouse on `http://localhost:3000`. Performance ≥ 85, Accessibility ≥ 95, SEO 100. If any drop, note in the PR description; fix only if egregious (block on a regression vs. baseline, not on absolute scores).

- [ ] **Step 6: View source + verify**
  - `<title>` matches new metadata.
  - `<meta property="og:image">` resolves to `/opengraph-image`.
  - `<script type="application/ld+json">` present and valid (paste into [Schema.org validator](https://validator.schema.org/)).
  - `/robots.txt` shows the correct rules.
  - `/sitemap.xml` lists `/`.
  - `/llms.txt` returns the markdown above.
  - Favicon shows the voxel cube.

- [ ] **Step 7: Final lint + typecheck + build**

```bash
cd /Users/maxim/Documents/my-monkey/mcmcp/web
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Expected: all green.

- [ ] **Step 8: Commit smoke fixes (if any) + push branch**

```bash
git status   # if there were last-minute fixes, commit them as their own commit
git push -u origin feat/landing-gsap
```

- [ ] **Step 9: Open PR (optional, user-driven)**

If the user asks for a PR, run:

```bash
gh pr create --title "feat: editorial landing redesign with GSAP + SEO refresh" --body "$(cat <<'EOF'
## Summary
- Replaces the current SaaS-style landing with a 7-section editorial scroll experience powered by GSAP + ScrollTrigger + SplitText.
- Adds a scripted Three.js mini-viewer in the LiveBuild section (real vanilla MC textures via the existing `World` + `TextureLibrary`).
- Full SEO meta refresh: dynamic OG/Twitter images, voxel favicon, JSON-LD `SoftwareApplication`, `robots.txt`, `sitemap.xml`, `llms.txt`.
- Preserves the create-session flow byte-for-byte.

Spec: `docs/superpowers/specs/2026-05-06-landing-gsap-design.md`
Plan: `docs/superpowers/plans/2026-05-06-landing-gsap.md`

## Test plan
- [ ] Desktop walkthrough — all 7 sections animate as designed
- [ ] Mobile (≤639px) — no broken pins, LiveBuild autoplays once on entry
- [ ] `prefers-reduced-motion` — scrubs/loops disabled, content readable
- [ ] Create session still routes to `/s/<id>`
- [ ] Lighthouse Performance ≥ 85, Accessibility ≥ 95, SEO 100
- [ ] OG image renders correctly at `/opengraph-image`
- [ ] Schema.org validator passes JSON-LD
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** All 7 sections from the spec map to Phase 2 (static) + Phase 3 (animation) tasks. SEO subsections (metadata, OG, favicon, JSON-LD, robots/sitemap, llms.txt) all have their own tasks in Phase 5. Out-of-scope items from the spec (ScrollSmoother, A/B copy, blog, hreflang, automated animation tests) remain out of this plan. Acceptance criteria from the spec are checked in Task 6.1.
- **No placeholders:** Code blocks contain real, complete implementations. The matchMedia code in Task 4.1 is intentionally given as a *pattern* with a per-section behavior list because each section's existing animation is already shown above; the engineer wraps each existing block in the matching media query rather than duplicating 7 full re-listings.
- **Type consistency:** `MiniScene` type returned from `createMiniScene` exposes `setProgress(p: number): void` and `destroy(): void`, matching `LiveBuild`'s `sceneRef`. `World.setBlock(x, y, z, type, animate?)` matches the existing `web/src/lib/world.ts:225` signature confirmed in research.
- **Risks acknowledged:** Next 16 doc check up-front (Task 0.1), cleanup verification on LiveBuild (Task 3.4), preprod deploy contingency for `.monkey` SEO flags (Task 5.4 / 6.1).

# Landing GSAP — Design Spec

**Date:** 2026-05-06
**Scope:** `web/` (Next.js 16 viewer)
**Status:** Approved by user, ready for implementation plan

## Goal

Replace the current static, SaaS-style landing (`web/src/app/page.tsx`) with an editorial / awwwards-style scroll experience powered by GSAP. The redesign is a single-page rewrite — no new routes — that keeps the existing session-creation flow intact and adds a real-time mini-viewer demo of the product.

A complete SEO meta refresh ships with the redesign.

## Direction

Editorial showcase. Big kinetic typography, ScrollTrigger-driven moments (pinning, scrub), and one cinematic "live build" demo that uses real Three.js with vanilla Minecraft textures.

**Palette:** off-black background (`#0b0b0d`), cream foreground, single grass-green accent pulled from the Minecraft world (the existing blue accent is dropped).

## Page spine — 7 scroll moments

| # | Section | Animation type |
|---|---------|----------------|
| 01 | Hero · kinetic type "BUILD MINECRAFT WITH AI" | Pin + scrub + SplitText |
| 02 | Manifesto · 3 short lines | SplitText line reveal (one-shot) |
| 03 | Live build · prompt → mini-viewer (Three.js) | Pin + scrub |
| 04 | Stack · AI · MCP · Viewer | Sticky-stack reveal |
| 05 | Toolkit · the 12 MCP tools | Infinite marquee |
| 06 | Setup · self-typing config + create-session form | Typewriter + reveal |
| 07 | Outro · "NOW GO BUILD." + footer | SplitText kinetic |

**Sections cut from the current page:** "Three steps from idea to Minecraft", the 3 "How it works" cards, the 6 "Features" cards. Their content is folded into 02, 04, and 05.

## Architecture

### Stack
- **GSAP** core + `ScrollTrigger` + `SplitText` (all free since Webflow's May 2024 acquisition).
- **No ScrollSmoother** — native scroll only, friendlier on iOS and trackpads.
- **Three.js**: already a dep. Section 03 reuses `web/src/lib/scene.ts`, `world.ts`, and `textures.ts` for the mini-viewer.

### File structure
```
web/src/app/page.tsx                           # thin orchestrator, ~50 lines
web/src/app/_components/landing/
  Nav.tsx
  HeroKinetic.tsx           # 01
  Manifesto.tsx             # 02
  LiveBuild.tsx             # 03 — the only Three.js section
  StackPillars.tsx          # 04
  ToolkitMarquee.tsx        # 05
  Setup.tsx                 # 06 — owns the existing create-session logic
  Outro.tsx                 # 07
  Footer.tsx
web/src/lib/landing/
  gsap.ts                   # registerPlugin once, matchMedia helpers
  miniScene.ts              # scripted Three.js scene for LiveBuild
```

### React/GSAP pattern
Each section is a client component using `useGSAP({ scope: ref })` from `@gsap/react`. One `gsap.context()` per section, automatic cleanup on unmount. Plugins are registered once in `lib/landing/gsap.ts`.

### Create-session form
The current `useState`/`useCallback`/Supabase logic from `page.tsx` is moved verbatim into `Setup.tsx`. No behavioural change. Presets, custom dimensions, validation, and routing to `/s/<id>` all preserved.

### Next 16 caveat
`web/AGENTS.md` flags that this Next version has breaking changes versus prior knowledge. Implementation must read `node_modules/next/dist/docs/` first to confirm `'use client'`, file conventions (`opengraph-image.tsx`, `icon.tsx`, `robots.ts`, `sitemap.ts`), and dynamic imports behave as expected before writing components.

## Section-by-section animation detail

### 01 · HeroKinetic
- Three-line title `BUILD MINECRAFT WITH AI`. Sans-serif weight 900, `clamp(64px, 12vw, 200px)`, tight letter-spacing.
- On mount: `SplitText` words → staggered reveal (~0.6s).
- On scroll (pin 100vh, scrub): the word **AI** disintegrates. Each glyph has a hidden grid of CSS voxel divs (isometric box-shadow look, dirt/stone/grass colors) positioned behind it. Scrubbing fades the glyph out per-character while voxels fade in bottom-up via `stagger`. The letter "builds itself in blocks".
- CTAs ("Get started" → scrolls to setup, "GitHub") fade in after the SplitText settles.

### 02 · Manifesto
- Three lines of editorial type, 80–120px:
  > *"You speak. / Claude builds. / You watch it happen — block by block, in real time."*
- `SplitText` lines with sequential reveal at viewport entry (no pin, no scrub, one-shot).

### 03 · LiveBuild — the showcase moment
- Pinned for ~150–200% of viewport height, scrubbed.
- Layout: left = fake Claude-style chat panel (Claude is the implied speaker), right = real Three.js canvas.
- Scrub timeline:
  1. **0–20%** — intro tilt of the empty canvas.
  2. **20–50%** — the user prompt `"build a stone tower with a torch on top"` types itself in the chat panel (typewriter driven by scroll progress, not `setTimeout`).
  3. **50–95%** — blocks spawn one by one in the canvas synced to the same scroll progress, following a fixed script in `miniScene.ts` (floor → tower shaft → battlements → torch).
  4. **95–100%** — gentle auto-orbit reveal of the finished build.
- No interactivity. The viewer is a film driven by the scrollbar.
- `lib/landing/miniScene.ts` is a new, stripped-down scene module: it imports texture and geometry helpers from `lib/textures.ts`, `lib/world.ts`, and `lib/geometries.ts` (not the editor-grade `lib/scene.ts`, which assumes Supabase realtime, gizmos, and edit zones). Same vanilla MC textures, dramatically simpler runtime.

### 04 · StackPillars
- Three sub-blocks `AI` / `MCP` / `VIEWER` stacked. Each = one massive word + one sentence + one accent visual.
- Sticky-stack effect: each block pins while the next slides over it (standard ScrollTrigger sticky-card pattern).
- No internal scrub, just reveal on entry.

### 05 · ToolkitMarquee
- Single horizontal line, infinite loop. Tools in order (≈12):
  `set_block · set_blocks · fill_region · fill_layer · replace · get_layer · get_region · get_all · create_zone · current_session · set_version · export_litematic`
- Type ~120px, separated by `·`. Loop implemented with GSAP `modifiers: { x: gsap.utils.unitize(...) }`. Hover slows but never stops; resume keeps momentum.
- No scrub.

### 06 · Setup
- Two columns. Left: `~/.claude.json` snippet types itself line-by-line on viewport entry (one-shot, ~2s). Persistent "Copy" button.
- Right: existing create-session form (presets + custom + submit). Fades up after the typewriter finishes.
- Mobile: stacks vertically, snippet on top, form below.

### 07 · Outro
- Full-bleed single line: `NOW GO BUILD.` ~200px+.
- `SplitText` letters with stagger entry, then a permanent micro-yoyo float.
- Footer (minimal — copyright, GitHub, MCP server link) sits below, unanimated.

## Responsive & accessibility

Single `gsap.matchMedia()` per section. Breakpoints:

| Breakpoint | Behaviour |
|---|---|
| **≥ 1024px** | Full experience: pin, scrub, SplitText, marquee, sticky-stack. |
| **640–1023px** | Pin + scrub kept on section 03. Sticky-stack on 04 degrades to vertical stack. Hero disintegration simplifies to a single voxel row. |
| **< 640px** | No pinning. All animations become entry reveals (`opacity:0 → 1`, `y:30 → 0`). The Three.js canvas in 03 still loads but autoplays once instead of being scroll-driven. Marquee remains. |
| **`prefers-reduced-motion: reduce`** | All scrubs and pins disabled. Animations become instant or 200ms fade-ins. The Three.js canvas loads its final state. The marquee stops. |

## Performance

- `LiveBuild` initialises the Three.js canvas only when the section enters the viewport (IntersectionObserver). Textures lazy-loaded.
- `SplitText.revert()` called in `useGSAP` cleanup to avoid DOM leaks across HMR and route transitions.
- `will-change: transform` is set only on the marquee track, removed elsewhere.
- No blocking assets at first paint.

## SEO refresh

Ships with the redesign — same PR.

### `app/layout.tsx` metadata
- `title` / `description` recalibrated against the new editorial copy (≤60 / ≤155 chars).
- `metadataBase: new URL("https://mcmcp.my-monkey.fr")`.
- Full `openGraph`: `url`, `siteName`, `images: [{ url, width:1200, height:630, alt }]`, `locale: "en_US"`, `type: "website"`.
- `twitter`: `summary_large_image` with same image.
- `themeColor: "#0b0b0d"`, `colorScheme: "dark"`.

### Dynamic OG / Twitter images
- `app/opengraph-image.tsx` + `app/twitter-image.tsx`. Rendered via Next 16's built-in satori/JSX route convention. Reuses the editorial type and grass-accent so it stays in sync with the brand.
- Output 1200×630.

### Favicon set
- Replace the default Next `favicon.ico` with a voxel-style glyph (a single stone+grass cube — Minecraft signature). Source SVG kept in `public/`.
- `app/icon.tsx` (dynamic) + `app/apple-icon.tsx` (180×180).

### JSON-LD `SoftwareApplication`
Injected via `<script type="application/ld+json">` in `layout.tsx`. Fields:
- `@type: "SoftwareApplication"`
- `name`, `description`, `url`
- `applicationCategory: "DeveloperApplication"`
- `operatingSystem: "Web, macOS, Windows, Linux"`
- `offers: { "@type": "Offer", "price": "0", "priceCurrency": "USD" }`
- `softwareRequirements: "Claude Code, Claude Desktop, or any MCP-compatible client"`

### robots.txt & sitemap.xml
- `app/robots.ts` — `Allow: /`, `Sitemap: https://mcmcp.my-monkey.fr/sitemap.xml`.
- `app/sitemap.ts` — root `/` only. Session URLs (`/s/<id>`) are private and not indexed.
- `web/.monkey` updated to `"robots": { "enabled": true }` and `"sitemap": { "enabled": true }`. If o2monk's generator conflicts with Next's file convention at deploy time, the `.monkey` flags are reverted and Next serves the files directly — implementation will verify on a preprod deploy.

### llms.txt
- `web/public/llms.txt`: short product summary, link to GitHub, link to setup snippet, "MCP server for Minecraft schematics" tagline. Naturally fits given the product is itself an AI tool.

## Out of scope

- ScrollSmoother (kept off — scroll natif suffit, plus safe sur iOS/trackpad).
- A/B copy variants.
- Blog or secondary pages — single-page stays single-page.
- Analytics tracking — separate concern.
- Multi-language / hreflang — English only.
- Automated animation tests. Lint, typecheck, and a manual smoke checklist suffice.
- Extracting a design system. Tailwind 4 inline classes stay, consistent with the rest of the project.

## Risks & mitigations

1. **Pin + Three.js canvas on iOS Safari** — historically flaky.
   *Mitigation:* `gsap.matchMedia()` strips pin under 640px; if tablet (640–1023px) misbehaves in QA, we add a UA-based exclusion.
2. **SplitText FOUC** — title flashes unsplit before hydration.
   *Mitigation:* the title element is `opacity:0` via base CSS; `useGSAP` reveals it after the split is computed.
3. **Next 16 file conventions** — `opengraph-image.tsx`, `icon.tsx`, `robots.ts`, `sitemap.ts` may have drifted from prior knowledge.
   *Mitigation:* implementation reads `node_modules/next/dist/docs/` before authoring those files.
4. **Create-session regression** — moving working code is the easiest place to silently break.
   *Mitigation:* implementation includes a manual smoke step — "Create session" must still create a row in `mcmcp_sessions` and route to `/s/<id>`.
5. **o2monk deploy collision** with Next-served `robots.txt` / `sitemap.xml`.
   *Mitigation:* preprod deploy first; if the generator wins, leave `.monkey` flags off and let Next serve them.

## Estimate

Roughly **3–4 days of dev** for the rewrite, excluding post-review iteration. Sections 03 (scripted Three.js) and 01 (hero disintegration) carry most of the engineering weight; the rest is paced.

## Acceptance

- All 7 spine sections present and animated per the section-by-section spec.
- `Create session` flow unchanged — same presets, same custom range (1–256), same Supabase row, same route push.
- `prefers-reduced-motion` honoured: no scrubs, no pins, no permanent animation.
- Mobile (< 640px): no broken pins, page is fully scrollable, the Three.js canvas does not jank.
- SEO refresh shipped: real OG image rendered, JSON-LD valid, `robots.txt` and `sitemap.xml` served at root, favicon updated.
- `pnpm build` green, `pnpm lint` green.

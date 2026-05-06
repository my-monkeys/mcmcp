# CLAUDE.md — `mcmcp`

**MCP server** + viewer 3D web temps réel pour construire des schematics Minecraft avec une IA. L'IA dialogue avec le MCP qui pose les blocs ; les changements streament en live dans le navigateur via Supabase Realtime. Export au format `.litematic` (mod Litematica).

## Stack

- **MCP server** : Node.js + TypeScript (stdio)
- **Viewer web** : Next.js 16 + React 19 + Three.js
- `prismarine-nbt` (parsing schematics MC)
- `@supabase/supabase-js` (real-time pub/sub)
- pnpm comme package manager

## Structure

```
mcp/                 # serveur MCP (stdio) — l'IA s'y connecte
web/                 # viewer Next.js + canvas Three.js
  .monkey           # déploiement o2monk du viewer
supabase/
  migrations/       # schéma SQL (tables prefixées mcmcp_*)
```

## Commandes

```bash
# MCP server
cd mcp
pnpm install
pnpm build           # compile TS

# Viewer
cd web
pnpm install
pnpm dev             # localhost:3000 (hot reload)
pnpm build
```

## Variables d'environnement

Le **MCP server** est configuré côté Claude Code, dans `~/.claude.json` `mcpServers.mcmcp-schematic` :

```
MCMCP_SESSION_ID         # ID 6 caractères de la session viewer
MCMCP_VIEWER_ORIGIN      # http://localhost:3000 (dev) ou prod URL
```

Le **viewer web** lit aussi `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase global).

## Backend

**Supabase** — projet partagé MyMonkey (`klliwmgdyuatstjvzzbb`), tables préfixées `mcmcp_`.

## Particularités

- Realtime block updates via **Supabase pub/sub** : l'IA pose un bloc → la table est mise à jour → le viewer re-render.
- Export `.litematic` (compatible mod Litematica pour Minecraft Java).
- Support **MC 1.16+** avec textures vanilla per-face.
- Géométrie complète (slabs, stairs, …) — milestone M5c.
- ~750 blocs supportés par version.
- L'IA construit en utilisant `set_blocks` (batch) plutôt que `set_block` un-par-un (perf).

---

## Déploiement (o2monk pour le viewer)

```bash
o2monk deploy /Users/maxim/Documents/my-monkey/mcmcp/web        # → cible définie dans web/.monkey
o2monk status /Users/maxim/Documents/my-monkey/mcmcp/web
o2monk --help
```

> Le **MCP server** (`mcp/`) n'est PAS déployé via o2monk — il est référencé en local via `~/.claude.json` et tourne sur la machine de dev.

- Mode Next.js standalone côté viewer.
- Working tree dirty → deploy refusé.

## Bonnes pratiques de code

- **Clean code** : noms explicites, fonctions courtes, une responsabilité.
- **Pas d'abstraction prématurée**.
- **Pas de commentaires "quoi"** — commenter le **pourquoi** non évident (parsing NBT, conventions de coords MC, edge cases textures per-face).
- **Valider aux frontières** : payloads MCP entrants, schemas SQL Supabase, props Three.js.
- **Pas de feature flags/dead code "au cas où"**.
- Préférer **`set_blocks`** (batch) à `set_block` pour les remplissages — plus rapide et plus fiable pour gros zones.

## Architecture

- Fichiers sous **~500 lignes**.
- Séparer **mcp/** (logique MCP, stdio) ↔ **web/** (UI, rendering 3D) ↔ **supabase/** (schéma DB).
- Le viewer ne doit jamais écrire dans Supabase — uniquement lire les events realtime. Les écritures viennent du MCP.
- Constantes nommées (versions MC supportées, IDs de blocs, taille max des zones).

## Git workflow

- **Une feature = une branche** : `feat/...`, `fix/...`, `chore/...`.
- **Commits réguliers**.
- **Conventional Commits** : `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`.
- Jamais de commit "WIP" sur `main`.
- **Pas de secrets** dans les commits.
- Avant push : `pnpm build` côté `mcp/` et `web/`.

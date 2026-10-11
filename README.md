# San Juan Roofing

Prototype site for a roofing business serving the San Juan Islands.

**Stack:** Bun · Vite · SolidJS · TypeScript · TanStack Router / Query / Store · `bun:sqlite`

```sh
bun install
bun run dev        # API on :3001 + Vite on http://127.0.0.1:5173 (proxies /api)
bun run build      # build the SPA into dist/
bun run start      # one Bun process serves dist/ + API on :3000
bun run typecheck
```

## Layout

- `server/` Bun API: `GET /api/services`, `GET /api/islands`, `GET|POST /api/quotes` (SQLite; `DB_PATH` env, default `roofing.sqlite`)
- `shared/types.ts` types shared by client and server
- `src/router.tsx` routes; loaders prefetch through the TanStack Query cache
- `src/lib/api.ts` query options and fetchers
- `src/lib/quoteStore.ts` TanStack Store for the quote draft (persisted to localStorage)
- `src/routes/` pages: home (research projects), research post, service area, quote, leads
- `server/research.ts` research projects and posts, served at `/api/projects` and `/api/projects/:projectId/posts/:postId`
- `scripts/census-san-juan.ts` regenerates `server/data/san-juan-towns.json` from Census ACS summary files (no API key): `bun scripts/census-san-juan.ts`
- `src/components/IslandMap.tsx` 3D map on `/areas` (MapLibre GL + EOX Sentinel-2 imagery + OpenFreeMap labels + AWS Terrain Tiles; no API keys). Lazy-loaded.

`/leads` lists submitted quote requests and has **no auth yet**. Lock it down before deploying.

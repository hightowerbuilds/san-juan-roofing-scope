// Builds the /map pixel-map data from keyless tile sources:
//   OpenFreeMap vector tiles (OpenMapTiles schema, OSM data): coastline, lakes, land cover, towns,
//     places, peaks, ferry routes, main roads
//   AWS Terrarium elevation tiles: land height only (their bathymetry is too smoothed to define a coast)
// Writes public/pixel-map/cells.bin + meta.json, and a full render to scripts/.cache/preview.png.
// Run: bun scripts/build-pixel-map.ts   (tiles are cached in scripts/.cache/, so reruns are offline)

import { mkdir } from "node:fs/promises";
import { VectorTile, type VectorTileFeature } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { decode as decodePng, encode as encodePng } from "fast-png";
import {
  ELEV_MAX,
  FORMAT_VERSION,
  encodeElevation,
  Surface,
  encodeCells,
  isWater,
  type LonLat,
  type PixelMapMeta,
  type PixelMapPlace,
} from "../shared/pixelMap";
import { paintCells } from "../src/lib/pixelArt";

// Haro Strait to Burlington, Patos Island to the south tip of Whidbey.
const BBOX = { west: -123.35, east: -122.25, north: 48.82, south: 47.88 };
const CELL_M = 40;
const VECTOR_ZOOM = 13;
const DEM_ZOOM = 12;
const CACHE = "scripts/.cache";
const OUT = "public/pixel-map";

// Equirectangular grid scaled at the middle latitude, so cells are square on the ground.
const M_PER_DEG_LAT = (Math.PI * 6_371_008.8) / 180;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((((BBOX.north + BBOX.south) / 2) * Math.PI) / 180);
const CELL_LON = CELL_M / M_PER_DEG_LON;
const CELL_LAT = CELL_M / M_PER_DEG_LAT;
const W = Math.round((BBOX.east - BBOX.west) / CELL_LON);
const H = Math.round((BBOX.north - BBOX.south) / CELL_LAT);
const gridX = (lon: number) => (lon - BBOX.west) / CELL_LON;
const gridY = (lat: number) => (BBOX.north - lat) / CELL_LAT;

// Web Mercator tile math.
const lonToTileX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const latToTileY = (lat: number, z: number) => ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z;
const tileXToLon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const tileYToLat = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

function tileRange(z: number) {
  return {
    x0: Math.floor(lonToTileX(BBOX.west, z)),
    x1: Math.floor(lonToTileX(BBOX.east, z)),
    y0: Math.floor(latToTileY(BBOX.north, z)),
    y1: Math.floor(latToTileY(BBOX.south, z)),
  };
}

async function cached(path: string, url: string): Promise<Uint8Array> {
  const file = Bun.file(path);
  if (await file.exists()) return new Uint8Array(await file.arrayBuffer());
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      let bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = Bun.gunzipSync(bytes);
      await Bun.write(path, bytes);
      return bytes;
    }
    if (attempt === 4) throw new Error(`${url}: HTTP ${res.status}`);
    await Bun.sleep(500 * attempt);
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
      if (++done % 100 === 0 || done === items.length) process.stdout.write(`\r  ${done}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  process.stdout.write("\n");
  return results;
}

// ---- Rasterizing ---------------------------------------------------------------------------

const surface = new Uint8Array(W * H).fill(Surface.Land);
const elevation = new Uint8Array(W * H);

type Clip = { c0: number; c1: number; r0: number; r1: number };

// Fills cells whose centers fall inside the polygon (even-odd rule, so holes and lakes work)
// and inside `clip`. Rings are flat [x0, y0, x1, y1, ...] arrays in grid coordinates.
function fillPolygon(rings: number[][], clip: Clip, value: number) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i += 2) {
      minY = Math.min(minY, ring[i]!);
      maxY = Math.max(maxY, ring[i]!);
    }
  }
  const rStart = Math.max(clip.r0, Math.ceil(minY - 0.5));
  const rEnd = Math.min(clip.r1, Math.ceil(maxY - 0.5) - 1);
  const xs: number[] = [];
  for (let r = rStart; r <= rEnd; r++) {
    const yc = r + 0.5;
    xs.length = 0;
    for (const ring of rings) {
      const n = ring.length;
      for (let i = 0; i < n; i += 2) {
        const j = (i + 2) % n;
        const ya = ring[i + 1]!;
        const yb = ring[j + 1]!;
        if (ya <= yc !== yb <= yc) {
          const xa = ring[i]!;
          xs.push(xa + ((yc - ya) * (ring[j]! - xa)) / (yb - ya));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(clip.c0, Math.ceil(xs[k]! - 0.5));
      const to = Math.min(clip.c1, Math.ceil(xs[k + 1]! - 0.5) - 1);
      if (from <= to) surface.fill(value, r * W + from, r * W + to + 1);
    }
  }
}

// ---- Vector tiles ----------------------------------------------------------------------------

const LANDCOVER: Record<string, number> = {
  farmland: Surface.Farmland,
  grass: Surface.Grass,
  wetland: Surface.Wetland,
  wood: Surface.Wood,
  sand: Surface.Sand,
  rock: Surface.Rock,
  ice: Surface.Rock,
};
// Paint order: later wins where cover polygons overlap.
const LANDCOVER_ORDER: number[] = [Surface.Farmland, Surface.Grass, Surface.Wetland, Surface.Wood, Surface.Sand, Surface.Rock];
const TOWN_LANDUSE = new Set(["residential", "commercial", "industrial", "retail"]);
const WATER: Record<string, number> = { ocean: Surface.Sea, dock: Surface.Sea, lake: Surface.Lake, pond: Surface.Lake, river: Surface.River };
const PLACE_KINDS = new Set(["city", "town", "village", "hamlet", "suburb", "island", "islet"]);
const ROAD_KINDS = new Set(["motorway", "trunk", "primary", "secondary", "tertiary"]);

const places = new Map<string, PixelMapPlace>();
const ferrySegments: LonLat[][] = [];
const roadSegments = new Map<string, LonLat[][]>();

const str = (v: unknown) => (v === undefined ? "" : String(v));

function processVectorTile(bytes: Uint8Array, x: number, y: number) {
  const z = VECTOR_ZOOM;
  const tile = new VectorTile(new PbfReader(bytes));
  const west = tileXToLon(x, z);
  const east = tileXToLon(x + 1, z);
  const north = tileYToLat(y, z);
  const south = tileYToLat(y + 1, z);
  // Each cell belongs to the one tile containing its center; tile buffers overlap, so clip to it.
  const clip: Clip = {
    c0: Math.max(0, Math.ceil(gridX(west) - 0.5)),
    c1: Math.min(W - 1, Math.ceil(gridX(east) - 0.5) - 1),
    r0: Math.max(0, Math.ceil(gridY(north) - 0.5)),
    r1: Math.min(H - 1, Math.ceil(gridY(south) - 0.5) - 1),
  };

  const features = (name: string) => {
    const layer = tile.layers[name];
    const out: VectorTileFeature[] = [];
    if (layer) for (let i = 0; i < layer.length; i++) out.push(layer.feature(i));
    return out;
  };
  const toLonLat = (px: number, py: number, extent: number): LonLat => [
    tileXToLon(x + px / extent, z),
    tileYToLat(y + py / extent, z),
  ];
  const polygonRings = (f: VectorTileFeature) =>
    f.loadGeometry().map((ring) =>
      ring.flatMap((p) => {
        const [lon, lat] = toLonLat(p.x, p.y, f.extent);
        return [gridX(lon), gridY(lat)];
      }),
    );

  if (clip.c0 <= clip.c1 && clip.r0 <= clip.r1) {
    const cover = features("landcover")
      .filter((f) => f.type === 3 && LANDCOVER[str(f.properties.class)] !== undefined)
      .map((f) => ({ f, value: LANDCOVER[str(f.properties.class)]! }))
      .sort((a, b) => LANDCOVER_ORDER.indexOf(a.value) - LANDCOVER_ORDER.indexOf(b.value));
    for (const { f, value } of cover) fillPolygon(polygonRings(f), clip, value);

    for (const f of features("landuse")) {
      if (f.type === 3 && TOWN_LANDUSE.has(str(f.properties.class))) fillPolygon(polygonRings(f), clip, Surface.Town);
    }
    for (const f of features("aeroway")) {
      if (f.type === 3 && str(f.properties.class) === "runway") fillPolygon(polygonRings(f), clip, Surface.Runway);
    }
    for (const f of features("water")) {
      const value = WATER[str(f.properties.class)];
      if (f.type !== 3 || value === undefined || f.properties.brunnel === "tunnel" || f.properties.intermittent === 1) continue;
      fillPolygon(polygonRings(f), clip, value);
    }
  }

  const inTile = ([lon, lat]: LonLat) => lon >= west && lon < east && lat <= north && lat > south;
  const inBbox = ([lon, lat]: LonLat) =>
    lon >= BBOX.west && lon <= BBOX.east && lat <= BBOX.north && lat >= BBOX.south;
  const addPoint = (f: VectorTileFeature, kind: string, rank: number, ele?: number) => {
    const name = str(f.properties["name:en"]) || str(f.properties.name);
    const p = f.loadGeometry()[0]?.[0];
    if (!name || !p) return;
    const pos = toLonLat(p.x, p.y, f.extent);
    if (!inTile(pos) || !inBbox(pos)) return;
    const key = `${kind}:${name}`;
    if (!places.has(key)) places.set(key, { name, kind, rank, ele, lon: round(pos[0]), lat: round(pos[1]) });
  };
  for (const f of features("place")) {
    const kind = str(f.properties.class);
    if (f.type === 1 && PLACE_KINDS.has(kind)) addPoint(f, kind, Number(f.properties.rank ?? 99));
  }
  for (const f of features("mountain_peak")) {
    // Peak rank is flat at this zoom; elevation is what separates Mt Constitution from a knoll.
    const ele = Number(f.properties.ele);
    if (f.type === 1 && str(f.properties.class) === "peak") addPoint(f, "peak", 99, Number.isFinite(ele) ? ele : undefined);
  }

  for (const f of features("transportation")) {
    const kind = str(f.properties.class);
    const isFerry = kind === "ferry";
    if (f.type !== 2 || (!isFerry && !ROAD_KINDS.has(kind))) continue;
    for (const line of f.loadGeometry()) {
      for (const part of clipLine(line, f.extent)) {
        const path = part.map(([px, py]) => toLonLat(px, py, f.extent));
        if (isFerry) ferrySegments.push(path);
        else (roadSegments.get(kind) ?? roadSegments.set(kind, []).get(kind)!).push(path);
      }
    }
  }
}

// Clips a polyline to the tile square [0, extent]² (Liang–Barsky per segment), returning the
// runs that stay inside. Keeps tile-buffer copies of a line from being drawn twice.
function clipLine(line: { x: number; y: number }[], extent: number): [number, number][][] {
  const runs: [number, number][][] = [];
  let run: [number, number][] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let t0 = 0;
    let t1 = 1;
    let inside = true;
    for (const [p, q] of [[-dx, a.x], [dx, extent - a.x], [-dy, a.y], [dy, extent - a.y]] as const) {
      if (p === 0) {
        if (q < 0) inside = false;
      } else {
        const t = q / p;
        if (p < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (!inside || t0 > t1) {
      if (run.length > 1) runs.push(run);
      run = [];
      continue;
    }
    const start: [number, number] = [a.x + t0 * dx, a.y + t0 * dy];
    const end: [number, number] = [a.x + t1 * dx, a.y + t1 * dy];
    if (run.length === 0) run.push(start);
    run.push(end);
    if (t1 < 1) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

// Joins segments that meet end to end (lines split across tiles) and drops ones outside the bbox.
// Each tile quantizes its own copy of a line, so cut points from neighboring tiles differ by a few
// meters: match ends within a tolerance, in either direction.
function chain(segments: LonLat[][], tolerance = 15): LonLat[][] {
  const near = (a: LonLat, b: LonLat) =>
    Math.hypot((a[0] - b[0]) * M_PER_DEG_LON, (a[1] - b[1]) * M_PER_DEG_LAT) < tolerance;
  const open = new Set(segments.map((_, i) => i));
  const take = (end: LonLat, atStart: boolean): LonLat[] | undefined => {
    for (const j of open) {
      const s = segments[j]!;
      // Oriented so the returned piece continues from `end` (appending) or leads into it (prepending).
      const piece = atStart
        ? near(end, s.at(-1)!) ? s : near(end, s[0]!) ? s.toReversed() : undefined
        : near(end, s[0]!) ? s : near(end, s.at(-1)!) ? s.toReversed() : undefined;
      if (piece) {
        open.delete(j);
        return piece;
      }
    }
  };
  const out: LonLat[][] = [];
  for (const i of segments.keys()) {
    if (!open.delete(i)) continue;
    let path = [...segments[i]!];
    for (let next = take(path.at(-1)!, false); next; next = take(path.at(-1)!, false)) path.push(...next.slice(1));
    for (let prev = take(path[0]!, true); prev; prev = take(path[0]!, true)) path = [...prev.slice(0, -1), ...path];
    out.push(path);
  }
  return out
    .filter((p) => p.some(([lon, lat]) => lon >= BBOX.west && lon <= BBOX.east && lat >= BBOX.south && lat <= BBOX.north))
    .map((p) => simplify(p, CELL_M / 2).map(([lon, lat]): LonLat => [round(lon), round(lat)]));
}

// Douglas–Peucker in local meters; detail under half a cell can't show on the map.
function simplify(path: LonLat[], tolerance: number): LonLat[] {
  if (path.length < 3) return path;
  const keep = new Uint8Array(path.length);
  keep[0] = keep[path.length - 1] = 1;
  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = [path[a]![0] * M_PER_DEG_LON, path[a]![1] * M_PER_DEG_LAT];
    const [bx, by] = [path[b]![0] * M_PER_DEG_LON, path[b]![1] * M_PER_DEG_LAT];
    const len = Math.hypot(bx - ax, by - ay);
    let worst = -1;
    let worstDist = tolerance;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = [path[i]![0] * M_PER_DEG_LON, path[i]![1] * M_PER_DEG_LAT];
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > worstDist) {
        worst = i;
        worstDist = d;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return path.filter((_, i) => keep[i]);
}

// ---- Elevation -------------------------------------------------------------------------------

async function sampleElevation() {
  const z = DEM_ZOOM;
  const { x0, x1, y0, y1 } = tileRange(z);
  const nx = x1 - x0 + 1;
  const ny = y1 - y0 + 1;
  const mw = nx * 256;
  const dem = new Float32Array(mw * ny * 256);
  const tiles = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push({ x, y });
  console.log(`Terrarium z${z}: ${tiles.length} tiles`);
  await mapLimit(tiles, 8, async ({ x, y }) => {
    const bytes = await cached(
      `${CACHE}/terrarium/${z}/${x}/${y}.png`,
      `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
    );
    const png = decodePng(bytes);
    const ch = png.channels;
    for (let py = 0; py < 256; py++) {
      const row = ((y - y0) * 256 + py) * mw + (x - x0) * 256;
      for (let px = 0; px < 256; px++) {
        const i = (py * 256 + px) * ch;
        dem[row + px] = png.data[i]! * 256 + png.data[i + 1]! + png.data[i + 2]! / 256 - 32768;
      }
    }
  });

  // Bilinear sample at each cell center.
  const colX = Float64Array.from({ length: W }, (_, c) => (lonToTileX(BBOX.west + (c + 0.5) * CELL_LON, z) - x0) * 256 - 0.5);
  for (let r = 0; r < H; r++) {
    const fy = (latToTileY(BBOX.north - (r + 0.5) * CELL_LAT, z) - y0) * 256 - 0.5;
    const iy = Math.floor(fy);
    const ty = fy - iy;
    for (let c = 0; c < W; c++) {
      const i = r * W + c;
      if (isWater(surface[i]!)) continue;
      const fx = colX[c]!;
      const ix = Math.floor(fx);
      const tx = fx - ix;
      const k = iy * mw + ix;
      const top = dem[k]! * (1 - tx) + dem[k + 1]! * tx;
      const bottom = dem[k + mw]! * (1 - tx) + dem[k + mw + 1]! * tx;
      const e = top * (1 - ty) + bottom * ty;
      elevation[i] = encodeElevation(e);
    }
  }
}

// ---- Main ------------------------------------------------------------------------------------

const started = performance.now();
console.log(`Grid ${W} × ${H} cells at ${CELL_M} m (${((W * H) / 1e6).toFixed(1)} M)`);

const tileJson = (await (await fetch("https://tiles.openfreemap.org/planet")).json()) as { tiles: string[] };
const tileUrl = tileJson.tiles[0]!;
const planetVersion = tileUrl.split("/").at(-4)!;
{
  const { x0, x1, y0, y1 } = tileRange(VECTOR_ZOOM);
  const tiles = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push({ x, y });
  console.log(`OpenFreeMap ${planetVersion} z${VECTOR_ZOOM}: ${tiles.length} tiles`);
  const z = VECTOR_ZOOM;
  const data = await mapLimit(tiles, 8, ({ x, y }) =>
    cached(
      `${CACHE}/openfreemap/${planetVersion}/${z}/${x}/${y}.pbf`,
      tileUrl.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)),
    ),
  );
  tiles.forEach(({ x, y }, i) => processVectorTile(data[i]!, x, y));
}
await sampleElevation();

const counts = new Map<number, number>();
for (const s of surface) counts.set(s, (counts.get(s) ?? 0) + 1);
const names = Object.fromEntries(Object.entries(Surface).map(([k, v]) => [v, k]));
console.log(
  "Surface:",
  [...counts].sort((a, b) => a[0] - b[0]).map(([s, n]) => `${names[s]} ${((100 * n) / (W * H)).toFixed(1)}%`).join(", "),
);

const ferries = chain(ferrySegments);
const roads = [...roadSegments].flatMap(([kind, segs]) => chain(segs).map((path) => ({ kind, path })));
const meta: PixelMapMeta = {
  version: FORMAT_VERSION,
  generated: new Date().toISOString(),
  bbox: { west: BBOX.west, east: BBOX.west + W * CELL_LON, north: BBOX.north, south: BBOX.north - H * CELL_LAT },
  cellMeters: CELL_M,
  width: W,
  height: H,
  elevMax: ELEV_MAX,
  places: [...places.values()].sort((a, b) => a.rank - b.rank || (b.ele ?? 0) - (a.ele ?? 0) || a.name.localeCompare(b.name)),
  ferries,
  roads,
  attribution: [
    "© OpenStreetMap contributors",
    "© OpenMapTiles",
    `OpenFreeMap ${planetVersion}`,
    "Terrain: Mapzen / AWS Terrain Tiles",
  ],
};

await mkdir(OUT, { recursive: true });
const cells = Bun.gzipSync(encodeCells({ width: W, height: H, surface, elevation }), { level: 9 });
await Bun.write(`${OUT}/cells.bin`, cells);
await Bun.write(`${OUT}/meta.json`, JSON.stringify(meta));
const paintStart = performance.now();
const pixels = paintCells({ width: W, height: H, surface, elevation }, CELL_M);
console.log(`Painted preview in ${Math.round(performance.now() - paintStart)} ms`);
await Bun.write(`${CACHE}/preview.png`, encodePng({ width: W, height: H, data: pixels, channels: 4 }));

const kb = (n: number) => `${Math.round(n / 1024)} KB`;
console.log(
  `Wrote ${OUT}/cells.bin (${kb(cells.length)}), meta.json (${kb(JSON.stringify(meta).length)}: ` +
    `${meta.places.length} places, ${ferries.length} ferry paths, ${roads.length} road paths), ` +
    `${CACHE}/preview.png in ${((performance.now() - started) / 1000).toFixed(1)} s`,
);

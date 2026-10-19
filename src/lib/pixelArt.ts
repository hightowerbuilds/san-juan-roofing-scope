// SNES-overworld art for the pixel map: turns the cell grid into RGBA, one pixel per cell.
// Pure and DOM-free so it runs in a Web Worker and in scripts/build-pixel-map.ts (preview).
//
// Each material has a 5-shade ramp (dark → light). Hillshade picks a shade, ordered (Bayer)
// dithering blends between neighbors, and small hash-driven patterns add trees, roofs, crop
// rows and waves. Water depth comes from distance to shore, not bathymetry.

import { decodeElevation, isWater, Surface, type PixelMapCells } from "../../shared/pixelMap";

type Ramp = [number, number, number, number, number];

// Packs "#rrggbb" as a little-endian RGBA word (bytes R, G, B, A in memory).
function rgba(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  return ((255 << 24) | ((v & 0xff) << 16) | (v & 0xff00) | (v >>> 16)) >>> 0;
}
const ramp = (...hexes: string[]) => hexes.map(rgba) as Ramp;

export const PALETTE = {
  sea: ["#4c94dc", "#3a7aca", "#2c62b4", "#22509e", "#1a4088"], // shallow → deep
  foam: "#d4eeff",
  surf: "#7cb8ee",
  lake: ["#2a6cb8", "#3a86d0", "#58a4e4"], // rim, body, glint
  grass: ["#2d5e26", "#3d7a2e", "#529838", "#6cb444", "#8fcc58"],
  meadow: ["#4a7a2c", "#5e9636", "#78b040", "#94c854", "#b2dc70"],
  forest: ["#0f2e1a", "#174425", "#205c30", "#2c763c", "#3d924a"],
  farmGold: ["#8a7a34", "#a8963e", "#c4b04c", "#d8c662", "#e8da82"],
  farmGreen: ["#5a7a2a", "#6e9232", "#86aa3c", "#9cc04c", "#b4d466"],
  farmBrown: ["#6a4e2e", "#7e5e38", "#947044", "#aa8454", "#c09a68"],
  wetland: ["#2e4a36", "#3c5e42", "#4c7450", "#5e8a60", "#74a274"],
  sand: ["#a88c52", "#c4a866", "#dcc47e", "#ecd898", "#f8ecbc"],
  rock: ["#3e3a3c", "#5a5452", "#78706a", "#968c84", "#b8aea2"],
  snow: ["#8c9ab4", "#aebcd2", "#d0dcec", "#eaf0f8", "#ffffff"],
  townGround: ["#6e6656", "#8a8068", "#a29a80", "#b6ae94", "#c8c0a6"],
  roofs: [
    ["#7c2c24", "#a83c2e", "#c85a40"],
    ["#34405a", "#4a5a7a", "#6a7c9c"],
    ["#5e3a24", "#7e5032", "#a06a44"],
    ["#2e5a54", "#3e7a70", "#5a9a8c"],
  ],
  runway: ["#4a4a4e", "#5e5e62", "#727276", "#88888c", "#a0a0a4"],
};
export const DEEP_SEA_CSS = PALETTE.sea[4];

const SEA = ramp(...PALETTE.sea);
const FOAM = rgba(PALETTE.foam);
const SURF = rgba(PALETTE.surf);
const LAKE = PALETTE.lake.map(rgba);
const GRASS = ramp(...PALETTE.grass);
const MEADOW = ramp(...PALETTE.meadow);
const FOREST = ramp(...PALETTE.forest);
const FARMS = [ramp(...PALETTE.farmGold), ramp(...PALETTE.farmGreen), ramp(...PALETTE.farmBrown)];
const WETLAND = ramp(...PALETTE.wetland);
const SAND = ramp(...PALETTE.sand);
const ROCK = ramp(...PALETTE.rock);
const SNOW = ramp(...PALETTE.snow);
const TOWN_GROUND = ramp(...PALETTE.townGround);
const ROOFS = PALETTE.roofs.map((r) => r.map(rgba));
const RUNWAY = ramp(...PALETTE.runway);

// What each cell is drawn as, after shore, altitude and unmapped-land rules are applied.
const M = { Sea: 0, Lake: 1, Grass: 2, Meadow: 3, Forest: 4, Farm: 5, Wetland: 6, Sand: 7, Rock: 8, Snow: 9, Town: 10, Runway: 11 } as const;

const TREE_LINE = 1050; // m; alpine rock above, with a noisy edge
const SNOW_LINE = 1550;
const HILLSHADE_GAIN = 2.6; // slope → shade; island slopes are gentle at 40 m cells

// 4×4 ordered-dither thresholds in (0, 1).
const BAYER = Float32Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], (v) => (v + 0.5) / 16);

// Deterministic per-cell hash in [0, 1).
function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Smooth value noise sampled from a precomputed lattice (one hash per lattice point, not per cell).
function noiseField(w: number, h: number, spacing: number, seed: number) {
  const gw = Math.ceil(w / spacing) + 2;
  const gh = Math.ceil(h / spacing) + 2;
  const lattice = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) lattice[y * gw + x] = hash(x, y, seed);
  return (r: number, c: number) => {
    const x = c / spacing;
    const y = r / spacing;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const k = yi * gw + xi;
    const a = lattice[k]!;
    const b = lattice[k + 1]!;
    const c0 = lattice[k + gw]!;
    const d = lattice[k + gw + 1]!;
    return a + (b - a) * sx + (c0 - a) * sy + (a - b - c0 + d) * sx * sy;
  };
}

function fbmField(w: number, h: number, seed: number) {
  const coarse = noiseField(w, h, 28, seed);
  const fine = noiseField(w, h, 9, seed + 1);
  return (r: number, c: number) => 0.65 * coarse(r, c) + 0.35 * fine(r, c);
}

// Two-pass chamfer distance (in cells) from every cell to the nearest cell where mask is 1.
// Works on a grid padded by one cell so the inner loops need no edge checks.
function distanceTo(mask: Uint8Array, w: number, h: number): Float32Array {
  const pw = w + 2;
  const d = new Float32Array(pw * (h + 2)).fill(1e9);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) if (mask[r * w + c]) d[(r + 1) * pw + c + 1] = 0;
  }
  const D = Math.SQRT2;
  for (let r = 1; r <= h; r++) {
    for (let i = r * pw + 1, end = i + w; i < end; i++) {
      let v = d[i]!;
      if (v === 0) continue;
      let t = d[i - 1]! + 1;
      if (t < v) v = t;
      t = d[i - pw]! + 1;
      if (t < v) v = t;
      t = d[i - pw - 1]! + D;
      if (t < v) v = t;
      t = d[i - pw + 1]! + D;
      if (t < v) v = t;
      d[i] = v;
    }
  }
  for (let r = h; r >= 1; r--) {
    for (let i = r * pw + w, end = r * pw; i > end; i--) {
      let v = d[i]!;
      if (v === 0) continue;
      let t = d[i + 1]! + 1;
      if (t < v) v = t;
      t = d[i + pw]! + 1;
      if (t < v) v = t;
      t = d[i + pw + 1]! + D;
      if (t < v) v = t;
      t = d[i + pw - 1]! + D;
      if (t < v) v = t;
      d[i] = v;
    }
  }
  const out = new Float32Array(w * h);
  for (let r = 0; r < h; r++) out.set(d.subarray((r + 1) * pw + 1, (r + 1) * pw + 1 + w), r * w);
  return out;
}

// 3×3 box blur, so hillshade reads landforms rather than DEM noise.
function blur3(src: Float32Array, w: number, h: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      tmp[i] = (src[c > 0 ? i - 1 : i]! + src[i]! + src[c < w - 1 ? i + 1 : i]!) / 3;
    }
  }
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      out[i] = (tmp[r > 0 ? i - w : i]! + tmp[i]! + tmp[r < h - 1 ? i + w : i]!) / 3;
    }
  }
  return out;
}

const clampIdx = (v: number) => (v < 0 ? 0 : v > 4 ? 4 : v);
// Ramp index for a hillshade value in [-1, 1], dithered between neighboring shades.
const lit = (shade: number, gain: number, dither: number) => clampIdx(Math.floor(2 + shade * 2 * gain + dither));

// Rows of context a band needs on each side. Sea shading saturates ~26 cells from shore, and
// capped distances computed inside a band match the full grid out to the margin.
export const BAND_MARGIN = 40;

export type PaintJob = {
  cells: PixelMapCells; // rows [rowOffset, rowOffset + cells.height) of the full grid
  cellMeters: number;
  rowOffset: number;
  totalHeight: number; // full grid height; patterns are keyed on absolute rows so bands line up
  from: number; // absolute rows to paint: [from, to)
  to: number;
};

export function paintCells(cells: PixelMapCells, cellMeters: number): Uint8ClampedArray<ArrayBuffer> {
  return paintRows({ cells, cellMeters, rowOffset: 0, totalHeight: cells.height, from: 0, to: cells.height });
}

// Paints rows [from, to) as RGBA. `cells` should extend BAND_MARGIN rows past them where it can.
export function paintRows({ cells, cellMeters, rowOffset, totalHeight, from, to }: PaintJob): Uint8ClampedArray<ArrayBuffer> {
  const { width: w, height: h, surface, elevation } = cells;
  const n = w * h;

  const meters = Float32Array.from({ length: 256 }, (_, b) => decodeElevation(b));
  const rawElev = new Float32Array(n);
  for (let i = 0; i < n; i++) rawElev[i] = meters[elevation[i]!]!;
  const elev = blur3(rawElev, w, h);

  const landMask = new Uint8Array(n);
  const seaMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    landMask[i] = isWater(surface[i]!) ? 0 : 1;
    seaMask[i] = surface[i] === Surface.Sea ? 1 : 0;
  }
  const fromLand = distanceTo(landMask, w, h); // water cells: distance to shore
  const fromSea = distanceTo(seaMask, w, h); // land cells: distance to the sea

  const forestNoise = fbmField(w, totalHeight, 5);
  const alpineNoise = fbmField(w, totalHeight, 11);
  const trees = treeCenters(w, totalHeight);
  const waves = waveCrests(w, totalHeight);

  // ---- Pass 1: material per cell ----
  const material = new Uint8Array(n);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      const s = surface[i]!;
      if (s === Surface.Sea) {
        material[i] = M.Sea;
        continue;
      }
      if (s === Surface.Lake || s === Surface.River) {
        material[i] = M.Lake;
        continue;
      }
      const e = rawElev[i]!;
      const built = s === Surface.Town || s === Surface.Runway;
      const natural = !built && s !== Surface.Farmland;
      if (natural && e > TREE_LINE - 200) {
        const jitter = (alpineNoise(r + rowOffset, c) - 0.5) * 300;
        if (e > SNOW_LINE + jitter) {
          material[i] = M.Snow;
          continue;
        }
        if (e > TREE_LINE + jitter) {
          material[i] = M.Rock;
          continue;
        }
      }
      // Shore rim: beaches on low shores, rock on steep ones.
      const sd = fromSea[i]!;
      if (!built && (sd < 1.5 || (sd < 2.5 && e < 4))) {
        material[i] = e < 12 ? M.Sand : M.Rock;
        continue;
      }
      switch (s) {
        case Surface.Land:
          // Unmapped land: mostly forest in the PNW, with clearings; more forest uphill.
          material[i] = forestNoise(r + rowOffset, c) + e / 500 > 0.5 ? M.Forest : M.Grass;
          break;
        case Surface.Grass:
          material[i] = M.Meadow;
          break;
        case Surface.Wood:
          material[i] = M.Forest;
          break;
        case Surface.Farmland:
          material[i] = M.Farm;
          break;
        case Surface.Wetland:
          material[i] = M.Wetland;
          break;
        case Surface.Sand:
          material[i] = M.Sand;
          break;
        case Surface.Rock:
          material[i] = M.Rock;
          break;
        case Surface.Town:
          material[i] = M.Town;
          break;
        default:
          material[i] = M.Runway;
      }
    }
  }

  // ---- Pass 2: color (r is the local row, R the absolute one) ----
  const out = new Uint32Array((to - from) * w);
  const slopeScale = HILLSHADE_GAIN / (2 * cellMeters);
  for (let r = from - rowOffset; r < to - rowOffset; r++) {
    const R = r + rowOffset;
    const o = (R - from) * w;
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      const m = material[i]!;
      const dither = BAYER[((R & 3) << 2) | (c & 3)]!;
      const noise = hash(c, R, 1);

      if (m === M.Sea) {
        const d = fromLand[i]!;
        if (d < 1.5) out[o + c] = dither < 0.7 ? FOAM : SURF;
        else if (d < 2.5) out[o + c] = SURF;
        else {
          let idx = clampIdx(Math.floor(Math.log2(d) - 0.7 + dither));
          if (d >= 8 && waves(R, c)) idx = Math.max(0, idx - 2);
          out[o + c] = SEA[idx]!;
        }
        continue;
      }
      if (m === M.Lake) {
        out[o + c] = fromLand[i]! < 1.5 ? LAKE[0]! : noise < 0.03 ? LAKE[2]! : LAKE[1]!;
        continue;
      }

      // Light from the NW: slopes facing up-left (terrain rising to the SE) are lit.
      const right = c < w - 1 ? i + 1 : i;
      const left = c > 0 ? i - 1 : i;
      const below = r < h - 1 ? i + w : i;
      const above = r > 0 ? i - w : i;
      let shade = (elev[right]! - elev[left]! + elev[below]! - elev[above]!) * slopeScale;
      shade = shade > 1 ? 1 : shade < -1 ? -1 : shade;

      switch (m) {
        case M.Forest:
          out[o + c] = FOREST[clampIdx(lit(shade, 1.4, dither) + trees(R, c))]!;
          break;
        case M.Grass:
        case M.Meadow: {
          const tones = m === M.Grass ? GRASS : MEADOW;
          let idx = lit(shade, 1, dither);
          if (noise < 0.06) idx++;
          else if (noise < 0.1) idx--;
          if (r > 0 && material[i - w] === M.Forest) idx--; // trees cast a shadow south
          out[o + c] = tones[clampIdx(idx)]!;
          break;
        }
        case M.Farm: {
          out[o + c] = farmColor(R, c, lit(shade, 0.5, dither), material[above] === M.Forest);
          break;
        }
        case M.Wetland:
          out[o + c] = noise < 0.05 ? LAKE[1]! : WETLAND[clampIdx(lit(shade, 0.7, dither) + (noise < 0.25 ? 1 : 0))]!;
          break;
        case M.Sand:
          out[o + c] = SAND[clampIdx(lit(shade, 0.8, dither) - (noise < 0.1 ? 1 : 0))]!;
          break;
        case M.Rock:
          out[o + c] = ROCK[clampIdx(lit(shade, 1.2, dither) + (noise < 0.12 ? -1 : noise < 0.22 ? 1 : 0))]!;
          break;
        case M.Snow:
          out[o + c] = SNOW[lit(shade, 1.2, dither)]!;
          break;
        case M.Town:
          out[o + c] = townColor(R, c, noise);
          break;
        default:
          out[o + c] = RUNWAY[clampIdx(2 + ((R + c) % 6 === 0 ? 1 : 0))]!;
      }
    }
  }
  return new Uint8ClampedArray(out.buffer);
}

// Sparse "^" wave crests on a jittered 12×8 grid in open water.
function waveCrests(w: number, h: number) {
  const bw = Math.ceil(w / 12);
  const bh = Math.ceil(h / 8);
  const ox = new Int8Array(bw * bh).fill(-1); // -1: no crest in this block
  const oy = new Int8Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      if (hash(bx, by, 3) > 0.45) continue;
      ox[by * bw + bx] = 1 + Math.floor(hash(bx, by, 4) * 8);
      oy[by * bw + bx] = 1 + Math.floor(hash(bx, by, 5) * 6);
    }
  }
  return (r: number, c: number) => {
    const bx = Math.floor(c / 12);
    const by = Math.floor(r / 8);
    const x = ox[by * bw + bx]!;
    if (x < 0) return false;
    const y = oy[by * bw + bx]!;
    const lc = c - bx * 12;
    const lr = r - by * 8;
    return (lr === y && (lc === x || lc === x + 2)) || (lr === y - 1 && lc === x + 1);
  };
}

// Canopy: trees on a jittered 3-cell grid. Up-left of a crown is lit, down-right is shaded,
// and gaps between crowns are dark. Returns a ramp offset.
function treeCenters(w: number, h: number) {
  const bw = Math.ceil(w / 3) + 2; // one block of padding on each side
  const bh = Math.ceil(h / 3) + 2;
  const cx = new Int32Array(bw * bh);
  const cy = new Int32Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      cx[by * bw + bx] = (bx - 1) * 3 + Math.floor(hash(bx, by, 21) * 3);
      cy[by * bw + bx] = (by - 1) * 3 + Math.floor(hash(bx, by, 22) * 3);
    }
  }
  return (r: number, c: number) => {
    const bx = Math.floor(c / 3) + 1;
    const by = Math.floor(r / 3) + 1;
    let best = Infinity;
    let vx = 0;
    let vy = 0;
    for (let k = (by - 1) * bw + bx - 1, dy = 0; dy < 3; dy++, k += bw - 3) {
      for (let dx = 0; dx < 3; dx++, k++) {
        const ux = c - cx[k]!;
        const uy = r - cy[k]!;
        const d = ux * ux + uy * uy;
        if (d < best) {
          best = d;
          vx = ux;
          vy = uy;
        }
      }
    }
    if (best > 2) return -2;
    return vx + vy < 0 ? 1 : vx + vy > 0 ? -1 : 0;
  };
}

// Patchwork fields: 16×12 blocks, some split in two, with hedgerows between fields and crop
// rows running across or along each field.
function farmColor(r: number, c: number, idx: number, shadedByTrees: boolean): number {
  const bx = Math.floor(c / 16);
  const by = Math.floor(r / 12);
  const lc = c - bx * 16;
  const lr = r - by * 12;
  const hedge = GRASS[clampIdx(idx - 1)]!;
  if (lr === 0 || lc === 0) return hedge;
  let field = 0;
  const split = hash(bx, by, 31);
  if (split < 0.4) {
    const at = 5 + Math.floor(hash(bx, by, 32) * 7);
    if (lc === at) return hedge;
    field = lc > at ? 1 : 0;
  } else if (split < 0.75) {
    const at = 4 + Math.floor(hash(bx, by, 33) * 5);
    if (lr === at) return hedge;
    field = lr > at ? 1 : 0;
  }
  const id = bx * 2 + field;
  const pick = hash(id, by, 34);
  const tones = FARMS[pick < 0.45 ? 0 : pick < 0.85 ? 1 : 2]!;
  const row = hash(id, by, 35) < 0.5 ? r & 1 : c & 1;
  return tones[clampIdx(idx + (row ? 0 : 1) - (shadedByTrees ? 1 : 0))]!;
}

// Houses on a 4-cell grid: a 2×2 roof (lit top-left) with a shadow down-right.
function townColor(r: number, c: number, noise: number): number {
  const bx = Math.floor(c / 4);
  const by = Math.floor(r / 4);
  const ground = TOWN_GROUND[noise < 0.08 ? 1 : 2]!;
  if (hash(bx, by, 41) < 0.28) return ground;
  const ox = Math.floor(hash(bx, by, 42) * 2);
  const oy = Math.floor(hash(bx, by, 43) * 2);
  const lc = c - bx * 4 - ox;
  const lr = r - by * 4 - oy;
  if (lc >= 0 && lc <= 1 && lr >= 0 && lr <= 1) {
    const pick = hash(bx, by, 44); // mostly red and brown roofs, some slate and teal
    const roof = ROOFS[pick < 0.4 ? 0 : pick < 0.7 ? 2 : pick < 0.9 ? 1 : 3]!;
    return roof[2 - lc - lr]!;
  }
  if ((lr === 2 && lc >= 1 && lc <= 2) || (lc === 2 && lr === 1)) return TOWN_GROUND[0]!;
  return ground;
}

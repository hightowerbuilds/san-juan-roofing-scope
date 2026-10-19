// Things drawn on top of the painted terrain:
//   paintRoutes: highways and ferry routes, baked into the terrain canvas at one pixel per cell
//   buildLabels/drawLabels: place names and markers, drawn per frame in screen space so text
//     stays crisp at every zoom, with greedy collision culling by priority

import type { LonLat, PixelMapMeta } from "../../shared/pixelMap";

export const LABEL_FONT = "Pixelify Sans";

const toCells = (meta: PixelMapMeta) => {
  const { west, east, north, south } = meta.bbox;
  return ([lon, lat]: LonLat): [number, number] => [
    ((lon - west) / (east - west)) * meta.width,
    ((north - lat) / (north - south)) * meta.height,
  ];
};

// Visits the cells along a polyline (Bresenham, 8-connected).
function walkCells(path: [number, number][], visit: (c: number, r: number) => void) {
  for (let i = 1; i < path.length; i++) {
    let c = Math.floor(path[i - 1]![0]);
    let r = Math.floor(path[i - 1]![1]);
    const c1 = Math.floor(path[i]![0]);
    const r1 = Math.floor(path[i]![1]);
    const dc = Math.abs(c1 - c);
    const dr = -Math.abs(r1 - r);
    const sc = c < c1 ? 1 : -1;
    const sr = r < r1 ? 1 : -1;
    let err = dc + dr;
    for (;;) {
      visit(c, r);
      if (c === c1 && r === r1) break;
      const e2 = 2 * err;
      if (e2 >= dr) {
        err += dr;
        c += sc;
      }
      if (e2 <= dc) {
        err += dc;
        r += sr;
      }
    }
  }
}

const ROAD_COLORS: Record<string, string> = { motorway: "#efe2b4", trunk: "#e6d6a4", primary: "#dccb98" };
const FERRY = "#fff6d0";
const FERRY_SHADOW = "#0e2456";
const DASH = 6; // cells per dash cycle
const DASH_ON = 3;

export function paintRoutes(ctx: CanvasRenderingContext2D, meta: PixelMapMeta) {
  const { width: w, height: h } = meta;
  const cell = toCells(meta);
  const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < w && r < h;

  for (const { kind, path } of meta.roads) {
    const color = ROAD_COLORS[kind];
    if (!color) continue;
    ctx.fillStyle = color;
    walkCells(path.map(cell), (c, r) => inside(c, r) && ctx.fillRect(c, r, 1, 1));
  }

  // Rasterize every ferry route into one set of cells, then dash by distance along that network
  // (BFS from its loose ends) so routes sharing water share the same dashes.
  const cells = new Set<number>();
  for (const { path } of meta.ferries) walkCells(path.map(cell), (c, r) => inside(c, r) && cells.add(r * w + c));
  const neighbors = (i: number) => {
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const j = i + dr * w + dc;
        if ((dr || dc) && cells.has(j)) out.push(j);
      }
    }
    return out;
  };
  const dist = new Map<number, number>();
  const queue: number[] = [];
  const seed = (i: number) => {
    dist.set(i, 0);
    queue.push(i);
  };
  for (const i of cells) if (neighbors(i).length <= 1) seed(i);
  for (let head = 0; ; ) {
    while (head < queue.length) {
      const i = queue[head++]!;
      for (const j of neighbors(i)) {
        if (!dist.has(j)) {
          dist.set(j, dist.get(i)! + 1);
          queue.push(j);
        }
      }
    }
    const loop = [...cells].find((i) => !dist.has(i)); // a closed loop has no loose end
    if (loop === undefined) break;
    seed(loop);
  }
  const dashes = [...dist].filter(([, d]) => d % DASH < DASH_ON).map(([i]) => i);
  ctx.fillStyle = FERRY_SHADOW;
  for (const i of dashes) if (!cells.has(i + w + 1)) ctx.fillRect((i % w) + 1, Math.floor(i / w) + 1, 1, 1);
  ctx.fillStyle = FERRY;
  for (const i of dashes) ctx.fillRect(i % w, Math.floor(i / w), 1, 1);
}

// ---- Labels ----

type Style = "town" | "village" | "hamlet" | "island" | "peak";

export type Label = {
  text: string;
  x: number; // cell coordinates
  y: number;
  style: Style;
  minCssPerCell: number; // shown once the map is at least this zoomed in
};

// San Juan County's own towns lead, whatever their OSM class.
const FEATURED = new Set(["Friday Harbor", "Eastsound", "Lopez Village"]);

const STYLES: Record<Style, { size: number; color: string; marker: "house" | "dot" | "peak" | null; caps?: boolean }> = {
  town: { size: 16, color: "#ffffff", marker: "house" },
  village: { size: 14, color: "#f4f0e4", marker: "dot" },
  hamlet: { size: 12, color: "#e4e0d4", marker: "dot" },
  island: { size: 14, color: "#fff0a8", marker: null, caps: true },
  peak: { size: 12, color: "#efe4cc", marker: "peak" },
};
const OUTLINE = "#0b1530";

// Builds labels in priority order (earlier ones win collisions).
export function buildLabels(meta: PixelMapMeta): Label[] {
  const cell = toCells(meta);
  const ranked: (Label & { priority: number; order: number })[] = [];
  for (const p of meta.places) {
    const text = p.name.split(",")[0]!.trim(); // "Dewey, Skagit County, Washington" → "Dewey"
    const [x, y] = cell([p.lon, p.lat]);
    const add = (style: Style, priority: number, minCssPerCell: number, order = p.rank) =>
      ranked.push({ text, x, y, style, minCssPerCell, priority, order });
    if (FEATURED.has(text)) add("town", 0, 0);
    else if (p.kind === "city") add("town", 1, 0);
    else if (p.kind === "town") add("town", 2, 0);
    else if (p.kind === "island") {
      if (p.rank <= 2) add("island", 3, 0);
      else if (p.rank <= 4) add("island", 5, 0.45);
      else add("island", 8, 1.4);
    } else if (p.kind === "village" || p.kind === "suburb") add("village", 4, 0.45);
    else if (p.kind === "peak") add("peak", (p.ele ?? 0) >= 400 ? 6 : 9, (p.ele ?? 0) >= 400 ? 0.9 : 2, -(p.ele ?? 0));
    else if (p.kind === "hamlet") add("hamlet", p.rank <= 12 ? 7 : 10, p.rank <= 12 ? 0.9 : 2);
  }
  ranked.sort((a, b) => a.priority - b.priority || a.order - b.order);
  return ranked.map(({ text, x, y, style, minCssPerCell }) => ({ text, x, y, style, minCssPerCell }));
}

// Each label's outlined text is rendered once per device-pixel ratio and reused every frame.
const sprites = new Map<string, HTMLCanvasElement>();
export const clearLabelSprites = () => sprites.clear();

function sprite(label: Label, dpr: number): HTMLCanvasElement {
  const key = `${label.style}|${label.text}|${dpr}`;
  const cached = sprites.get(key);
  if (cached) return cached;
  const style = STYLES[label.style];
  const text = style.caps ? label.text.toUpperCase() : label.text;
  const px = Math.round(style.size * dpr);
  const pad = Math.ceil(dpr);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `600 ${px}px "${LABEL_FONT}", ui-monospace, monospace`;
  ctx.font = font;
  if (style.caps) ctx.letterSpacing = `${Math.round(dpr)}px`;
  canvas.width = Math.ceil(ctx.measureText(text).width) + pad * 2 + Math.round(dpr);
  canvas.height = Math.ceil(px * 1.25) + pad * 2;
  ctx.font = font; // resizing resets context state
  if (style.caps) ctx.letterSpacing = `${Math.round(dpr)}px`;
  ctx.textBaseline = "top";
  // A hard 1-pixel outline (8 offsets) reads like SNES map text better than a soft stroke.
  ctx.fillStyle = OUTLINE;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if (dx || dy) ctx.fillText(text, pad + dx * pad, pad + dy * pad);
  }
  ctx.fillStyle = style.color;
  ctx.fillText(text, pad, pad);
  sprites.set(key, canvas);
  return canvas;
}

function drawMarker(ctx: CanvasRenderingContext2D, kind: "house" | "dot" | "peak", x: number, y: number, u: number) {
  const box = (bx: number, by: number, bw: number, bh: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x + bx * u), Math.round(y + by * u), Math.round(bw * u), Math.round(bh * u));
  };
  if (kind === "house") {
    box(-4, -4, 8, 8, OUTLINE);
    box(-3, -3, 6, 6, "#d8442e");
    box(-3, -3, 3, 2, "#f07a52");
  } else if (kind === "dot") {
    box(-3, -3, 6, 6, OUTLINE);
    box(-2, -2, 4, 4, "#f4e6b8");
  } else {
    // Stepped triangle with a snowy tip.
    box(-1, -4, 2, 1, OUTLINE);
    box(-2, -3, 4, 1, OUTLINE);
    box(-3, -2, 6, 1, OUTLINE);
    box(-4, -1, 8, 2, OUTLINE);
    box(-1, -3, 2, 1, "#ffffff");
    box(-2, -2, 4, 1, "#b8aa98");
    box(-3, -1, 6, 1, "#8e8070");
  }
}

export type View = { ox: number; oy: number; scale: number; dpr: number; width: number; height: number };

export function drawLabels(ctx: CanvasRenderingContext2D, labels: Label[], view: View) {
  const { ox, oy, scale, dpr, width, height } = view;
  const cssPerCell = scale / dpr;
  const placed: [number, number, number, number][] = [];
  const gap = 3 * dpr;
  const free = (x: number, y: number, w: number, h: number) =>
    x >= 0 && y >= 0 && x + w <= width && y + h <= height &&
    !placed.some(([px, py, pw, ph]) => x < px + pw + gap && x + w + gap > px && y < py + ph + gap && y + h + gap > py);

  ctx.imageSmoothingEnabled = false;
  const unit = Math.max(1, Math.round(dpr * 1.25)); // marker pixel size, whole device pixels
  for (const label of labels) {
    if (label.minCssPerCell > cssPerCell) continue;
    const sx = ox + label.x * scale;
    const sy = oy + label.y * scale;
    if (sx < -200 * dpr || sy < -50 * dpr || sx > width + 200 * dpr || sy > height + 50 * dpr) continue;
    const marker = STYLES[label.style].marker;
    const img = sprite(label, dpr);
    const m = 5 * unit; // marker half-size plus breathing room
    const candidates: [number, number][] = marker
      ? [
          [sx + m, sy - img.height / 2],
          [sx - m - img.width, sy - img.height / 2],
          [sx - img.width / 2, sy - m - img.height],
          [sx - img.width / 2, sy + m],
        ]
      : [[sx - img.width / 2, sy - img.height / 2]];
    const markerBox: [number, number, number, number] = [sx - m, sy - m, 2 * m, 2 * m];
    if (marker && !free(...markerBox)) continue;
    const spot = candidates.find(([x, y]) => free(x, y, img.width, img.height));
    if (!spot) continue;
    const [x, y] = [Math.round(spot[0]), Math.round(spot[1])];
    placed.push([x, y, img.width, img.height]);
    if (marker) {
      placed.push(markerBox);
      drawMarker(ctx, marker, Math.round(sx), Math.round(sy), unit);
    }
    ctx.drawImage(img, x, y);
  }
}

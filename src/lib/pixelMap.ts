import { queryOptions } from "@tanstack/solid-query";
import { decodeCells, decodeElevation, isWater, Surface, type PixelMapCells, type PixelMapMeta } from "../../shared/pixelMap";

async function fetchCells(): Promise<PixelMapCells> {
  const res = await fetch("/pixel-map/cells.bin");
  if (!res.ok) throw new Error(`Map data failed to load (${res.status})`);
  let bytes = new Uint8Array(await res.arrayBuffer());
  // The file is gzip. A server that labels it Content-Encoding: gzip will have inflated it already.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return decodeCells(bytes);
}

async function fetchMeta(): Promise<PixelMapMeta> {
  const res = await fetch("/pixel-map/meta.json");
  if (!res.ok) throw new Error(`Map data failed to load (${res.status})`);
  return res.json();
}

export const pixelMapQuery = queryOptions({
  queryKey: ["pixel-map"],
  queryFn: async () => {
    const [cells, meta] = await Promise.all([fetchCells(), fetchMeta()]);
    return { cells, meta };
  },
  staleTime: Infinity,
  gcTime: Infinity,
});

const rgb = (r: number, g: number, b: number) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;

// Placeholder palette until the art pass.
const COLORS: Record<number, [number, number, number]> = {
  [Surface.Sea]: [30, 79, 140],
  [Surface.Lake]: [70, 140, 210],
  [Surface.River]: [70, 140, 210],
  [Surface.Land]: [150, 180, 90],
  [Surface.Farmland]: [200, 200, 110],
  [Surface.Grass]: [130, 190, 90],
  [Surface.Wood]: [50, 120, 60],
  [Surface.Wetland]: [110, 150, 120],
  [Surface.Sand]: [230, 215, 150],
  [Surface.Rock]: [150, 140, 130],
  [Surface.Town]: [190, 120, 100],
  [Surface.Runway]: [90, 90, 90],
};
export const SEA_CSS = `rgb(${COLORS[Surface.Sea]!.join(" ")})`;

const painted = new WeakMap<PixelMapCells, HTMLCanvasElement>();

// Paints the cell grid onto a canvas at one pixel per cell. Done once per load; the viewer scales it.
export function paintTerrain(cells: PixelMapCells, cellMeters: number): HTMLCanvasElement {
  const cached = painted.get(cells);
  if (cached) return cached;
  const { width: w, height: h, surface, elevation } = cells;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(w, h);
  const out = new Uint32Array(image.data.buffer); // RGBA bytes read as little-endian ABGR words
  const meters = Float32Array.from({ length: 256 }, (_, b) => decodeElevation(b));

  for (let r = 0; r < h; r++) {
    const up = Math.max(0, r - 1) * w;
    const down = Math.min(h - 1, r + 1) * w;
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      const s = surface[i]!;
      const [cr, cg, cb] = COLORS[s]!;
      if (isWater(s)) {
        out[i] = rgb(cr, cg, cb);
        continue;
      }
      // Light from the NW: slopes facing up and left are brighter.
      const dzdx = (meters[elevation[r * w + Math.min(w - 1, c + 1)]!]! - meters[elevation[r * w + Math.max(0, c - 1)]!]!) / (2 * cellMeters);
      const dzdy = (meters[elevation[down + c]!]! - meters[elevation[up + c]!]!) / (2 * cellMeters);
      const shade = Math.max(0.55, Math.min(1.35, 1 - (dzdx + dzdy) * 1.2));
      out[i] = rgb(Math.min(255, cr * shade), Math.min(255, cg * shade), Math.min(255, cb * shade));
    }
  }
  ctx.putImageData(image, 0, 0);
  painted.set(cells, canvas);
  return canvas;
}

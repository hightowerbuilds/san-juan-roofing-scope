import { queryOptions } from "@tanstack/solid-query";
import { decodeCells, type PixelMapCells, type PixelMapMeta } from "../../shared/pixelMap";
import { paintRoutes } from "./mapOverlays";
import { BAND_MARGIN, type PaintJob } from "./pixelArt";

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
    const terrain = await paintTerrain(cells, meta);
    return { cells, meta, terrain };
  },
  staleTime: Infinity,
  gcTime: Infinity, // keep the painted terrain for revisits
});

// Paints the cell grid onto a canvas at one pixel per cell, in parallel horizontal bands, then
// bakes in highways and ferry routes.
async function paintTerrain(cells: PixelMapCells, meta: PixelMapMeta): Promise<HTMLCanvasElement> {
  const { width: w, height: h } = cells;
  const bands = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1));
  const bandHeight = Math.ceil(h / bands);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  await Promise.all(
    Array.from({ length: bands }, (_, b) => {
      const from = b * bandHeight;
      const to = Math.min(h, from + bandHeight);
      const r0 = Math.max(0, from - BAND_MARGIN);
      const r1 = Math.min(h, to + BAND_MARGIN);
      // Copy just this band's rows (with margin) so the worker gets its own small buffers.
      const job: PaintJob = {
        cells: {
          width: w,
          height: r1 - r0,
          surface: cells.surface.slice(r0 * w, r1 * w),
          elevation: cells.elevation.slice(r0 * w, r1 * w),
        },
        cellMeters: meta.cellMeters,
        rowOffset: r0,
        totalHeight: h,
        from,
        to,
      };
      return new Promise<void>((resolve, reject) => {
        const worker = new Worker(new URL("./paintWorker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (e: MessageEvent<Uint8ClampedArray<ArrayBuffer>>) => {
          ctx.putImageData(new ImageData(e.data, w, to - from), 0, from);
          worker.terminate();
          resolve();
        };
        worker.onerror = (e) => {
          worker.terminate();
          reject(new Error(e.message || "Map painting failed"));
        };
        worker.postMessage(job, [job.cells.surface.buffer, job.cells.elevation.buffer]);
      });
    }),
  );
  paintRoutes(ctx, meta);
  return canvas;
}

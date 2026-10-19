// Data format for the pixel map, shared by scripts/build-pixel-map.ts (writer) and the client (reader).
//
// public/pixel-map/cells.bin is gzip of:
//   header  "SJPM" | u8 version | u8 reserved | u16le width | u16le height
//   plane 1 width*height bytes: surface class (Surface below), row-major from the NW corner
//   plane 2 width*height bytes: land elevation, square-root encoded (see encodeElevation; 0 for water)

export const FORMAT_VERSION = 1;
export const HEADER_BYTES = 10;
// Square-root encoding keeps ~1–4 m steps on the low islands and still reaches the Olympics.
export const ELEV_MAX = 2400;
export const encodeElevation = (meters: number) =>
  Math.round(Math.sqrt(Math.min(ELEV_MAX, Math.max(0, meters)) / ELEV_MAX) * 255);
export const decodeElevation = (byte: number) => (byte / 255) ** 2 * ELEV_MAX;

export const Surface = {
  Sea: 0,
  Lake: 1,
  River: 2,
  Land: 3, // land with no mapped cover
  Farmland: 4,
  Grass: 5,
  Wood: 6,
  Wetland: 7,
  Sand: 8,
  Rock: 9,
  Town: 10,
  Runway: 11,
} as const;
export type Surface = (typeof Surface)[keyof typeof Surface];

export const isWater = (s: number) => s <= Surface.River;

export type LonLat = [lon: number, lat: number];

export type PixelMapPlace = {
  name: string;
  kind: string; // OpenMapTiles place class: city, town, village, hamlet, island, islet, ...
  rank: number; // lower is more important
  ele?: number; // meters, peaks only
  lon: number;
  lat: number;
};

export type PixelMapMeta = {
  version: number;
  generated: string;
  bbox: { west: number; east: number; north: number; south: number };
  cellMeters: number;
  width: number;
  height: number;
  elevMax: number;
  places: PixelMapPlace[];
  ferries: { name: string; path: LonLat[] }[]; // name is empty for a few unnamed local runs
  roads: { kind: string; path: LonLat[] }[];
  attribution: string[];
};

export type PixelMapCells = { width: number; height: number; surface: Uint8Array; elevation: Uint8Array };

export function encodeCells({ width, height, surface, elevation }: PixelMapCells): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(HEADER_BYTES + width * height * 2);
  out.set([0x53, 0x4a, 0x50, 0x4d, FORMAT_VERSION, 0]); // "SJPM"
  const view = new DataView(out.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  out.set(surface, HEADER_BYTES);
  out.set(elevation, HEADER_BYTES + width * height);
  return out;
}

export function decodeCells(bytes: Uint8Array): PixelMapCells {
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== "SJPM") throw new Error("Not a pixel map file");
  if (bytes[4] !== FORMAT_VERSION) throw new Error(`Unsupported pixel map version ${bytes[4]}`);
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  const n = width * height;
  return {
    width,
    height,
    surface: bytes.subarray(HEADER_BYTES, HEADER_BYTES + n),
    elevation: bytes.subarray(HEADER_BYTES + n, HEADER_BYTES + 2 * n),
  };
}

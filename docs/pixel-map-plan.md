# Pixel map plan

A large, pixel-art, video-game-style map of the San Juans drawn on `<canvas>`. Coverage runs from
Haro Strait east to Burlington and south past the tip of Whidbey Island. It should feel pixelated
but fine-grained: millions of small cells, not a chunky 100×100 grid.

## 1. Coverage and grid

| | value |
|---|---|
| West | −123.35° (Haro Strait, edge of the Saanich Peninsula) |
| East | −122.25° (Burlington, start of the Skagit foothills) |
| North | 48.82° (Patos/Sucia, Lummi Island, Chuckanut) |
| South | 47.88° (Possession Point, the south tip of Whidbey) |
| Size on the ground | ≈ 81 km × 105 km (portrait) |
| Projection | Equirectangular scaled by cos(48.35°), so cells are square in meters. Distortion over 1° is negligible. |
| Cell size | **40 m**, about **2030 × 2610 cells (≈ 5.3 M)**. One constant; 30 m (≈ 9.4 M cells) and 50 m (≈ 3.4 M) are options. |

Each cell is one "game pixel". At 40 m, small islands such as Sucia, Matia, Jones and the Wasps
still keep their shapes.

## 2. Data sources (checked 2026-10-19)

The three sources are all keyless and the site already uses them on `/areas`.

- **Coastline and land types: OpenFreeMap vector tiles** (OpenMapTiles schema, built from OSM).
  - `water` gives sea, lakes and the crisp coastline.
  - `landcover` gives wood, grass, wetland, sand and rock.
  - `landuse` gives residential and farmland (the Skagit flats).
  - `transportation` with class `ferry` gives the ferry routes.
  - `place` gives town names.
  - Tiles at z13, about 600 tiles, cached on disk and fetched once.
- **Elevation: AWS Terrarium DEM** at z12, used only for land height (hills, Mt Constitution at
  734 m, Mt Erie, Chuckanut) and hillshade.
  - *Finding:* the bathymetry in this DEM is smoothed and smeared. Channels read 0–3 m and blobby,
    so **it cannot define the coastline**. OSM water defines the coastline, and water depth bands
    come from the distance to shore.
- Attribution on the map: © OpenStreetMap contributors, © OpenMapTiles, Terrain: Mapzen/AWS.

## 3. Architecture

```
scripts/build-pixel-map.ts      (offline, run by hand like census-san-juan.ts)
  fetch + cache tiles → scripts/.cache/ (gitignored)
  decode MVT + Terrarium PNG
  rasterize polygons onto the cell grid, sample the DEM
  derive: distance-to-shore, hillshade, shore rim
  write ↓
public/pixel-map/cells.png      8-bit grayscale; each pixel is a terrain CLASS id (not a color)
public/pixel-map/meta.json      bbox, cell size, dims, places, ferry routes (lat/lon), attribution
scripts/.cache/preview.png      debug render, used for review only (not shipped)

src/components/PixelMap.tsx     loads cells.png → applies the palette → offscreen canvas (1 px per cell)
                                → draws the visible window to an on-screen canvas
                                with nearest-neighbor scaling, plus overlays
src/routes/MapPage.tsx          full-bleed page at /map, nav link "Map"
```

**Why store classes instead of colors:** palette and art changes then happen client-side and
need no regeneration. Large uniform regions compress well, so the PNG should be a few hundred KB.

**Terrain classes (draft):** deep water, mid water, shallow, surf/foam rim, lake, beach/rock shore,
farmland, grass, forest, dense forest, town, hill bands 1–3, peak. Hillshade is folded in as
light/normal/dark variants of each land class, using 2 bits of the byte.

## 4. Rendering

- **Crisp pixels:**
  - Size the canvas backing store by `devicePixelRatio`.
  - Set `imageSmoothingEnabled = false`.
  - Keep cell edges on whole device pixels.
- **Camera:** `{ centerX, centerY, scale }`.
  - Drag to pan, wheel and pinch to zoom around the cursor, `+`/`−` and arrow keys.
  - Clamp to the map bounds.
  - Zoom runs from "whole region fits" to about 16 device px per cell.
  - Redraw only on change, using `requestAnimationFrame`.
- **Overlays**, drawn on top in screen space so they stay sharp at every zoom:
  - ferry routes as dashed pixel lines
  - town markers with labels in a pixel font (Google Fonts *Silkscreen* or *Pixelify Sans*)
  - compass and scale bar
  - attribution
  - labels thin out by importance at low zoom
- **Performance:** one `drawImage` of the visible source rectangle per frame. The 5 M-cell
  palette pass runs once, on load.

## 5. Art direction

16-bit overworld style (SNES/GBA): a limited palette with 3–4 shades per material.

- Water is darker with distance from shore. There is a 1-cell light foam rim at the coast and
  ordered-dither transitions between depth bands.
- Shore: sand or rock rim, then grass and farmland, then forest. Hills step up through bands.
  Mt Constitution reads as a summit.
- NW-lit hillshade, quantized and dithered (no smooth gradients).
- Optional animation: a slow water shimmer that cycles a few sparkle pixels per frame, not a
  full-image repaint.

## 6. Phases

1. **Data pipeline.** Build the script, then `preview.png`. Check the coastline against reality:
   Deception Pass, Swinomish Channel, Mosquito Pass, and lakes on Orcas and Whidbey. Pick the final
   cell size (try 40 and 30 m) and check the file size.
2. **Viewer.** Build `PixelMap.tsx` and the `/map` route: load, palette, pan/zoom, retina crispness.
   Test performance on a laptop and a phone.
3. **Art pass.** Palette, dithering, hillshade, foam, forest texture. Iterate from screenshots.
4. **Overlays.** Towns, ferry routes, pixel font, compass, scale bar, attribution.
5. **Polish.**
   - water shimmer
   - loading state
   - keyboard and a11y (an aria label and a text list of places)
   - check `bun run build` and that the prod server serves `/pixel-map/*`
   - typecheck

## 7. Decisions (2026-10-19)

- **Placement:** a new `/map` page with a "Map" nav link. The MapLibre map on `/areas` stays.
- **Cell size:** 40 m.
- **Art style:** SNES overworld (A Link to the Past / Chrono Trigger).

## 8. Phase 1 results (2026-10-19)

- **Output size:**
  - Grid of 2032 × 2613 cells.
  - `cells.bin` is 1.25 MB gzipped, with planes for surface class and elevation.
  - `meta.json` is 260 KB: 403 places, 30 ferry paths, 1,243 road paths.
  - A full build takes about 45 s with no cache and about 6 s from cache.
- **Coastline checks** at 40 m all pass:
  - Deception Pass, including Pass Island and Canoe Pass
  - the Swinomish Channel past La Conner
  - Mosquito Pass and Henry Island
  - Marrowstone and Indian Islands
- **Elevation** is square-root encoded up to 2,400 m. A linear byte clipped the Olympics at 1,020 m.
  The new encoding gives about 1–4 m steps on the islands.
- **Land cover:** 28% of the land has no mapped cover. Most of it is on Whidbey and the Olympic
  foothills. The art pass needs a good default land treatment (elevation- and noise-driven
  grass/forest mix).
- **Ferries:** the layer includes long-haul routes such as the Victoria Clipper and the Alaska
  ferry. Filter or restyle them in the overlay phase.
- **Peaks:** OMT peak rank is flat at z13, so peaks carry `ele` and are ranked by height.

## 9. Phase 2 results (2026-10-19)

- **Route:** `/map` is full-bleed. A route `staticData.fullBleed` flag switches `<main>` out of
  `.wrap`, and the page fills the window between header and footer.
- **Data loading:** `pixelMapQuery` (TanStack Query) is prefetched by the route loader on link
  hover and cached forever. `cells.bin` is inflated with `DecompressionStream`, and the code
  handles servers that send it pre-inflated.
- **Camera:**
  - The canvas backing store is sized from `device-pixel-content-box`.
  - Zoom stops run fit → 0.5 → 1 → 2 → … 24 device px per cell. The origin snaps to whole device
    pixels, so cells are crisp at every stop from 1× up. Below 1×, smoothing is on to avoid
    dropping cells.
- **Input:**
  - Wheel and trackpad pinch zoom by stops around the cursor.
  - Drag pans with glide.
  - Two-finger pinch snaps to the nearest stop on release.
  - Arrow keys, `+`/`−` and `0` work.
- **Measured** on a 2× retina MacBook: cached fetch + decode 45 ms, terrain paint 135 ms on the
  main thread. If the art pass pushes painting past about 250 ms, move it to a Worker (build the
  RGBA buffer there and post it back as a transferable).
- **Not yet tested:** a real phone and touch pinch (the browser window here couldn't be resized
  to phone width).

## 10. Risks

- **OSM tile generalization at z13:** may smooth tiny islets. Fall back to z14 (≈ 2.4 k tiles)
  if the preview shows losses.
- **Polygon rasterization in the tiles:**
  - Tile buffers overlap, so clip each feature to its tile extent.
  - Rasterize with the even-odd rule so lakes and holes come out right.
- **New dev dependencies** for the build script only: `@mapbox/vector-tile`, `pbf`, and a PNG
  codec (`fast-png`). None of them ship to the client.

import { onCleanup, onMount } from "solid-js";
import { Map, NavigationControl, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre looks for its worker next to its own module, which doesn't survive bundling.
setWorkerUrl(workerUrl);

// Free, keyless sources: OpenFreeMap vector basemap (roads + labels), EOX Sentinel-2 Cloudless
// imagery, and AWS Open Data terrain (Terrarium-encoded DEM).
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// 2016 layer: CC BY 4.0 (2018+ are non-commercial; 2017 serves only a placeholder mask here).
const SATELLITE_TILES = ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"];
const SATELLITE_ATTRIBUTION =
  '<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless by EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2016)';
const DEM_TILES = ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"];
const DEM_ATTRIBUTION =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank">Terrain: Mapzen / AWS</a>';

export default function IslandMap() {
  let container!: HTMLDivElement;

  onMount(() => {
    const map = new Map({
      container,
      style: STYLE_URL,
      center: [-122.98, 48.565],
      zoom: 10.1,
      pitch: 62,
      bearing: -15,
      maxPitch: 80,
      cooperativeGestures: true, // don't hijack page scrolling
    });
    map.addControl(new NavigationControl({ visualizePitch: true }));

    map.on("load", () => {
      map.addSource("terrain", {
        type: "raster-dem",
        tiles: DEM_TILES,
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 15,
        attribution: DEM_ATTRIBUTION,
      });
      map.setTerrain({ source: "terrain", exaggeration: 1.6 });

      // Imagery covers the basemap's fills and roads; borders and labels draw on top.
      map.addSource("satellite", {
        type: "raster",
        tiles: SATELLITE_TILES,
        tileSize: 256,
        maxzoom: 14, // ~10 m source imagery; overzoom past this
        attribution: SATELLITE_ATTRIBUTION,
      });
      const firstBoundary = map.getStyle().layers.find((l) => l.id.startsWith("boundary"))?.id;
      map.addLayer(
        {
          id: "satellite",
          type: "raster",
          source: "satellite",
          paint: { "raster-brightness-min": 0.06, "raster-contrast": 0.12, "raster-saturation": 0.1 },
        },
        firstBoundary,
      );
      map.setSky({
        "sky-color": "#a9c8dd",
        "horizon-color": "#e9eef0",
        "fog-color": "#e9eef0",
        "sky-horizon-blend": 0.6,
        "horizon-fog-blend": 0.6,
        "fog-ground-blend": 0.4,
      });
    });

    onCleanup(() => map.remove());
  });

  return <div ref={container} class="map" role="region" aria-label="3D map of the San Juan Islands service area" />;
}

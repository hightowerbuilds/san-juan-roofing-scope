import { useQuery } from "@tanstack/solid-query";
import { Match, Switch } from "solid-js";
import PixelMap from "../components/PixelMap";
import { paintTerrain, pixelMapQuery, SEA_CSS } from "../lib/pixelMap";

export function MapPage() {
  const map = useQuery(() => pixelMapQuery);
  const terrain = () => map.data && paintTerrain(map.data.cells, map.data.meta.cellMeters);

  return (
    <section class="pixel-map-page" style={{ background: SEA_CSS }}>
      <h1 class="sr-only">Map of the San Juan Islands</h1>
      <Switch>
        <Match when={map.isError}>
          <p class="pixel-map-status">Couldn’t load the map. {map.error?.message}</p>
        </Match>
        <Match when={map.data && terrain()}>
          {(canvas) => <PixelMap terrain={canvas()} meta={map.data!.meta} background={SEA_CSS} />}
        </Match>
        <Match when={true}>
          <p class="pixel-map-status">Loading map…</p>
        </Match>
      </Switch>
    </section>
  );
}

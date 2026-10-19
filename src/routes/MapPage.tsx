import { useQuery } from "@tanstack/solid-query";
import { Match, Switch } from "solid-js";
import PixelMap from "../components/PixelMap";
import { DEEP_SEA_CSS } from "../lib/pixelArt";
import { pixelMapQuery } from "../lib/pixelMap";

export function MapPage() {
  const map = useQuery(() => pixelMapQuery);

  return (
    <section class="pixel-map-page" style={{ background: DEEP_SEA_CSS }}>
      <h1 class="sr-only">Map of the San Juan Islands</h1>
      <Switch>
        <Match when={map.isError}>
          <p class="pixel-map-status">Couldn’t load the map. {map.error?.message}</p>
        </Match>
        <Match when={map.data}>
          {(data) => <PixelMap terrain={data().terrain} meta={data().meta} background={DEEP_SEA_CSS} />}
        </Match>
        <Match when={true}>
          <p class="pixel-map-status">Loading map…</p>
        </Match>
      </Switch>
    </section>
  );
}

import { Suspense, lazy } from "solid-js";

// MapLibre is large; load it only when this page renders.
const IslandMap = lazy(() => import("../components/IslandMap"));

export function Areas() {
  return (
    <section class="page">
      <h1>Service area</h1>
      <p class="lede">
        We cover every ferry-served island in San Juan County, and reach the outer islands by barge.
      </p>
      <Suspense fallback={<div class="map map-loading">Loading map…</div>}>
        <IslandMap />
      </Suspense>
    </section>
  );
}

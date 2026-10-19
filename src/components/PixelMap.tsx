import { createSignal, onCleanup, onMount, Show } from "solid-js";
import type { PixelMapMeta } from "../../shared/pixelMap";

// Zoom stops in device pixels per map cell. From 1 up, every cell covers the same whole number of
// device pixels, so the art stays crisp. The lowest stop is always "whole map fits".
const ZOOM_STOPS = [0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24];
const ZOOM_MS = 160;
const WHEEL_STEP = 50; // accumulated wheel pixels per zoom stop
const GLIDE_DECAY_MS = 220;

type Props = { terrain: HTMLCanvasElement; meta: PixelMapMeta; background: string };

export default function PixelMap(props: Props) {
  let canvas!: HTMLCanvasElement;
  let controls: { zoomBy(dir: 1 | -1): void; fitAll(): void } | undefined;
  const [cursor, setCursor] = createSignal<{ lat: number; lon: number } | null>(null);
  const [zoom, setZoom] = createSignal(0);

  onMount(() => {
    const { terrain, meta, background } = props;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const W = terrain.width;
    const H = terrain.height;

    // Camera: the map cell under the canvas center, and device pixels per cell.
    const cam = { x: W / 2, y: H / 2, scale: 1 };
    let cw = 0;
    let ch = 0;
    let dpr = 1;
    let fit = 1;
    let frame = 0;
    let anim: { from: number; to: number; wx: number; wy: number; ax: number; ay: number; start: number } | null = null;
    let glide: { vx: number; vy: number; last: number } | null = null; // device px per ms

    const stops = () => [fit, ...ZOOM_STOPS.filter((s) => s > fit * 1.2)];
    const requestDraw = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const toWorld = (ax: number, ay: number) => [cam.x + (ax - cw / 2) / cam.scale, cam.y + (ay - ch / 2) / cam.scale] as const;

    // Keeps the map filling the view; centers it along any axis where it is smaller than the view.
    function clamp() {
      const hw = cw / 2 / cam.scale;
      const hh = ch / 2 / cam.scale;
      cam.x = 2 * hw >= W ? W / 2 : Math.min(W - hw, Math.max(hw, cam.x));
      cam.y = 2 * hh >= H ? H / 2 : Math.min(H - hh, Math.max(hh, cam.y));
    }

    // Sets the scale while keeping map point (wx, wy) under canvas point (ax, ay).
    function setScale(scale: number, wx: number, wy: number, ax: number, ay: number) {
      cam.scale = scale;
      cam.x = wx - (ax - cw / 2) / scale;
      cam.y = wy - (ay - ch / 2) / scale;
      clamp();
      setZoom(scale);
    }

    function zoomTo(scale: number, ax = cw / 2, ay = ch / 2) {
      const [wx, wy] = toWorld(ax, ay);
      glide = null;
      anim = { from: cam.scale, to: scale, wx, wy, ax, ay, start: performance.now() };
      requestDraw();
    }

    function zoomBy(dir: 1 | -1, ax?: number, ay?: number) {
      const base = anim?.to ?? cam.scale;
      const list = stops();
      const next = dir > 0 ? list.find((s) => s > base * 1.01) : list.findLast((s) => s < base / 1.01);
      if (next !== undefined) zoomTo(next, ax, ay);
    }

    // After a pinch, settle on the nearest stop so cells end up on whole pixels again.
    function snapZoom(ax: number, ay: number) {
      const near = stops().reduce((a, b) => (Math.abs(Math.log(b / cam.scale)) < Math.abs(Math.log(a / cam.scale)) ? b : a));
      if (near !== cam.scale) zoomTo(near, ax, ay);
    }

    function draw(now: number) {
      frame = 0;
      if (anim) {
        const t = Math.min(1, (now - anim.start) / ZOOM_MS);
        const eased = 1 - (1 - t) ** 3;
        setScale(anim.from * (anim.to / anim.from) ** eased, anim.wx, anim.wy, anim.ax, anim.ay);
        if (t < 1) requestDraw();
        else anim = null;
      }
      if (glide) {
        const dt = Math.min(50, now - glide.last);
        glide.last = now;
        cam.x -= (glide.vx * dt) / cam.scale;
        cam.y -= (glide.vy * dt) / cam.scale;
        clamp();
        const decay = Math.exp(-dt / GLIDE_DECAY_MS);
        glide.vx *= decay;
        glide.vy *= decay;
        if (Math.hypot(glide.vx, glide.vy) > 0.02) requestDraw();
        else glide = null;
      }

      const s = cam.scale;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, cw, ch);
      // Snap the map origin to a whole device pixel so every cell renders at the same size.
      const ox = Math.round(cw / 2 - cam.x * s);
      const oy = Math.round(ch / 2 - cam.y * s);
      // Below one pixel per cell the overview is downsampled: smooth it rather than drop cells.
      ctx.imageSmoothingEnabled = s < 1;
      ctx.imageSmoothingQuality = "high";
      const sx0 = Math.max(0, Math.floor(-ox / s));
      const sy0 = Math.max(0, Math.floor(-oy / s));
      const sx1 = Math.min(W, Math.ceil((cw - ox) / s));
      const sy1 = Math.min(H, Math.ceil((ch - oy) / s));
      if (sx1 > sx0 && sy1 > sy0) {
        ctx.drawImage(terrain, sx0, sy0, sx1 - sx0, sy1 - sy0, ox + sx0 * s, oy + sy0 * s, (sx1 - sx0) * s, (sy1 - sy0) * s);
      }
    }

    // ---- Size ----
    const resize = (deviceWidth: number, deviceHeight: number) => {
      if (deviceWidth === cw && deviceHeight === ch) return;
      const wasFit = cam.scale <= fit;
      cw = canvas.width = deviceWidth;
      ch = canvas.height = deviceHeight;
      fit = Math.min(cw / W, ch / H);
      if (wasFit || cam.scale < fit) setScale(fit, cam.x, cam.y, cw / 2, ch / 2);
      clamp();
      cancelAnimationFrame(frame);
      draw(performance.now()); // resizing clears the canvas; repaint now to avoid a blank frame
    };
    const observer = new ResizeObserver(([entry]) => {
      dpr = window.devicePixelRatio || 1;
      const box = entry!.devicePixelContentBoxSize?.[0];
      resize(
        box?.inlineSize ?? Math.round(entry!.contentRect.width * dpr),
        box?.blockSize ?? Math.round(entry!.contentRect.height * dpr),
      );
    });
    try {
      observer.observe(canvas, { box: "device-pixel-content-box" });
    } catch {
      observer.observe(canvas); // Safari
    }

    // ---- Pointer: drag to pan (with glide), two fingers to pinch ----
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; scale: number; wx: number; wy: number; mx: number; my: number } | null = null;
    let samples: { x: number; y: number; t: number }[] = [];

    const local = (e: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr };
    };
    const startPinch = () => {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const [wx, wy] = toWorld(mx, my);
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: cam.scale, wx, wy, mx, my };
    };
    const updateCursor = (p: { x: number; y: number }) => {
      const [wx, wy] = toWorld(p.x, p.y);
      const { west, east, north, south } = meta.bbox;
      setCursor(
        wx >= 0 && wx < W && wy >= 0 && wy < H
          ? { lon: west + (wx / W) * (east - west), lat: north - (wy / H) * (north - south) }
          : null,
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      anim = null;
      glide = null;
      samples = [];
      if (pointers.size === 2) startPinch();
    };
    const onPointerMove = (e: PointerEvent) => {
      const p = local(e);
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        if (e.pointerType === "mouse") updateCursor(p);
        return;
      }
      pointers.set(e.pointerId, p);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
        pinch.mx = (a.x + b.x) / 2;
        pinch.my = (a.y + b.y) / 2;
        const scale = Math.min(ZOOM_STOPS.at(-1)!, Math.max(fit, (pinch.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist));
        setScale(scale, pinch.wx, pinch.wy, pinch.mx, pinch.my);
      } else if (pointers.size === 1) {
        cam.x -= (p.x - prev.x) / cam.scale;
        cam.y -= (p.y - prev.y) / cam.scale;
        clamp();
        samples.push({ ...p, t: e.timeStamp });
        while (samples.length > 2 && e.timeStamp - samples[0]!.t > 80) samples.shift();
      }
      if (e.pointerType === "mouse") updateCursor(p);
      requestDraw();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      if (pinch) {
        if (pointers.size < 2) {
          snapZoom(pinch.mx, pinch.my);
          pinch = null;
        }
        samples = [];
        return;
      }
      const first = samples[0];
      const last = samples.at(-1);
      if (pointers.size === 0 && first && last && last.t > first.t && e.timeStamp - last.t < 50) {
        const dt = last.t - first.t;
        glide = { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt, last: performance.now() };
        requestDraw();
      }
    };

    // ---- Wheel: zoom by stops around the cursor (trackpad pinch arrives as ctrl+wheel) ----
    let wheelAcc = 0;
    let wheelIdle = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * ch : e.deltaY;
      wheelAcc += dy * (e.ctrlKey ? 4 : 1);
      clearTimeout(wheelIdle);
      wheelIdle = window.setTimeout(() => (wheelAcc = 0), 200);
      if (Math.abs(wheelAcc) >= WHEEL_STEP) {
        const p = local(e);
        zoomBy(wheelAcc < 0 ? 1 : -1, p.x, p.y);
        wheelAcc = 0;
      }
    };

    // ---- Keyboard (the canvas is focusable) ----
    const onKeyDown = (e: KeyboardEvent) => {
      const pan = (Math.min(cw, ch) * 0.2) / cam.scale;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-pan, 0],
        ArrowRight: [pan, 0],
        ArrowUp: [0, -pan],
        ArrowDown: [0, pan],
      };
      if (moves[e.key]) {
        cam.x += moves[e.key]![0];
        cam.y += moves[e.key]![1];
        clamp();
        requestDraw();
      } else if (e.key === "+" || e.key === "=") zoomBy(1);
      else if (e.key === "-" || e.key === "_") zoomBy(-1);
      else if (e.key === "0") zoomTo(fit);
      else return;
      e.preventDefault();
    };

    const onPointerLeave = () => setCursor(null);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);
    controls = { zoomBy: (dir) => zoomBy(dir), fitAll: () => zoomTo(fit) };

    onCleanup(() => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(wheelIdle);
      controls = undefined;
    });
  });

  const scaleLabel = () => {
    const z = zoom();
    return z >= 1 ? `Zoom ${Math.round(z * 10) / 10}× · 1 cell = ${props.meta.cellMeters} m` : `Overview · 1 cell = ${props.meta.cellMeters} m`;
  };

  return (
    <div class="pixel-map">
      <canvas
        ref={canvas}
        tabIndex={0}
        role="img"
        aria-label="Pixel-art map of the San Juan Islands, Fidalgo and Whidbey Islands, and the Skagit Valley. Drag to pan; use the mouse wheel or plus and minus keys to zoom."
      />
      <div class="pixel-map-zoom">
        <button type="button" onClick={() => controls?.zoomBy(1)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => controls?.zoomBy(-1)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => controls?.fitAll()} aria-label="Show the whole map">⤢</button>
      </div>
      <div class="pixel-map-readout" aria-hidden="true">
        <span>{scaleLabel()}</span>
        <Show when={cursor()}>
          {(c) => <span>{c().lat.toFixed(4)}° N, {Math.abs(c().lon).toFixed(4)}° W</span>}
        </Show>
      </div>
      <div class="pixel-map-attribution">{props.meta.attribution.join(" · ")}</div>
    </div>
  );
}

import { paintRows, type PaintJob } from "./pixelArt";

// Paints one band of the pixel map off the main thread.
self.onmessage = (e: MessageEvent<PaintJob>) => {
  const rgba = paintRows(e.data);
  self.postMessage(rgba, { transfer: [rgba.buffer] });
};

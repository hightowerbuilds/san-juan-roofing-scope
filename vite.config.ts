import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  // MapLibre (~1 MB) is lazy-loaded on /areas only; don't warn about that chunk.
  build: { chunkSizeWarningLimit: 1200 },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": "http://localhost:3001" },
  },
});

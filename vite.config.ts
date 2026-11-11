import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/web",
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    // Two pages: the site, and Algorithms Explained By Claude (D29).
    rollupOptions: { input: { main: resolve("src/web/index.html"), explain: resolve("src/web/explain.html") } },
  },
  server: { proxy: { "/api/": "http://localhost:3000" } },
});

import { defineConfig } from "vite";
import { resolve } from "path";
import { runtimePublicationPlugin } from "./publication.js";

export default defineConfig({
  root: ".",
  publicDir: false,
  plugins: [runtimePublicationPlugin()],
  resolve: {
    alias: {
      shared: resolve(__dirname, "../shared"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});

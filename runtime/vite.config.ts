import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  // Serve library/ as static assets: /activities/*.json and /assets/**
  publicDir: resolve(__dirname, "../library"),
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

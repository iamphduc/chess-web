import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const HOST = "127.0.0.1";

// A whole number from 1 to 65535, or the fallback. Read on every config load.
function portFromEnv(fallback: number): number {
  const raw = process.env.PORT ?? "";
  if (!/^\d+$/.test(raw)) return fallback;
  const port = Number(raw);
  return port >= 1 && port <= 65535 ? port : fallback;
}

const svgMock = fileURLToPath(new URL("./src/__mocks__/svgMock.ts", import.meta.url));

export default defineConfig({
  base: "/chess-web/",
  plugins: [react()],
  resolve: {
    // app/, assets/, features/, game/, hooks/ come from tsconfig "paths"
    tsconfigPaths: true,
  },
  build: {
    // Piece.tsx uses image URLs in an unquoted CSS url(...). An inlined
    // data:image/svg+xml URL breaks it, so SVGs always ship as files.
    assetsInlineLimit: (file) => (file.endsWith(".svg") ? false : undefined),
  },
  server: { host: HOST, port: portFromEnv(5173) },
  preview: { host: HOST, port: portFromEnv(4173) },
  test: {
    environment: "node",
    // Vitest only: every *.svg import (bare assets/ or relative) gets the stub.
    // test.alias runs before tsconfig paths, so it wins over assets/*.
    alias: [{ find: /^.*\.svg$/, replacement: svgMock }],
  },
});

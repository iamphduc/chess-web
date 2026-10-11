// Browser glue only: starts Stockfish lite single-thread WASM in a Web Worker
// and hands it to createUciEngine. All protocol rules live in uci-engine.ts.
//
// `?url` makes Vite copy both files into the build under the app's base path,
// so the engine is never loaded from a CDN. They load only when this module
// is imported.
import engineUrl from "stockfish/bin/stockfish-18-lite-single.js?url";
import wasmUrl from "stockfish/bin/stockfish-18-lite-single.wasm?url";
import type { MoveEngine } from "./move-engine";
import { createUciEngine } from "./uci-engine";

export function createStockfishWorkerEngine(): MoveEngine {
  // The engine script reads the .wasm location from the URL hash. Don't add
  // ",worker" to it: that flag is for the multi-thread build's helpers.
  const worker = new Worker(`${engineUrl}#${encodeURIComponent(wasmUrl)}`);
  return createUciEngine({
    send: (line) => worker.postMessage(line),
    onLine: (cb) => worker.addEventListener("message", (e: MessageEvent) => cb(String(e.data))),
    onError: (cb) => {
      worker.addEventListener("error", cb);
      worker.addEventListener("messageerror", cb);
    },
    terminate: () => worker.terminate(),
  });
}

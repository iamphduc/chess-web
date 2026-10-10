import type { PlayerEntry } from "../../src/game/opponent/types";
import type { HttpDeps, TextCache } from "./sources";

export interface ImportDeps {
  fetch: HttpDeps["fetch"];
  sleep: HttpDeps["sleep"];
  now: () => Date;
  cache: TextCache;
  entry: PlayerEntry;
  readOtbFiles: () => Promise<string[]>;
  writeBook: (fileName: string, json: string) => Promise<void>;
  log: (line: string) => void;
  warn: (line: string) => void;
}

export async function runImport(_argv: string[], _deps: ImportDeps): Promise<number> {
  return 0;
}

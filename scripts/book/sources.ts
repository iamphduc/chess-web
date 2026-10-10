import type { PlayerEntry } from "../../src/game/opponent/types";

export const RETRY_MS = 0;
export const USER_AGENT = "";

export interface TextCache {
  read(key: string): Promise<string | null>;
  write(key: string, text: string): Promise<void>;
}

export interface HttpDeps {
  fetch: typeof globalThis.fetch;
  sleep: (ms: number) => Promise<void>;
  cache?: TextCache;
  now?: () => Date;
}

export class SourceError extends Error {}

export async function fetchText(_url: string, _deps: HttpDeps): Promise<string> {
  return "";
}

export function parseFideLinkedUser(_html: string): string | null {
  return "";
}

export async function resolveLichessUser(
  _opts: { flag?: string; entry: PlayerEntry },
  _deps: HttpDeps
): Promise<{ user: string | null; via: "flag" | "player" | "fide-page" | "none" }> {
  return { user: null, via: "none" };
}

export async function lichessGames(_user: string, _deps: HttpDeps): Promise<string> {
  return "";
}

export async function chesscomGames(_user: string, _deps: HttpDeps): Promise<string[]> {
  return [];
}

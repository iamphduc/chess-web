// Where his games come from: Lichess, Chess.com and local OTB files.
// All network access goes through the injected `fetch`, so tests never touch it.
import type { PlayerEntry } from "../../src/game/opponent/types";

/** Lichess asks clients to wait a full minute after a 429. */
export const RETRY_MS = 60_000;
/** Retries after the first 429 before the source fails. */
export const MAX_RETRIES = 3;
/** Both APIs ask for a way to contact the client's author. */
export const USER_AGENT = "chess-web-book-import/1.0 (+https://github.com/iamphduc/chess-web)";

const LICHESS_USER = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/;

/** Saves downloads (in the CLI, the git-ignored `games/cache/` folder). */
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

/** A configured source could not be read; the import stops and writes nothing. */
export class SourceError extends Error {
  constructor(
    readonly url: string,
    message: string
  ) {
    super(`${url}: ${message}`);
    this.name = "SourceError";
  }
}

/** GET `url` as text. A 429 is retried up to 3 times; anything else not OK fails. */
export async function fetchText(
  url: string,
  deps: HttpDeps,
  accept = "*/*"
): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await deps.fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: accept } });
    } catch (err) {
      throw new SourceError(url, `request failed (${(err as Error).message})`);
    }
    if (res.ok) return res.text();
    if (res.status !== 429) throw new SourceError(url, `HTTP ${res.status}`);
    if (attempt === MAX_RETRIES) {
      throw new SourceError(url, `HTTP 429 after ${MAX_RETRIES} retries`);
    }
    const after = Number(res.headers.get("Retry-After"));
    await deps.sleep(Number.isFinite(after) && after > 0 ? after * 1000 : RETRY_MS);
  }
}

/**
 * The Lichess account a Lichess FIDE player page links to, or `null`. Only
 * links inside the player header count, not site navigation or broadcasts.
 */
export function parseFideLinkedUser(html: string): string | null {
  const start = html.indexOf('class="fide-player__header"');
  if (start < 0) return null;
  const end = html.indexOf('class="fide-player__ratings"', start);
  const header = html.slice(start, end < 0 ? undefined : end);
  const link = /href="\/@\/([A-Za-z0-9_-]+)"/.exec(header);
  return link ? link[1] : null;
}

/** The flag, else `player.json`, else the account linked from his FIDE page. Never a guess. */
export async function resolveLichessUser(
  opts: { flag?: string; entry: PlayerEntry },
  deps: HttpDeps
): Promise<{ user: string | null; via: "flag" | "player" | "fide-page" | "none" }> {
  if (opts.flag !== undefined) {
    if (!LICHESS_USER.test(opts.flag)) {
      throw new Error(`--lichess-user "${opts.flag}" is not a Lichess username`);
    }
    return { user: opts.flag, via: "flag" };
  }
  const fromEntry = opts.entry.sources.lichessUser;
  if (fromEntry !== null) return { user: fromEntry, via: "player" };
  const html = await fetchText(opts.entry.sources.lichessFideUrl, deps, "text/html");
  const linked = parseFideLinkedUser(html);
  return linked === null ? { user: null, via: "none" } : { user: linked, via: "fide-page" };
}

/** All his Lichess games as PGN, from the documented export endpoint. */
export async function lichessGames(user: string, deps: HttpDeps): Promise<string> {
  const url =
    `https://lichess.org/api/games/user/${encodeURIComponent(user)}` +
    "?clocks=false&evals=false&opening=false&literate=false";
  const text = await fetchText(url, deps, "application/x-chess-pgn");
  await deps.cache?.write(`lichess-${user.toLowerCase()}.pgn`, text);
  return text;
}

/**
 * One PGN text per monthly archive. Finished months come from the cache when
 * saved; the archive list and the current month are always fetched.
 */
export async function chesscomGames(user: string, deps: HttpDeps): Promise<string[]> {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/games`;
  const list = JSON.parse(await fetchText(`${base}/archives`, deps, "application/json")) as {
    archives?: unknown;
  };
  if (!Array.isArray(list.archives)) {
    throw new SourceError(`${base}/archives`, "no archives list");
  }
  const now = (deps.now ?? (() => new Date()))();
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const texts: string[] = [];
  for (const archive of list.archives as string[]) {
    const month = /\/(\d{4})\/(\d{2})$/.exec(archive);
    if (month === null) throw new SourceError(archive, "unexpected archive URL");
    const ym = `${month[1]}-${month[2]}`;
    const key = `chesscom-${user.toLowerCase()}-${ym}.pgn`;
    const cached = ym === thisMonth ? null : ((await deps.cache?.read(key)) ?? null);
    if (cached !== null) {
      texts.push(cached);
      continue;
    }
    const text = await fetchText(`${archive}/pgn`, deps, "application/x-chess-pgn");
    await deps.cache?.write(key, text);
    texts.push(text);
  }
  return texts;
}

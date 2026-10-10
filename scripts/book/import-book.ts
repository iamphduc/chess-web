// `npm run book:import [-- --lichess-user <name>]`: downloads his games, builds
// both books and writes them next to player.json. Reaches the network.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Book, BookName, GameSource, PlayerEntry } from "../../src/game/opponent/types";
import { buildBooks, serializeBook } from "./build-book";
import { PgnFile, selectGames } from "./games";
import {
  chesscomGames,
  HttpDeps,
  lichessGames,
  resolveLichessUser,
  TextCache,
} from "./sources";

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

const USAGE = "Usage: npm run book:import [-- --lichess-user <name>]";

function parseArgs(argv: string[]): { lichessUser?: string } | null {
  const out: { lichessUser?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--lichess-user" && i + 1 < argv.length) out.lichessUser = argv[++i];
    else if (arg.startsWith("--lichess-user=")) out.lichessUser = arg.slice("--lichess-user=".length);
    else return null;
  }
  return out;
}

const SOURCES: GameSource[] = ["otb", "lichess", "chesscom"];
const bySource = (counts: Record<GameSource, number>) =>
  SOURCES.map((s) => `${s} ${counts[s]}`).join(", ");

function describeBook(name: BookName, book: Book, json: string): string {
  const positions = Object.keys(book.positions).length;
  const kb = (Buffer.byteLength(json) / 1024).toFixed(0);
  return `${name} book: ${book.games} games (${bySource(book.gamesBySource)}), ${positions} positions, minGames ${book.minGames}, ${kb} KB`;
}

/** Runs the import. Returns the exit code; writes books only when every source succeeded. */
export async function runImport(argv: string[], deps: ImportDeps): Promise<number> {
  const args = parseArgs(argv);
  if (args === null) {
    deps.warn(USAGE);
    return 2;
  }
  const { entry } = deps;
  const http: HttpDeps = { fetch: deps.fetch, sleep: deps.sleep, cache: deps.cache, now: deps.now };
  try {
    const lichess = await resolveLichessUser({ flag: args.lichessUser, entry }, http);
    if (lichess.user === null) {
      deps.warn(
        `No Lichess account found (none in player.json, none linked from ${entry.sources.lichessFideUrl}). ` +
          "Building without Lichess. Pass --lichess-user <name> to add one."
      );
    } else {
      deps.log(`Lichess account: ${lichess.user} (from ${lichess.via})`);
    }

    const files: PgnFile[] = (await deps.readOtbFiles()).map((text) => ({ source: "otb", text }));
    deps.log(`OTB files: ${files.length}`);
    if (lichess.user !== null) {
      files.push({ source: "lichess", text: await lichessGames(lichess.user, http) });
    }
    const months = await chesscomGames(entry.sources.chesscomUser, http);
    deps.log(`Chess.com account: ${entry.sources.chesscomUser} (${months.length} monthly archives)`);
    for (const text of months) files.push({ source: "chesscom", text });

    const { games, summary } = selectGames(files, {
      fideId: entry.fideId,
      aliases: entry.aliases,
      accounts: { lichess: lichess.user, chesscom: entry.sources.chesscomUser },
    });
    const books = buildBooks(games, { player: entry.id });
    const json = { slow: serializeBook(books.slow), online: serializeBook(books.online) };

    deps.log(`Games read: ${summary.read}`);
    deps.log(`Games kept: ${bySource(summary.kept)}`);
    deps.log(
      `Skipped: ${Object.entries(summary.skipped)
        .map(([reason, n]) => `${reason} ${n}`)
        .join(", ")}`
    );
    deps.log(`Dropped (cut at a move our engine rejected): ${summary.dropped}`);
    for (const name of ["slow", "online"] as const) {
      deps.log(describeBook(name, books[name], json[name]));
    }

    for (const name of ["slow", "online"] as const) {
      await deps.writeBook(entry.books[name], json[name]);
    }
    return 0;
  } catch (err) {
    deps.warn(`Import failed, no book written: ${(err as Error).message}`);
    return 1;
  }
}

// --- CLI glue: real network, file system and console. ---

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PLAYER_DIR = join(ROOT, "src/game/opponent/players/le-quang-liem");
const CACHE_DIR = join(ROOT, "games/cache");
const OTB_DIR = join(ROOT, "games/otb");

const fileCache: TextCache = {
  read: (key) => readFile(join(CACHE_DIR, key), "utf8").catch(() => null),
  write: async (key, text) => {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, key), text);
  },
};

async function readOtbFiles(): Promise<string[]> {
  const names = await readdir(OTB_DIR).catch(() => [] as string[]);
  const pgns = names.filter((n) => n.toLowerCase().endsWith(".pgn")).sort();
  return Promise.all(pgns.map((n) => readFile(join(OTB_DIR, n), "utf8")));
}

async function main(): Promise<void> {
  const entry = JSON.parse(await readFile(join(PLAYER_DIR, "player.json"), "utf8")) as PlayerEntry;
  process.exitCode = await runImport(process.argv.slice(2), {
    fetch: globalThis.fetch,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date(),
    cache: fileCache,
    entry,
    readOtbFiles,
    writeBook: (name, json) => writeFile(join(PLAYER_DIR, name), json),
    log: (line) => console.log(line),
    warn: (line) => console.warn(line),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}

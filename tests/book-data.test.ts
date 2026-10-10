import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import type { Book, BookName, PlayerEntry } from "../src/game/opponent/types";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PLAYER_DIR = join(ROOT, "src/game/opponent/players/le-quang-liem");
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
const MAX_BYTES = 3 * 1024 * 1024;
const BOOK_KEYS = ["book", "format", "games", "gamesBySource", "minGames", "player", "positions"];
const KEY_PATTERN = /^[1-8pnbrqkPNBRQK/]+ [wb] (-|K?Q?k?q?) (-|[a-h][36])$/;
const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

const entry = JSON.parse(readFileSync(join(PLAYER_DIR, "player.json"), "utf8")) as PlayerEntry;
const NAMES: BookName[] = ["slow", "online"];

function bookText(name: BookName): string {
  const path = join(PLAYER_DIR, entry.books[name]);
  expect(existsSync(path), `${path} is committed`).toBe(true);
  return readFileSync(path, "utf8");
}

const games = (m: readonly unknown[]) => (m[4] as number) + (m[5] as number) + (m[6] as number);

describe("committed books are valid", () => {
  it("the player entry names both book files", () => {
    expect(entry.id).toBe("le-quang-liem");
    expect(entry.books).toEqual({ slow: "book-slow.json", online: "book-online.json" });
  });

  for (const name of NAMES) {
    it(`${name} book: format 1, invariant, sort order, at most 3 MB`, () => {
      const text = bookText(name);
      expect(Buffer.byteLength(text)).toBeLessThanOrEqual(MAX_BYTES);
      const book = JSON.parse(text) as Book;
      expect(book.format).toBe(1);
      expect(book.book).toBe(name);
      expect(book.player).toBe(entry.id);
      expect(Number.isInteger(book.minGames) && book.minGames >= 1).toBe(true);
      const bySource = book.gamesBySource;
      expect(book.games).toBe(bySource.otb + bySource.lichess + bySource.chesscom);
      const keys = Object.keys(book.positions);
      expect(keys).toEqual([...keys].sort());
      for (const key of keys) {
        expect(key).toMatch(KEY_PATTERN);
        const moves = book.positions[key];
        expect(moves.length).toBeGreaterThan(0);
        let total = 0;
        for (const m of moves) {
          expect(m).toHaveLength(7);
          expect(m[0]).toMatch(UCI_PATTERN);
          for (const n of m.slice(1)) expect(Number.isInteger(n) && (n as number) >= 0).toBe(true);
          expect(m[1] + m[2] + m[3]).toBe(games(m));
          expect(games(m)).toBeGreaterThan(0);
          total += games(m);
        }
        expect(total).toBeGreaterThanOrEqual(book.minGames);
        const sorted = [...moves].sort((a, b) => games(b) - games(a) || (a[0] < b[0] ? -1 : 1));
        expect(moves).toEqual(sorted);
      }
    });
  }

  it("the online book has games, and a book has the start position (he plays White)", () => {
    const books = NAMES.map((n) => JSON.parse(bookText(n)) as Book);
    expect(books[1].games).toBeGreaterThan(0);
    expect(books.some((b) => (b.positions[START]?.length ?? 0) > 0)).toBe(true);
  });

  it("players/index.ts exports the entry and both books", async () => {
    const { LIEM, PLAYERS } = await import("../src/game/opponent/players/index");
    expect(LIEM.entry).toEqual(entry);
    expect(PLAYERS).toContain(LIEM);
    for (const name of NAMES) expect(LIEM.books[name]).toEqual(JSON.parse(bookText(name)));
  });
});

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("no raw game data and no parser in the app", () => {
  it("book JSON has only the allowed fields: no names, dates or move lists", () => {
    for (const name of NAMES) {
      const text = bookText(name);
      const book = JSON.parse(text) as Record<string, unknown>;
      expect(Object.keys(book).sort()).toEqual(BOOK_KEYS);
      expect(Object.keys(book.gamesBySource as object).sort()).toEqual(["chesscom", "lichess", "otb"]);
      expect(text).not.toMatch(/\d{4}[.-]\d{2}[.-]\d{2}/);
      expect(text.toLowerCase()).not.toContain(entry.sources.chesscomUser);
      expect(text).not.toMatch(/\[(Event|Site|White|Black|Date) /);
      // Every string in the file is a known field, a position key or a UCI move.
      const strings = [...text.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
      for (const s of strings) {
        const ok =
          BOOK_KEYS.includes(s) ||
          ["otb", "lichess", "chesscom", "slow", "online", entry.id].includes(s) ||
          KEY_PATTERN.test(s) ||
          UCI_PATTERN.test(s);
        expect(ok, s).toBe(true);
      }
    }
  });

  it("no file under src/ imports chess.js", () => {
    const offenders = filesUnder(join(ROOT, "src"))
      .filter((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f))
      .filter((f) => /(from\s*|import\s*\(\s*|require\s*\(\s*)["']chess\.js["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});

describe("raw PGN folder is ignored", () => {
  it("git check-ignore reports games/otb/x.pgn and games/cache/x.pgn as ignored", () => {
    const out = execFileSync("git", ["check-ignore", "games/otb/x.pgn", "games/cache/x.pgn"], {
      cwd: ROOT,
      encoding: "utf8",
    });
    expect(out.trim().split(/\r?\n/)).toEqual(["games/otb/x.pgn", "games/cache/x.pgn"]);
  });
});

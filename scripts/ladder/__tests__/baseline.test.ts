import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BaselineFile,
  parseArgs,
  runBaseline,
  serializeBaseline,
  SPARRING_LEVELS,
  summaryLines,
} from "../baseline";
import type { LichessClient, LichessGame } from "../lichess";

const LEVEL_KEYS = ["droppedGames", "games", "lowSample", "rates", "ratingMax", "ratingMin", "speeds"];
const RATE_KEYS = ["accuracy", "avgLoss", "gradedMoves", "games", "per40", "sides"];
const GRADES = ["blunder", "inaccuracy", "mistake"];

const sorted = (o: object) => Object.keys(o).sort();

/** Checks a parsed file against the sprint's contract, key for key. */
function expectContractShape(file: unknown): asserts file is BaselineFile {
  const f = file as Record<string, unknown>;
  expect(sorted(f)).toEqual(["format", "generated", "levels", "skipPlies", "source"]);
  expect(f.format).toBe(1);
  expect(f.generated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(typeof f.source).toBe("string");
  expect(Number.isInteger(f.skipPlies)).toBe(true);
  const levels = f.levels as Record<string, Record<string, unknown>>;
  for (const [key, level] of Object.entries(levels)) {
    expect(["1400", "1700", "1900", "2100", "2300", "2500"]).toContain(key);
    expect(sorted(level)).toEqual(LEVEL_KEYS);
    expect(level.ratingMin as number).toBeLessThan(level.ratingMax as number);
    expect(sorted(level.speeds as object)).toEqual(["blitz", "rapid"]);
    const speeds = level.speeds as Record<string, number>;
    expect(speeds.blitz + speeds.rapid).toBe(level.games);
    expect(typeof level.lowSample).toBe("boolean");
    expect(Number.isInteger(level.droppedGames)).toBe(true);
    const rates = level.rates as Record<string, unknown>;
    expect(sorted(rates)).toEqual(RATE_KEYS);
    expect(rates.games).toBe(level.games);
    const per40 = rates.per40 as Record<string, unknown>;
    expect(sorted(per40)).toEqual(["hung", "lichess", "missedCapture", "review"]);
    expect(sorted(per40.review as object)).toEqual(GRADES);
    expect(sorted(per40.lichess as object)).toEqual(GRADES);
  }
}

// --- A fake Lichess: two arenas, five players, their games. ---

let nextId = 0;
function game(white: [string, number], black: [string, number], speed = "rapid"): LichessGame {
  return {
    id: `gm${String(nextId++).padStart(6, "0")}`,
    rated: true,
    variant: "standard",
    speed,
    status: "resign",
    players: {
      white: { user: { name: white[0], id: white[0].toLowerCase() }, rating: white[1], analysis: { accuracy: 80 } },
      black: { user: { name: black[0], id: black[0].toLowerCase() }, rating: black[1], analysis: { accuracy: 70 } },
    },
    moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6",
    analysis: [20, 25, 22, 30, 28, 35, 30, 33, 25, 30, 28, 600, 590, 600].map((e) => ({ eval: e })),
  };
}

const NAMES = ["Zed_Player", "Quux77", "MaryLou", "Grand_K", "Lowly1"];

function fakeLichess(): { client: LichessClient; urls: string[] } {
  const urls: string[] = [];
  const games: Record<string, LichessGame[]> = {
    Zed_Player: [game(["Zed_Player", 1400], ["Quux77", 1420]), game(["Zed_Player", 1405], ["Lowly1", 1100])],
    Quux77: [game(["Quux77", 1390], ["MaryLou", 1380], "blitz")],
    MaryLou: [game(["MaryLou", 1395], ["Zed_Player", 1430])],
    Grand_K: [game(["Grand_K", 2490], ["Quux77", 2510])],
    Lowly1: [],
  };
  const client: LichessClient = {
    get: async (url) => {
      urls.push(url);
      if (url === "https://lichess.org/api/tournament") {
        return JSON.stringify({
          finished: [
            { id: "arenaAAA", fullName: "Hourly Rapid Arena", perf: { key: "rapid" }, variant: { key: "standard" } },
            { id: "arenaBBB", fullName: "Bullet", perf: { key: "bullet" }, variant: { key: "standard" } },
            { id: "arenaCCC", fullName: "960", perf: { key: "blitz" }, variant: { key: "chess960" } },
          ],
        });
      }
      if (url.startsWith("https://lichess.org/api/tournament/arenaAAA/results")) {
        return [
          { username: "Zed_Player", rating: 1400 },
          { username: "Quux77", rating: 1390 },
          { username: "MaryLou", rating: 1395 },
          { username: "Grand_K", rating: 2490 },
          { username: "Lowly1", rating: 1100 },
        ]
          .map((r) => JSON.stringify(r))
          .join("\n");
      }
      const user = /\/api\/games\/user\/([^?]+)/.exec(url)?.[1];
      if (user !== undefined) return (games[user] ?? []).map((g) => JSON.stringify(g)).join("\n");
      throw new Error(`unexpected ${url}`);
    },
  };
  return { client, urls };
}

describe("baseline flags", () => {
  it("defaults to 150 games, 10 skipped plies, the six sparring levels", () => {
    const o = parseArgs([]);
    expect(o.games).toBe(150);
    expect(o.skipPlies).toBe(10);
    expect(o.levels).toEqual(SPARRING_LEVELS);
    expect(SPARRING_LEVELS).toEqual([1400, 1700, 1900, 2100, 2300, 2500]);
  });

  it("reads --games, --skip-plies and --levels, and rejects nonsense", () => {
    const o = parseArgs(["--games", "40", "--skip-plies", "8", "--levels", "1400,2500"]);
    expect([o.games, o.skipPlies, o.levels]).toEqual([40, 8, [1400, 2500]]);
    expect(() => parseArgs(["--games", "0"])).toThrow();
    expect(() => parseArgs(["--levels", "1500"])).toThrow();
    expect(() => parseArgs(["--bogus"])).toThrow();
  });
});

describe("file shape has no personal data", () => {
  it("writes exactly the contract's keys and no username, game id or move", async () => {
    nextId = 0;
    const { client, urls } = fakeLichess();
    const lines: string[] = [];
    const file = await runBaseline(parseArgs(["--games", "10"]), {
      client,
      today: () => new Date("2026-10-18T12:00:00Z"),
      log: (l) => lines.push(l),
    });
    const text = serializeBaseline(file);
    const parsed = JSON.parse(text);
    expectContractShape(parsed);
    expect(parsed.generated).toBe("2026-10-18");
    expect(parsed.skipPlies).toBe(10);

    // 1400: three games with both players in ±100 → under 30, widened, low sample.
    const l1400 = parsed.levels["1400"];
    expect(l1400.games).toBe(3);
    expect([l1400.ratingMin, l1400.ratingMax]).toEqual([1250, 1550]);
    expect(l1400.lowSample).toBe(true);
    expect(l1400.speeds).toEqual({ rapid: 2, blitz: 1 });
    expect(l1400.rates.accuracy).toBe(75);
    // Plies 10..13 graded, both sides: 4 per game.
    expect(l1400.rates.gradedMoves).toBe(12);
    expect(l1400.rates.per40.review.blunder).toBeGreaterThan(0);
    expect(parsed.levels["2500"].games).toBe(1);
    // No candidates near 1700: no baseline for it.
    expect(parsed.levels["1700"]).toBeUndefined();

    for (const secret of [...NAMES, ...NAMES.map((n) => n.toLowerCase()), "gm0000", "arenaAAA", "Nf3", "e2e4", "O-O"]) {
      expect(text).not.toContain(secret);
    }
    for (const secret of NAMES) expect(lines.join("\n")).not.toContain(secret);
    // Bullet and 960 arenas are never read.
    expect(urls.some((u) => u.includes("arenaBBB") || u.includes("arenaCCC"))).toBe(false);
    // Each player's games are fetched once, however many levels they suit.
    const userUrls = urls.filter((u) => u.includes("/api/games/user/"));
    expect(new Set(userUrls).size).toBe(userUrls.length);
    expect(summaryLines(parsed).some((l) => l.startsWith("1400"))).toBe(true);
  });

  it("serializes byte-stable, with a trailing newline", async () => {
    nextId = 0;
    const deps = { client: fakeLichess().client, today: () => new Date("2026-10-18T00:00:00Z"), log: () => {} };
    const a = serializeBaseline(await runBaseline(parseArgs(["--games", "10"]), deps));
    nextId = 0;
    const b = serializeBaseline(await runBaseline(parseArgs(["--games", "10"]), deps));
    expect(a).toBe(b);
    expect(a.endsWith("}\n")).toBe(true);
  });
});

describe("committed baselines", () => {
  const path = new URL("../human-baselines.json", import.meta.url);

  it("parses to the contract, each level has games and graded moves", () => {
    expect(existsSync(path)).toBe(true);
    const file = JSON.parse(readFileSync(path, "utf8"));
    expectContractShape(file);
    const levels = Object.values(file.levels);
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) {
      expect(level.games).toBeGreaterThan(0);
      expect(level.rates.gradedMoves).toBeGreaterThan(0);
      for (const g of GRADES) {
        expect(typeof level.rates.per40.review[g as "mistake"]).toBe("number");
      }
    }
  });
});

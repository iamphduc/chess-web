import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BaselineFile,
  LevelKey,
  mergeBaseline,
  parseArgs,
  parseExistingBaseline,
  runBaseline,
  saveBaseline,
  serializeBaseline,
  SPARRING_LEVELS,
  summaryLines,
} from "../baseline";
import type { LichessClient, LichessGame } from "../lichess";

const LEVEL_KEYS = ["droppedGames", "games", "lowSample", "rates", "ratingMax", "ratingMin", "speeds"];
const RATE_KEYS = ["accuracy", "avgLoss", "games", "gradedMoves", "per40", "sides"];
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

const NAMES = ["Zed_Player", "Quux77", "MaryLou", "Grand_K", "Lowly1", "Top_Gun", "Ace_X"];

function fakeLichess(): { client: LichessClient; urls: string[] } {
  const urls: string[] = [];
  const games: Record<string, LichessGame[]> = {
    Zed_Player: [game(["Zed_Player", 1400], ["Quux77", 1420]), game(["Zed_Player", 1405], ["Lowly1", 1100])],
    Quux77: [game(["Quux77", 1390], ["MaryLou", 1380], "blitz")],
    MaryLou: [game(["MaryLou", 1395], ["Zed_Player", 1430])],
    Grand_K: [game(["Grand_K", 2490], ["Quux77", 2510]), game(["Top_Gun", 2480], ["Grand_K", 2495])],
    Lowly1: [],
    // Never in an arena: found as Grand_K's opponent.
    Top_Gun: [game(["Ace_X", 2520], ["Top_Gun", 2470], "blitz")],
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
    const l1400 = parsed.levels["1400"]!;
    expect(l1400.games).toBe(3);
    expect([l1400.ratingMin, l1400.ratingMax]).toEqual([1250, 1550]);
    expect(l1400.lowSample).toBe(true);
    expect(l1400.speeds).toEqual({ rapid: 2, blitz: 1 });
    expect(l1400.rates.accuracy).toBe(75);
    // Plies 10..13 graded, both sides: 4 per game.
    expect(l1400.rates.gradedMoves).toBe(12);
    expect(l1400.rates.per40.review.blunder).toBeGreaterThan(0);
    // 2500: one arena player, then the opponents met in his games.
    expect(parsed.levels["2500"]!.games).toBe(3);
    expect(urls.some((u) => u.includes("/api/games/user/Top_Gun"))).toBe(true);
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

describe("mergeBaseline", () => {
  const lvl = (games: number) => ({ games }) as unknown as BaselineFile["levels"]["1400"];
  const file = (generated: string, levels: BaselineFile["levels"]): BaselineFile => ({
    format: 1,
    generated,
    source: "src",
    skipPlies: 10,
    levels,
  });

  it("keeps unmeasured levels and replaces measured ones", () => {
    const old = file("2026-10-18", { "1400": lvl(1), "1700": lvl(2), "2500": lvl(3) });
    const run = file("2026-10-20", { "1700": lvl(99) });
    const merged = mergeBaseline(old, run);
    expect(merged.levels).toEqual({ "1400": lvl(1), "1700": lvl(99), "2500": lvl(3) });
    expect(merged.generated).toBe("2026-10-20");
  });

  it("keeps an old level when the run kept no games for it", () => {
    const old = file("2026-10-18", { "1400": lvl(1) });
    expect(mergeBaseline(old, file("2026-10-20", {})).levels).toEqual({ "1400": lvl(1) });
  });

  it("writes levels in ascending order whatever order they arrive in", () => {
    const old = file("2026-10-18", { "2500": lvl(3), "1400": lvl(1) });
    const run = file("2026-10-20", { "1900": lvl(2), "1700": lvl(2) });
    expect(Object.keys(mergeBaseline(old, run).levels)).toEqual(["1400", "1700", "1900", "2500"]);
  });

  it("starts from the run alone when there is no existing file", () => {
    const run = file("2026-10-20", { "2300": lvl(5), "1400": lvl(4) });
    const merged = mergeBaseline(null, run);
    expect(Object.keys(merged.levels)).toEqual(["1400", "2300"]);
    expect(merged.generated).toBe("2026-10-20");
  });
});

describe("parseExistingBaseline", () => {
  it("returns null for missing, broken or wrong-shaped text", () => {
    expect(parseExistingBaseline(null)).toBeNull();
    expect(parseExistingBaseline("{ nope")).toBeNull();
    expect(parseExistingBaseline('{"format":2,"levels":{}}')).toBeNull();
    expect(parseExistingBaseline('{"format":1,"levels":[]}')).toBeNull();
  });

  it("reads a good file", () => {
    const text = serializeBaseline({ format: 1, generated: "d", source: "s", skipPlies: 10, levels: {} });
    expect(parseExistingBaseline(text)?.generated).toBe("d");
  });
});

// --- Saving and the summary: a fake file, full level entries. ---

function level(games: number): NonNullable<BaselineFile["levels"]["1400"]> {
  const grades = { inaccuracy: 1, mistake: 0.5, blunder: 0.25 };
  return {
    ratingMin: 1300,
    ratingMax: 1500,
    games,
    droppedGames: 0,
    speeds: { blitz: games, rapid: 0 },
    lowSample: false,
    rates: {
      games,
      gradedMoves: games * 40,
      per40: { review: grades, lichess: grades, hung: 0.1, missedCapture: 0.2 },
      avgLoss: 3,
      accuracy: 80,
      sides: games * 2,
    },
  };
}

function baselineFile(generated: string, levels: BaselineFile["levels"]): BaselineFile {
  return { format: 1, generated, source: "src", skipPlies: 10, levels };
}

/** A fake saved file: counts reads, keeps every write. */
function fakeIo(saved: string | null, writeError?: Error) {
  const io = {
    reads: 0,
    writes: [] as string[],
    read: async () => {
      io.reads++;
      return saved;
    },
    write: async (text: string) => {
      if (writeError) throw writeError;
      io.writes.push(text);
    },
  };
  return io;
}

const KEPT = " (kept from the saved file)";

describe("saveBaseline", () => {
  const old = baselineFile("2026-10-18", { "1400": level(1), "1700": level(2), "2500": level(3) });

  it("saveBaseline writes the merged file on a partial run", async () => {
    const run = baselineFile("2026-10-20", { "1700": level(99) });
    const io = fakeIo(serializeBaseline(old));
    const written = await saveBaseline(run, [1700], io);
    expect(io.reads).toBe(1);
    expect(io.writes).toHaveLength(1);
    const expected = baselineFile("2026-10-20", { "1400": level(1), "1700": level(99), "2500": level(3) });
    expect(io.writes[0]).toBe(serializeBaseline(expected));
    expect(io.writes[0]).not.toBe(serializeBaseline(run));
    expect(written).toEqual(expected);
  });

  it("saveBaseline writes a full run whole without reading", async () => {
    const run = baselineFile("2026-10-20", { "1400": level(7), "2100": level(8) });
    for (const levels of [SPARRING_LEVELS, [2500, 2300, 2100, 1900, 1700, 1400]]) {
      const io = fakeIo(serializeBaseline(old));
      const written = await saveBaseline(run, levels, io);
      expect(io.reads).toBe(0);
      expect(io.writes).toEqual([serializeBaseline(run)]);
      expect(written).toEqual(run);
    }
  });

  it("saveBaseline starts empty when the saved file is missing or broken", async () => {
    const run = baselineFile("2026-10-20", { "2300": level(5) });
    for (const saved of [null, "{ nope", '{"format":2,"levels":{}}']) {
      const io = fakeIo(saved);
      const written = await saveBaseline(run, [2300, 2500], io);
      expect(io.reads).toBe(1);
      expect(io.writes).toEqual([serializeBaseline(run)]);
      expect(Object.keys(written.levels)).toEqual(["2300"]);
    }
  });

  it("saveBaseline rejects when the write fails", async () => {
    const boom = new Error("disk full");
    const io = fakeIo(serializeBaseline(old), boom);
    await expect(saveBaseline(baselineFile("2026-10-20", {}), [1400], io)).rejects.toBe(boom);
    await expect(saveBaseline(baselineFile("2026-10-20", {}), SPARRING_LEVELS, io)).rejects.toBe(boom);
  });
});

describe("summaryLines marks", () => {
  const merged = baselineFile("2026-10-20", { "1400": level(1), "1700": level(99), "2500": level(3) });

  it("summaryLines marks levels this run didn't measure", () => {
    const lines = summaryLines(merged, ["1700"]);
    expect(lines).toHaveLength(6);
    expect(lines[0].startsWith("1400: 1 games")).toBe(true);
    expect(lines[0].endsWith(KEPT)).toBe(true);
    expect(lines[1].startsWith("1700: 99 games")).toBe(true);
    expect(lines[1]).not.toContain(KEPT);
    expect(lines[5].endsWith(KEPT)).toBe(true);
    // Unmarked, the line is the same as before.
    expect(lines[0]).toBe(summaryLines(merged)[0] + KEPT);
    for (const i of [2, 3, 4]) expect(lines[i]).toBe(`${SPARRING_LEVELS[i]}: no baseline`);
  });

  it("summaryLines marks an old level the run kept no games for", async () => {
    // --levels 1400,1700: 1700 kept games, 1400 kept none, so its old entry stayed.
    const run = baselineFile("2026-10-20", { "1700": level(99) });
    const old = baselineFile("2026-10-18", { "1400": level(1), "1700": level(2) });
    const written = await saveBaseline(run, [1400, 1700], fakeIo(serializeBaseline(old)));
    const lines = summaryLines(written, Object.keys(run.levels) as LevelKey[]);
    expect(lines[0].startsWith("1400: 1 games")).toBe(true);
    expect(lines[0].endsWith(KEPT)).toBe(true);
    expect(lines[1]).not.toContain(KEPT);
  });

  it("summaryLines marks nothing after a full run", () => {
    const full = baselineFile("2026-10-20", { "1400": level(1), "1900": level(2) });
    for (const lines of [summaryLines(full), summaryLines(full, ["1400", "1900"]), summaryLines(merged)]) {
      expect(lines.some((l) => l.includes(KEPT))).toBe(false);
    }
    expect(summaryLines(full, ["1400", "1900"])[1]).toBe("1700: no baseline");
    expect(summaryLines(merged, [])[2]).toBe("1900: no baseline");
  });
});

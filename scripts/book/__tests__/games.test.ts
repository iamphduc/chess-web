import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { PgnFile, PlayerIdentity, selectGames, splitPgn } from "../games";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

const WHO: PlayerIdentity = {
  fideId: 12401137,
  aliases: ["Le Quang Liem", "Le, Quang Liem"],
  accounts: { lichess: "fixtureuser", chesscom: "liemle" },
};

const FILES: PgnFile[] = [
  { source: "otb", text: fixture("otb.pgn") },
  { source: "lichess", text: fixture("lichess.pgn") },
  { source: "chesscom", text: fixture("chesscom.pgn") },
];

const run = (files: PgnFile[] = FILES, who: PlayerIdentity = WHO) => selectGames(files, who);

const one = (headers: string, moves = "1. e4 1-0") => `${headers}\n\n${moves}\n`;

describe("splitPgn", () => {
  it("splits a multi-game file, with LF or CRLF endings and a BOM", () => {
    expect(splitPgn(fixture("otb.pgn"))).toHaveLength(10);
    expect(splitPgn(fixture("chesscom.pgn"))).toHaveLength(3);
    expect(splitPgn("﻿" + fixture("lichess.pgn"))).toHaveLength(3);
    expect(splitPgn("")).toEqual([]);
  });
});

describe("unknown and daily clocks by source", () => {
  it("OTB games with no, '-' or '?' clock go to the slow book", () => {
    const otb = run().games.filter((g) => g.source === "otb");
    // G1 (no tag), G2 ("-"), G3 ("?"), G9 (180+2), G10 (no tag)
    expect(otb.map((g) => g.book)).toEqual(["slow", "slow", "slow", "online", "slow"]);
  });

  it("online games with '-' are skipped, and daily games are skipped", () => {
    const { games, summary } = run();
    expect(games.filter((g) => g.source === "lichess").map((g) => g.book)).toEqual([
      "online",
      "slow",
    ]);
    expect(games.filter((g) => g.source === "chesscom").map((g) => g.book)).toEqual([
      "online",
      "online",
    ]);
    expect(summary.skipped["no-clock"]).toBe(1);
    expect(summary.skipped.daily).toBe(1);
  });

  it("an online game with an unparsable clock is skipped, an OTB one is slow", () => {
    const pgn = (white: string) =>
      one(`[White "${white}"]\n[Black "x"]\n[Date "2023.01.01"]\n[Result "1-0"]\n[TimeControl "abc"]`);
    const online = run([{ source: "lichess", text: pgn("FixtureUser") }]);
    expect(online.games).toEqual([]);
    expect(online.summary.skipped["no-clock"]).toBe(1);
    const otb = run([{ source: "otb", text: pgn("Le Quang Liem") }]);
    expect(otb.games.map((g) => g.book)).toEqual(["slow"]);
  });

  it("an online game with no TimeControl tag is skipped", () => {
    const text = one(`[White "FixtureUser"]\n[Black "x"]\n[Result "1-0"]`);
    expect(run([{ source: "lichess", text }]).summary.skipped["no-clock"]).toBe(1);
  });
});

describe("skip rules", () => {
  it("skips Chess960, SetUp/FEN, '*', games without him and duplicates, counting each", () => {
    const { summary } = run();
    expect(summary.read).toBe(16);
    expect(summary.skipped).toEqual({
      variant: 1,
      setup: 1,
      unfinished: 1,
      "not-player": 1,
      "no-clock": 1,
      daily: 1,
      duplicate: 1,
    });
    expect(summary.kept).toEqual({ otb: 5, lichess: 2, chesscom: 2 });
  });

  it("keeps only the first copy of a duplicate, even across sources", () => {
    const first = splitPgn(fixture("otb.pgn"))[0];
    const { games, summary } = run([
      { source: "otb", text: first },
      { source: "otb", text: first.replace("{a comment} ", "") },
    ]);
    expect(games).toHaveLength(1);
    expect(summary.skipped.duplicate).toBe(1);
    const lichessCopy = first
      .replace("Le Quang Liem", "FixtureUser")
      .replace("[Result", '[TimeControl "180+0"]\n[Result');
    const cross = run([
      { source: "lichess", text: lichessCopy },
      { source: "lichess", text: lichessCopy },
    ]);
    expect(cross.summary.kept.lichess).toBe(1);
  });

  it("a game with a different date or move list is not a duplicate", () => {
    const first = splitPgn(fixture("otb.pgn"))[0];
    const { games } = run([
      { source: "otb", text: first },
      { source: "otb", text: first.replace("2020.01.01", "2020.01.31") },
      { source: "otb", text: first.replace("Nf6 1-0", "Be7 1-0") },
    ]);
    expect(games).toHaveLength(3);
  });

  it("a SetUp '0' tag or a Standard variant is not skipped", () => {
    const text = one(`[White "Le Quang Liem"]\n[Black "x"]\n[Result "1-0"]\n[SetUp "0"]\n[Variant "Standard"]`);
    expect(run([{ source: "otb", text }]).games).toHaveLength(1);
  });

  it("any FEN tag is skipped, and an unknown result is unfinished", () => {
    const fen = one(
      `[White "Le Quang Liem"]\n[Black "x"]\n[Result "1-0"]\n[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]`
    );
    const odd = one(`[White "Le Quang Liem"]\n[Black "x"]\n[Result "?"]`, "1. e4 *");
    const { summary } = run([
      { source: "otb", text: fen },
      { source: "otb", text: odd },
    ]);
    expect(summary.skipped.setup).toBe(1);
    expect(summary.skipped.unfinished).toBe(1);
  });
});

describe("finds his side", () => {
  it("by account name, case-insensitive, for each online source", () => {
    const online = run().games.filter((g) => g.source !== "otb");
    expect(online.map((g) => [g.source, g.color, g.result])).toEqual([
      ["lichess", "white", "loss"],
      ["lichess", "white", "draw"],
      ["chesscom", "white", "win"],
      ["chesscom", "white", "win"],
    ]);
  });

  it("an online game is matched by that source's account only", () => {
    // "fixtureuser" is the Lichess account; on Chess.com it is someone else.
    const text = one(`[White "fixtureuser"]\n[Black "x"]\n[Result "1-0"]\n[TimeControl "60"]`);
    expect(run([{ source: "chesscom", text }]).summary.skipped["not-player"]).toBe(1);
    const noLichess: PlayerIdentity = { ...WHO, accounts: { lichess: null, chesscom: "liemle" } };
    expect(run([{ source: "lichess", text }], noLichess).summary.skipped["not-player"]).toBe(1);
  });

  it("OTB by FideId first, then by normalized alias", () => {
    const otb = run().games.filter((g) => g.source === "otb");
    expect(otb.map((g) => [g.color, g.result])).toEqual([
      ["white", "win"], // WhiteFideId 12401137
      ["black", "win"], // "Le, Quang Liem"
      ["white", "draw"], // "LE,  quang   LIEM"
      ["black", "loss"],
      ["white", "loss"],
    ]);
  });

  it("a FideId on the other side wins over a matching alias", () => {
    const text = one(`[White "Le Quang Liem"]\n[Black "Namesake"]\n[BlackFideId "12401137"]\n[Result "1-0"]`);
    expect(run([{ source: "otb", text }]).games.map((g) => g.color)).toEqual(["black"]);
  });

  it("a name that only contains an alias does not match", () => {
    const text = one(`[White "Le Quang Liem Junior"]\n[Black "x"]\n[Result "1-0"]`);
    expect(run([{ source: "otb", text }]).summary.skipped["not-player"]).toBe(1);
  });
});

describe("replay stops at the first rejected move", () => {
  it("keeps the moves before an illegal move and counts one drop", () => {
    const { games, summary } = run();
    const illegal = games.filter((g) => g.source === "otb")[4];
    expect(illegal.moves).toEqual(["e2e4", "e7e5"]);
    expect(summary.dropped).toBe(1);
  });

  it("turns SAN into UCI through comments, variations, NAGs, castling and promotion", () => {
    const { games } = run();
    expect(games[0].moves).toEqual(["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6"]);
    const chesscom = games.filter((g) => g.source === "chesscom");
    expect(chesscom[0].moves).toEqual(["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"]);
    expect(chesscom[1].moves.slice(-2)).toEqual(["h2g1q", "h1g1"]);
    const castle = one(
      `[White "Le Quang Liem"]\n[Black "x"]\n[Result "1-0"]`,
      "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O! Nf6 1-0"
    );
    expect(run([{ source: "otb", text: castle }]).games[0].moves.slice(-2)).toEqual([
      "e1g1",
      "g8f6",
    ]);
  });

  it("a rejected first move keeps the game with no moves", () => {
    const text = one(`[White "Le Quang Liem"]\n[Black "x"]\n[Result "1-0"]`, "1. e5 e5 1-0");
    const { games, summary } = run([{ source: "otb", text }]);
    expect(games.map((g) => g.moves)).toEqual([[]]);
    expect(summary.dropped).toBe(1);
  });
});

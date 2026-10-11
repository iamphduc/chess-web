// PGN text -> his games: filtered, deduped, colored and replayed through our engine.
import { Chess } from "chess.js";
import { applyMove } from "../../src/game/engine/engine";
import { initialGameState, type PieceColor } from "../../src/game/engine/game-state";
import { uciToMove } from "../../src/game/opponent/position";
import type { BookName, GameSource } from "../../src/game/opponent/types";
import { clockClass } from "./timecontrol";

/** Who he is in each source. */
export interface PlayerIdentity {
  fideId: number;
  aliases: string[];
  accounts: { lichess: string | null; chesscom: string };
}

export interface PgnFile {
  source: GameSource;
  text: string;
}

export type SkipReason =
  | "variant"
  | "setup"
  | "unfinished"
  | "not-player"
  | "no-clock"
  | "daily"
  | "duplicate";

/** One of his games, reduced to what the book needs. */
export interface ImportedGame {
  source: GameSource;
  book: BookName;
  color: PieceColor;
  /** His result. */
  result: "win" | "draw" | "loss";
  /** UCI moves from the start, cut before the first move our engine rejects. */
  moves: string[];
}

export interface GamesSummary {
  /** Games found in the PGN text. */
  read: number;
  kept: Record<GameSource, number>;
  skipped: Record<SkipReason, number>;
  /** Games cut short at a move our engine (or the parser) rejected. */
  dropped: number;
}

const TAG_LINE = /^\[([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/;
const RESULTS = ["1-0", "0-1", "1/2-1/2"];

/** Splits PGN text into one string per game. Handles CRLF and a BOM. */
export function splitPgn(text: string): string[] {
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const games: string[] = [];
  let current: string[] = [];
  let hasMoves = false;
  for (const line of lines) {
    const isTag = TAG_LINE.test(line);
    if (isTag && hasMoves) {
      games.push(current.join("\n").trim());
      current = [];
      hasMoves = false;
    }
    current.push(line);
    if (!isTag && line.trim() !== "") hasMoves = true;
  }
  const last = current.join("\n").trim();
  if (last !== "") games.push(last);
  return games;
}

function parseGame(pgn: string): { headers: Record<string, string>; movetext: string } {
  const headers: Record<string, string> = {};
  const moveLines: string[] = [];
  for (const line of pgn.split("\n")) {
    const tag = TAG_LINE.exec(line);
    if (tag) headers[tag[1]] = tag[2].replace(/\\(["\\])/g, "$1");
    // A ";" comment runs to the end of its line.
    else moveLines.push(line.replace(/;.*$/, ""));
  }
  return { headers, movetext: moveLines.join(" ") };
}

/** SAN tokens of the main line: no comments, variations, NAGs, numbers or result. */
function sanTokens(movetext: string): string[] {
  let text = movetext.replace(/\{[^}]*\}/g, " ");
  let out = "";
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  text = out.replace(/\$\d+/g, " ");
  return text
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.+/, "").replace(/[!?]+$/, ""))
    .filter((t) => t !== "" && t !== "e.p." && t !== "*" && !RESULTS.includes(t));
}

/** Case, commas and extra spaces don't matter. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
}

function hisColor(
  headers: Record<string, string>,
  source: GameSource,
  who: PlayerIdentity
): PieceColor | null {
  const white = headers.White ?? "";
  const black = headers.Black ?? "";
  let isWhite: boolean;
  let isBlack: boolean;
  if (source === "otb") {
    const id = String(who.fideId);
    if (headers.WhiteFideId === id || headers.BlackFideId === id) {
      isWhite = headers.WhiteFideId === id;
      isBlack = headers.BlackFideId === id;
    } else {
      const aliases = new Set(who.aliases.map(normalizeName));
      isWhite = aliases.has(normalizeName(white));
      isBlack = aliases.has(normalizeName(black));
    }
  } else {
    const account = who.accounts[source];
    if (account === null) return null;
    const lower = account.toLowerCase();
    isWhite = white.toLowerCase() === lower;
    isBlack = black.toLowerCase() === lower;
  }
  // Neither side, or both: not a game we can attribute to him.
  if (isWhite === isBlack) return null;
  return isWhite ? "white" : "black";
}

function bookFor(source: GameSource, tc: string | undefined): BookName | SkipReason {
  const cls = clockClass(tc);
  if (cls === "daily") return "daily";
  if (cls === "unknown") return source === "otb" ? "slow" : "no-clock";
  return cls;
}

function hisResult(result: string, color: PieceColor): ImportedGame["result"] {
  if (result === "1/2-1/2") return "draw";
  const whiteWon = result === "1-0";
  return whiteWon === (color === "white") ? "win" : "loss";
}

/** Plays the SAN moves; stops at the first one the parser or our engine rejects. */
function replay(tokens: string[]): { moves: string[]; complete: boolean } {
  const chess = new Chess();
  let state = initialGameState();
  const moves: string[] = [];
  for (const san of tokens) {
    let uci: string;
    try {
      const m = chess.move(san);
      uci = m.from + m.to + (m.promotion ?? "");
    } catch {
      return { moves, complete: false };
    }
    const ours = uciToMove(state, uci);
    if (ours === null) return { moves, complete: false };
    state = applyMove(state, ours);
    moves.push(uci);
  }
  return { moves, complete: true };
}

function emptySummary(): GamesSummary {
  return {
    read: 0,
    kept: { otb: 0, lichess: 0, chesscom: 0 },
    skipped: {
      variant: 0,
      setup: 0,
      unfinished: 0,
      "not-player": 0,
      "no-clock": 0,
      daily: 0,
      duplicate: 0,
    },
    dropped: 0,
  };
}

/**
 * His games from the PGN files, in file order. The first copy of a duplicate
 * (same White, Black, Date and move list) counts; later copies are skipped.
 */
export function selectGames(
  files: PgnFile[],
  who: PlayerIdentity
): { games: ImportedGame[]; summary: GamesSummary } {
  const summary = emptySummary();
  const games: ImportedGame[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    for (const pgn of splitPgn(file.text)) {
      summary.read++;
      const { headers, movetext } = parseGame(pgn);
      const skip = (reason: SkipReason) => summary.skipped[reason]++;

      const variant = headers.Variant;
      if (variant !== undefined && variant.toLowerCase() !== "standard") {
        skip("variant");
        continue;
      }
      if (headers.SetUp === "1" || headers.FEN !== undefined) {
        skip("setup");
        continue;
      }
      const result = headers.Result ?? "";
      if (!RESULTS.includes(result)) {
        skip("unfinished");
        continue;
      }
      const color = hisColor(headers, file.source, who);
      if (color === null) {
        skip("not-player");
        continue;
      }
      const book = bookFor(file.source, headers.TimeControl);
      if (book !== "slow" && book !== "online") {
        skip(book);
        continue;
      }
      const tokens = sanTokens(movetext);
      const key = [
        normalizeName(headers.White ?? ""),
        normalizeName(headers.Black ?? ""),
        headers.Date ?? "",
        tokens.map((t) => t.replace(/[+#]$/, "")).join(" "),
      ].join("|");
      if (seen.has(key)) {
        skip("duplicate");
        continue;
      }
      seen.add(key);

      const { moves, complete } = replay(tokens);
      if (!complete) summary.dropped++;
      summary.kept[file.source]++;
      games.push({ source: file.source, book, color, result: hisResult(result, color), moves });
    }
  }
  return { games, summary };
}

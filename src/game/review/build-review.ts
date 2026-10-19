// Relative imports only, no React.
import type { GameState } from "../engine/game-state";
import { lookupBook, type GameClock } from "../opponent/book";
import { uciToMove } from "../opponent/position";
import { moveGames, type Book, type BookMove, type BookName } from "../opponent/types";
import { gameAccuracy, LICHESS_START_WIN, lichessWinPercent } from "./game-accuracy";
import { gradeMove, winFor } from "./grade";
import { gameMoves, moveLabel } from "./moves";
import type {
  BuildReviewInput,
  Grade,
  KeyMoment,
  MoveRef,
  PositionEval,
  ReviewModel,
  ReviewMove,
} from "./types";

/** How many key moments the review picks (locked ones can make it more). */
export const KEY_MOMENTS = 3;

const SEVERITY: Record<Grade, number> = { inaccuracy: 1, mistake: 2, blunder: 3 };

export interface MomentCandidate {
  ply: number;
  grade: Grade;
  drop: number;
}

/** Bigger drop first, then the worse grade, then the earlier ply. */
function byRank(a: MomentCandidate, b: MomentCandidate): number {
  return b.drop - a.drop || SEVERITY[b.grade] - SEVERITY[a.grade] || a.ply - b.ply;
}

/**
 * The key moments' plies, in game order: every locked candidate, then the
 * best-ranked others up to `KEY_MOMENTS` in all. A locked ply that isn't a
 * candidate is left out.
 */
export function pickKeyMoments(
  candidates: readonly MomentCandidate[],
  locked: readonly number[]
): number[] {
  const lockedSet = new Set(locked.map(Number));
  const kept = candidates.filter((c) => lockedSet.has(c.ply));
  const free = Math.max(0, KEY_MOMENTS - kept.length);
  const others = candidates
    .filter((c) => !lockedSet.has(c.ply))
    .sort(byRank)
    .slice(0, free);
  return [...kept, ...others].map((c) => c.ply).sort((a, b) => a - b);
}

type Books = Record<BookName, Book>;

/** His moves at `state`, most games first, as MoveRefs; illegal ones skipped. */
function hisMoves(books: Books, state: GameState, clock: GameClock, ply: number): MoveRef[] {
  const found = lookupBook(books, state, clock);
  if (found === null) return [];
  return [...found.moves]
    .sort((a: BookMove, b: BookMove) => moveGames(b) - moveGames(a))
    .filter((m) => uciToMove(state, m[0]) !== null)
    .map((m) => ({ uci: m[0], label: moveLabel(state, m[0], ply), games: moveGames(m) }));
}

function refOf(state: GameState, uci: string | null, ply: number): MoveRef | null {
  if (uci === null || uciToMove(state, uci) === null) return null;
  return { uci, label: moveLabel(state, uci, ply) };
}

interface PlyText {
  uci: string;
  label: string;
}

/**
 * Each ply's UCI and label. They don't depend on the evals, and the store
 * keeps the same positions array while the evals come in, so they're kept
 * per array.
 */
const textCache = new WeakMap<readonly GameState[], PlyText[]>();

function plyTexts(positions: readonly GameState[]): PlyText[] {
  const cached = textCache.get(positions);
  if (cached !== undefined) return cached;
  const texts = gameMoves(positions).map((uci, ply) => ({ uci, label: moveLabel(positions[ply], uci, ply) }));
  textCache.set(positions, texts);
  return texts;
}

function reviewPly(
  input: BuildReviewInput,
  ply: number,
  { uci, label }: PlyText,
  evalAt: (i: number) => PositionEval | null
): ReviewMove {
  const { positions, humanColor, books, clock } = input;
  const state = positions[ply];
  const byHuman = state.turn === humanColor;
  const move: ReviewMove = {
    ply,
    label,
    uci,
    byHuman,
    bookGames: null,
    drop: null,
    accuracy: null,
    grade: null,
  };
  if (!byHuman) return move;

  if (books !== null) move.bookGames = lookupBook(books, positions[ply + 1], clock)?.games ?? null;
  const before = evalAt(ply);
  const after = evalAt(ply + 1);
  if (before !== null && after !== null) {
    const graded = gradeMove(before, after);
    move.drop = graded.drop;
    move.accuracy = graded.accuracy;
    move.grade = graded.grade;
  }
  if (move.bookGames !== null) {
    move.accuracy = 100;
    move.grade = null;
  }
  return move;
}

/**
 * The review of a finished game, from whatever evals are in so far. Throws a
 * RangeError when two neighbouring positions aren't one legal move apart.
 */
export function buildReview(input: BuildReviewInput): ReviewModel {
  const { positions, books, clock, evals } = input;
  const evalAt = (i: number): PositionEval | null => evals[i] ?? null;

  const moves = plyTexts(positions).map((text, ply) => reviewPly(input, ply, text, evalAt));
  const whiteWin = positions.map((p, i) => {
    const e = evalAt(i);
    return e === null ? null : winFor(e, p.turn, "white");
  });

  const counts: Record<Grade, number> = { inaccuracy: 0, mistake: 0, blunder: 0 };
  const candidates: MomentCandidate[] = [];
  for (const m of moves) {
    if (m.grade === null || m.drop === null) continue;
    counts[m.grade]++;
    candidates.push({ ply: m.ply, grade: m.grade, drop: m.drop });
  }

  const picked = new Set(pickKeyMoments(candidates, input.locked));
  const keyMoments = candidates.filter((c) => picked.has(c.ply)).map(({ ply, grade, drop }): KeyMoment => {
    const state = positions[ply];
    const liem = books === null ? [] : hisMoves(books, state, clock, ply);
    return {
      ply,
      grade,
      drop,
      played: { uci: moves[ply].uci, label: moves[ply].label },
      best: refOf(state, evalAt(ply)?.best ?? null, ply),
      liem: liem[0] ?? null,
    };
  });

  let bookPlies = 0;
  let leftBook: ReviewModel["leftBook"] = null;
  if (books !== null) {
    const left = moves.find((m) => m.byHuman && m.bookGames === null);
    if (left === undefined) {
      bookPlies = moves.length;
    } else {
      bookPlies = left.ply;
      leftBook = {
        ply: left.ply,
        played: { uci: left.uci, label: left.label },
        his: hisMoves(books, positions[left.ply], clock, left.ply),
      };
    }
  }

  return {
    moves,
    whiteWin,
    analysed: whiteWin.filter((w) => w !== null).length,
    total: positions.length,
    accuracy: gameAccuracy(
      positions.map((p, i) => {
        if (i === 0) return LICHESS_START_WIN;
        const e = evalAt(i);
        return e === null ? null : lichessWinPercent(e.score, p.turn);
      }),
      moves.map((_, ply) => positions[ply].turn),
      input.humanColor
    ),
    counts,
    keyMoments,
    bookPlies,
    leftBook,
  };
}

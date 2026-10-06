import { describe, expect, it } from "vitest";

import {
  boardSlice,
  clickSquare,
  movePiece,
  pickUp,
  promotePawn,
  reset,
  selectPiece,
  start,
  stop,
} from "../BoardSlice";
import { projectSquares } from "../engineAdapter";
import { GameOverType } from "../components/GameOver";
import { PiecePromoted } from "../components/Promotion";
import { PieceType } from "../../../game/piece-type";
import { EngineSquare, GameState, initialGameState } from "../../../game/engine/game-state";

const { reducer } = boardSlice;
type BoardState = ReturnType<typeof reducer>;
type Sq = readonly [number, number];

function fresh(): BoardState {
  return reducer(undefined, { type: "@@INIT" });
}

function seeded(engine: GameState): BoardState {
  return { ...fresh(), engineHistory: [engine], history: [{ squares: projectSquares(engine) }] };
}

function grid(pieces: [PieceType, Sq][]): EngineSquare[][] {
  const g = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null as EngineSquare));
  for (const [p, [y, x]] of pieces) g[y][x] = p;
  return g;
}

/** Algebraic square name to board coordinates (y = 0 is rank 8). */
function sq(name: string): Sq {
  return [8 - Number(name[1]), name.charCodeAt(0) - 97];
}

/** Drag-style move: select the piece on `from`, then movePiece. */
function drag(state: BoardState, from: string, to: string): BoardState {
  const [y, x] = sq(from);
  const pieceType = state.engineHistory[state.engineHistory.length - 1].squares[y][x] as PieceType;
  state = reducer(state, selectPiece({ pieceType, y, x }));
  const [ty, tx] = sq(to);
  return reducer(state, movePiece({ to: [ty, tx] }));
}

/** Click-to-move: click `from`, then `to`. */
function tap(state: BoardState, from: string, to: string): BoardState {
  const [y, x] = sq(from);
  const [ty, tx] = sq(to);
  state = reducer(state, clickSquare({ y, x }));
  return reducer(state, clickSquare({ y: ty, x: tx }));
}

function play(moves: [string, string][], how = drag, state = fresh()): BoardState {
  for (const [from, to] of moves) state = how(state, from, to);
  return state;
}

const kind = (state: BoardState) => state.moveSound?.kind ?? null;

/** White pawn on b7 about to promote, with the black king on `blackKing`. */
function promoting(blackKing: string, extra: [PieceType, Sq][] = []): BoardState {
  return seeded({
    ...initialGameState(),
    squares: grid([
      [PieceType.WhitePawnB, sq("b7")],
      [PieceType.WhiteKing, sq("a1")],
      [PieceType.BlackKing, sq(blackKing)],
      ...extra,
    ]),
  });
}

describe("move sound", () => {
  it("quiet, capture, en passant and castle sounds", () => {
    expect(fresh().moveSound).toBeNull();

    expect(kind(play([["e2", "e4"]]))).toBe("move");
    expect(kind(play([["e2", "e4"], ["d7", "d5"], ["e4", "d5"]]))).toBe("capture");

    // 1.e4 a6 2.e5 d5 3.exd6 e.p.
    const ep = play([["e2", "e4"], ["a7", "a6"], ["e4", "e5"], ["d7", "d5"], ["e5", "d6"]]);
    expect(ep.fallenPieces.length).toBe(1);
    expect(kind(ep)).toBe("capture");

    const castling = () =>
      seeded({
        ...initialGameState(),
        squares: grid([
          [PieceType.WhiteKing, sq("e1")],
          [PieceType.WhiteKingRook, sq("h1")],
          [PieceType.WhiteQueenRook, sq("a1")],
          [PieceType.BlackKing, sq("h8")],
        ]),
      });
    const short = drag(castling(), "e1", "g1");
    expect(short.notation).toEqual(["O-O"]);
    expect(kind(short)).toBe("castle");
    const long = drag(castling(), "e1", "c1");
    expect(long.notation).toEqual(["O-O-O"]);
    expect(kind(long)).toBe("castle");
  });

  it("check and checkmate sounds", () => {
    const check = play([["e2", "e4"], ["f7", "f5"], ["d1", "h5"]]);
    expect(check.notation[2]).toMatch(/\+$/);
    expect(kind(check)).toBe("check");

    const mate = play([["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
    expect(mate.gameOver).toBe(GameOverType.Win);
    expect(kind(mate)).toBe("game-end");
  });

  it("stalemate sound", () => {
    const state = seeded({
      ...initialGameState(),
      squares: grid([
        [PieceType.BlackKing, sq("a8")],
        [PieceType.WhiteKing, sq("b6")],
        [PieceType.WhiteQueen, sq("c4")],
      ]),
    });
    const after = drag(state, "c4", "c7");
    expect(after.gameOver).toBe(GameOverType.Draw);
    expect(kind(after)).toBe("game-end");
  });

  it("promotion sounds on the pick", () => {
    // A quiet move first, so there's a sound to keep.
    let state = drag(promoting("h6"), "a1", "a2");
    state = drag(state, "h6", "h5");
    const before = state.moveSound;
    expect(before?.kind).toBe("move");

    state = drag(state, "b7", "b8");
    expect(state.pendingPromotion).not.toBeNull();
    expect(state.moveSound).toBe(before);

    const picked = reducer(state, promotePawn({ piecePromoted: PiecePromoted.Knight }));
    expect(kind(picked)).toBe("promote");
    expect(picked.moveSound).not.toBe(before);

    // A promoted queen on b8 checks the king on h8.
    const checking = reducer(
      drag(promoting("h8"), "b7", "b8"),
      promotePawn({ piecePromoted: PiecePromoted.Queen })
    );
    expect(checking.notation[0]).toMatch(/\+$/);
    expect(kind(checking)).toBe("check");

    // A capturing promotion is "promote", not "capture".
    const capturing = reducer(
      drag(promoting("h6", [[PieceType.BlackQueenRook, sq("a8")]]), "b7", "a8"),
      promotePawn({ piecePromoted: PiecePromoted.Knight })
    );
    expect(capturing.fallenPieces.length).toBe(1);
    expect(kind(capturing)).toBe("promote");

    // Played by clicking too.
    const tapped = tap(promoting("h6"), "b7", "b8");
    expect(tapped.pendingPromotion).not.toBeNull();
    expect(tapped.moveSound).toBeNull();
    expect(kind(reducer(tapped, promotePawn({ piecePromoted: PiecePromoted.Rook })))).toBe(
      "promote"
    );
  });

  it("each ply stores a new sound", () => {
    const one = play([["e2", "e4"]]);
    const two = drag(one, "e7", "e5");
    expect(kind(one)).toBe("move");
    expect(kind(two)).toBe("move");
    expect(two.moveSound).not.toBe(one.moveSound);

    // Click-to-move stores the same kinds as drag.
    const line: [string, string][] = [
      ["e2", "e4"],
      ["d7", "d5"],
      ["e4", "d5"],
      ["d8", "d5"],
      ["f1", "b5"],
    ];
    const kinds = (how: typeof drag) => {
      const out: (string | null)[] = [];
      let s = fresh();
      for (const [from, to] of line) {
        const prev = s.moveSound;
        s = how(s, from, to);
        expect(s.moveSound).not.toBe(prev);
        out.push(kind(s));
      }
      return out;
    };
    expect(kinds(tap)).toEqual(["move", "move", "capture", "capture", "check"]);
    expect(kinds(tap)).toEqual(kinds(drag));

    // Moves after Play store sounds the same way as before Play.
    const playing = drag(reducer(fresh(), start()), "e2", "e4");
    expect(kind(playing)).toBe("move");
  });

  it("no sound without a completed ply", () => {
    const moved = play([["e2", "e4"]]);
    const sound = moved.moveSound;
    expect(sound).not.toBeNull();

    expect(reducer(moved, reset()).moveSound).toBeNull();

    // Selecting, deselecting and picking up keep the same object.
    const [y, x] = sq("e7");
    let s = reducer(moved, selectPiece({ pieceType: PieceType.BlackPawnE, y, x }));
    expect(s.selectedPiece).not.toBeNull();
    expect(s.moveSound).toBe(sound);
    s = reducer(s, selectPiece({ pieceType: PieceType.BlackPawnE, y, x }));
    expect(s.selectedPiece).toBeNull();
    expect(s.moveSound).toBe(sound);
    s = reducer(s, clickSquare({ y, x }));
    expect(s.selectedPiece).not.toBeNull();
    expect(s.moveSound).toBe(sound);
    s = reducer(s, clickSquare({ y, x }));
    expect(s.selectedPiece).toBeNull();
    expect(s.moveSound).toBe(sound);
    s = reducer(s, clickSquare({ y: 4, x: 0 })); // empty a4
    expect(s.moveSound).toBe(sound);
    s = reducer(s, pickUp({ y, x }));
    expect(s.selectedPiece).not.toBeNull();
    expect(s.moveSound).toBe(sound);

    // A flag fall plays nothing.
    const flagged = reducer(reducer(moved, start()), stop());
    expect(flagged.gameOver).toBe(GameOverType.Win);
    expect(flagged.moveSound).toBe(sound);

    // A promotion picked after a flag fall still sounds for its ply.
    let promo = drag(promoting("h6"), "b7", "b8");
    promo = reducer(reducer(promo, start()), stop());
    expect(promo.gameOver).toBe(GameOverType.Win);
    expect(promo.moveSound).toBeNull();
    promo = reducer(promo, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(promo.gameOver).toBe(GameOverType.Win);
    expect(kind(promo)).toBe("promote");
  });
});

import { describe, expect, it } from "vitest";

import {
  boardSlice,
  clickSquare,
  movePiece,
  newGame,
  pickUp,
  playOpponentMove,
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
import {
  EngineSquare,
  GameState,
  initialGameState,
  PieceColor,
} from "../../../game/engine/game-state";
import { PromotionKind } from "../../../game/engine/moves/promotion";

const { reducer } = boardSlice;
type BoardState = ReturnType<typeof reducer>;
type Sq = [number, number];

function fresh(): BoardState {
  return reducer(undefined, { type: "@@INIT" });
}

/** A vs-Liem game: the human plays `humanColor`. */
function vs(humanColor: PieceColor | null, state = fresh()): BoardState {
  return reducer(state, newGame({ humanColor }));
}

/** A position with `engine` as its only ply, and the human on `humanColor`. */
function seeded(engine: GameState, humanColor: PieceColor | null): BoardState {
  return {
    ...vs(humanColor),
    engineHistory: [engine],
    history: [{ squares: projectSquares(engine) }],
  };
}

function grid(pieces: [PieceType, string][]): EngineSquare[][] {
  const g = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null as EngineSquare));
  for (const [p, name] of pieces) {
    const [y, x] = sq(name);
    g[y][x] = p;
  }
  return g;
}

const NO_CASTLING = {
  white: { kingSide: false, queenSide: false },
  black: { kingSide: false, queenSide: false },
};

/** Algebraic square name to board coordinates (y = 0 is rank 8). */
function sq(name: string): Sq {
  return [8 - Number(name[1]), name.charCodeAt(0) - 97];
}

function turn(state: BoardState): PieceColor {
  return state.engineHistory[state.engineHistory.length - 1].turn;
}

function ply(state: BoardState): number {
  return state.engineHistory.length - 1;
}

/** Click-to-move: click `from`, then `to`. */
function tap(state: BoardState, from: string, to: string): BoardState {
  const [y, x] = sq(from);
  const [ty, tx] = sq(to);
  state = reducer(state, clickSquare({ y, x }));
  return reducer(state, clickSquare({ y: ty, x: tx }));
}

/** His move, for the current game and ply unless overridden. */
function his(
  state: BoardState,
  from: string,
  to: string,
  promotion?: PromotionKind,
  at: { gameId?: number; ply?: number } = {}
): BoardState {
  const move = promotion === undefined ? { from: sq(from), to: sq(to) } : { from: sq(from), to: sq(to), promotion };
  return reducer(
    state,
    playOpponentMove({ gameId: at.gameId ?? state.gameId, ply: at.ply ?? ply(state), move })
  );
}

/** Plays `moves` in turn: the human taps his own, and the opponent plays the rest. */
function playVs(humanColor: PieceColor, moves: [string, string][], state = vs(humanColor)): BoardState {
  for (const [from, to] of moves) {
    state = turn(state) === humanColor ? tap(state, from, to) : his(state, from, to);
  }
  return state;
}

/** The same moves, all by hand, in a two-player game. */
function playTwo(moves: [string, string][]): BoardState {
  let state = vs(null);
  for (const [from, to] of moves) state = tap(state, from, to);
  return state;
}

/** The parts of a ply a human move and his move must both produce. */
function plyView(state: BoardState) {
  return {
    engineHistory: state.engineHistory,
    history: state.history,
    notation: state.notation,
    lastMoves: state.lastMoves,
    fallenPieces: state.fallenPieces,
    moveSound: state.moveSound,
    pieceAttackedKing: state.pieceAttackedKing,
    gameOver: state.gameOver,
    selectedPiece: state.selectedPiece,
    possibleMoves: state.possibleMoves,
    pendingPromotion: state.pendingPromotion,
  };
}

describe("newGame and reset", () => {
  it("newGame and reset bump gameId", () => {
    const initial = fresh();
    expect(initial.gameId).toBe(0);
    expect(initial.humanColor).toBeNull();

    // A game in progress, so newGame has something to clear.
    let state = tap(reducer(initial, start()), "e2", "e4");
    state = reducer(state, newGame({ humanColor: "black" }));
    expect(state.gameId).toBe(1);
    expect(state.humanColor).toBe("black");
    expect(state.isPlaying).toBe(true);
    expect(state.engineHistory).toEqual([initialGameState()]);
    expect(state.history).toHaveLength(1);
    expect(state.notation).toEqual([]);
    expect(state.fallenPieces).toEqual([]);
    expect(state.gameOver).toBe(GameOverType.Continue);
    expect(state.moveSound).toBeNull();

    state = reducer(state, newGame({ humanColor: "white" }));
    expect(state.gameId).toBe(2);
    expect(state.humanColor).toBe("white");

    state = reducer(state, reset());
    expect(state.gameId).toBe(3);
    expect(state.humanColor).toBeNull();
    expect(state.isPlaying).toBe(false);
    // Apart from the id, reset is the page-load state.
    expect({ ...state, gameId: 0 }).toEqual(initial);

    // newGame with no human color is a two-player game whose clocks run.
    const two = reducer(state, newGame({ humanColor: null }));
    expect(two.gameId).toBe(4);
    expect(two.humanColor).toBeNull();
    expect(two.isPlaying).toBe(true);
  });
});

describe("input lock", () => {
  it("human input only on the human's turn", () => {
    // White's turn: the human (White) can select, pick up and move.
    let state = vs("white");
    const [ey, ex] = sq("e2");
    expect(reducer(state, selectPiece({ pieceType: PieceType.WhitePawnE, y: ey, x: ex })).selectedPiece).not.toBeNull();
    expect(reducer(state, pickUp({ y: ey, x: ex })).selectedPiece).not.toBeNull();
    state = tap(state, "e2", "e4");
    expect(state.notation).toEqual(["e4"]);

    // Black's turn: every human input leaves the state as it is.
    const [y, x] = sq("e7");
    expect(reducer(state, selectPiece({ pieceType: PieceType.BlackPawnE, y, x }))).toBe(state);
    expect(reducer(state, clickSquare({ y, x }))).toBe(state);
    expect(reducer(state, pickUp({ y, x }))).toBe(state);
    expect(tap(state, "e7", "e5")).toBe(state);
    // Even a selection somehow held for his piece can't be moved.
    const held = { ...state, selectedPiece: { pieceType: PieceType.BlackPawnE, y, x } };
    expect(reducer(held, movePiece({ to: sq("e5") }))).toBe(held);
    // And his turn doesn't let the human move White's pieces either.
    const [dy, dx] = sq("d2");
    expect(reducer(state, clickSquare({ y: dy, x: dx }))).toBe(state);

    // As Black, the human waits on White's first move.
    const asBlack = vs("black");
    expect(reducer(asBlack, clickSquare({ y: ey, x: ex }))).toBe(asBlack);
    expect(reducer(asBlack, pickUp({ y: ey, x: ex }))).toBe(asBlack);

    // Two players: nothing is locked.
    const two = tap(tap(vs(null), "e2", "e4"), "e7", "e5");
    expect(two.notation).toEqual(["e4", "e5"]);
    const page = tap(tap(fresh(), "e2", "e4"), "e7", "e5");
    expect(page.notation).toEqual(["e4", "e5"]);
  });
});

describe("playOpponentMove", () => {
  it("opponent move updates the board like a human move", () => {
    const cases: { human: PieceColor; moves: [string, string][]; last: string; sound: string }[] = [
      // quiet: 1.e4 e5 (he is Black)
      { human: "white", moves: [["e2", "e4"], ["e7", "e5"]], last: "e5", sound: "move" },
      // capture: 1.e4 d5 2.a3 dxe4
      {
        human: "white",
        moves: [["e2", "e4"], ["d7", "d5"], ["a2", "a3"], ["d5", "e4"]],
        last: "dxe4",
        sound: "capture",
      },
      // O-O: he is White, 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.O-O
      {
        human: "black",
        moves: [["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"], ["f1", "c4"], ["g8", "f6"], ["e1", "g1"]],
        last: "O-O",
        sound: "castle",
      },
      // en passant: 1.a3 e5 2.a4 e4 3.d4 exd3
      {
        human: "white",
        moves: [["a2", "a3"], ["e7", "e5"], ["a3", "a4"], ["e5", "e4"], ["d2", "d4"], ["e4", "d3"]],
        last: "exd3",
        sound: "capture",
      },
      // mate: 1.f3 e5 2.g4 Qh4#
      {
        human: "white",
        moves: [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]],
        last: "Qh4#",
        sound: "game-end",
      },
    ];

    for (const { human, moves, last, sound } of cases) {
      const vsState = playVs(human, moves);
      const twoState = playTwo(moves);
      expect(vsState.notation).toHaveLength(moves.length);
      expect(vsState.notation[moves.length - 1]).toBe(last);
      expect(vsState.moveSound?.kind).toBe(sound);
      expect(plyView(vsState)).toEqual(plyView(twoState));
    }

    const ep = playVs("white", [["a2", "a3"], ["e7", "e5"], ["a3", "a4"], ["e5", "e4"], ["d2", "d4"], ["e4", "d3"]]);
    expect(ep.fallenPieces).toHaveLength(1);
    expect(ep.lastMoves[ep.lastMoves.length - 1]).toEqual([sq("e4"), sq("d3")]);

    const mate = playVs("white", [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]);
    expect(mate.gameOver).toBe(GameOverType.Win);
    expect(mate.pieceAttackedKing).toBe(PieceType.WhiteKing);

    // Each ply gets a new sound object, even when the kind repeats.
    const a = playVs("white", [["e2", "e4"], ["e7", "e5"]]);
    const b = playVs("white", [["d2", "d4"]], a);
    const c = his(b, "d7", "d5");
    expect(c.moveSound?.kind).toBe("move");
    expect(c.moveSound).not.toBe(b.moveSound);
  });

  it("stale or illegal opponent moves are ignored", () => {
    // After 1.e4 it's his (Black's) turn: e7e5 would be accepted.
    const ready = tap(vs("white"), "e2", "e4");
    expect(his(ready, "e7", "e5").notation).toEqual(["e4", "e5"]);

    // Stale game id (older and newer).
    expect(his(ready, "e7", "e5", undefined, { gameId: ready.gameId - 1 })).toBe(ready);
    expect(his(ready, "e7", "e5", undefined, { gameId: ready.gameId + 1 })).toBe(ready);
    // Stale ply (older and newer).
    expect(his(ready, "e7", "e5", undefined, { ply: 0 })).toBe(ready);
    expect(his(ready, "e7", "e5", undefined, { ply: 2 })).toBe(ready);

    // The human's turn: his move for White is refused.
    const humansTurn = vs("white");
    expect(his(humansTurn, "e2", "e4")).toBe(humansTurn);
    // Two players: he never moves.
    const two = tap(vs(null), "e2", "e4");
    expect(his(two, "e7", "e5")).toBe(two);
    const page = tap(fresh(), "e2", "e4");
    expect(his(page, "e7", "e5")).toBe(page);

    // Game over: his flag fell.
    const flagged = reducer(ready, stop());
    expect(flagged.gameOver).toBe(GameOverType.Win);
    expect(his(flagged, "e7", "e5")).toBe(flagged);

    // Illegal: not a legal move, an empty square, a human piece, out of the board.
    expect(his(ready, "e7", "e4")).toBe(ready);
    expect(his(ready, "e5", "e4")).toBe(ready);
    expect(his(ready, "d2", "d4")).toBe(ready);
    expect(
      reducer(ready, playOpponentMove({ gameId: ready.gameId, ply: 1, move: { from: [9, 9], to: [8, 8] } }))
    ).toBe(ready);
    // A promotion on a move that isn't one.
    expect(his(ready, "e7", "e5", "queen")).toBe(ready);

    // A pending promotion: the human's pawn is on a8, the picker is open, and
    // the engine already says it's Black's turn.
    const promoting = seeded(
      {
        ...initialGameState(),
        squares: grid([
          [PieceType.WhitePawnA, "a7"],
          [PieceType.WhiteKing, "e1"],
          [PieceType.BlackKing, "h6"],
        ]),
        castling: NO_CASTLING,
      },
      "white"
    );
    const pending = tap(promoting, "a7", "a8");
    expect(pending.pendingPromotion).not.toBeNull();
    expect(turn(pending)).toBe("black");
    expect(his(pending, "h6", "h5")).toBe(pending);

    // His promotion with a missing promotion kind.
    const hisPawn = seeded(
      {
        ...initialGameState(),
        squares: grid([
          [PieceType.BlackPawnB, "b2"],
          [PieceType.WhiteKing, "h3"],
          [PieceType.BlackKing, "h6"],
        ]),
        turn: "black",
        castling: NO_CASTLING,
      },
      "white"
    );
    expect(his(hisPawn, "b2", "b1")).toBe(hisPawn);
    expect(his(hisPawn, "b2", "b1", "rook").notation).toEqual(["b1=R"]);
  });

  it("opponent promotion completes in one ply", () => {
    const position = (extra: [PieceType, string][] = []): BoardState =>
      seeded(
        {
          ...initialGameState(),
          squares: grid([
            [PieceType.BlackPawnB, "b2"],
            [PieceType.BlackKing, "h6"],
            ...extra,
          ]),
          turn: "black",
          castling: NO_CASTLING,
        },
        "white"
      );

    // Quiet promotion, no check: the promote sound.
    const quiet = position([[PieceType.WhiteKing, "h3"]]);
    const after = his(quiet, "b2", "b1", "queen");
    expect(after.engineHistory).toHaveLength(2);
    expect(after.history).toHaveLength(2);
    const promoted = after.engineHistory[1].squares[sq("b1")[0]][sq("b1")[1]];
    expect(promoted).not.toBeNull();
    expect(after.history[1].squares[sq("b1")[0]][sq("b1")[1]].pieceType).toBe(promoted);
    expect(promoted).not.toBe(PieceType.BlackPawnB);
    expect(after.notation).toEqual(["b1=Q"]);
    expect(after.pendingPromotion).toBeNull();
    expect(after.promotionPosition).toEqual([-1, -1]);
    expect(after.moveSound?.kind).toBe("promote");
    expect(after.lastMoves[after.lastMoves.length - 1]).toEqual([sq("b2"), sq("b1")]);
    expect(turn(after)).toBe("white");

    // A queen on b1 checks the king on d1 along the first rank.
    const check = his(position([[PieceType.WhiteKing, "d1"]]), "b2", "b1", "queen");
    expect(check.notation).toEqual(["b1=Q+"]);
    expect(check.pieceAttackedKing).toBe(PieceType.WhiteKing);
    expect(check.pendingPromotion).toBeNull();

    // A capture promotion: the fallen piece and the file letter, like a human's.
    const capture = his(
      position([
        [PieceType.WhiteKing, "h3"],
        [PieceType.WhiteQueenRook, "a1"],
      ]),
      "b2",
      "a1",
      "knight"
    );
    expect(capture.notation).toEqual(["bxa1=N"]);
    expect(capture.fallenPieces).toHaveLength(1);
    expect(capture.moveSound?.kind).toBe("promote");

    // The same ply by hand in a two-player game ends in the same board and notation.
    const byHand = (() => {
      let s = { ...position([[PieceType.WhiteKing, "d1"]]), humanColor: null };
      s = tap(s, "b2", "b1");
      return reducer(s, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    })();
    expect(plyView(check)).toEqual(plyView(byHand));
  });

  it("human promotion is not locked", () => {
    const state = seeded(
      {
        ...initialGameState(),
        squares: grid([
          [PieceType.WhitePawnA, "a7"],
          [PieceType.WhiteKing, "e1"],
          [PieceType.BlackKing, "h6"],
        ]),
        castling: NO_CASTLING,
      },
      "white"
    );
    const pending = tap(state, "a7", "a8");
    // The turn has already flipped to his side while the picker is open.
    expect(turn(pending)).toBe("black");
    const done = reducer(pending, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(done.pendingPromotion).toBeNull();
    expect(done.notation).toEqual(["a8=Q"]);
    expect(done.moveSound?.kind).toBe("promote");
    // Now it's his turn, and he can move.
    expect(his(done, "h6", "h5").notation).toEqual(["a8=Q", "Kh5"]);
  });
});

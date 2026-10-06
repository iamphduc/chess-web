import { describe, expect, it } from "vitest";

import {
  boardSlice,
  clickSquare,
  movePiece,
  pickUp,
  promotePawn,
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

function fresh(): BoardState {
  return reducer(undefined, { type: "@@INIT" });
}

function seeded(engine: GameState): BoardState {
  return { ...fresh(), engineHistory: [engine], history: [{ squares: projectSquares(engine) }] };
}

function emptyGrid(): EngineSquare[][] {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null as EngineSquare));
}

/** Click a square by its board coordinates. */
function click(state: BoardState, y: number, x: number): BoardState {
  return reducer(state, clickSquare({ y, x }));
}

function dests(state: BoardState): string[] {
  return state.possibleMoves.map(([y, x]) => `${y},${x}`).sort();
}

// Board coordinates: y = 0 is rank 8, x = 0 is the a-file.
const B1 = [7, 1] as const;
const E2 = [6, 4] as const;
const D2 = [6, 3] as const;
const E7 = [1, 4] as const;

describe("click to move", () => {
  it("click own piece selects it", () => {
    const state = click(fresh(), ...B1);
    expect(state.selectedPiece).toEqual({ pieceType: PieceType.WhiteQueenKnight, y: 7, x: 1 });
    expect(dests(state)).toEqual(["5,0", "5,2"]); // a3, c3
  });

  it("repeat click toggles selection", () => {
    let state = click(fresh(), ...B1);
    expect(state.selectedPiece).not.toBeNull();

    state = click(state, ...B1);
    expect(state.selectedPiece).toBeNull();
    expect(state.possibleMoves).toEqual([]);

    state = click(state, ...B1);
    expect(state.selectedPiece).toEqual({ pieceType: PieceType.WhiteQueenKnight, y: 7, x: 1 });
    expect(dests(state)).toEqual(["5,0", "5,2"]);
  });

  it("click elsewhere deselects", () => {
    // An empty square that isn't a legal destination for the knight.
    let state = click(click(fresh(), ...B1), 4, 4);
    expect(state.selectedPiece).toBeNull();
    expect(state.possibleMoves).toEqual([]);
    expect(state.history).toHaveLength(1);

    // An opponent piece that isn't a legal capture.
    state = click(click(fresh(), ...B1), ...E7);
    expect(state.selectedPiece).toBeNull();
    expect(state.possibleMoves).toEqual([]);
    expect(state.history).toHaveLength(1);

    // An empty square with nothing selected changes nothing.
    const before = fresh();
    expect(click(before, 4, 4)).toEqual(before);
  });

  it("click another own piece reselects", () => {
    let state = click(fresh(), ...B1);
    state = click(state, ...E2);
    expect(state.selectedPiece).toEqual({ pieceType: PieceType.WhitePawnE, y: 6, x: 4 });
    expect(dests(state)).toEqual(["4,4", "5,4"]); // e4, e3

    // An own piece with no legal moves also takes the selection in one click.
    state = click(state, 7, 0); // a1 rook, boxed in
    expect(state.selectedPiece).toEqual({ pieceType: PieceType.WhiteQueenRook, y: 7, x: 0 });
    expect(state.possibleMoves).toEqual([]);
  });

  it("click legal square moves", () => {
    // Quiet move: e2-e4 by clicks matches e2-e4 by movePiece.
    const byClick = click(click(fresh(), ...E2), 4, 4);
    const byMove = reducer(
      reducer(fresh(), selectPiece({ pieceType: PieceType.WhitePawnE, y: 6, x: 4 })),
      movePiece({ to: [4, 4] })
    );
    expect(byClick.notation).toEqual(["e4"]);
    expect(byClick.notation).toEqual(byMove.notation);
    expect(byClick.history).toEqual(byMove.history);
    expect(byClick.engineHistory).toEqual(byMove.engineHistory);
    expect(byClick.lastMoves).toEqual(byMove.lastMoves);
    expect(byClick.engineHistory[byClick.engineHistory.length - 1].turn).toBe("black");
    expect(byClick.selectedPiece).toBeNull();
    expect(byClick.possibleMoves).toEqual([]);

    // Capture: 1. e4 d5 2. exd5 by clicks.
    let state = click(click(fresh(), ...E2), 4, 4); // e4
    state = click(click(state, 1, 3), 3, 3); // d5
    state = click(state, 4, 4); // select e4 pawn
    expect(dests(state)).toContain("3,3");
    state = click(state, 3, 3); // exd5
    expect(state.notation).toEqual(["e4", "d5", "exd5"]);
    expect(state.history).toHaveLength(4);
    expect(state.engineHistory[state.engineHistory.length - 1].turn).toBe("black");
    expect(state.history[3].squares[3][3].pieceType).toBe(PieceType.WhitePawnE);
    expect(state.fallenPieces.length).toBeGreaterThan(0);
  });

  it("click into promotion waits for the picker", () => {
    // White: Ka1, Pb7; black: Kh6. b7-b8 waits for the picker.
    const grid = emptyGrid();
    grid[2][7] = PieceType.BlackKing;
    grid[7][0] = PieceType.WhiteKing;
    grid[1][1] = PieceType.WhitePawnB;
    let state = seeded({ ...initialGameState(), squares: grid });

    state = click(click(state, 1, 1), 0, 1);
    expect(state.pendingPromotion).toEqual({ from: [1, 1], to: [0, 1] });
    expect(state.promotionPosition).toEqual([0, 1]);

    // Any click (black king, white king, empty square, the pawn) changes nothing.
    const waiting = state;
    for (const [y, x] of [
      [2, 7],
      [7, 0],
      [4, 4],
      [0, 1],
    ] as const) {
      state = click(state, y, x);
      expect(state).toEqual(waiting);
      expect(reducer(state, pickUp({ y, x }))).toEqual(waiting);
    }

    state = reducer(state, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(state.pendingPromotion).toBeNull();
    expect(state.notation).toEqual(["b8=Q"]);

    // Black moves next by click.
    state = click(state, 2, 7);
    expect(state.selectedPiece?.pieceType).toBe(PieceType.BlackKing);
  });

  it("off-turn piece is ignored", () => {
    const before = fresh();
    expect(click(before, ...E7)).toEqual(before);
    expect(click(before, 0, 1)).toEqual(before); // black b8 knight

    // After white moves, a white piece is the off-turn one.
    const afterE4 = click(click(fresh(), ...E2), 4, 4);
    expect(click(afterE4, ...D2)).toEqual(afterE4);
  });

  it("piece with no moves still selects", () => {
    const state = click(fresh(), 7, 3); // d1 queen, boxed in
    expect(state.selectedPiece).toEqual({ pieceType: PieceType.WhiteQueen, y: 7, x: 3 });
    expect(state.possibleMoves).toEqual([]);
  });

  it("no clicks after game over", () => {
    // Checkmate: White Kf7, Qg4 vs black Kh8, Pa7; Qg7#.
    const grid = emptyGrid();
    grid[0][7] = PieceType.BlackKing;
    grid[1][0] = PieceType.BlackPawnA;
    grid[1][5] = PieceType.WhiteKing;
    grid[4][6] = PieceType.WhiteQueen;
    let mated = seeded({ ...initialGameState(), squares: grid });
    mated = click(click(mated, 4, 6), 1, 6);
    expect(mated.gameOver).toBe(GameOverType.Win);

    for (const [y, x] of [
      [1, 0],
      [0, 7],
      [1, 6],
      [4, 4],
    ] as const) {
      expect(click(mated, y, x)).toEqual(mated);
      expect(reducer(mated, pickUp({ y, x }))).toEqual(mated);
    }

    // Flag fall.
    const flagged = reducer(reducer(fresh(), start()), stop());
    expect(flagged.gameOver).toBe(GameOverType.Win);
    for (const [y, x] of [E2, E7, B1, [4, 4]] as const) {
      expect(click(flagged, y, x)).toEqual(flagged);
      expect(reducer(flagged, pickUp({ y, x }))).toEqual(flagged);
    }
  });

  it("pickUp never toggles", () => {
    // Selects an own piece.
    let state = reducer(fresh(), pickUp({ y: 7, x: 1 }));
    expect(state.selectedPiece).toEqual({ pieceType: PieceType.WhiteQueenKnight, y: 7, x: 1 });
    expect(dests(state)).toEqual(["5,0", "5,2"]);

    // Picking up the selected piece keeps it selected.
    state = reducer(state, pickUp({ y: 7, x: 1 }));
    expect(state.selectedPiece).toEqual({ pieceType: PieceType.WhiteQueenKnight, y: 7, x: 1 });
    expect(dests(state)).toEqual(["5,0", "5,2"]);

    // Picking up another own piece moves the selection to it.
    state = reducer(state, pickUp({ y: 6, x: 4 }));
    expect(state.selectedPiece).toEqual({ pieceType: PieceType.WhitePawnE, y: 6, x: 4 });

    // An off-turn piece clears the selection, so a drop can't move the old one.
    state = reducer(state, pickUp({ y: 1, x: 4 }));
    expect(state.selectedPiece).toBeNull();
    expect(state.possibleMoves).toEqual([]);
    const afterDrop = reducer(state, movePiece({ to: [4, 4] }));
    expect(afterDrop.history).toHaveLength(1);

    // An empty square clears it too.
    state = reducer(reducer(fresh(), pickUp({ y: 7, x: 1 })), pickUp({ y: 4, x: 4 }));
    expect(state.selectedPiece).toBeNull();
    expect(state.possibleMoves).toEqual([]);

    // A drag picked up then dropped on a legal square plays the move.
    state = reducer(reducer(fresh(), pickUp({ y: 6, x: 4 })), movePiece({ to: [4, 4] }));
    expect(state.notation).toEqual(["e4"]);
  });

  it("off-board click is treated as an empty square", () => {
    const selected = click(fresh(), ...B1);
    for (const [y, x] of [
      [-1, -1],
      [8, 0],
      [0, 8],
    ] as const) {
      const after = click(selected, y, x);
      expect(after.selectedPiece).toBeNull();
      expect(after.history).toHaveLength(1);
      expect(reducer(selected, pickUp({ y, x })).selectedPiece).toBeNull();
    }
  });

  it("castling and en passant by clicks", () => {
    // Castling: 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O
    let state = fresh();
    const plies: [number, number, number, number][] = [
      [6, 4, 4, 4],
      [1, 4, 3, 4],
      [7, 6, 5, 5],
      [0, 1, 2, 2],
      [7, 5, 4, 2],
      [0, 5, 3, 2],
      [7, 4, 7, 6],
    ];
    for (const [fy, fx, ty, tx] of plies) state = click(click(state, fy, fx), ty, tx);
    expect(state.notation[state.notation.length - 1]).toBe("O-O");
    expect(state.history[state.history.length - 1].squares[7][5].pieceType).toBe(
      PieceType.WhiteKingRook
    );

    // En passant: 1. e4 a6 2. e5 d5 3. exd6
    state = fresh();
    for (const [fy, fx, ty, tx] of [
      [6, 4, 4, 4],
      [1, 0, 2, 0],
      [4, 4, 3, 4],
      [1, 3, 3, 3],
      [3, 4, 2, 3],
    ] as [number, number, number, number][]) {
      state = click(click(state, fy, fx), ty, tx);
    }
    expect(state.notation[state.notation.length - 1]).toBe("exd6");
    expect(state.history[state.history.length - 1].squares[3][3].pieceType).toBeNull();
  });
});

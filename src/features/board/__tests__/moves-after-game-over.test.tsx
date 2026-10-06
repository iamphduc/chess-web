import { describe, expect, it } from "vitest";

import { boardSlice, movePiece, promotePawn, selectPiece, start, stop } from "../BoardSlice";
import { projectSquares } from "../engineAdapter";
import { GameOverType } from "../components/GameOver";
import { PiecePromoted } from "../components/Promotion";
import { PieceType } from "../../../game/piece-type";
import { EngineSquare, GameState, initialGameState } from "../../../game/engine/game-state";

const { reducer } = boardSlice;
type BoardState = ReturnType<typeof reducer>;

const E2 = { pieceType: PieceType.WhitePawnE, y: 6, x: 4 };
const E4: [number, number] = [4, 4];

function fresh(): BoardState {
  return reducer(undefined, { type: "@@INIT" });
}

function seeded(engine: GameState): BoardState {
  return { ...fresh(), engineHistory: [engine], history: [{ squares: projectSquares(engine) }] };
}

/** Play pressed, then white's flag falls (what Player.tsx dispatches). */
function flagFallen(): BoardState {
  return reducer(reducer(fresh(), start()), stop());
}

function emptyGrid(): EngineSquare[][] {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null as EngineSquare));
}

describe("moves after the game is over", () => {
  it("after a flag fall, selecting a piece does nothing", () => {
    const before = flagFallen();
    const after = reducer(before, selectPiece(E2));
    expect(after.selectedPiece).toBeNull();
    expect(after.possibleMoves).toEqual([]);
    expect(after).toEqual(before);
  });

  it("after a flag fall, a move does nothing and the result stays", () => {
    // A piece picked up before the flag fell must not be playable either.
    const picked = reducer(reducer(fresh(), start()), selectPiece(E2));
    const before = reducer(picked, stop());
    expect(before.selectedPiece).toBeNull(); // move hints vanish when the flag falls
    expect(before.possibleMoves).toEqual([]);
    const after = reducer(before, movePiece({ to: E4 }));
    expect(after.history).toHaveLength(1);
    expect(after.engineHistory).toHaveLength(1);
    expect(after.notation).toEqual([]);
    expect(after.gameOver).toBe(GameOverType.Win);
    expect(after.isPlaying).toBe(false);
  });

  it("after checkmate without clocks, the losing side cannot move", () => {
    // White: Kf7, Qg4; black: Kh8, Pa7. Qg7# — black has a pawn that could move.
    const grid = emptyGrid();
    grid[0][7] = PieceType.BlackKing;
    grid[1][0] = PieceType.BlackPawnA;
    grid[1][5] = PieceType.WhiteKing;
    grid[4][6] = PieceType.WhiteQueen;
    let state = seeded({ ...initialGameState(), squares: grid });
    state = reducer(state, selectPiece({ pieceType: PieceType.WhiteQueen, y: 4, x: 6 }));
    state = reducer(state, movePiece({ to: [1, 6] }));
    expect(state.gameOver).toBe(GameOverType.Win);

    const before = state;
    state = reducer(state, selectPiece({ pieceType: PieceType.BlackPawnA, y: 1, x: 0 }));
    state = reducer(state, movePiece({ to: [2, 0] }));
    expect(state).toEqual(before);
  });

  it("moves before Play still work", () => {
    let state = reducer(fresh(), selectPiece(E2));
    expect(state.possibleMoves).toContainEqual(E4);
    state = reducer(state, movePiece({ to: E4 }));
    expect(state.history).toHaveLength(2);
    expect(state.notation).toEqual(["e4"]);
    expect(state.gameOver).toBe(GameOverType.Continue);
  });

  it("a promotion picked after a flag fall keeps the flag-fall result", () => {
    // White: Ka1, Pb7; black: Kh8 (far away, so =Q is not mate). b8 waits for the picker.
    const grid = emptyGrid();
    grid[0][7] = PieceType.BlackKing;
    grid[7][0] = PieceType.WhiteKing;
    grid[1][1] = PieceType.WhitePawnB;
    let state = reducer(seeded({ ...initialGameState(), squares: grid }), start());
    state = reducer(state, selectPiece({ pieceType: PieceType.WhitePawnB, y: 1, x: 1 }));
    state = reducer(state, movePiece({ to: [0, 1] }));
    expect(state.pendingPromotion).not.toBeNull();

    state = reducer(state, stop()); // black's flag falls while white picks
    expect(state.gameOver).toBe(GameOverType.Win);

    state = reducer(state, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(state.gameOver).toBe(GameOverType.Win);
    expect(state.pendingPromotion).toBeNull();
    expect(state.notation).toEqual(["b8=Q"]);
  });
});

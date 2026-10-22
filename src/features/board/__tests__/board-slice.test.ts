import { describe, it, expect } from "vitest";

import { boardSlice, selectPiece, movePiece, promotePawn, reset } from "../BoardSlice";
import { projectSquares } from "../engineAdapter";
import { GameOverType } from "../gameOverType";
import { PiecePromoted } from "../piecePromoted";
import { PieceType } from "../../../game/piece-type";
import {
  EngineSquare,
  GameState,
  initialGameState,
} from "../../../game/engine/game-state";

const { reducer } = boardSlice;

/** The slice's initial state (engine seeded from the true starting position). */
function freshState() {
  return reducer(undefined, { type: "@@INIT" });
}

/** An empty 8x8 grid for hand-built scenarios. */
function emptyGrid(): EngineSquare[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
}

/** Build a BoardState seeded with a custom engine position (white to move). */
function stateFromEngine(engine: GameState) {
  return {
    ...freshState(),
    engineHistory: [engine],
    history: [{ squares: projectSquares(engine) }],
  };
}

describe("BoardSlice — engine wiring", () => {
  it("(a) a quiet move updates the projected squares and flips the turn", () => {
    let state = freshState();

    // White pawn e2 -> e4 (squares[6][4] -> squares[4][4]).
    state = reducer(state, selectPiece({ pieceType: PieceType.WhitePawnE, y: 6, x: 4 }));
    state = reducer(state, movePiece({ to: [4, 4] }));

    // Projected board reflects the move.
    expect(state.history[state.history.length - 1].squares[4][4].pieceType).toBe(
      PieceType.WhitePawnE
    );
    expect(state.history[state.history.length - 1].squares[6][4].pieceType).toBeNull();

    // Turn flipped to black (engine + history-length parity stay in lockstep).
    expect(state.engineHistory[state.engineHistory.length - 1].turn).toBe("black");
    expect(state.history.length).toBe(2);
    expect(state.history.length % 2 === 1).toBe(false); // components read "black turn"

    // lastMoves recorded the from/to for the highlight.
    const lastMove = state.lastMoves[state.lastMoves.length - 1];
    expect(lastMove).toEqual([
      [6, 4],
      [4, 4],
    ]);
  });

  it("(b) selectPiece populates possibleMoves from the engine", () => {
    let state = freshState();

    // A starting knight (b1, squares[7][1]) has exactly two legal moves: a3, c3.
    state = reducer(state, selectPiece({ pieceType: PieceType.WhiteQueenKnight, y: 7, x: 1 }));

    const dests = new Set(state.possibleMoves.map(([y, x]) => `${y},${x}`));
    expect(state.possibleMoves.length).toBe(2);
    expect(dests.has("5,0")).toBe(true); // a3
    expect(dests.has("5,2")).toBe(true); // c3

    // Re-selecting the same piece deselects (toggle), clearing possibleMoves.
    state = reducer(state, selectPiece({ pieceType: PieceType.WhiteQueenKnight, y: 7, x: 1 }));
    expect(state.selectedPiece).toBeNull();
    expect(state.possibleMoves).toEqual([]);
  });

  it("(c) promotion sets promotionPosition, then promotePawn lands a promoted id", () => {
    const grid = emptyGrid();
    grid[7][4] = PieceType.WhiteKing;
    grid[0][7] = PieceType.BlackKing;
    grid[1][0] = PieceType.WhitePawnA; // one step from the last rank (row 0)
    const engine: GameState = { ...initialGameState(), squares: grid };

    let state = stateFromEngine(engine);

    // Select the pawn — pushing to [0,0] (promotion) is a legal destination.
    state = reducer(state, selectPiece({ pieceType: PieceType.WhitePawnA, y: 1, x: 0 }));
    const dests = new Set(state.possibleMoves.map(([y, x]) => `${y},${x}`));
    expect(dests.has("0,0")).toBe(true);

    // Move onto the last rank: the picker opens (no turn handed back yet beyond
    // the ply push), promotionPosition + pendingPromotion are set.
    state = reducer(state, movePiece({ to: [0, 0] }));
    expect(state.promotionPosition).toEqual([0, 0]);
    expect(state.pendingPromotion).toEqual({ from: [1, 0], to: [0, 0] });

    // Choose a queen: the engine square now holds a promoted queen id.
    state = reducer(state, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    const promoted = state.engineHistory[state.engineHistory.length - 1].squares[0][0];
    expect(promoted).toBe(PieceType.WhiteQueenPromoted1);
    expect(state.history[state.history.length - 1].squares[0][0].pieceType).toBe(
      PieceType.WhiteQueenPromoted1
    );

    // Picker cleared, turn now belongs to black.
    expect(state.promotionPosition).toEqual([-1, -1]);
    expect(state.pendingPromotion).toBeNull();
    expect(state.engineHistory[state.engineHistory.length - 1].turn).toBe("black");

    // Notation carries the promotion suffix.
    expect(state.notation[state.notation.length - 1]).toContain("=Q");
  });

  it("(d) reset fully clears state across two consecutive games", () => {
    // A position where the white pawn can capture-AND-promote, so the game ends
    // with a captured piece AND an advanced promotion counter.
    const grid = emptyGrid();
    grid[7][4] = PieceType.WhiteKing;
    grid[0][7] = PieceType.BlackKing;
    grid[1][0] = PieceType.WhitePawnA;
    grid[0][1] = PieceType.BlackQueenKnight; // capturable on the last rank
    const engine: GameState = { ...initialGameState(), squares: grid };

    let state = stateFromEngine(engine);

    // Capture-promote: pawn [1,0] x [0,1].
    state = reducer(state, selectPiece({ pieceType: PieceType.WhitePawnA, y: 1, x: 0 }));
    expect(new Set(state.possibleMoves.map(([y, x]) => `${y},${x}`)).has("0,1")).toBe(true);
    state = reducer(state, movePiece({ to: [0, 1] }));
    state = reducer(state, promotePawn({ piecePromoted: PiecePromoted.Rook }));

    // Pre-reset: the captured knight is gone from the board, notation is
    // non-empty, and the engine's promotionCount advanced (a rook was handed out).
    const taken = state.history[state.history.length - 1].squares
      .flat()
      .filter((sq) => sq.pieceType === PieceType.BlackQueenKnight);
    expect(taken).toEqual([]);
    expect(state.notation.length).toBeGreaterThan(0);
    const counts = state.engineHistory[state.engineHistory.length - 1].promotionCount;
    expect(counts.some((c) => c > 0)).toBe(true);

    // --- reset ---
    state = reducer(state, reset());

    // Every UI-facing field is back to its initial value.
    expect(state.history.length).toBe(1);
    expect(state.engineHistory.length).toBe(1);
    expect(state.engineHistory[0]).toEqual(initialGameState());
    expect(state.notation).toEqual([]);
    expect(state.possibleMoves).toEqual([]);
    expect(state.promotionPosition).toEqual([-1, -1]);
    expect(state.pendingPromotion).toBeNull();
    expect(state.selectedPiece).toBeNull();
    expect(state.pieceAttackedKing).toBeNull();
    expect(state.gameOver).toBe(GameOverType.Continue);

    // The projected board equals a brand-new game's projection.
    expect(state.history[0].squares).toEqual(projectSquares(initialGameState()));

    // --- a fresh game behaves identically to a never-touched one ---
    const reference = (() => {
      let s = freshState();
      s = reducer(s, selectPiece({ pieceType: PieceType.WhitePawnE, y: 6, x: 4 }));
      return reducer(s, movePiece({ to: [4, 4] }));
    })();

    let replay = state;
    replay = reducer(replay, selectPiece({ pieceType: PieceType.WhitePawnE, y: 6, x: 4 }));
    replay = reducer(replay, movePiece({ to: [4, 4] }));

    expect(replay.history[replay.history.length - 1].squares).toEqual(
      reference.history[reference.history.length - 1].squares
    );
    expect(replay.engineHistory[replay.engineHistory.length - 1].turn).toBe(
      reference.engineHistory[reference.engineHistory.length - 1].turn
    );
    expect(replay.notation).toEqual(reference.notation);
  });
});

describe("BoardSlice — moved and dropped fields", () => {
  it("promotePawn with PiecePromoted from its own module", async () => {
    expect(Object.entries(PiecePromoted)).toEqual([
      ["Queen", "QUEEN"],
      ["Rook", "ROOK"],
      ["Bishop", "BISHOP"],
      ["Knight", "KNIGHT"],
    ]);
    // The picker component uses it but doesn't hand it out.
    const promotionModule: Record<string, unknown> = await import("../components/Promotion");
    expect("PiecePromoted" in promotionModule).toBe(false);

    // A pick still promotes: Black's pawn on h2 becomes a knight on h1.
    const grid = emptyGrid();
    grid[7][0] = PieceType.WhiteKing;
    grid[0][4] = PieceType.BlackKing;
    grid[6][7] = PieceType.BlackPawnH;
    let state = stateFromEngine({ ...initialGameState(), squares: grid, turn: "black" });
    state = reducer(state, selectPiece({ pieceType: PieceType.BlackPawnH, y: 6, x: 7 }));
    state = reducer(state, movePiece({ to: [7, 7] }));
    state = reducer(state, promotePawn({ piecePromoted: PiecePromoted.Knight }));
    expect(state.engineHistory[state.engineHistory.length - 1].squares[7][7]).toBe(
      PieceType.BlackKnightPromoted1
    );
    expect(state.notation).toEqual(["h1=N"]);
  });

  it("reset returns a fresh state with no fallenPieces", () => {
    const fresh = freshState();
    expect("fallenPieces" in fresh).toBe(false);

    // 1.e4 d5 2.exd5: a capture, then reset.
    let state = fresh;
    for (const [pieceType, y, x, to] of [
      [PieceType.WhitePawnE, 6, 4, [4, 4]],
      [PieceType.BlackPawnD, 1, 3, [3, 3]],
      [PieceType.WhitePawnE, 4, 4, [3, 3]],
    ] as const) {
      state = reducer(state, selectPiece({ pieceType, y, x }));
      state = reducer(state, movePiece({ to }));
    }
    expect(state.notation).toEqual(["e4", "d5", "exd5"]);
    expect("fallenPieces" in state).toBe(false);

    const after = reducer(state, reset());
    expect("fallenPieces" in after).toBe(false);
    expect({ ...after, gameId: 0 }).toEqual(fresh);
  });
});

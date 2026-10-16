import { describe, expect, it } from "vitest";

import { applyMove } from "game/engine/engine";
import { type EngineSquare, type GameState, initialGameState } from "game/engine/game-state";
import { uciToMove } from "game/opponent/position";
import { PieceType } from "game/piece-type";
import { choosePromotion, clickSquare, NO_SELECTION, targetsOf, type TrySelection } from "../tryBoard";

const P = PieceType;

function play(start: GameState, ucis: readonly string[]): GameState {
  return ucis.reduce((state, uci) => {
    const move = uciToMove(state, uci);
    if (move === null) throw new Error(`rejected ${uci}`);
    return applyMove(state, move);
  }, start);
}

const NO_RIGHTS = {
  white: { kingSide: false, queenSide: false },
  black: { kingSide: false, queenSide: false },
};

function board(pieces: Record<string, PieceType>, turn: "white" | "black" = "white"): GameState {
  const grid: EngineSquare[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => null as EngineSquare)
  );
  for (const [sq, piece] of Object.entries(pieces)) {
    grid[8 - Number(sq[1])]["abcdefgh".indexOf(sq[0])] = piece;
  }
  return { ...initialGameState(), squares: grid, castling: NO_RIGHTS, turn };
}

/** Clicks the squares in order and returns the last step. */
function clicks(game: GameState, squares: string[], from: TrySelection = NO_SELECTION) {
  let step = { selection: from, move: null as string | null };
  for (const sq of squares) step = clickSquare(game, step.selection, sq);
  return step;
}

describe("tryBoard", () => {
  it("click to move", () => {
    const start = initialGameState();

    // Nothing selected: an empty square or a piece of the side not to move does nothing.
    expect(clickSquare(start, NO_SELECTION, "e4")).toEqual({ selection: NO_SELECTION, move: null });
    expect(clickSquare(start, NO_SELECTION, "e7")).toEqual({ selection: NO_SELECTION, move: null });

    // Select a piece of the side to move; its legal targets are listed.
    const picked = clickSquare(start, NO_SELECTION, "e2");
    expect(picked).toEqual({ selection: { selected: "e2", promotion: null }, move: null });
    expect(targetsOf(start, picked.selection).sort()).toEqual(["e3", "e4"]);

    // Another own piece changes the selection; the same square deselects.
    expect(clicks(start, ["e2", "g1"]).selection.selected).toBe("g1");
    expect(clicks(start, ["e2", "e2"])).toEqual({ selection: NO_SELECTION, move: null });

    // An illegal target clears the selection and plays nothing.
    expect(clicks(start, ["e2", "e5"])).toEqual({ selection: NO_SELECTION, move: null });
    expect(clicks(start, ["g1", "e7"])).toEqual({ selection: NO_SELECTION, move: null });

    // A legal target gives the move in UCI and clears the selection.
    expect(clicks(start, ["e2", "e4"])).toEqual({ selection: NO_SELECTION, move: "e2e4" });
    expect(clicks(start, ["g1", "f3"]).move).toBe("g1f3");

    // Only the side to move: with Black to move, White's pieces don't select.
    const blackToMove = play(start, ["e2e4"]);
    expect(clickSquare(blackToMove, NO_SELECTION, "d2").selection).toEqual(NO_SELECTION);
    expect(clicks(blackToMove, ["c7", "c5"]).move).toBe("c7c5");

    // Castling is the king's two-square move; en passant lands on the empty square.
    const castle = play(start, ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"]);
    expect(clicks(castle, ["e1", "g1"]).move).toBe("e1g1");
    const ep = play(start, ["e2e4", "a7a6", "e4e5", "d7d5"]);
    expect(clicks(ep, ["e5", "d6"]).move).toBe("e5d6");

    // Capturing an enemy piece works; a selection with no targets still deselects on another click.
    const capture = play(start, ["e2e4", "d7d5"]);
    expect(clicks(capture, ["e4", "d5"]).move).toBe("e4d5");
    expect(clicks(start, ["a1", "a3"])).toEqual({ selection: NO_SELECTION, move: null });

    // No selection, no targets.
    expect(targetsOf(start, NO_SELECTION)).toEqual([]);
  });

  it("promotion", () => {
    const game = board({ e7: P.WhitePawnE, d8: P.BlackQueenRook, a1: P.WhiteKing, h8: P.BlackKing });

    // A pawn reaching the last rank waits for the piece: no move yet.
    const waiting = clicks(game, ["e7", "e8"]);
    expect(waiting).toEqual({ selection: { selected: "e7", promotion: { from: "e7", to: "e8" } }, move: null });
    // One target square per promotion, not four.
    expect(targetsOf(game, clickSquare(game, NO_SELECTION, "e7").selection).sort()).toEqual(["d8", "e8"]);

    // The piece gives e7e8q style UCI and clears the selection.
    expect(choosePromotion(game, waiting.selection, "q")).toEqual({ selection: NO_SELECTION, move: "e7e8q" });
    expect(choosePromotion(game, waiting.selection, "n").move).toBe("e7e8n");
    const captureWait = clicks(game, ["e7", "d8"]);
    expect(choosePromotion(game, captureWait.selection, "r").move).toBe("e7d8r");

    // A square click while waiting cancels the promotion and plays nothing.
    expect(clickSquare(game, waiting.selection, "a1")).toEqual({ selection: NO_SELECTION, move: null });
    // Choosing with no promotion pending does nothing.
    expect(choosePromotion(game, NO_SELECTION, "q")).toEqual({ selection: NO_SELECTION, move: null });

    // Black promotes on rank 1.
    const black = board({ b2: P.BlackPawnB, h8: P.BlackKing, h1: P.WhiteKing }, "black");
    const blackWait = clicks(black, ["b2", "b1"]);
    expect(blackWait.move).toBeNull();
    expect(choosePromotion(black, blackWait.selection, "b").move).toBe("b2b1b");
  });
});

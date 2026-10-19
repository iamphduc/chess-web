import { describe, expect, it } from "vitest";

import { applyMove } from "game/engine/engine";
import { EngineSquare, GameState, initialGameState, PromotionCount } from "game/engine/game-state";
import { uciToMove } from "game/opponent/position";
import { PieceType } from "game/piece-type";
import { materialLine } from "../material";

/** The start position after `moves` (UCI), each checked legal. */
function play(...moves: string[]): GameState {
  return moves.reduce((state, uci) => {
    const move = uciToMove(state, uci);
    if (!move) throw new Error(`illegal in test: ${uci}`);
    return applyMove(state, move);
  }, initialGameState());
}

const at = (name: string): [number, number] => [8 - Number(name[1]), "abcdefgh".indexOf(name[0])];

/** The start position with some squares changed by hand, for positions too long to play out. */
function edited(changes: Record<string, EngineSquare>, promotionCount?: PromotionCount): GameState {
  const start = initialGameState();
  const squares = start.squares.map((row) => [...row]);
  for (const [name, piece] of Object.entries(changes)) {
    const [y, x] = at(name);
    squares[y][x] = piece;
  }
  return { ...start, squares, promotionCount: promotionCount ?? start.promotionCount };
}

describe("materialLine", () => {
  it("start position", () => {
    const start = initialGameState();
    expect(materialLine(start, "white")).toEqual({ captured: [], advantage: 0 });
    expect(materialLine(start, "black")).toEqual({ captured: [], advantage: 0 });
  });

  it("a capture", () => {
    // 1.e4 Nf6 2.Nc3 Ng4 3.Qxg4: White takes a knight.
    const state = play("e2e4", "g8f6", "b1c3", "f6g4", "d1g4");
    expect(materialLine(state, "white")).toEqual({ captured: ["knight"], advantage: 3 });
    expect(materialLine(state, "black")).toEqual({ captured: [], advantage: 0 });
  });

  it("an equal trade", () => {
    // 1.e4 d5 2.exd5 Qxd5: a pawn each.
    const state = play("e2e4", "d7d5", "e4d5", "d8d5");
    expect(materialLine(state, "white")).toEqual({ captured: ["pawn"], advantage: 0 });
    expect(materialLine(state, "black")).toEqual({ captured: ["pawn"], advantage: 0 });
  });

  it("the side behind has no advantage, and captures read highest value first", () => {
    // Black is missing his queen, a rook and two pawns; White a knight.
    const state = edited({ d8: null, h8: null, a7: null, b7: null, g1: null });
    expect(materialLine(state, "white")).toEqual({
      captured: ["queen", "rook", "pawn", "pawn"],
      advantage: 9 + 5 + 2 - 3,
    });
    expect(materialLine(state, "black")).toEqual({ captured: ["knight"], advantage: 0 });
  });

  it("an en-passant capture counts", () => {
    // 1.e4 a6 2.e5 d5 3.exd6 e.p.
    const state = play("e2e4", "a7a6", "e4e5", "d7d5", "e5d6");
    expect(materialLine(state, "white")).toEqual({ captured: ["pawn"], advantage: 1 });
  });

  it("promotions count", () => {
    // White's a-pawn took the b8 knight and became a queen: +3 for the knight, +8 for the promotion.
    const promoted = edited(
      { a2: null, b8: PieceType.WhiteQueenPromoted1 },
      [1, 0, 0, 0, 0, 0, 0, 0]
    );
    expect(materialLine(promoted, "white")).toEqual({ captured: ["knight"], advantage: 3 + 8 });
    // The pawn wasn't taken, so Black has captured nothing.
    expect(materialLine(promoted, "black")).toEqual({ captured: [], advantage: 0 });

    // A pawn really taken still shows, beside one that promoted.
    const both = edited(
      { a2: null, b2: null, b8: PieceType.WhiteQueenPromoted1 },
      [1, 0, 0, 0, 0, 0, 0, 0]
    );
    expect(materialLine(both, "black")).toEqual({ captured: ["pawn"], advantage: 0 });
    expect(materialLine(both, "white")).toEqual({ captured: ["knight"], advantage: 3 + 8 - 1 });

    // Black then takes the new queen: it counts as a queen, not a pawn. White is still a
    // knight for a pawn up.
    const retaken = edited({ a2: null, b8: null }, [1, 0, 0, 0, 0, 0, 0, 0]);
    expect(materialLine(retaken, "black")).toEqual({ captured: ["queen"], advantage: 0 });
    expect(materialLine(retaken, "white")).toEqual({ captured: ["knight"], advantage: 3 - 1 });

    // An under-promotion counts as its new kind too (Black's h-pawn became a knight).
    const knight = edited({ h7: null, h1: PieceType.BlackKnightPromoted1 }, [0, 0, 0, 0, 0, 0, 0, 1]);
    expect(materialLine(knight, "black")).toEqual({ captured: ["rook"], advantage: 5 + 2 });
  });
});

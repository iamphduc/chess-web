import { describe, it, expect } from "vitest";
import { allocatePromotedId, PromotionKind } from "../promotion";
import { PieceColor, PromotionCount } from "../../game-state";
import { PieceType } from "../../../piece-type";

const ZERO: PromotionCount = [0, 0, 0, 0, 0, 0, 0, 0];

/** First id (`*Promoted1`) handed out for each (color, kind) at zero counts. */
const FIRST_ID: Record<PieceColor, Record<PromotionKind, PieceType>> = {
  white: {
    queen: PieceType.WhiteQueenPromoted1,
    rook: PieceType.WhiteRookPromoted1,
    bishop: PieceType.WhiteBishopPromoted1,
    knight: PieceType.WhiteKnightPromoted1,
  },
  black: {
    queen: PieceType.BlackQueenPromoted1,
    rook: PieceType.BlackRookPromoted1,
    bishop: PieceType.BlackBishopPromoted1,
    knight: PieceType.BlackKnightPromoted1,
  },
};

/** The slot each (color, kind) maps into within the 8-slot tuple. */
const SLOT: [PieceColor, PromotionKind, number][] = [
  ["white", "queen", 0],
  ["white", "rook", 1],
  ["white", "bishop", 2],
  ["white", "knight", 3],
  ["black", "queen", 4],
  ["black", "rook", 5],
  ["black", "bishop", 6],
  ["black", "knight", 7],
];

describe("allocatePromotedId: slot mapping", () => {
  it.each(SLOT)(
    "(%s, %s) increments exactly slot %i and hands out the first id",
    (color, kind, slot) => {
      const { id, nextCounts } = allocatePromotedId(color, kind, ZERO);

      expect(id).toBe(FIRST_ID[color][kind]);

      // Exactly the mapped slot incremented; all others untouched.
      const expected = ZERO.map((_, i) => (i === slot ? 1 : 0));
      expect(nextCounts).toEqual(expected);
    }
  );
});

describe("allocatePromotedId: sequential hand-out", () => {
  it("hands out Promoted1..4 in order for the same (color, kind)", () => {
    let counts: PromotionCount = ZERO;
    const ids: PieceType[] = [];
    for (let i = 0; i < 4; i++) {
      const res = allocatePromotedId("white", "queen", counts);
      ids.push(res.id);
      counts = res.nextCounts;
    }

    expect(ids).toEqual([
      PieceType.WhiteQueenPromoted1,
      PieceType.WhiteQueenPromoted2,
      PieceType.WhiteQueenPromoted3,
      PieceType.WhiteQueenPromoted4,
    ]);
    expect(counts[0]).toBe(4);
  });

  it("clamps a 5th same-type promotion to the 4th id but still increments", () => {
    const counts: PromotionCount = [4, 0, 0, 0, 0, 0, 0, 0];
    const { id, nextCounts } = allocatePromotedId("white", "queen", counts);
    expect(id).toBe(PieceType.WhiteQueenPromoted4);
    expect(nextCounts[0]).toBe(5);
  });
});

describe("allocatePromotedId: purity", () => {
  it("does not mutate the input counts tuple", () => {
    const counts: PromotionCount = [0, 0, 0, 0, 0, 0, 0, 0];
    const snapshot = [...counts];
    const { nextCounts } = allocatePromotedId("black", "knight", counts);

    expect(counts).toEqual(snapshot);
    expect(nextCounts).not.toBe(counts);
  });
});

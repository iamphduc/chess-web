import { describe, expect, it } from "vitest";

import { squareMarks, SquareMarkInput } from "../squareMarks";

const none: SquareMarkInput = {
  isLastMove: false,
  isSelected: false,
  isPossibleMove: false,
  hasPiece: false,
  isCheckedKing: false,
  isOver: false,
  canDrop: false,
};

const blank = { highlight: false, hint: null, check: false, dropEdge: false };

describe("squareMarks", () => {
  it("one yellow tint for last move and selection", () => {
    expect(squareMarks(none)).toEqual(blank);
    expect(squareMarks({ ...none, isLastMove: true }).highlight).toBe(true);
    expect(squareMarks({ ...none, isSelected: true, hasPiece: true }).highlight).toBe(true);
    // Both at once is still one tint, not a second, darker layer.
    expect(squareMarks({ ...none, isLastMove: true, isSelected: true, hasPiece: true })).toEqual({
      ...blank,
      highlight: true,
    });
  });

  it("dot on empty, ring on capture", () => {
    expect(squareMarks({ ...none, isPossibleMove: true }).hint).toBe("dot");
    expect(squareMarks({ ...none, isPossibleMove: true, hasPiece: true }).hint).toBe("ring");
    expect(squareMarks({ ...none, hasPiece: true }).hint).toBeNull();
    expect(squareMarks(none).hint).toBeNull();
    // A legal square that is also the last move keeps both marks.
    expect(squareMarks({ ...none, isPossibleMove: true, isLastMove: true })).toEqual({
      ...blank,
      highlight: true,
      hint: "dot",
    });
  });

  it("drop edge only on legal drag-over", () => {
    expect(squareMarks({ ...none, isPossibleMove: true, isOver: true, canDrop: true }).dropEdge).toBe(
      true
    );
    // Illegal drag-over adds nothing at all.
    expect(squareMarks({ ...none, isOver: true, canDrop: false })).toEqual(blank);
    expect(squareMarks({ ...none, hasPiece: true, isLastMove: true, isOver: true })).toEqual(
      squareMarks({ ...none, hasPiece: true, isLastMove: true })
    );
    // canDrop without the pointer over the square is not a drop edge.
    expect(squareMarks({ ...none, isPossibleMove: true, canDrop: true }).dropEdge).toBe(false);
  });

  it("check glow on king square", () => {
    expect(squareMarks({ ...none, hasPiece: true, isCheckedKing: true }).check).toBe(true);
    expect(squareMarks({ ...none, hasPiece: true }).check).toBe(false);
    // Board compares the checked king's type to each square's piece type, so an empty
    // square matches when nobody is in check (null === null). Only a piece glows.
    expect(squareMarks({ ...none, isCheckedKing: true }).check).toBe(false);
    expect(squareMarks({ ...none, isLastMove: true, isPossibleMove: true }).check).toBe(false);
    // Selecting the checked king shows both the tint and the glow.
    expect(
      squareMarks({ ...none, hasPiece: true, isCheckedKing: true, isSelected: true })
    ).toEqual({ ...blank, highlight: true, check: true });
  });
});

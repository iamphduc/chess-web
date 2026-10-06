/** What a square shows. Look A: one yellow tint, grey dot or ring, red check glow, white drop edge. */
export interface SquareMarkInput {
  isLastMove: boolean;
  isSelected: boolean;
  isPossibleMove: boolean;
  hasPiece: boolean;
  isCheckedKing: boolean;
  /** A dragged piece is over this square. */
  isOver: boolean;
  /** The dragged piece may drop here. */
  canDrop: boolean;
}

export interface SquareMarks {
  /** Last move or selected square; both share one tint, never stacked. */
  highlight: boolean;
  /** Legal target: a dot on an empty square, a ring on a capture. */
  hint: "dot" | "ring" | null;
  check: boolean;
  /** Legal drag-over. An illegal drag-over shows nothing. */
  dropEdge: boolean;
}

export function squareMarks(input: SquareMarkInput): SquareMarks {
  return {
    highlight: input.isLastMove || input.isSelected,
    hint: input.isPossibleMove ? (input.hasPiece ? "ring" : "dot") : null,
    check: input.isCheckedKing && input.hasPiece,
    dropEdge: input.isOver && input.canDrop,
  };
}

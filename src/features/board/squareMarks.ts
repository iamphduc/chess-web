export interface SquareMarkInput {
  isLastMove: boolean;
  isSelected: boolean;
  isPossibleMove: boolean;
  hasPiece: boolean;
  isCheckedKing: boolean;
  isOver: boolean;
  canDrop: boolean;
}

export interface SquareMarks {
  highlight: boolean;
  hint: "dot" | "ring" | null;
  check: boolean;
  dropEdge: boolean;
}

export function squareMarks(_input: SquareMarkInput): SquareMarks {
  return { highlight: false, hint: null, check: false, dropEdge: false };
}

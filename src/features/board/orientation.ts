/**
 * Board orientation math. Board coordinates are always White's view
 * (`y = 0` is rank 8, `x = 0` is the a-file); flipping changes only where a
 * square renders and which squares carry the edge labels.
 */

export type Coord = [number, number];

/** Board `[y, x]` to display `[row, col]`. Its own inverse, so it also maps display back to board. */
export function toDisplay([y, x]: readonly [number, number], flipped: boolean): Coord {
  return flipped ? [7 - y, 7 - x] : [y, x];
}

/** The 64 board coordinates in render order: display row 0 to 7, column 0 to 7 within each row. */
export function displayOrder(flipped: boolean): Coord[] {
  const order: Coord[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      order.push(toDisplay([row, col], flipped));
    }
  }
  return order;
}

export interface SquareLabels {
  rank: string | null;
  file: string | null;
}

/** Rank label on display column 0, file label on display row 7. */
export function squareLabels(y: number, x: number, flipped: boolean): SquareLabels {
  const [row, col] = toDisplay([y, x], flipped);
  return {
    rank: col === 0 ? String(8 - y) : null,
    file: row === 7 ? String.fromCharCode(97 + x) : null,
  };
}

export interface PromotionPlacement {
  left: number | "unset";
  right: number | "unset";
  top: number | "unset";
  bottom: number | "unset";
}

/** Where the promotion picker sits for a pawn on board `[y, x]`, beside its display square. */
export function promotionPlacement(
  y: number,
  x: number,
  flipped: boolean,
  squareSize: number
): PromotionPlacement {
  const [row, col] = toDisplay([y, x], flipped);
  return {
    left: col <= 3 ? squareSize * col - squareSize / 2 : "unset",
    right: col > 3 ? squareSize * (7 - col) - squareSize / 2 : "unset",
    top: row === 0 ? squareSize : "unset",
    bottom: row === 7 ? squareSize : "unset",
  };
}

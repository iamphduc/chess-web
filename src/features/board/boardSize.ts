import { SQUARE_SIZE_MD, SQUARE_SIZE_XL, SQUARE_SIZE_XS } from "../../constants";

/** The board's media queries: the square size grows at 768 px and again at 1200 px. */
export const WIDE_768 = "only screen and (min-width: 768px)";
export const WIDE_1200 = "only screen and (min-width: 1200px)";

/** The square size in px for the two media query results; the wider one wins. The board is 8 of these. */
export function squareSizeFor(wide768: boolean, wide1200: boolean): number {
  if (wide1200) return SQUARE_SIZE_XL;
  if (wide768) return SQUARE_SIZE_MD;
  return SQUARE_SIZE_XS;
}

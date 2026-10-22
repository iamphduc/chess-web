/**
 * The promotion picker's choices. Its own module, so the reducer and the engine
 * adapter can name them without importing the picker component (which imports
 * the reducer back).
 */
export enum PiecePromoted {
  Queen = "QUEEN",
  Rook = "ROOK",
  Bishop = "BISHOP",
  Knight = "KNIGHT",
}

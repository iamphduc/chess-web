import { PieceType } from "../../game/piece-type";
import { HistorySquares } from "../../game/piece-moves";
import { GameState } from "../../game/engine/game-state";
import { Move, Position } from "../../game/engine/engine";
import { gameStatus } from "../../game/engine/game-status";
import { findKing, isInCheck } from "../../game/engine/moves/attack";
import { PromotionKind } from "../../game/engine/moves/promotion";
import { PiecePromoted } from "./components/Promotion";
import { GameOverType } from "./components/GameOver";

/**
 * Presentation adapter bridging the pure engine's immutable {@link GameState}
 * and `BoardSlice`'s existing UI-facing state shape.
 *
 * Per the "engine boundary excludes presentation" decision the engine answers
 * only legality + resulting position; this module re-wraps that position into
 * the `HistorySquares` the UI reads and maps UI action payloads back into engine
 * {@link Move}s. Notation, `lastMoves` highlighting and the fallen-pieces list
 * stay reducer-side and are NOT computed here.
 *
 * Engine modules are imported via RELATIVE paths (not the `game/...` baseUrl
 * alias) so the Vitest reducer-wiring graph — which does not resolve the tsconfig
 * `baseUrl` — can pull this module in through the slice.
 */

/**
 * Direction A (engine → UI): project a {@link GameState}'s `EngineSquare[][]`
 * grid (`PieceType | null`) into the `HistorySquares` shape the UI consumes,
 * `squares[y][x] = { pieceType, isEnemyAttacked }`.
 *
 * `isEnemyAttacked` is set uniformly `false`: the legacy flag fed
 * castling-through-check (now handled inside the engine) and the check
 * highlight, but the UI's check highlight actually comes from `pieceAttackedKing`
 * (see {@link checkedKingPieceType}). A fresh, fully-owned 2-D array is returned
 * so the Redux state never aliases the engine's `readonly` grid.
 */
export function projectSquares(state: GameState): HistorySquares {
  return state.squares.map((row) =>
    row.map((cell) => ({
      pieceType: cell,
      isEnemyAttacked: false,
    }))
  );
}

/**
 * Direction B (UI → engine): build the engine {@link Move} for a piece moving
 * `from → to`, optionally promoting. Castling (king two files) and en passant
 * (pawn diagonal onto empty) carry no marker fields — `applyMove` infers them by
 * geometry — so only the endpoints and the optional promotion kind are needed.
 */
export function buildMove(
  from: Position,
  to: Position,
  promotion?: PromotionKind
): Move {
  return promotion === undefined ? { from, to } : { from, to, promotion };
}

/**
 * Map the UI's {@link PiecePromoted} picker choice to the engine's
 * {@link PromotionKind}.
 */
export function toPromotionKind(piece: PiecePromoted): PromotionKind {
  switch (piece) {
    case PiecePromoted.Queen:
      return "queen";
    case PiecePromoted.Rook:
      return "rook";
    case PiecePromoted.Bishop:
      return "bishop";
    case PiecePromoted.Knight:
      return "knight";
  }
}

/**
 * The `PieceType` of the king currently in check, or `null` when the side to
 * move is not in check. Drives the UI's check highlight (`Board.tsx` compares
 * `pieceAttackedKing` against each square's `pieceType`).
 *
 * After `applyMove` the side to move is the one that just received the move and
 * may now be in check, so this is computed against `state.turn`.
 */
export function checkedKingPieceType(state: GameState): PieceType | null {
  if (!isInCheck(state, state.turn)) return null;
  const king = findKing(state, state.turn);
  if (king === null) return null;
  return state.turn === "white" ? PieceType.WhiteKing : PieceType.BlackKing;
}

/**
 * Collapse the engine's {@link gameStatus} verdict into the UI's
 * {@link GameOverType}: checkmate → Win, stalemate → Draw, ongoing → Continue.
 */
export function gameOverFromStatus(state: GameState): GameOverType {
  switch (gameStatus(state)) {
    case "checkmate":
      return GameOverType.Win;
    case "stalemate":
      return GameOverType.Draw;
    case "ongoing":
      return GameOverType.Continue;
  }
}

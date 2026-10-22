import { describe, expect, it } from "vitest";

import { boardSlice, clickSquare, promotePawn, start, stop } from "../BoardSlice";
import { projectSquares } from "../engineAdapter";
import { gameEnd } from "../gameEnd";
import { PiecePromoted } from "../piecePromoted";
import { PieceType } from "../../../game/piece-type";
import { EngineSquare, GameState, initialGameState } from "../../../game/engine/game-state";

const { reducer } = boardSlice;
type BoardState = ReturnType<typeof reducer>;

const fresh = (): BoardState => reducer(undefined, { type: "@@INIT" });

/** A click on `from`, then on `to`: one move by hand. */
function play(state: BoardState, from: [number, number], to: [number, number]): BoardState {
  state = reducer(state, clickSquare({ y: from[0], x: from[1] }));
  return reducer(state, clickSquare({ y: to[0], x: to[1] }));
}

/** Play pressed, then 1.f3 e5 2.g4 Qh4#. */
function foolsMate(): BoardState {
  let s = reducer(fresh(), start());
  s = play(s, [6, 5], [5, 5]); // f3
  s = play(s, [1, 4], [3, 4]); // e5
  s = play(s, [6, 6], [4, 6]); // g4
  return play(s, [0, 3], [4, 7]); // Qh4#
}

function emptyGrid(): EngineSquare[][] {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null as EngineSquare));
}

/** Play pressed in a seeded position (white to move). */
function playingFrom(squares: EngineSquare[][]): BoardState {
  const engine: GameState = { ...initialGameState(), squares };
  return reducer(
    { ...fresh(), engineHistory: [engine], history: [{ squares: projectSquares(engine) }] },
    start()
  );
}

/** White: Kf7, Qg4; black: Kh8. Qg6 stalemates, Qg7 mates. */
function kingAndQueenVsKing(): BoardState {
  const grid = emptyGrid();
  grid[0][7] = PieceType.BlackKing; // h8
  grid[1][5] = PieceType.WhiteKing; // f7
  grid[4][6] = PieceType.WhiteQueen; // g4
  return playingFrom(grid);
}

/** White: Ke1, a7; black: Kh8, g7, h7. a8=Q mates on the back rank. */
function backRankPromotion(): BoardState {
  const grid = emptyGrid();
  grid[0][7] = PieceType.BlackKing; // h8
  grid[1][6] = PieceType.BlackPawnG; // g7
  grid[1][7] = PieceType.BlackPawnH; // h7
  grid[1][0] = PieceType.WhitePawnA; // a7
  grid[7][4] = PieceType.WhiteKing; // e1
  return playingFrom(grid);
}

describe("gameEnd", () => {
  it("each ending has its winner and reason", () => {
    // Mid-game: no result.
    expect(gameEnd(fresh())).toBeNull();
    expect(gameEnd(play(reducer(fresh(), start()), [6, 4], [4, 4]))).toBeNull();

    // Checkmate: the mating side wins, for either color.
    expect(gameEnd(foolsMate())).toEqual({ winner: "black", reason: "checkmate" });
    expect(gameEnd(play(kingAndQueenVsKing(), [4, 6], [1, 6]))).toEqual({
      winner: "white",
      reason: "checkmate",
    });

    // Stalemate: a draw.
    expect(gameEnd(play(kingAndQueenVsKing(), [4, 6], [2, 6]))).toEqual({
      winner: null,
      reason: "stalemate",
    });

    // A flag fall: the side whose clock ran loses.
    expect(gameEnd(reducer(reducer(fresh(), start()), stop()))).toEqual({
      winner: "black",
      reason: "time",
    });
    const afterE4 = play(reducer(fresh(), start()), [6, 4], [4, 4]);
    expect(gameEnd(reducer(afterE4, stop()))).toEqual({ winner: "white", reason: "time" });
  });

  it("the result never changes once the game ends", () => {
    // stop() after a mate or a stalemate keeps it.
    expect(gameEnd(reducer(foolsMate(), stop()))).toEqual({ winner: "black", reason: "checkmate" });
    const stalemate = play(kingAndQueenVsKing(), [4, 6], [2, 6]);
    expect(gameEnd(reducer(stalemate, stop()))).toEqual({ winner: null, reason: "stalemate" });

    // A flag fall with the picker open, then a pick that would mate: still on time.
    let s = play(backRankPromotion(), [1, 0], [0, 0]); // a8, picker opens
    expect(s.pendingPromotion).not.toBeNull();
    s = reducer(s, stop()); // White's clock ran out
    expect(gameEnd(s)).toEqual({ winner: "black", reason: "time" });
    s = reducer(s, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(s.pendingPromotion).toBeNull();
    expect(s.notation[s.notation.length - 1]).toBe("a8=Q#");
    expect(gameEnd(s)).toEqual({ winner: "black", reason: "time" });
  });

  it("a promotion that mates reports checkmate after the pick", () => {
    let s = play(backRankPromotion(), [1, 0], [0, 0]);
    expect(gameEnd(s)).toBeNull();
    s = reducer(s, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(gameEnd(s)).toEqual({ winner: "white", reason: "checkmate" });
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import { boardSlice, movePiece, selectPiece, start, stop } from "../BoardSlice";
import { projectSquares } from "../engineAdapter";
import { GameOver, GameOverType } from "../components/GameOver";
import { PieceType } from "../../../game/piece-type";
import { EngineSquare, GameState, initialGameState } from "../../../game/engine/game-state";

const { reducer } = boardSlice;
type BoardState = ReturnType<typeof reducer>;

function emptyGrid(): EngineSquare[][] {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null as EngineSquare));
}

/** A game with the clocks running (Play pressed), seeded at `engine` (white to move). */
function playingFrom(engine: GameState): BoardState {
  const fresh = reducer(undefined, { type: "@@INIT" });
  return reducer(
    { ...fresh, engineHistory: [engine], history: [{ squares: projectSquares(engine) }] },
    start()
  );
}

/** White: Kf7, Qg4; black: Kh8. Qg6 stalemates, Qg7 mates. */
function kingAndQueenVsKing(): GameState {
  const grid = emptyGrid();
  grid[0][7] = PieceType.BlackKing; // h8
  grid[1][5] = PieceType.WhiteKing; // f7
  grid[4][6] = PieceType.WhiteQueen; // g4
  return { ...initialGameState(), squares: grid };
}

function moveQueen(state: BoardState, to: [number, number]): BoardState {
  state = reducer(state, selectPiece({ pieceType: PieceType.WhiteQueen, y: 4, x: 6 }));
  return reducer(state, movePiece({ to }));
}

/** What Player.tsx does once the game is over while playing (or on a flag fall). */
function playerStops(state: BoardState): BoardState {
  return reducer(state, stop());
}

function overlayText(board: BoardState): string {
  const store = configureStore({ reducer: { board: reducer }, preloadedState: { board } });
  return renderToStaticMarkup(
    <Provider store={store}>
      <GameOver />
    </Provider>
  );
}

describe("game end while the clocks run", () => {
  it("a stalemate stays a draw after stop() and the overlay shows Draw!", () => {
    let state = moveQueen(playingFrom(kingAndQueenVsKing()), [2, 6]); // Qg6
    expect(state.gameOver).toBe(GameOverType.Draw);

    state = playerStops(state);
    expect(state.gameOver).toBe(GameOverType.Draw);
    expect(state.isPlaying).toBe(false);
    expect(overlayText(state)).toContain("Draw!");
    expect(overlayText(state)).not.toContain("Win!");
  });

  it("a checkmate stays a win for the mating side after stop()", () => {
    let state = moveQueen(playingFrom(kingAndQueenVsKing()), [1, 6]); // Qg7#
    state = playerStops(state);
    expect(state.gameOver).toBe(GameOverType.Win);
    expect(state.isPlaying).toBe(false);
    expect(overlayText(state)).toContain("White Win!");
  });

  it("a flag fall mid-game is a win for the other side", () => {
    // White to move and white's flag falls: black wins.
    let state = playingFrom(initialGameState());
    state = playerStops(state);
    expect(state.gameOver).toBe(GameOverType.Win);
    expect(state.isPlaying).toBe(false);
    expect(overlayText(state)).toContain("Black Win!");
  });

  it("stop() twice keeps the result", () => {
    let state = moveQueen(playingFrom(kingAndQueenVsKing()), [2, 6]);
    state = playerStops(playerStops(state));
    expect(state.gameOver).toBe(GameOverType.Draw);

    const flagged = playerStops(playerStops(playingFrom(initialGameState())));
    expect(flagged.gameOver).toBe(GameOverType.Win);
  });
});

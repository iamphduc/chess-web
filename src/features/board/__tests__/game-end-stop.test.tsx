import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import { matchSlice } from "features/liem/matchSlice";
import { boardSlice, movePiece, selectPiece, start, stop } from "../BoardSlice";
import { projectSquares } from "../engineAdapter";
import { GameOver } from "../components/GameOver";
import { GameOverType } from "../gameOverType";
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
  // Two players, where these games are played.
  const match = { ...matchSlice.reducer(undefined, { type: "@@INIT" }), mode: "two-player" as const, setupOpen: false };
  const store = configureStore({
    reducer: { board: reducer, match: matchSlice.reducer },
    preloadedState: { board, match },
  });
  return renderToStaticMarkup(
    <Provider store={store}>
      <GameOver />
    </Provider>
  );
}

describe("game end while the clocks run", () => {
  it("a stalemate stays a draw after stop() and the card reads Draw · Stalemate", () => {
    let state = moveQueen(playingFrom(kingAndQueenVsKing()), [2, 6]); // Qg6
    expect(state.gameOver).toBe(GameOverType.Draw);

    state = playerStops(state);
    expect(state.gameOver).toBe(GameOverType.Draw);
    expect(state.isPlaying).toBe(false);
    expect(overlayText(state)).toContain('<p class="game-over__title">Draw</p>');
    expect(overlayText(state)).toContain('<p class="game-over__reason">Stalemate</p>');
    expect(overlayText(state)).not.toContain("wins");
  });

  it("a checkmate stays a win for the mating side after stop()", () => {
    let state = moveQueen(playingFrom(kingAndQueenVsKing()), [1, 6]); // Qg7#
    state = playerStops(state);
    expect(state.gameOver).toBe(GameOverType.Win);
    expect(state.isPlaying).toBe(false);
    expect(overlayText(state)).toContain('<p class="game-over__title">White wins</p>');
    expect(overlayText(state)).toContain('<p class="game-over__reason">Checkmate</p>');
  });

  it("a flag fall mid-game is a win for the other side", () => {
    // White to move and white's flag falls: black wins.
    let state = playingFrom(initialGameState());
    state = playerStops(state);
    expect(state.gameOver).toBe(GameOverType.Win);
    expect(state.isPlaying).toBe(false);
    expect(overlayText(state)).toContain('<p class="game-over__title">Black wins</p>');
    expect(overlayText(state)).toContain('<p class="game-over__reason">On time</p>');
  });

  it("stop() twice keeps the result", () => {
    let state = moveQueen(playingFrom(kingAndQueenVsKing()), [2, 6]);
    state = playerStops(playerStops(state));
    expect(state.gameOver).toBe(GameOverType.Draw);
    expect(overlayText(state)).toContain('<p class="game-over__reason">Stalemate</p>');

    const flagged = playerStops(playerStops(playingFrom(initialGameState())));
    expect(flagged.gameOver).toBe(GameOverType.Win);
    expect(overlayText(flagged)).toContain('<p class="game-over__reason">On time</p>');
  });
});

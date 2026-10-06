import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import { boardSlice, movePiece, promotePawn, reset, selectPiece, start, stop } from "../BoardSlice";
import { GameOver, GameOverType } from "../components/GameOver";
import { Player } from "../components/Player";
import { PiecePromoted } from "../components/Promotion";
import { PieceType } from "../../../game/piece-type";

const { reducer } = boardSlice;
type BoardState = ReturnType<typeof reducer>;

function move(state: BoardState, pieceType: PieceType, from: [number, number], to: [number, number]) {
  state = reducer(state, selectPiece({ pieceType, y: from[0], x: from[1] }));
  return reducer(state, movePiece({ to }));
}

/** Play pressed, then 1.h4 g5 2.hxg5 h6 3.gxh6 Nf6 4.h7 Rg8 5.hxg8, piece not picked yet. */
function whitePickingPromotion(): BoardState {
  let s = reducer(reducer(undefined, { type: "@@INIT" }), start());
  s = move(s, PieceType.WhitePawnH, [6, 7], [4, 7]); // h4
  s = move(s, PieceType.BlackPawnG, [1, 6], [3, 6]); // g5
  s = move(s, PieceType.WhitePawnH, [4, 7], [3, 6]); // hxg5
  s = move(s, PieceType.BlackPawnH, [1, 7], [2, 7]); // h6
  s = move(s, PieceType.WhitePawnH, [3, 6], [2, 7]); // gxh6
  s = move(s, PieceType.BlackKingKnight, [0, 6], [2, 5]); // Nf6
  s = move(s, PieceType.WhitePawnH, [2, 7], [1, 7]); // h7
  s = move(s, PieceType.BlackKingRook, [0, 7], [0, 6]); // Rg8
  s = move(s, PieceType.WhitePawnH, [1, 7], [0, 6]); // hxg8, picker opens
  return s;
}

function render(board: BoardState, node: React.ReactElement): string {
  const store = configureStore({ reducer: { board: reducer }, preloadedState: { board } });
  return renderToStaticMarkup(<Provider store={store}>{node}</Provider>);
}

/** Which player cards show a running clock. */
function runningClocks(board: BoardState): { white: boolean; black: boolean } {
  const isRunning = (isWhite: boolean) =>
    render(board, <Player name="P" title={null} avatar={null} isWhite={isWhite} />).includes(
      "player__time--running"
    );
  return { white: isRunning(true), black: isRunning(false) };
}

describe("clocks while the promotion picker is open", () => {
  it("the mover's clock runs and the opponent's waits", () => {
    const s = whitePickingPromotion();
    expect(s.pendingPromotion).not.toBeNull();
    expect(runningClocks(s)).toEqual({ white: true, black: false });
  });

  it("the turn passes to the opponent once the piece is picked", () => {
    const s = reducer(whitePickingPromotion(), promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(s.pendingPromotion).toBeNull();
    expect(runningClocks(s)).toEqual({ white: false, black: true });
  });

  it("a flag fall with the picker open is the mover's loss, before and after the pick", () => {
    // Player.tsx dispatches stop() when the running (White's) clock reaches 0.
    let s = reducer(whitePickingPromotion(), stop());
    expect(s.gameOver).toBe(GameOverType.Win);
    expect(render(s, <GameOver />)).toContain("Black Win!");

    // Promotion after the flag fall stays allowed; the result does not change.
    s = reducer(s, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(s.notation[s.notation.length - 1]).toBe("hxg8=Q");
    expect(render(s, <GameOver />)).toContain("Black Win!");
  });

  it("a flag fall without a picker is still the side to move's loss", () => {
    let s = reducer(reducer(undefined, { type: "@@INIT" }), start());
    s = move(s, PieceType.WhitePawnH, [6, 7], [4, 7]); // h4, Black's clock runs
    s = reducer(s, stop());
    expect(render(s, <GameOver />)).toContain("White Win!");
  });

  it("reset clears a flag-fall result", () => {
    const s = reducer(reducer(whitePickingPromotion(), stop()), reset());
    expect(s.gameOver).toBe(GameOverType.Continue);
    expect(runningClocks(s)).toEqual({ white: true, black: false });
    expect(render(s, <GameOver />)).toBe("");
  });
});

describe("no other move while the promotion picker is open", () => {
  it("the opponent cannot pick up or move a piece; the mover's clock keeps running", () => {
    const before = whitePickingPromotion();
    let s = reducer(before, selectPiece({ pieceType: PieceType.BlackPawnA, y: 1, x: 0 }));
    expect(s.selectedPiece).toBeNull();
    expect(s.possibleMoves).toEqual([]);
    s = reducer(s, movePiece({ to: [3, 0] })); // a5
    expect(s.history).toHaveLength(before.history.length);
    expect(s.notation).toEqual(before.notation);
    expect(s.pendingPromotion).toEqual(before.pendingPromotion);
    expect(runningClocks(s)).toEqual({ white: true, black: false });

    s = reducer(s, promotePawn({ piecePromoted: PiecePromoted.Queen }));
    expect(s.notation[s.notation.length - 1]).toBe("hxg8=Q");
    expect(s.history[s.history.length - 1].squares[0][6].pieceType).toBe(PieceType.WhiteQueenPromoted1);
    expect(s.history[s.history.length - 1].squares[1][0].pieceType).toBe(PieceType.BlackPawnA);
  });

  it("a piece selected before the move cannot move during the picker", () => {
    // A selection left over cannot slip a move in while the picker is open.
    let s = whitePickingPromotion();
    s = { ...s, selectedPiece: { pieceType: PieceType.BlackPawnA, y: 1, x: 0 } };
    const after = reducer(s, movePiece({ to: [3, 0] }));
    expect(after.history).toHaveLength(s.history.length);
    expect(after.notation).toEqual(s.notation);
  });

  it("after the pick the opponent moves as normal", () => {
    let s = reducer(whitePickingPromotion(), promotePawn({ piecePromoted: PiecePromoted.Queen }));
    s = move(s, PieceType.BlackPawnA, [1, 0], [3, 0]); // a5
    expect(s.notation.slice(-2)).toEqual(["hxg8=Q", "a5"]);
    expect(runningClocks(s)).toEqual({ white: true, black: false });
  });
});

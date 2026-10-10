import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import { boardSlice, movePiece, selectPiece } from "../BoardSlice";
import { toggleFlip, viewSlice } from "../viewSlice";
import { Board } from "../Board";
import { matchSlice } from "../../liem/matchSlice";
import { Promotion } from "../components/Promotion";
import { PieceType } from "../../../game/piece-type";
import { players } from "../../../game/players";

const { reducer } = boardSlice;
type BoardState = ReturnType<typeof reducer>;

function makeStore(board?: BoardState) {
  return configureStore({
    reducer: { board: reducer, view: viewSlice.reducer, match: matchSlice.reducer },
    preloadedState: board ? { board } : undefined,
  });
}
type TestStore = ReturnType<typeof makeStore>;

function render(store: TestStore, node: React.ReactElement): string {
  return renderToStaticMarkup(
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>{node}</DndProvider>
    </Provider>
  );
}

/** The piece type of the first `.piece` in the markup. */
function firstPiece(html: string): string | undefined {
  return html.match(/class="piece piece__([A-Z_0-9]+)/)?.[1];
}

/** The order the two player names appear in. */
function nameOrder(html: string): string[] {
  const black = players.find((p) => !p.isWhite)!.name;
  const white = players.find((p) => p.isWhite)!.name;
  const names = Array.from(
    html.matchAll(/class="player__name">(?:<span[^>]*>[^<]*<\/span>)?([^<]*)/g),
    (m) => m[1].trim()
  );
  return names.map((n) => (n === black ? "black" : n === white ? "white" : n));
}

function move(
  state: BoardState,
  pieceType: PieceType,
  from: [number, number],
  to: [number, number]
) {
  state = reducer(state, selectPiece({ pieceType, y: from[0], x: from[1] }));
  return reducer(state, movePiece({ to }));
}

/** 1.d4 e5 2.dxe5 Ke7 3.e6 Kf6 4.e7 Kg6 5.e8, White picking a piece on e8. */
function whitePromotingOnE8(): BoardState {
  let s = reducer(undefined, { type: "@@INIT" });
  s = move(s, PieceType.WhitePawnD, [6, 3], [4, 3]); // d4
  s = move(s, PieceType.BlackPawnE, [1, 4], [3, 4]); // e5
  s = move(s, PieceType.WhitePawnD, [4, 3], [3, 4]); // dxe5
  s = move(s, PieceType.BlackKing, [0, 4], [1, 4]); // Ke7
  s = move(s, PieceType.WhitePawnD, [3, 4], [2, 4]); // e6
  s = move(s, PieceType.BlackKing, [1, 4], [2, 5]); // Kf6
  s = move(s, PieceType.WhitePawnD, [2, 4], [1, 4]); // e7
  s = move(s, PieceType.BlackKing, [2, 5], [2, 6]); // Kg6
  s = move(s, PieceType.WhitePawnD, [1, 4], [0, 4]); // e8, picker opens
  return s;
}

/** The inline style of the `.promotion` element. */
function pickerStyle(html: string): string {
  const style = html.match(/class="promotion" style="([^"]*)"/)?.[1];
  if (style === undefined) throw new Error("no promotion picker in markup");
  return style;
}

describe("board flip", () => {
  it("flip reverses squares and player cards", () => {
    const store = makeStore();
    const before = render(store, <Board />);
    expect(firstPiece(before)).toBe(PieceType.BlackQueenRook); // a8
    expect(nameOrder(before)).toEqual(["black", "white"]);

    store.dispatch(toggleFlip());
    const after = render(store, <Board />);
    expect(firstPiece(after)).toBe(PieceType.WhiteKingRook); // h1
    expect(nameOrder(after)).toEqual(["white", "black"]);
  });

  it("flip button reflects state", () => {
    const store = makeStore();
    const flipButton = (html: string) => {
      const buttons = html.match(/<div class="buttons">[\s\S]*?<\/div>/)?.[0] ?? "";
      return buttons.match(/<button[^>]*aria-label="Flip board"[^>]*>/)?.[0] ?? "";
    };

    const before = flipButton(render(store, <Board />));
    expect(before).toMatch(/class="button button--icon"/);
    expect(before).toMatch(/aria-pressed="false"/);

    store.dispatch(toggleFlip());
    expect(flipButton(render(store, <Board />))).toMatch(/aria-pressed="true"/);
  });

  it("promotion picker placed for flipped board", () => {
    const board = whitePromotingOnE8();
    expect(board.promotionPosition).toEqual([0, 4]);
    const store = makeStore(board);

    // Unflipped, e8 is on the top edge, right half.
    const normal = pickerStyle(render(store, <Promotion squareSize={60} />));
    expect(normal).toMatch(/right:150px/);
    expect(normal).toMatch(/top:60px/);
    expect(normal).toMatch(/left:unset/);
    expect(normal).toMatch(/bottom:unset/);

    // Flipped, e8 is on the bottom edge, left half.
    store.dispatch(toggleFlip());
    const flipped = pickerStyle(render(store, <Promotion squareSize={60} />));
    expect(flipped).toMatch(/left:150px/);
    expect(flipped).toMatch(/bottom:60px/);
    expect(flipped).toMatch(/right:unset/);
    expect(flipped).toMatch(/top:unset/);
  });
});

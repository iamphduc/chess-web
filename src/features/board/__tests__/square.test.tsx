import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { describe, expect, it } from "vitest";

import { boardSlice, clickSquare } from "../BoardSlice";
import { toggleFlip, viewSlice } from "../viewSlice";
import { Square } from "../components/Square";
import { PieceType } from "../../../game/piece-type";

function makeStore() {
  return configureStore({ reducer: { board: boardSlice.reducer, view: viewSlice.reducer } });
}
type TestStore = ReturnType<typeof makeStore>;

const FILES = "abcdefgh";
function coord(name: string): [number, number] {
  return [8 - Number(name[1]), FILES.indexOf(name[0])];
}

function render(store: TestStore, name: string, pieceType: PieceType | null = null): string {
  const [y, x] = coord(name);
  return renderToStaticMarkup(
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <Square
          y={y}
          x={x}
          pieceType={pieceType}
          isPossibleMove={false}
          isLastMove={false}
          isWhiteTurn={true}
          isPieceAttackedKing={false}
          isInCheck={false}
          size={52}
        />
      </DndProvider>
    </Provider>
  );
}

/** The text of each edge label in the markup, by kind. */
function labels(markup: string): { rank: string[]; file: string[] } {
  const pick = (kind: string) =>
    Array.from(markup.matchAll(new RegExp(`square__label--${kind}[^>]*>([^<]*)<`, "g"))).map((m) => m[1]);
  return { rank: pick("rank"), file: pick("file") };
}

describe("Square", () => {
  it("labels and data-square follow the flip", () => {
    const store = makeStore();
    expect(render(store, "e2", PieceType.WhitePawnE)).toContain('data-square="e2"');
    expect(labels(render(store, "a1", PieceType.WhiteQueenRook))).toEqual({ rank: ["1"], file: ["a"] });
    expect(labels(render(store, "e4"))).toEqual({ rank: [], file: [] });

    store.dispatch(toggleFlip());
    expect(render(store, "e2")).toContain('data-square="e2"');
    expect(labels(render(store, "h8", PieceType.BlackKingRook))).toEqual({ rank: ["8"], file: ["h"] });
    expect(labels(render(store, "h1", PieceType.WhiteKingRook))).toEqual({ rank: ["1"], file: [] });
    expect(labels(render(store, "a1", PieceType.WhiteQueenRook))).toEqual({ rank: [], file: [] });
  });

  it("selected square reads its selection from the store", () => {
    const store = makeStore();
    expect(render(store, "b1", PieceType.WhiteQueenKnight)).not.toContain("overlay--highlight");
    store.dispatch(clickSquare({ y: 7, x: 1 }));
    expect(render(store, "b1", PieceType.WhiteQueenKnight)).toContain("overlay--highlight");
    expect(render(store, "g1", PieceType.WhiteKingKnight)).not.toContain("overlay--highlight");
  });
});

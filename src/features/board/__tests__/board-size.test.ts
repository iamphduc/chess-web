import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { startLiemGame } from "features/liem/liemActions";
import { squareSizeFor } from "../boardSize";
import { Board } from "../Board";

describe("board size", () => {
  it("square sizes keep their rules", () => {
    // Media query results at a given width: 768 px and up, 1200 px and up.
    const at = (width: number) => squareSizeFor(width >= 768, width >= 1200);
    expect(at(375)).toBe(39);
    expect(at(767)).toBe(39);
    expect(at(768)).toBe(52);
    expect(at(992)).toBe(52);
    expect(at(1199)).toBe(52);
    expect(at(1200)).toBe(78);
    expect(at(1400)).toBe(78);
    // The wide query wins.
    expect(squareSizeFor(false, true)).toBe(78);

    // With no window (server render) both queries are false: the board is 8 x 39.
    const store = createAppStore();
    store.dispatch(startLiemGame());
    const html = renderToStaticMarkup(
      createElement(Provider, {
        store,
        children: createElement(DndProvider, { backend: HTML5Backend }, createElement(Board)),
      })
    );
    expect(html).toMatch(/<div class="board" style="width:312px">/);
  });
});

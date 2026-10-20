// Piece speed (plan ui-motion, sprint motion › P1): every piece move on the game board
// is a 150 ms ease-out tween, not Framer Motion's default spring. Fake-DOM tests can't
// see motion, so a mocked motion.div records the props each piece gets.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Provider } from "react-redux";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { PieceType } from "game/piece-type";
import { reset } from "../BoardSlice";
import { switchMode } from "features/liem/liemActions";
import { PIECE_MOVE_TRANSITION } from "../pieceMotion";
import { Piece } from "../components/Piece";

const recorded = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const { forwardRef, createElement } = await import("react");
  const div = forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) => {
    recorded.push(props);
    const { className, style } = props as { className?: string; style?: object };
    return createElement("div", { ref, className, style, "data-layout-id": props.layoutId });
  });
  return { ...actual, motion: { div } };
});

beforeEach(() => {
  recorded.length = 0;
});

function renderPiece(store: ReturnType<typeof createAppStore>, pieceType: PieceType) {
  return renderToStaticMarkup(
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <Piece pieceType={pieceType} y={6} x={4} isWhiteTurn />
      </DndProvider>
    </Provider>
  );
}

describe("piece speed", () => {
  it("piece moves use a 150 ms ease-out tween", () => {
    expect(PIECE_MOVE_TRANSITION).toEqual({ type: "tween", ease: "easeOut", duration: 0.15 });
  });

  it("the game board's pieces use it", () => {
    const store = createAppStore();
    store.dispatch(switchMode("two-player"));
    store.dispatch(reset());
    const { gameId } = store.getState().board;
    renderPiece(store, PieceType.WhitePawnE);

    expect(recorded).toHaveLength(1);
    expect(recorded[0].transition).toEqual(PIECE_MOVE_TRANSITION);
    // The layout id is still one per piece per game.
    expect(recorded[0].layoutId).toBe(`${gameId}-${PieceType.WhitePawnE}`);
  });
});

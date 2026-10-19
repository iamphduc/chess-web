import { afterEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "app/store";
import { clickSquare, playOpponentMove } from "features/board/BoardSlice";
import { startLiemGame } from "features/liem/liemActions";
import { setColorPick, setStrength } from "features/liem/matchSlice";
import { uciToMove } from "game/opponent/position";
import { openReview } from "../reviewActions";
import { graphPlacement, playAgain } from "../reviewLayout";

describe("graphPlacement", () => {
  it("graph shows once", () => {
    // Wide: always the sidebar, whatever the sheet does (there is no sheet on desktop).
    for (const sheetOpen of [true, false]) {
      for (const low of [true, false]) {
        expect(graphPlacement({ wide: true, sheetOpen, low })).toBe("sidebar");
      }
    }
    // A phone with the sheet open and up: the top of the sheet.
    expect(graphPlacement({ wide: false, sheetOpen: true, low: false })).toBe("sheet");
    // Low while trying a move: the sheet shows only the title and buttons, so the sidebar has it.
    expect(graphPlacement({ wide: false, sheetOpen: true, low: true })).toBe("sidebar");
    // Closed: the sidebar.
    expect(graphPlacement({ wide: false, sheetOpen: false, low: false })).toBe("sidebar");
    expect(graphPlacement({ wide: false, sheetOpen: false, low: true })).toBe("sidebar");
  });
});

const sq = (name: string) => ({ y: 8 - Number(name[1]), x: "abcdefgh".indexOf(name[0]) });

/** As Black at 1900: 1.e4 f6 2.d4 g5 3.Qh5#. */
function finishedGame() {
  const store = createAppStore();
  store.dispatch(setStrength(1900));
  store.dispatch(setColorPick("black"));
  store.dispatch(startLiemGame());
  for (const uci of ["e2e4", "f7f6", "d2d4", "g7g5", "d1h5"]) {
    const { board } = store.getState();
    const ply = board.engineHistory.length - 1;
    const state = board.engineHistory[ply];
    if (state.turn !== board.humanColor) {
      store.dispatch(playOpponentMove({ gameId: board.gameId, ply, move: uciToMove(state, uci)! }));
    } else {
      store.dispatch(clickSquare(sq(uci.slice(0, 2))));
      store.dispatch(clickSquare(sq(uci.slice(2, 4))));
    }
  }
  return store;
}

describe("playAgain", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replays the level and color, clears the review and goes to #/play", () => {
    // A review with no #/play entry marked under it: #/review becomes #/play.
    const location = { hash: "#/review", replace: (url: string) => (location.hash = url) };
    const back = vi.fn();
    vi.stubGlobal("window", { location, history: { state: null, back } });
    const store = finishedGame();
    store.dispatch(openReview());
    expect(store.getState().review.open).toBe(true);
    const { gameId } = store.getState().board;

    store.dispatch(playAgain());

    const { board, match, review } = store.getState();
    expect(board.gameId).toBeGreaterThan(gameId);
    expect(board.humanColor).toBe("black");
    expect(board.engineHistory).toHaveLength(1);
    expect(match.strength).toBe(1900);
    expect(match.colorPick).toBe("black");
    expect(match.setupOpen).toBe(false);
    expect(review.open).toBe(false);
    expect(review.gameId).toBeNull();
    expect(store.getState().view.flipped).toBe(true);
    expect(location.hash).toBe("#/play");
    expect(back).not.toHaveBeenCalled();
  });
});

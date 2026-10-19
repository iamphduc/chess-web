import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import { startLiemGame, switchMode } from "features/liem/liemActions";
import { setColorPick, setStrength } from "features/liem/matchSlice";
import { openReview } from "features/review/reviewActions";
import { clickSquare, playOpponentMove } from "../BoardSlice";
import { uciToMove } from "game/opponent/position";
import { topBarInput, topBarTitle } from "../topBar";

type Store = ReturnType<typeof createAppStore>;
const title = (store: Store) => topBarTitle(topBarInput(store.getState()));

const sq = (name: string) => ({ y: 8 - Number(name[1]), x: "abcdefgh".indexOf(name[0]) });

describe("top bar", () => {
  it("titles", () => {
    expect(topBarTitle({ mode: "liem", strength: 1700, humanColor: "white", review: false })).toBe(
      "vs Medium · you play White"
    );
    expect(topBarTitle({ mode: "liem", strength: "full", humanColor: "black", review: false })).toBe(
      "vs Liem · you play Black"
    );
    expect(topBarTitle({ mode: "two-player", strength: 2100, humanColor: "white", review: false })).toBe(
      "Two players"
    );
    expect(topBarTitle({ mode: "liem", strength: 1700, humanColor: "white", review: true })).toBe(
      "Review · vs Medium"
    );
    // No sparring title names a rating.
    for (const strength of [1400, 1700, 1900, 2100, 2300, 2500] as const) {
      const t = topBarTitle({ mode: "liem", strength, humanColor: "white", review: false });
      expect(t).not.toMatch(/\d{4}|about/);
    }
  });

  it("titles from the store, with the resolved color when the pick was Random", () => {
    const random = createAppStore();
    random.dispatch(setStrength(1700));
    random.dispatch(setColorPick("random"));
    random.dispatch(startLiemGame(() => 0.9)); // Random draws Black
    expect(random.getState().board.humanColor).toBe("black");
    expect(title(random)).toBe("vs Medium · you play Black");

    const white = createAppStore();
    white.dispatch(setColorPick("random"));
    white.dispatch(startLiemGame(() => 0.1)); // Random draws White
    expect(title(white)).toBe("vs Harder · you play White");

    // Before a game the pick so far: Random shows White.
    const home = createAppStore();
    home.dispatch(setColorPick("random"));
    expect(title(home)).toBe("vs Harder · you play White");

    const two = createAppStore();
    two.dispatch(switchMode("two-player"));
    expect(title(two)).toBe("Two players");
  });

  it("the review title names the level", () => {
    const store = createAppStore();
    store.dispatch(setStrength(1700));
    store.dispatch(setColorPick("white"));
    store.dispatch(startLiemGame());
    for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) {
      const { board } = store.getState();
      const ply = board.engineHistory.length - 1;
      const state = board.engineHistory[ply];
      if (state.turn === board.humanColor) {
        store.dispatch(clickSquare(sq(uci.slice(0, 2))));
        store.dispatch(clickSquare(sq(uci.slice(2, 4))));
      } else {
        store.dispatch(playOpponentMove({ gameId: board.gameId, ply, move: uciToMove(state, uci)! }));
      }
    }
    store.dispatch(openReview());
    expect(store.getState().review.open).toBe(true);
    expect(title(store)).toBe("Review · vs Medium");
  });
});

import { describe, expect, it } from "vitest";

import { createAppStore } from "app/store";
import {
  gameStarted,
  type LastChoice,
  matchSlice,
  type MatchState,
  openSetup,
  opponentMoved,
  resolveColor,
  setColorPick,
  setMode,
  setOpponentStatus,
  setStrength,
} from "../matchSlice";

const reducer = matchSlice.reducer;
const initial = (): MatchState => reducer(undefined, { type: "@@init" });

const CHOICE: LastChoice = { gameId: 1, ply: 1, uci: "e7e5", source: "book", lookup: null };

/** Liem mode with a game under way: card closed, a choice shown, status thinking. */
function inGame(): MatchState {
  let s = reducer(initial(), setMode("liem"));
  s = reducer(s, gameStarted());
  s = reducer(s, opponentMoved(CHOICE));
  return reducer(s, setOpponentStatus("thinking"));
}

describe("setMode", () => {
  it("has the contract defaults", () => {
    expect(initial()).toEqual({
      mode: "two-player",
      setupOpen: false,
      colorPick: "white",
      strength: 2100,
      lastChoice: null,
      opponentStatus: "idle",
    });
  });

  it("keeps the same state object for the same mode", () => {
    const two = initial();
    expect(reducer(two, setMode("two-player"))).toBe(two);
    const liem = inGame();
    expect(reducer(liem, setMode("liem"))).toBe(liem);
  });

  it("liem opens the card and two-player closes it, both clearing lastChoice and status", () => {
    const toLiem = reducer(initial(), setMode("liem"));
    expect(toLiem.mode).toBe("liem");
    expect(toLiem.setupOpen).toBe(true);

    const toTwo = reducer(inGame(), setMode("two-player"));
    expect(toTwo).toMatchObject({ mode: "two-player", setupOpen: false, lastChoice: null, opponentStatus: "idle" });

    const backToLiem = reducer(reducer(toTwo, setOpponentStatus("failed")), setMode("liem"));
    expect(backToLiem).toMatchObject({ mode: "liem", setupOpen: true, lastChoice: null, opponentStatus: "idle" });
  });

  it("keeps the color and strength picks across mode switches", () => {
    let s = reducer(initial(), setMode("liem"));
    s = reducer(s, setColorPick("black"));
    s = reducer(s, setStrength("full"));
    s = reducer(reducer(s, setMode("two-player")), setMode("liem"));
    expect(s).toMatchObject({ colorPick: "black", strength: "full" });
  });
});

describe("setup picks and game start", () => {
  it("setColorPick and setStrength apply while the card is open", () => {
    let s = reducer(initial(), setMode("liem"));
    s = reducer(s, setColorPick("random"));
    s = reducer(s, setStrength(1400));
    expect(s).toMatchObject({ colorPick: "random", strength: 1400 });
    s = reducer(s, setStrength("full"));
    expect(s.strength).toBe("full");
  });

  it("setColorPick and setStrength do nothing while the card is closed", () => {
    const two = initial();
    expect(reducer(two, setColorPick("black"))).toBe(two);
    expect(reducer(two, setStrength(1400))).toBe(two);
    const game = inGame();
    expect(reducer(game, setColorPick("black"))).toBe(game);
    expect(reducer(game, setStrength(1400))).toBe(game);
  });

  it("ignores a step not in STRENGTH_STEPS", () => {
    const open = reducer(initial(), setMode("liem"));
    for (const bad of [1500, 0, -1, "2100", null, undefined, Number.NaN] as unknown[]) {
      expect(reducer(open, { type: setStrength.type, payload: bad })).toBe(open);
    }
  });

  it("gameStarted closes the card and clears lastChoice and status", () => {
    let s = reducer(inGame(), openSetup());
    s = reducer(s, opponentMoved(CHOICE));
    s = reducer(s, setOpponentStatus("failed"));
    const started = reducer(s, gameStarted());
    expect(started).toMatchObject({ mode: "liem", setupOpen: false, lastChoice: null, opponentStatus: "idle" });
  });

  it("gameStarted does nothing in two-player mode", () => {
    const two = initial();
    expect(reducer(two, gameStarted())).toBe(two);
  });

  it("openSetup works only in liem mode", () => {
    const two = initial();
    expect(reducer(two, openSetup())).toBe(two);
    const opened = reducer(inGame(), openSetup());
    expect(opened.setupOpen).toBe(true);
  });

  it("opponentMoved records his choice in liem mode and is ignored in two-player mode", () => {
    const s = reducer(reducer(reducer(initial(), setMode("liem")), gameStarted()), opponentMoved(CHOICE));
    expect(s.lastChoice).toEqual(CHOICE);
    const two = initial();
    expect(reducer(two, opponentMoved(CHOICE))).toBe(two);
  });

  it("setOpponentStatus sets the status", () => {
    const s = reducer(initial(), setOpponentStatus("loading"));
    expect(s.opponentStatus).toBe("loading");
  });
});

describe("resolveColor edges", () => {
  it("returns white and black as given, without calling random", () => {
    const never = () => {
      throw new Error("random must not be called");
    };
    expect(resolveColor("white", never)).toBe("white");
    expect(resolveColor("black", never)).toBe("black");
  });

  it("random below 0.5 is white, 0.5 and above is black", () => {
    expect(resolveColor("random", () => 0)).toBe("white");
    expect(resolveColor("random", () => 0.4999)).toBe("white");
    expect(resolveColor("random", () => 0.5)).toBe("black");
    expect(resolveColor("random", () => 0.9999)).toBe("black");
  });

  it("defaults to Math.random", () => {
    expect(["white", "black"]).toContain(resolveColor("random"));
  });
});

describe("createAppStore", () => {
  it("returns independent stores with board, view and match", () => {
    const a = createAppStore();
    const b = createAppStore();
    expect(Object.keys(a.getState()).sort()).toEqual(["board", "match", "view"]);
    a.dispatch(setMode("liem"));
    expect(a.getState().match.mode).toBe("liem");
    expect(b.getState().match.mode).toBe("two-player");
    expect(b.getState().board).toEqual(createAppStore().getState().board);
  });
});

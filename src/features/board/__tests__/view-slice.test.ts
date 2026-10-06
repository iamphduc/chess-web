import { describe, expect, it } from "vitest";

import { store } from "app/store";
import { reset } from "../BoardSlice";
import { toggleFlip, viewSlice } from "../viewSlice";

describe("view slice", () => {
  it("flip toggles and survives reset", () => {
    // The real store starts unflipped.
    expect(store.getState().view.flipped).toBe(false);

    const { reducer } = viewSlice;
    const initial = reducer(undefined, { type: "@@INIT" });
    expect(initial.flipped).toBe(false);
    const once = reducer(initial, toggleFlip());
    expect(once.flipped).toBe(true);
    expect(reducer(once, toggleFlip()).flipped).toBe(false);

    // Through the store: the board reset leaves the flip alone.
    store.dispatch(toggleFlip());
    expect(store.getState().view.flipped).toBe(true);
    store.dispatch(reset());
    expect(store.getState().view.flipped).toBe(true);
    store.dispatch(toggleFlip());
    expect(store.getState().view.flipped).toBe(false);
  });
});

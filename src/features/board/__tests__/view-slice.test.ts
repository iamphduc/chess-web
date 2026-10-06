import { describe, expect, it } from "vitest";

import { store } from "app/store";
import { reset } from "../BoardSlice";
import { toggleFlip, toggleSound, viewSlice } from "../viewSlice";

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

  it("sound toggles and survives reset", () => {
    // Node has no localStorage, so the store starts with the default: on.
    expect(store.getState().view.soundOn).toBe(true);

    const { reducer } = viewSlice;
    const initial = reducer(undefined, { type: "@@INIT" });
    expect(initial.soundOn).toBe(true);
    const off = reducer(initial, toggleSound());
    expect(off.soundOn).toBe(false);
    expect(off.flipped).toBe(initial.flipped);
    expect(reducer(off, toggleSound()).soundOn).toBe(true);

    // Through the store: neither the board reset nor the flip touches it.
    store.dispatch(toggleSound());
    expect(store.getState().view.soundOn).toBe(false);
    store.dispatch(reset());
    expect(store.getState().view.soundOn).toBe(false);
    store.dispatch(toggleFlip());
    expect(store.getState().view.soundOn).toBe(false);
    store.dispatch(toggleFlip());
    store.dispatch(toggleSound());
    expect(store.getState().view.soundOn).toBe(true);
  });
});

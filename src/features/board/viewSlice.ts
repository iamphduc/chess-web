import { createSlice } from "@reduxjs/toolkit";

/** How the board is shown. Not saved, and the board `reset` doesn't touch it. */
interface ViewState {
  flipped: boolean;
}

const initialState: ViewState = { flipped: false };

export const viewSlice = createSlice({
  name: "view",
  initialState,
  reducers: {
    toggleFlip: (state) => {
      state.flipped = !state.flipped;
    },
  },
});

export const { toggleFlip } = viewSlice.actions;

import { createSlice } from "@reduxjs/toolkit";

import { browserStorage, loadSoundOn } from "./soundSetting";

/**
 * How the board is shown. The board `reset` doesn't touch it. `flipped` isn't saved;
 * `soundOn` is saved by the Sound button and loaded here.
 */
interface ViewState {
  flipped: boolean;
  soundOn: boolean;
}

const initialState: ViewState = { flipped: false, soundOn: loadSoundOn(browserStorage) };

export const viewSlice = createSlice({
  name: "view",
  initialState,
  reducers: {
    toggleFlip: (state) => {
      state.flipped = !state.flipped;
    },
    toggleSound: (state) => {
      state.soundOn = !state.soundOn;
    },
  },
});

export const { toggleFlip, toggleSound } = viewSlice.actions;

import { configureStore } from "@reduxjs/toolkit";

import { boardSlice } from "features/board/BoardSlice";
import { viewSlice } from "features/board/viewSlice";
import { matchSlice } from "features/liem/matchSlice";

/** A fresh store with its own `board`, `view` and `match` state. Tests make their own. */
export function createAppStore() {
  return configureStore({
    reducer: {
      board: boardSlice.reducer,
      view: viewSlice.reducer,
      match: matchSlice.reducer,
    },
  });
}

export const store = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

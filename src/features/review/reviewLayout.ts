import type { AnyAction, ThunkAction } from "@reduxjs/toolkit";

import type { RootState } from "app/store";

export type GraphPlace = "sidebar" | "sheet";

/** Stub: filled in by the feat commit. */
export function graphPlacement(_: { wide: boolean; sheetOpen: boolean; low: boolean }): GraphPlace {
  return "sidebar";
}

/** Stub: filled in by the feat commit. */
export const playAgain = (): ThunkAction<void, RootState, unknown, AnyAction> => () => {};

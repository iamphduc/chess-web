import React from "react";

import type { AppDispatch } from "app/store";
import type { Screen } from "app/route";
import type { PlayerEntry } from "game/opponent/types";

export function playFromHome(_dispatch: AppDispatch, _go: (screen: Screen) => void): void {}

export function Home(_props: { entry?: PlayerEntry }) {
  return null;
}

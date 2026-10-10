import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { PieceColor } from "game/engine/game-state";
import type { BookLookup } from "game/opponent/book";
import { STRENGTH_STEPS, type StrengthStep } from "game/opponent/strength";

export type Mode = "two-player" | "liem";
export type ColorPick = "white" | "black" | "random";
export type OpponentStatus = "idle" | "loading" | "thinking" | "failed";

/** His last move and how he chose it, for the book note. */
export interface LastChoice {
  gameId: number;
  ply: number;
  uci: string;
  source: "book" | "engine";
  lookup: BookLookup | null;
}

export interface MatchState {
  mode: Mode;
  /** The setup card is showing (vs-Liem only); no game runs while it is open. */
  setupOpen: boolean;
  colorPick: ColorPick;
  strength: StrengthStep;
  lastChoice: LastChoice | null;
  opponentStatus: OpponentStatus;
}

const initialState: MatchState = {
  mode: "two-player",
  setupOpen: false,
  colorPick: "white",
  strength: 2100,
  lastChoice: null,
  opponentStatus: "idle",
};

function isStrengthStep(value: unknown): value is StrengthStep {
  return (STRENGTH_STEPS as readonly unknown[]).includes(value);
}

export const matchSlice = createSlice({
  name: "match",
  initialState,
  reducers: {
    /** The same mode keeps the state as is. Liem opens the setup card; two players closes it. */
    setMode: (state, action: PayloadAction<Mode>) => {
      if (state.mode === action.payload) return;
      state.mode = action.payload;
      state.setupOpen = action.payload === "liem";
      state.lastChoice = null;
      state.opponentStatus = "idle";
    },
    openSetup: (state) => {
      if (state.mode !== "liem") return;
      state.setupOpen = true;
    },
    setColorPick: (state, action: PayloadAction<ColorPick>) => {
      if (!state.setupOpen) return;
      state.colorPick = action.payload;
    },
    /** Ignores anything not in `STRENGTH_STEPS`. */
    setStrength: (state, action: PayloadAction<StrengthStep>) => {
      if (!state.setupOpen || !isStrengthStep(action.payload)) return;
      state.strength = action.payload;
    },
    gameStarted: (state) => {
      if (state.mode !== "liem") return;
      state.setupOpen = false;
      state.lastChoice = null;
      state.opponentStatus = "idle";
    },
    /** Ignored outside vs-Liem, so a late answer never shows in two-player mode. */
    opponentMoved: (state, action: PayloadAction<LastChoice>) => {
      if (state.mode !== "liem") return;
      // A new object, not a draft write: the book's move tuples are readonly.
      return { ...state, lastChoice: action.payload };
    },
    setOpponentStatus: (state, action: PayloadAction<OpponentStatus>) => {
      state.opponentStatus = action.payload;
    },
  },
});

export const { setMode, openSetup, setColorPick, setStrength, gameStarted, opponentMoved, setOpponentStatus } =
  matchSlice.actions;

/** The human's color for a pick: `random() < 0.5` is white, else black. */
export function resolveColor(pick: ColorPick, random: () => number = Math.random): PieceColor {
  if (pick !== "random") return pick;
  return random() < 0.5 ? "white" : "black";
}

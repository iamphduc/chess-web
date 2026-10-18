import { LIEM } from "game/opponent/players";
import type { StrengthStep } from "game/opponent/strength";
import type { PlayerEntry } from "game/opponent/types";

/** Every text the app shows for a strength step. Stub: filled in by the next commit. */
export interface LevelView {
  sparring: boolean;
  name: string;
  title: string | null;
  star: boolean;
  glyph: string | null;
  avatar: string | null;
  detail: string;
  shortDetail: string;
  detailLead: string;
  value: string;
  valueLead: string | null;
  valueMain: string;
  stepLabel: string;
  engineLine: string;
  outText: string;
}

export function levelView(_step: StrengthStep, _entry: PlayerEntry = LIEM.entry): LevelView {
  return {
    sparring: false,
    name: "",
    title: null,
    star: false,
    glyph: null,
    avatar: null,
    detail: "",
    shortDetail: "",
    detailLead: "",
    value: "",
    valueLead: null,
    valueMain: "",
    stepLabel: "",
    engineLine: "",
    outText: "",
  };
}

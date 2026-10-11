// Relative imports only: the Node import script (run with tsx) loads this folder.
// No book JSON here: the app loads the books on demand (load-books.ts).
import type { PlayerEntry } from "../types";
import liemEntry from "./le-quang-liem/player.json";

/** A player the app can play against. */
export interface Player {
  entry: PlayerEntry;
}

export const LIEM: Player = { entry: liemEntry };

export const PLAYERS: readonly Player[] = [LIEM];

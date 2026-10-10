import type { BookName, GameSource } from "../../src/game/opponent/types";
import type { PieceColor } from "../../src/game/engine/game-state";

export interface PlayerIdentity {
  fideId: number;
  aliases: string[];
  accounts: { lichess: string | null; chesscom: string };
}
export interface PgnFile {
  source: GameSource;
  text: string;
}
export type SkipReason =
  | "variant"
  | "setup"
  | "unfinished"
  | "not-player"
  | "no-clock"
  | "daily"
  | "duplicate";
export interface ImportedGame {
  source: GameSource;
  book: BookName;
  color: PieceColor;
  result: "win" | "draw" | "loss";
  moves: string[];
}
export interface GamesSummary {
  read: number;
  kept: Record<GameSource, number>;
  skipped: Record<SkipReason, number>;
  dropped: number;
}

export function splitPgn(_text: string): string[] {
  return [];
}

export function selectGames(
  _files: PgnFile[],
  _who: PlayerIdentity
): { games: ImportedGame[]; summary: GamesSummary } {
  return {
    games: [],
    summary: {
      read: 0,
      kept: { otb: 0, lichess: 0, chesscom: 0 },
      skipped: {
        variant: 0,
        setup: 0,
        unfinished: 0,
        "not-player": 0,
        "no-clock": 0,
        daily: 0,
        duplicate: 0,
      },
      dropped: 0,
    },
  };
}

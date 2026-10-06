/** The kinds of move sound, one per file in `public/sounds/`. */
export type SoundKind = "game-end" | "check" | "promote" | "castle" | "capture" | "move";

/** The sound of the last completed ply. A new object per ply, so a repeated kind plays again. */
export interface MoveSound {
  kind: SoundKind;
}

/** What a ply did, as `pickSound` reads it. */
export interface PlyFlags {
  /** The position after the ply is checkmate or stalemate. */
  gameEnd: boolean;
  /** The side to move after the ply is in check. */
  check: boolean;
  promotion: boolean;
  castle: boolean;
  /** En passant counts as a capture. */
  capture: boolean;
}

/** The file in `public/sounds/` for each kind. See `public/sounds/CREDITS.md`. */
export const SOUND_FILES: Record<SoundKind, string> = {
  "game-end": "game-end.wav",
  check: "check.wav",
  promote: "promote.wav",
  castle: "castle.wav",
  capture: "capture.wav",
  move: "move.wav",
};

/** The first true flag in the order game end > check > promotion > castle > capture, else "move". */
export function pickSound({ gameEnd, check, promotion, castle, capture }: PlyFlags): SoundKind {
  if (gameEnd) return "game-end";
  if (check) return "check";
  if (promotion) return "promote";
  if (castle) return "castle";
  if (capture) return "capture";
  return "move";
}

/**
 * The kind to play when the stored sound changes from `prev` to `next`: only a new
 * (by reference) non-null sound, and only with sound on.
 */
export function soundToPlay(
  prev: MoveSound | null,
  next: MoveSound | null,
  soundOn: boolean
): SoundKind | null {
  if (next === null || next === prev || !soundOn) return null;
  return next.kind;
}

// Stub: the tests are written first; the values land in the next commit.
export const PIECE_MOVE_TRANSITION = {} as { type: "tween"; ease: "easeOut"; duration: number };
export const SNAP_TRANSITION = {} as { duration: number };

export interface ReviewStep {
  gameId: number;
  ply: number;
  flipped: boolean;
  size: number;
}

export type ReviewStepMotion = "slide" | "snap";

export function reviewStepMotion(_prev: ReviewStep | null, _next: ReviewStep): ReviewStepMotion {
  return "unset" as ReviewStepMotion;
}

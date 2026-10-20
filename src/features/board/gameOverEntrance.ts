// Stub so the tests fail on their assertions; the real module follows.
export type Entrance = "animate" | "instant";
export const ENTRANCE = {} as Record<string, unknown> as {
  pauseMs: number;
  scrimMs: number;
  cardMs: number;
  risePx: number;
  scaleFrom: number;
  ease: string;
};
export const ENTRANCE_TOTAL_MS = 0;
export function gameOverEntrance(_reduced: boolean, _first: number | null, _now: number): Entrance {
  return "instant";
}
export function firstShownAt(_key: object, _now: number): number | null {
  return -1;
}

export type ClockClass = "slow" | "online" | "unknown" | "daily";
export const SLOW_SECONDS = 0;
export function clockEstimate(_tc: string | undefined): number | null {
  return -1;
}
export function clockClass(_tc: string | undefined): ClockClass {
  return "online";
}

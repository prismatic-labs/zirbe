/** Page motion. Components read these so they never contain a duration of their own. */
export function motionMs(reduced: boolean): number {
  if (reduced) return 0;
  return 700;
}

export function playMs(reduced: boolean): number {
  if (reduced) return 1100;
  return 900;
}
